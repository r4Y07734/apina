import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { allowedOrigin, playerName, CardRoom } from '../worker.js';

test('only exact configured browser origins receive access', () => {
  const env = { ALLOWED_ORIGINS: 'https://apina.example,http://localhost:8000' };
  assert.equal(allowedOrigin('https://apina.example', env), true);
  assert.equal(allowedOrigin('https://apina.example.attacker.test', env), false);
  assert.equal(allowedOrigin('null', env), false);
  assert.equal(allowedOrigin(null, env), true);
});

test('names have clear bounds and reject controls', () => {
  assert.equal(playerName({ name: '  Aino  ' }), 'Aino');
  assert.throws(() => playerName({ name: '' }));
  assert.throws(() => playerName({ name: 'x'.repeat(25) }));
  assert.throws(() => playerName({ name: 'A\nB' }));
  assert.throws(() => playerName({ name: 1 }));
});

test('invalid browser origin and invalid input never allocate a room', async () => {
  const env = { ALLOWED_ORIGINS: 'http://localhost:8000', ROOMS: { idFromName() { throw new Error('Must not allocate'); } } };
  const response = await worker.fetch(new Request('https://server.example/rooms', {
    method: 'POST', headers: { Origin: 'https://attacker.test', 'Content-Type': 'application/json' }, body: '{"name":"Test"}',
  }), env);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  const invalid = await worker.fetch(new Request('https://server.example/rooms', {
    method: 'POST', headers: { Origin: 'http://localhost:8000', 'Content-Type': 'application/json' }, body: '{"name":""}',
  }), env);
  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8000');
});

test('large request bodies are rejected before room allocation', async () => {
  const response = await worker.fetch(new Request('https://server.example/rooms', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'A', data: 'x'.repeat(2_000) }),
  }), { ALLOWED_ORIGINS: '' });
  assert.equal(response.status, 413);
});

function mockContext() {
  const storage = new Map();
  let alarm = null;
  return {
    storage: {
      async get(key) { return structuredClone(storage.get(key)); },
      async put(key, value) { storage.set(key, structuredClone(value)); },
      async setAlarm(time) { alarm = time; },
      async deleteAlarm() { alarm = null; },
      async deleteAll() { storage.clear(); },
    },
    blockConcurrencyWhile(fn) { return fn(); },
    getWebSockets() { return []; },
    stored() { return storage.get('room'); },
    alarmTime() { return alarm; },
  };
}

async function startedRoom() {
  const ctx = mockContext();
  const room = new CardRoom(ctx, {});
  await Promise.resolve();
  const create = await room.fetch(new Request('https://room.internal/create', {
    method: 'POST', body: JSON.stringify({ name: 'Aino', room: 'ABCDEF' }),
  }));
  assert.equal(create.status, 201);
  assert.equal(ctx.stored().game, null);
  assert.ok(ctx.alarmTime() <= Date.now() + 30 * 60_000);
  const join = await room.fetch(new Request('https://room.internal/join', {
    method: 'POST', body: JSON.stringify({ name: 'Elias' }),
  }));
  assert.equal(join.status, 201);
  return { room, ctx };
}

test('a room stores authoritative cards and private views only contain own hand', async () => {
  const { room, ctx } = await startedRoom();
  assert.equal(ctx.stored().cards.length, 50);
  const first = room.snapshot(0);
  const second = room.snapshot(1);
  assert.equal(first.state.you, 0);
  assert.equal(second.state.you, 1);
  assert.deepEqual(first.state.hand, room.room.game.players[0].hand);
  assert.deepEqual(second.state.hand, room.room.game.players[1].hand);
  for (const view of [first.state, second.state]) {
    assert.equal(view.players[0].hand, undefined);
    assert.equal(view.players[1].deck, undefined);
    assert.equal(view.players[1].discard, undefined);
    assert.equal(view.tokens, undefined);
  }
});

test('stale turns forfeit and schedule short finished retention', async () => {
  const { room, ctx } = await startedRoom();
  room.room.disconnectedAt = [null, null];
  room.room.turnDeadline = Date.now() - 1;
  await room.enforceLimits();
  assert.equal(room.room.game.status, 'finished');
  assert.equal(room.room.game.winner, 1);
  assert.match(room.room.notice, /turn time/);
  assert.ok(ctx.alarmTime() <= Date.now() + 10 * 60_000);
});

test('disconnect grace forfeits and expired rooms erase stored data', async () => {
  const { room, ctx } = await startedRoom();
  room.room.disconnectedAt = [null, Date.now() - 90_001];
  await room.enforceLimits();
  assert.equal(room.room.game.status, 'finished');
  assert.equal(room.room.game.winner, 0);
  assert.match(room.room.notice, /90 seconds/);
  room.room.expiresAt = Date.now() - 1;
  await room.alarm();
  assert.equal(room.room, null);
  assert.equal(ctx.stored(), undefined);
  assert.equal(ctx.alarmTime(), null);
});
