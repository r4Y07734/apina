import rawCards from '../../dist/card-pvp/cards.json' with { type: 'json' };
import { createGame, applyAction, viewFor, validateCards, normalizeCards } from '../../dist/card-pvp/rules.js';

const cards = normalizeCards(rawCards);
const RULES_VERSION = 4;

const ROOM_CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const ROOM_TOKEN = /^[a-f0-9]{64}$/;
const WAIT_MS = 30 * 60_000;
const MAX_ROOM_MS = 24 * 60 * 60_000;
const FINISHED_MS = 10 * 60_000;
const TURN_MS = 30_000;
const DISCONNECT_MS = 90_000;
const MAX_JSON_BYTES = 1_024;

class ClientError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

function randomHex(bytes = 32) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}

function randomRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), byte => alphabet[byte % alphabet.length]).join('');
}

export function allowedOrigin(origin, env) {
  if (!origin) return true; // Non-browser clients have no Origin header and get no CORS grant.
  return (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean).includes(origin);
}

export function playerName(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.name !== 'string') {
    throw new ClientError('Enter a player name.');
  }
  const name = body.name.trim().normalize('NFC');
  if (!name || [...name].length > 24 || /[\u0000-\u001f\u007f-\u009f]/u.test(name)) {
    throw new ClientError('Use a name with 1–24 characters, without control characters.');
  }
  return name;
}

async function readJson(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    throw new ClientError('Send JSON using Content-Type: application/json.', 415);
  }
  // Read with a byte cap rather than buffering an arbitrarily large request first.
  const reader = request.body?.getReader();
  if (!reader) throw new ClientError('A JSON request body is required.');
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_JSON_BYTES) {
        await reader.cancel();
        throw new ClientError('Request body is too large.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new ClientError('The JSON body is invalid.'); }
}

function cors(response, origin) {
  if (response.status === 101 || !origin) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (!allowedOrigin(origin, env)) return json({ error: 'This website is not allowed to connect to the game server.' }, 403);
    let response;
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const roomPath = path.match(/^\/rooms\/([^/]+)\/(join|socket)$/);
      if (request.method === 'OPTIONS') {
        if (path !== '/rooms' && !roomPath) throw new ClientError('Not found.', 404);
        response = new Response(null, { status: 204, headers: {
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '600',
        } });
      } else if (path === '/health' && request.method === 'GET') {
        response = json({ ok: true, service: 'apina-card-pvp' });
      } else if (path === '/rooms') {
        if (request.method !== 'POST') throw new ClientError('Use POST to create a room.', 405);
        const name = playerName(await readJson(request));
        for (let attempt = 0; attempt < 5; attempt++) {
          const room = randomRoomCode();
          const stub = env.ROOMS.get(env.ROOMS.idFromName(room));
          response = await stub.fetch(new Request('https://room.internal/create', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, room }),
          }));
          if (response.status !== 409) break;
        }
      } else if (roomPath) {
        const room = roomPath[1].toUpperCase();
        if (!ROOM_CODE.test(room)) throw new ClientError('Room codes use six letters or numbers.');
        const operation = roomPath[2];
        const stub = env.ROOMS.get(env.ROOMS.idFromName(room));
        if (operation === 'join') {
          if (request.method !== 'POST') throw new ClientError('Use POST to join a room.', 405);
          const name = playerName(await readJson(request));
          response = await stub.fetch(new Request('https://room.internal/join', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
          }));
        } else {
          if (request.method !== 'GET') throw new ClientError('Use GET to connect.', 405);
          if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') throw new ClientError('A WebSocket connection is required.', 426);
          const token = url.searchParams.get('token');
          if (!ROOM_TOKEN.test(token || '')) throw new ClientError('Invalid reconnect token.', 401);
          response = await stub.fetch(new Request(`https://room.internal/socket?token=${token}`, request));
        }
      } else {
        throw new ClientError('Not found.', 404);
      }
    } catch (error) {
      if (error instanceof ClientError) response = json({ error: error.message }, error.status);
      else {
        // Avoid logging URLs: reconnect tokens are query parameters.
        console.error('Game server request failed.', error?.name || 'Error');
        response = json({ error: 'The game server could not complete this request. Try again.' }, 500);
      }
    }
    return cors(response, origin);
  },
};

export class CardRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.room = null;
    ctx.blockConcurrencyWhile(async () => { this.room = await ctx.storage.get('room') || null; });
  }

  sockets(actor) {
    return this.ctx.getWebSockets().filter(socket => {
      const attachment = socket.deserializeAttachment();
      return attachment && !attachment.replaced && (actor === undefined || attachment.actor === actor);
    });
  }

  connected() { return [this.sockets(0).length > 0, this.sockets(1).length > 0]; }

  send(socket, payload) {
    try { socket.send(JSON.stringify(payload)); } catch { /* close handler records disconnect */ }
  }

  snapshot(actor) {
    const shared = { room: this.room.code, connected: this.connected(), deadline: this.room.turnDeadline || null };
    if (!this.room.game) return { type: 'waiting', ...shared };
    return { type: 'state', state: viewFor(this.room.game, actor), ...shared, notice: this.room.notice || null };
  }

  broadcast() {
    if (!this.room) return;
    for (const socket of this.sockets()) this.send(socket, this.snapshot(socket.deserializeAttachment().actor));
  }

  async save() {
    await this.ctx.storage.put('room', this.room);
    await this.scheduleAlarm();
  }

  async scheduleAlarm() {
    if (!this.room) return;
    const times = [this.room.expiresAt];
    if (this.room.game?.status === 'playing') {
      times.push(this.room.turnDeadline);
      this.room.disconnectedAt.forEach(time => { if (time !== null) times.push(time + DISCONNECT_MS); });
    }
    await this.ctx.storage.setAlarm(Math.max(Date.now() + 1, Math.min(...times)));
  }

  async expire(message = 'This room has expired. Create a new room to play again.') {
    for (const socket of this.sockets()) {
      this.send(socket, { type: 'error', error: message });
      socket.close(4002, 'Room expired');
    }
    this.room = null;
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
  }

  async enforceLimits() {
    if (!this.room) return;
    if (this.room.rulesVersion !== RULES_VERSION) { await this.expire('The game rules have been updated. Create a new room to play.'); return; }
    // Add inactive reserved slots to older rooms while preserving their active catalog and match.
    if(this.room.cards.length===50 && cards.length===75){this.room.cards=this.room.cards.concat(cards.slice(50));await this.save();}
    const now = Date.now();
    if (now >= this.room.expiresAt) { await this.expire(); return; }
    if (this.room.game?.status !== 'playing') return;
    const game = this.room.game;
    const absent = this.room.disconnectedAt.map((time, actor) => time !== null && now - time >= DISCONNECT_MS ? actor : null).filter(actor => actor !== null);
    let loser = null;
    if (absent.length) {
      loser = absent.length === 2 ? game.turn : absent[0];
      this.room.notice = `${game.players[loser].name} did not reconnect within 90 seconds.`;
    } else if (now >= this.room.turnDeadline) {
      const actor = game.turn;
      applyAction(game, actor, { type: 'end' }, this.room.cards);
      this.room.notice = `${game.players[actor].name}'s time ran out. Turn ended automatically.`;
      if(game.status === 'finished') {
        this.room.turnDeadline = null;
        this.room.expiresAt = Math.min(this.room.expiresAt,now + FINISHED_MS);
      } else this.room.turnDeadline = now + TURN_MS;
      await this.save();
      this.broadcast();
      return;
    }
    if (loser !== null) {
      applyAction(game, loser, { type: 'concede' }, this.room.cards);
      this.room.turnDeadline = null;
      this.room.expiresAt = Math.min(this.room.expiresAt, now + FINISHED_MS);
      await this.save();
      this.broadcast();
    }
  }

  async fetch(request) {
    await this.enforceLimits();
    const url = new URL(request.url);
    if (url.pathname === '/create') {
      if (this.room) return json({ error: 'Room code is already in use.' }, 409);
      const { name, room } = await request.json();
      validateCards(cards);
      const token = randomHex();
      this.room = {
        rulesVersion: RULES_VERSION, code: room, names: [name, null], tokens: [token, null], game: null, cards,
        createdAt: Date.now(), expiresAt: Date.now() + WAIT_MS,
        disconnectedAt: [null, null], turnDeadline: null, notice: null,
      };
      await this.save();
      return json({ room, token }, 201);
    }
    if (!this.room) return json({ error: 'Room not found or expired. Check the code or create a new room.' }, 404);
    if (url.pathname === '/join') {
      if (this.room.tokens[1]) return json({ error: 'This room already has two players.' }, 409);
      const { name } = await request.json();
      const token = randomHex();
      this.room.names[1] = name;
      this.room.tokens[1] = token;
      this.room.game = createGame(this.room.cards, { names: this.room.names, startingPlayer: crypto.getRandomValues(new Uint8Array(1))[0] & 1 });
      const now = Date.now();
      this.room.turnDeadline = now + TURN_MS;
      this.room.expiresAt = this.room.createdAt + MAX_ROOM_MS;
      this.room.disconnectedAt = this.connected().map(connected => connected ? null : now);
      await this.save();
      this.broadcast();
      return json({ room: this.room.code, token }, 201);
    }
    if (url.pathname === '/socket') {
      const token = url.searchParams.get('token');
      const actor = this.room.tokens.indexOf(token);
      if (actor === -1 || !token) return json({ error: 'Invalid reconnect token.' }, 401);
      // One live socket per player; reconnect replaces an old tab/device connection.
      for (const oldSocket of this.sockets(actor)) {
        const attachment = oldSocket.deserializeAttachment();
        attachment.replaced = true;
        oldSocket.serializeAttachment(attachment);
        oldSocket.close(4001, 'Reconnected from another tab');
      }
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ actor, rateStart: Date.now(), rateCount: 0, replaced: false });
      this.room.disconnectedAt[actor] = null;
      await this.save();
      this.broadcast();
      return new Response(null, { status: 101, webSocket: client });
    }
    return json({ error: 'Not found.' }, 404);
  }

  async webSocketMessage(socket, message) {
    await this.enforceLimits();
    const attachment = socket.deserializeAttachment();
    if (!this.room || !attachment || attachment.replaced) return;
    const fail = error => this.send(socket, { type: 'error', error });
    if (typeof message !== 'string' || new TextEncoder().encode(message).length > MAX_JSON_BYTES) {
      fail('Send a small JSON action.'); return;
    }
    const now = Date.now();
    if (now - attachment.rateStart >= 5_000) { attachment.rateStart = now; attachment.rateCount = 0; }
    attachment.rateCount++;
    socket.serializeAttachment(attachment);
    if (attachment.rateCount > 15) { fail('Too many actions. Wait a moment before trying again.'); return; }
    let action;
    try { action = JSON.parse(message); } catch { fail('The action is not valid JSON.'); return; }
    if (!action || typeof action !== 'object' || Array.isArray(action) || !['play', 'end', 'concede'].includes(action.type)) {
      fail('Unknown action.'); return;
    }
    if (action.type === 'play' && (typeof action.cardId !== 'string' || action.cardId.length > 64)) {
      fail('Choose a card from your hand.'); return;
    }
    if (!this.room.game) { fail('Wait for your opponent to join.'); return; }
    const previousTurn = this.room.game.turn;
    const result = applyAction(this.room.game, attachment.actor, action, this.room.cards);
    if (!result.ok) { fail(result.error); return; }
    this.room.notice = null;
    if (this.room.game.status === 'finished') {
      this.room.turnDeadline = null;
      this.room.expiresAt = Math.min(this.room.expiresAt, now + FINISHED_MS);
    } else if (previousTurn !== this.room.game.turn) {
      this.room.turnDeadline = now + TURN_MS;
    }
    await this.save();
    this.broadcast();
  }

  async recordDisconnect(socket) {
    const attachment = socket.deserializeAttachment();
    if (!this.room || !attachment || attachment.replaced) return;
    attachment.replaced = true;
    socket.serializeAttachment(attachment);
    if (!this.sockets(attachment.actor).length) this.room.disconnectedAt[attachment.actor] = Date.now();
    await this.save();
    this.broadcast();
  }

  async webSocketClose(socket, code) {
    await this.recordDisconnect(socket);
    const validCode = (code >= 1000 && code <= 1014 && ![1004, 1005, 1006].includes(code)) || (code >= 3000 && code <= 4999);
    socket.close(validCode ? code : 1000, 'Connection closed');
  }

  async webSocketError(socket) { await this.recordDisconnect(socket); }

  async alarm() {
    await this.enforceLimits();
    if (this.room) await this.scheduleAlarm();
  }
}
