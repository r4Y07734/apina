// Run after `npm run dev`. This exercises the real local Worker runtime.
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import cards from '../../../dist/card-pvp/cards.json' with { type: 'json' };

const base = process.env.CARD_PVP_SERVER || 'http://127.0.0.1:8787';
const origin = 'http://127.0.0.1:8000';
const sockets = [];

async function post(path, body, requestOrigin = origin) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: requestOrigin }, body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function connect(room, token) {
  const socket = new WebSocket(`${base.replace(/^http/, 'ws')}/rooms/${room}/socket?token=${token}`, { origin });
  const messages = [];
  socket.on('message', data => messages.push(JSON.parse(data.toString())));
  sockets.push(socket);
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  return { socket, messages };
}

async function waitFor(client, predicate) {
  const stop = Date.now() + 5_000;
  while (Date.now() < stop) {
    const message = client.messages.find(predicate);
    if (message) return message;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail(`No expected message: ${JSON.stringify(client.messages)}`);
}

async function rejectedConnection(room, token, requestOrigin = origin) {
  const socket = new WebSocket(`${base.replace(/^http/, 'ws')}/rooms/${room}/socket?token=${token}`, { origin: requestOrigin });
  return new Promise((resolve, reject) => {
    socket.once('unexpected-response', (request, response) => {
      response.resume();
      request.destroy();
      resolve(response.statusCode);
    });
    socket.once('error', reject);
    socket.once('open', () => { socket.close(); reject(new Error('Invalid credentials were accepted')); });
  });
}

try {
  assert.equal((await fetch(`${base}/health`)).status, 200);
  assert.equal((await post('/rooms', { name: 'Blocked' }, 'https://attacker.example')).status, 403);
  const host = await post('/rooms', { name: 'Aino' });
  assert.equal(host.status, 201);
  assert.match(host.body.room, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  assert.match(host.body.token, /^[a-f0-9]{64}$/);
  assert.equal(await rejectedConnection(host.body.room, '0'.repeat(64)), 401);
  assert.equal(await rejectedConnection(host.body.room, host.body.token, 'https://attacker.example'), 403);
  const a = await connect(host.body.room, host.body.token);
  const waiting = await waitFor(a, message => message.type === 'waiting');
  assert.deepEqual(waiting.connected, [true, false]);
  assert.equal(waiting.state, undefined);
  const guest = await post(`/rooms/${host.body.room}/join`, { name: 'Elias' });
  assert.equal(guest.status, 201);
  assert.notEqual(guest.body.token, host.body.token);
  const b = await connect(host.body.room, guest.body.token);
  const initialA = await waitFor(a, message => message.type === 'state' && message.connected.every(Boolean));
  const initialB = await waitFor(b, message => message.type === 'state');
  assert.equal(initialA.state.you, 0);
  assert.equal(initialB.state.you, 1);
  assert.equal(initialA.state.hand.length, 5);
  assert.equal(initialB.state.hand.length, 5);
  for (const packet of [initialA, initialB]) {
    assert.equal(packet.state.players[0].hand, undefined);
    assert.equal(packet.state.players[1].hand, undefined);
    assert.equal(packet.state.players[0].deck, undefined);
    assert.equal(packet.state.tokens, undefined);
    assert.ok(packet.deadline > Date.now());
  }
  assert.equal((await post(`/rooms/${host.body.room}/join`, { name: 'Third' })).status, 409);
  b.socket.send(JSON.stringify({ type: 'end' }));
  await waitFor(b, message => message.type === 'error');
  a.socket.send(JSON.stringify({ type: 'play', cardId: 'not-in-deck', damage: 9999 }));
  await waitFor(a, message => message.type === 'error');
  a.socket.send(JSON.stringify({ type: 'end' }));
  const afterTurn = await waitFor(b, message => message.type === 'state' && message.state.turn === 1);
  assert.equal(afterTurn.state.players[0].health, initialB.state.players[0].health);
  const playable = afterTurn.state.hand.find(id => cards.find(card => card.id === id).cost <= afterTurn.state.players[1].energy);
  assert.ok(playable, 'The second player has an affordable card');
  b.socket.send(JSON.stringify({ type: 'play', cardId: playable }));
  const afterPlay = await waitFor(b, message => message.type === 'state' && message.state.revision === afterTurn.state.revision + 1);
  assert.equal(afterPlay.state.hand.includes(playable), false);
  assert.equal(afterPlay.state.lastEvent.cardId, playable);
  assert.equal(afterPlay.state.turn, 1);
  const close = new Promise(resolve => a.socket.once('close', resolve));
  a.socket.close();
  await close;
  await waitFor(b, message => message.type === 'state' && message.connected[0] === false);
  const reconnected = await connect(host.body.room, host.body.token);
  const restored = await waitFor(reconnected, message => message.type === 'state');
  assert.equal(restored.state.you, 0);
  assert.equal(restored.state.turn, 1);
  assert.equal(restored.state.revision, afterPlay.state.revision);
  assert.deepEqual(restored.state.hand, initialA.state.hand);
  const replaced = new Promise(resolve => reconnected.socket.once('close', (code) => resolve(code)));
  const replacement = await connect(host.body.room, host.body.token);
  assert.equal(await replaced, 4001);
  await waitFor(replacement, message => message.type === 'state');
  b.socket.send(JSON.stringify({ type: 'concede' }));
  const result = await waitFor(replacement, message => message.type === 'state' && message.state.status === 'finished');
  assert.equal(result.state.winner, 0);
  assert.equal(result.deadline, null);
  console.log('Worker integration passed: two players, origin and token checks, hand privacy, rejected actions, turn progression, authoritative card play, reconnect, socket replacement, and concession.');
} finally {
  for (const socket of sockets) if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
}
