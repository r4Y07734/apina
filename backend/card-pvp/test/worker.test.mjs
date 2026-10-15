import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { allowedOrigin, playerName, playerCharacter, CardRoom } from '../worker.js';
import { createGame, RULES } from '../../../dist/card-pvp/rules.js';

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

test('character requests accept only cosmetic IDs from the selection',()=>{
  assert.equal(playerCharacter({character:'monkey'}),'monkey');
  assert.equal(playerCharacter({}),'black-man');
  for(const id of ['__proto__','https://attacker.test/p.png','unknown',1,null])assert.throws(()=>playerCharacter({character:id}));
});

test('host and guest character choices survive room storage and both private views',async()=>{
  const ctx=mockContext(),room=new CardRoom(ctx,{});await Promise.resolve();
  await room.fetch(new Request('https://room.internal/create',{method:'POST',body:JSON.stringify({name:'Host',room:'ABCDEF',character:'monkey'})}));
  await room.fetch(new Request('https://room.internal/join',{method:'POST',body:JSON.stringify({name:'Guest',character:'indian'})}));
  assert.deepEqual(ctx.stored().characters,['monkey','indian']);
  for(const actor of [0,1])assert.deepEqual(room.snapshot(actor).state.players.map(p=>p.character),['monkey','indian']);
  const reloaded=new CardRoom(ctx,{});await Promise.resolve();
  assert.deepEqual(reloaded.snapshot(1).state.players.map(p=>p.character),['monkey','indian']);
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
  const invalidCharacter=await worker.fetch(new Request('https://server.example/rooms',{
    method:'POST',headers:{Origin:'http://localhost:8000','Content-Type':'application/json'},body:JSON.stringify({name:'Test',character:'unknown'}),
  }),env);
  assert.equal(invalidCharacter.status,400);
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
  assert.equal(ctx.stored().cards.length, 75);
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

test('expired turns switch players, preserve the match, and schedule the next deadline', async () => {
  const { room, ctx } = await startedRoom();
  const actor=room.room.game.turn;
  room.room.disconnectedAt = [null, null];
  room.room.turnDeadline = Date.now() - 1;
  const incoming=room.room.game.players[1-actor];
  incoming.discard.push(...incoming.hand.splice(1));
  const deckBefore=incoming.deck.length;
  await room.enforceLimits();
  assert.equal(incoming.deck.length,deckBefore-4);
  assert.equal(room.room.game.status, 'playing');
  assert.equal(room.room.game.winner, null);
  assert.equal(room.room.game.turn,1-actor);
  assert.equal(room.room.game.players[1-actor].energy,6);
  assert.equal(room.room.game.players[1-actor].hand.length,5);
  assert.match(room.room.notice, /ended automatically/);
  assert.ok(ctx.alarmTime() > Date.now());
  assert.ok(ctx.alarmTime() <= Date.now()+30_000);
  const revision=room.room.game.revision;
  await room.enforceLimits();
  assert.equal(room.room.game.revision,revision);
});

test('rooms from the old 50-card rules expire before dealing the expanded deck',async()=>{
  const {room,ctx}=await startedRoom();room.room.rulesVersion=4;
  await room.enforceLimits();assert.equal(room.room,null);assert.equal(ctx.stored(),undefined);
});

test('either multiplayer player can start according to the secure coin flip',async()=>{
  const original=crypto.getRandomValues.bind(crypto);
  for(const actor of [0,1]){
    const mocked=test.mock.method(crypto,'getRandomValues',array=>{if(array instanceof Uint8Array&&array.length===1){array[0]=actor;return array;}return original(array);});
    try{
      const {room}=await startedRoom();
      assert.equal(room.room.game.turn,actor);
      assert.equal(room.room.game.startingPlayer,actor);
      assert.equal(room.room.game.lastEvent.actor,actor);
      assert.equal(room.room.game.round,1);
    }finally{mocked.mock.restore();}
  }
});

test('automatic turn endings resolve poison and normal lethal damage',async()=>{
  const {room}=await startedRoom();
  const actor=room.room.game.turn, next=1-actor;
  room.room.disconnectedAt=[null,null];
  room.room.game.players[next].health=2;
  room.room.game.players[next].poison=[{amount:3,remaining:1}];
  room.room.turnDeadline=Date.now()-1;
  await room.enforceLimits();
  assert.equal(room.room.game.players[next].health,0);
  assert.equal(room.room.game.status,'finished');
  assert.equal(room.room.game.winner,actor);
  assert.equal(room.room.turnDeadline,null);
});

test('multiplayer deadlines allow 30 seconds and only reset when the turn changes', async () => {
  const before = Date.now();
  const { room, ctx } = await startedRoom();
  assert.ok(room.room.turnDeadline >= before + 30_000);
  assert.ok(room.room.turnDeadline <= Date.now() + 30_000);
  assert.equal(ctx.alarmTime(), room.room.turnDeadline);
  room.room.cards = Array.from({ length: RULES.catalogSize }, (_, i) => ({
    id: `test-${i}`, name: 'Test card', description: '', cost: 0, icon: 'heart', accent: 'heal',
    effects: [{ type: 'heal', target: 'self', amount: 1 }],
  }));
  room.room.game = createGame(room.room.cards);
  const socket = {
    deserializeAttachment() { return { actor: 0, rateStart: Date.now(), rateCount: 0, replaced: false }; },
    serializeAttachment() {},
  };
  const deadline = room.room.turnDeadline;
  await room.webSocketMessage(socket, JSON.stringify({ type: 'play', cardId: room.room.game.players[0].hand[0] }));
  assert.equal(room.room.turnDeadline, deadline);
  assert.equal(room.room.game.players[0].hand.length, 4);
  const nextTurn = Date.now();
  await room.webSocketMessage(socket, JSON.stringify({ type: 'end' }));
  assert.equal(room.room.game.turn, 1);
  assert.equal(room.room.game.players[1].hand.length, 5);
  assert.equal(room.room.game.players[1].deck.length, 70);
  assert.ok(room.room.turnDeadline >= nextTurn + 30_000);
  assert.ok(room.room.turnDeadline <= Date.now() + 30_000);
  assert.equal(ctx.alarmTime(), room.room.turnDeadline);
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

test('rooms created under old deck rules expire instead of dealing inactive cards', async () => {
  const {room, ctx} = await startedRoom();
  delete room.room.rulesVersion;
  await room.enforceLimits();
  assert.equal(room.room, null);
  assert.equal(ctx.stored(), undefined);
  assert.equal(ctx.alarmTime(), null);
});

async function rematchRoom(){
  const {room,ctx}=await startedRoom();
  const sockets=[0,1].map(actor=>({
    attachment:{actor,rateStart:Date.now(),rateCount:0,replaced:false},messages:[],
    deserializeAttachment(){return this.attachment;},serializeAttachment(value){this.attachment=value;},
    send(value){this.messages.push(JSON.parse(value));},
  }));
  ctx.getWebSockets=()=>sockets;
  room.room.disconnectedAt=[null,null];
  const send=(actor,action)=>room.webSocketMessage(sockets[actor],JSON.stringify(action));
  return {room,ctx,sockets,send};
}

test('rematches require a finished game and consent from both connected players',async()=>{
  const {room,ctx,sockets,send}=await rematchRoom();
  await send(0,{type:'rematch',matchId:1});
  assert.equal(sockets[0].messages.at(-1).type,'error');
  await send(1,{type:'concede'});
  const original=structuredClone(room.room.game),tokens=[...room.room.tokens];
  await send(0,{type:'rematch',matchId:1});
  await send(0,{type:'rematch',matchId:1});
  assert.deepEqual(room.room.game,original);
  assert.deepEqual(room.snapshot(1).rematch,[true,false]);
  const restored=new CardRoom(ctx,{});await Promise.resolve();
  assert.deepEqual(restored.snapshot(0).rematch,[true,false]);
  await send(1,{type:'rematch',matchId:1});
  assert.equal(room.room.game.status,'playing');
  assert.equal(room.snapshot(0).matchId,2);
  assert.deepEqual(room.snapshot(0).rematch,[false,false]);
  assert.deepEqual(room.room.tokens,tokens);
  assert.equal(room.room.code,'ABCDEF');
  assert.deepEqual(room.room.game.players.map(p=>p.name),['Aino','Elias']);
  for(const p of room.room.game.players){assert.equal(p.health,40);assert.equal(p.energy,3);assert.equal(p.hand.length,5);assert.deepEqual(p.poison,[]);}
  assert.deepEqual(room.snapshot(0).state.playedCards,[]);
  assert.ok(room.room.turnDeadline>Date.now());
  assert.equal(room.snapshot(0).state.players[1].hand,undefined);
  await send(0,{type:'concede',matchId:1});
  assert.equal(room.room.game.status,'playing');
  await send(1,{type:'concede',matchId:2});
  await send(0,{type:'rematch',matchId:1});
  assert.deepEqual(room.snapshot(0).rematch,[false,false]);
});

test('rematch waits for a disconnected opponent and preserves character choices',async()=>{
  const {room,ctx,sockets,send}=await rematchRoom();
  room.room.game.players[0].character='monkey';room.room.game.players[1].character='indian';
  await send(1,{type:'concede'});
  ctx.getWebSockets=()=>[sockets[0]];
  await send(0,{type:'rematch',matchId:1});
  assert.deepEqual(room.snapshot(0).rematch,[false,false]);
  ctx.getWebSockets=()=>sockets;
  await send(0,{type:'rematch',matchId:1});await send(1,{type:'rematch',matchId:1});
  assert.deepEqual(room.snapshot(0).state.players.map(p=>p.character),['monkey','indian']);
});
