// Shared by the browser bot game and the authoritative multiplayer server.
// Keep this module free of browser APIs so the same rules run in both places.
import { DEFAULT_CHARACTER, validCharacter } from './characters.js';
export const RULES = Object.freeze({
  health: 40,
  initialEnergy: 3,
  maxEnergy: 10,
  energyPerTurn: 3,
  initialHand: 5,
  maxHand: 5,
  catalogSize: 75,
  activeCards: 50,
});

const EFFECT_TYPES = new Set(['damage', 'heal', 'energy', 'steal', 'poison']);
const ACCENTS = new Set(['damage', 'heal', 'energy', 'poison', 'mixed']);
const LOG_LIMIT = 32;

function integer(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function validIcon(icon) {
  if (typeof icon !== 'string' || icon.length > 160) return false;
  if (/^[a-z][a-z0-9-]*$/.test(icon)) return true;
  return /^\/?(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.svg$/.test(icon);
}

// Accept common presentation aliases without rewriting the user's JSON file.
export function normalizeCards(cards) {
  if (!Array.isArray(cards)) return cards;
  return cards.map(card => {
    if (!card || typeof card !== 'object' || Array.isArray(card)) return card;
    const aliases = { heart: 'heal', attack: 'damage' };
    return { ...card, accent: aliases[card.accent] || card.accent,
      effects: Array.isArray(card.effects) ? card.effects.map(effect => {
        if (!effect || typeof effect !== 'object') return effect;
        const amount = typeof effect.amount === 'string' && /^-?\d+$/.test(effect.amount)
          ? Number(effect.amount) : effect.amount;
        const chance = typeof effect.chance === 'string' && /^\d+(\.\d+)?$/.test(effect.chance) ? Number(effect.chance) : effect.chance;
        return { ...effect, amount, ...(chance !== undefined ? {chance} : {}) };
      }) : card.effects };
  });
}

/** Validate the editable catalog. No executable code or remote icon URLs. */
export function validateCards(cards) {
  if (!Array.isArray(cards) || cards.length !== RULES.catalogSize) {
    throw new Error(`The catalog must contain exactly ${RULES.catalogSize} card slots.`);
  }
  const ids = new Set();
  for (const [index, card] of cards.entries()) {
    const label = `Card slot ${index + 1}`;
    if (!card || typeof card !== 'object' || Array.isArray(card)) {
      throw new Error(`${label} must be an object.`);
    }
    if (typeof card.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(card.id) || ids.has(card.id)) {
      throw new Error(`${label} needs a unique, stable id.`);
    }
    ids.add(card.id);
    if (typeof card.name !== 'string' || !card.name.trim() || card.name.length > 80) {
      throw new Error(`${label} needs a name of 1–80 characters.`);
    }
    if (typeof card.description !== 'string' || card.description.length > 600) {
      throw new Error(`${label} needs a description of up to 600 characters.`);
    }
    if (!integer(card.cost, 0, RULES.maxEnergy)) {
      throw new Error(`${label} cost must be an integer from 0 to ${RULES.maxEnergy}.`);
    }
    if (!validIcon(card.icon)) {
      throw new Error(`${label} icon must be an icon name or a local SVG path.`);
    }
    if (!ACCENTS.has(card.accent)) {
      throw new Error(`${label} has an invalid accent.`);
    }
    if (!Array.isArray(card.effects) || card.effects.length < 1 || card.effects.length > 8) {
      throw new Error(`${label} needs between 1 and 8 effects.`);
    }
    for (const effect of card.effects) {
      if (!effect || !EFFECT_TYPES.has(effect.type) || !['self', 'opponent'].includes(effect.target)) {
        throw new Error(`${label} has an invalid effect type or target.`);
      }
      if (effect.chance !== undefined && (typeof effect.chance !== 'number' || !Number.isFinite(effect.chance) || effect.chance < 0 || effect.chance > 100)) {
        throw new Error(`${label} effect chance must be a percentage from 0 to 100.`);
      }
      const min = effect.type === 'energy' ? -100 : 1;
      if (!integer(effect.amount, min, 100) || effect.amount === 0) {
        throw new Error(`${label} effect amount must be a nonzero integer ${min}–100.`);
      }
      if (effect.type === 'poison' && !integer(effect.rounds, 1, 10)) {
        throw new Error(`${label} poison duration must be an integer from 1 to 10.`);
      }
    }
  }
  return true;
}

// Never use a small persisted seed: observing one's own cards must not make the
// opponent's hidden deck reproducible. Modern browsers and Workers provide this.
function secureRandom() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure randomness is unavailable. Use a modern browser or server runtime.');
  }
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}

function shuffle(cards, random = secureRandom) {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new Error('random must return a number from 0 (inclusive) to 1 (exclusive).');
    }
    const j = Math.floor(value * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function log(state, text, kind = 'turn', target) {
  const entry = { id: ++state.eventSequence, text, kind };
  if (target !== undefined) entry.target = target;
  state.log.push(entry);
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
  return entry.id;
}

function draw(state, actor) {
  const player = state.players[actor];
  // A full hand does not consume the next card from the deck.
  if (player.hand.length >= RULES.maxHand) return false;
  if (!player.deck.length && player.discard.length) {
    player.deck = shuffle(player.discard);
    player.discard = [];
  }
  if (!player.deck.length) return false;
  player.hand.push(player.deck.pop());
  return true;
}

function setWinner(state) {
  const defeated = state.players.map(player => player.health <= 0);
  if (!defeated[0] && !defeated[1]) return false;
  state.status = 'finished';
  state.winner = defeated[0] && defeated[1] ? 'draw' : defeated[0] ? 1 : 0;
  log(state, state.winner === 'draw' ? 'Both players fell. The match is a draw.' : `${state.players[state.winner].name} won the match.`, 'finish');
  return true;
}

function safeName(value, fallback) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 24) || fallback : fallback;
}

export function createGame(cards, { names = ['You', 'Bot'], random = secureRandom, startingPlayer = 0, characters = [DEFAULT_CHARACTER,DEFAULT_CHARACTER] } = {}) {
  validateCards(cards);
  if (typeof random !== 'function') throw new Error('random must be a function.');
  if (startingPlayer !== 0 && startingPlayer !== 1) throw new Error('Starting player must be 0 or 1.');
  const state = {
    status: 'playing',
    turn: startingPlayer,
    startingPlayer,
    round: 1,
    players: [],
    winner: null,
    log: [],
    playedCards: [],
    lastEvent: null,
    revision: 0,
    eventSequence: 0,
  };
  for (let actor = 0; actor < 2; actor += 1) {
    state.players.push({
      name: safeName(names?.[actor], actor === 0 ? 'You' : 'Bot'),
      character: validCharacter(characters?.[actor]) ? characters[actor] : DEFAULT_CHARACTER,
      health: RULES.health,
      maxHealth: RULES.health,
      energy: RULES.initialEnergy,
      maxEnergy: RULES.maxEnergy,
      poison: [],
      hand: [],
      deck: shuffle(cards.slice(0, RULES.activeCards).map(card => card.id), random),
      discard: [],
    });
    for (let count = 0; count < RULES.initialHand; count += 1) draw(state, actor);
  }
  const id = log(state, `${state.players[startingPlayer].name} takes the first turn.`, 'turn', startingPlayer);
  state.lastEvent = { id, kind: 'start', actor: startingPlayer, targets: [startingPlayer] };
  return state;
}

function applyEffect(state, actor, effect) {
  const target = effect.target === 'self' ? actor : 1 - actor;
  const player = state.players[target];
  const other = state.players[1 - target];
  if (effect.type === 'damage') {
    const amount = Math.min(player.health, effect.amount);
    player.health -= amount;
    return { target, text: `${player.name} took ${amount} damage.` };
  }
  if (effect.type === 'heal') {
    const amount = Math.min(player.maxHealth - player.health, effect.amount);
    player.health += amount;
    return { target, text: `${player.name} healed ${amount} health.` };
  }
  if (effect.type === 'energy') {
    const before = player.energy;
    player.energy = Math.max(0, Math.min(player.maxEnergy, before + effect.amount));
    const amount = player.energy - before;
    return { target, text: `${player.name} ${amount >= 0 ? 'gained' : 'lost'} ${Math.abs(amount)} energy.` };
  }
  if (effect.type === 'steal') {
    const amount = Math.min(effect.amount, player.energy, other.maxEnergy - other.energy);
    player.energy -= amount;
    other.energy += amount;
    return { target, targets: [target, 1 - target], text: `${other.name} stole ${amount} energy from ${player.name}.` };
  }
  player.poison.push({ amount: effect.amount, remaining: effect.rounds });
  return { target, text: `${player.name} was poisoned: ${effect.amount} damage for ${effect.rounds} of their turns.` };
}

function startTurn(state, actor) {
  const player = state.players[actor];
  state.turn = actor;
  if (actor === (state.startingPlayer ?? 0)) state.round += 1;
  const damage = player.poison.reduce((total, effect) => total + effect.amount, 0);
  if (damage) {
    player.health = Math.max(0, player.health - damage);
    log(state, `${player.name} took ${damage} poison damage.`, 'poison', actor);
    player.poison = player.poison
      .map(effect => ({ amount: effect.amount, remaining: effect.remaining - 1 }))
      .filter(effect => effect.remaining > 0);
    state.lastEvent.kind = 'poison';
  }
  if (setWinner(state)) return;
  const energyGained = Math.min(player.maxEnergy - player.energy, RULES.energyPerTurn);
  player.energy += energyGained;
  const drew = draw(state, actor);
  log(state, `${player.name}'s turn. +${energyGained} energy${drew ? ' · drew a card' : ''}.`, 'turn', actor);
}

/** Apply one authorized action. Invalid actions leave state byte-for-byte unchanged. */
export function applyAction(state, actor, action, cards, random = secureRandom) {
  const fail = error => ({ ok: false, error });
  if (actor !== 0 && actor !== 1) return fail('Unknown player.');
  if (!state || state.status !== 'playing') return fail('This match has finished.');
  if (!action || typeof action !== 'object' || Array.isArray(action) || !['play', 'end', 'concede'].includes(action.type)) {
    return fail('Unknown action.');
  }
  // Either player can concede at any time, including during the other turn.
  if (action.type === 'concede') {
    state.status = 'finished';
    state.winner = 1 - actor;
    const id = log(state, `${state.players[actor].name} conceded. ${state.players[1 - actor].name} wins.`, 'finish', actor);
    state.lastEvent = { id, kind: 'concede', actor, targets: [actor] };
    state.revision += 1;
    return { ok: true };
  }
  if (state.turn !== actor) return fail('Wait for your turn.');
  if (action.type === 'end') {
    const id = log(state, `${state.players[actor].name} ended their turn.`, 'turn', actor);
    state.lastEvent = { id, kind: 'turn', actor, targets: [1 - actor] };
    startTurn(state, 1 - actor);
    state.revision += 1;
    return { ok: true };
  }
  if (typeof action.cardId !== 'string') return fail('Choose a card from your hand.');
  const player = state.players[actor];
  const handIndex = player.hand.indexOf(action.cardId);
  if (handIndex === -1) return fail('That card is not in your hand.');
  let card;
  try {
    validateCards(cards);
    card = cards.find(entry => entry.id === action.cardId);
  } catch {
    return fail('The card catalog is invalid.');
  }
  if (!card || !cards.slice(0, RULES.activeCards).some(entry => entry.id === card.id)) return fail('That card is not active in this match.');
  if (player.energy < card.cost) return fail(`You need ${card.cost} energy to play this card.`);

  // Roll independently before mutating anything; multiplayer uses server-side secure randomness.
  const effectResults = card.effects.map(effect => {
    const chance = effect.chance ?? 100;
    if(chance === 100)return true;
    if(chance === 0)return false;
    const roll=random();
    if(typeof roll !== 'number' || !Number.isFinite(roll) || roll < 0 || roll >= 1)throw new Error('random must return a number from 0 (inclusive) to 1 (exclusive).');
    return roll < chance / 100;
  });
  player.energy -= card.cost;
  player.hand.splice(handIndex, 1);
  player.discard.push(card.id);
  const outcomes = card.effects.map((effect,index) => effectResults[index]
    ? applyEffect(state, actor, effect)
    : {targets:[],text:`${effect.type} effect did not trigger (${effect.chance}% chance).`});
  const targets = [...new Set(outcomes.flatMap(outcome => outcome.targets || [outcome.target]))];
  const id = log(state, `${player.name} played ${card.name}. ${outcomes.map(outcome => outcome.text).join(' ')}`, card.accent);
  state.lastEvent = { id, kind: 'play', actor, targets, cardId: card.id, effectResults };
  state.playedCards ||= [];
  state.playedCards.push({ id, actor, round: state.round, card: structuredClone(card), effectResults });
  if (state.playedCards.length > 20) state.playedCards.splice(0, state.playedCards.length - 20);
  setWinner(state);
  state.revision += 1;
  return { ok: true };
}

/** Deliberately omit both decks/discards and every opponent hand identity. */
export function viewFor(state, actor) {
  if (actor !== 0 && actor !== 1) throw new Error('Unknown player.');
  return {
    status: state.status,
    turn: state.turn,
    round: state.round,
    players: state.players.map(player => ({
      name: player.name,
      character: validCharacter(player.character) ? player.character : DEFAULT_CHARACTER,
      health: player.health,
      maxHealth: player.maxHealth,
      energy: player.energy,
      maxEnergy: player.maxEnergy,
      poison: player.poison.map(effect => ({ ...effect })),
      handCount: player.hand.length,
      deckCount: player.deck.length,
    })),
    hand: [...state.players[actor].hand],
    playedCards: structuredClone(state.playedCards || []),
    you: actor,
    winner: state.winner,
    log: state.log.map(entry => ({ ...entry })),
    lastEvent: state.lastEvent ? { ...state.lastEvent, targets: [...state.lastEvent.targets] } : null,
    revision: state.revision,
  };
}

function projectedPoison(player) {
  return player.poison.reduce((total, effect) => total + effect.amount * effect.remaining, 0);
}

/** Evaluate only the bot's own cards and public stats; never inspect the enemy hand. */
export function pickBotAction(state, actor, cards) {
  if (state.status !== 'playing' || state.turn !== actor || (actor !== 0 && actor !== 1)) return { type: 'end' };
  const own = state.players[actor];
  const opponent = state.players[1 - actor];
  let best = null;
  let bestScore = 0.15;
  for (const cardId of own.hand) {
    const card = cards.find(entry => entry.id === cardId);
    if (!card || card.cost > own.energy) continue;
    const simulated = structuredClone(state);
    // Approximate expected value without rolling hypothetical effects during bot selection.
    const expectedEffects = card.effects.filter(effect => (effect.chance ?? 100) > 0).map(effect => ({
      ...effect,
      amount: Math.sign(effect.amount) * Math.max(1, Math.round(Math.abs(effect.amount) * (effect.chance ?? 100) / 100)),
      chance: 100,
    }));
    if (!expectedEffects.length) continue;
    const expectedCards = cards.map(entry => entry === card ? {...entry, effects:expectedEffects} : entry);
    if (!applyAction(simulated, actor, { type: 'play', cardId }, expectedCards).ok) continue;
    const nextOwn = simulated.players[actor];
    const nextOpponent = simulated.players[1 - actor];
    let score =
      (nextOwn.health - own.health) * (own.health <= 12 ? 1.35 : 0.85) +
      (opponent.health - nextOpponent.health) * 1.1 +
      (nextOwn.energy - own.energy) * 0.55 +
      (opponent.energy - nextOpponent.energy) * 0.5 +
      (projectedPoison(nextOpponent) - projectedPoison(opponent)) * 0.72 -
      (projectedPoison(nextOwn) - projectedPoison(own)) * 0.9;
    if (simulated.winner === actor) score += 10000;
    if (simulated.winner === 1 - actor) score -= 10000;
    if (simulated.winner === 'draw') score += own.health <= 8 ? 100 : -100;
    if (score > bestScore) {
      bestScore = score;
      best = { type: 'play', cardId };
    }
  }
  return best || { type: 'end' };
}
