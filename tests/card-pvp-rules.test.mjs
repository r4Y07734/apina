import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RULES, validateCards, createGame, applyAction, viewFor, pickBotAction, normalizeCards } from '../dist/card-pvp/rules.js';

const shippedCards = normalizeCards(JSON.parse(await readFile(new URL('../dist/card-pvp/cards.json', import.meta.url), 'utf8')));
const cloneCards = () => structuredClone(shippedCards);
const makeGame = cards => {
  let seed = 123456789;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  return createGame(cards, { names: ['Alice', 'Bob'], random });
};

function fixture(effects, { cost = 0, actor = 0 } = {}) {
  const cards = cloneCards();
  cards[0] = { ...cards[0], effects, cost };
  const state = makeGame(cards);
  state.turn = actor;
  state.players[actor].hand = [cards[0].id];
  return { cards, state, cardId: cards[0].id };
}

function play({ state, cards, cardId }, actor = state.turn) {
  assert.deepEqual(applyAction(state, actor, { type: 'play', cardId }, cards), { ok: true });
}

function end(state, cards) {
  assert.deepEqual(applyAction(state, state.turn, { type: 'end' }, cards), { ok: true });
}

test('the editable catalog has exactly 75 unique slots with 50 active cards', () => {
  assert.equal(validateCards(shippedCards), true);
  assert.equal(shippedCards.length, 75);
  assert.ok(shippedCards.every(card => typeof card.name === 'string' && card.name.trim()));
  assert.equal(new Set(shippedCards.map(card => card.id)).size, 75);
});

test('catalog validation rejects malformed amounts, costs, targets, durations, and unsafe icons', () => {
  const invalidMutations = [
    cards => cards.pop(),
    cards => { cards[1].id = cards[0].id; },
    cards => { cards[0].cost = -1; },
    cards => { cards[0].cost = 11; },
    cards => { cards[0].effects[0].amount = 1.5; },
    cards => { cards[0].effects[0].amount = -5; },
    cards => { cards[0].effects[0].target = 'everyone'; },
    cards => { cards[0].effects = [{ type: 'poison', target: 'opponent', amount: 2, rounds: 0 }]; },
    cards => { cards[0].effects = []; },
    cards => { cards[0].icon = 'https://example.com/icon.svg'; },
    cards => { cards[0].icon = '../private.svg'; },
    cards => { cards[0].icon = 'javascript:alert(1)'; },
  ];
  for (const mutate of invalidMutations) {
    const cards = cloneCards();
    mutate(cards);
    assert.throws(() => validateCards(cards));
  }
  const cards = cloneCards();
  cards[0].icon = '/card-pvp/icons/custom.svg';
  cards[1].icon = 'icons/custom-card.svg';
  cards[2].effects = [{ type: 'energy', target: 'self', amount: -3 }];
  assert.equal(validateCards(cards), true);
});

test('a new game deals independently shuffled decks without duplicates and fixed initial resources', () => {
  const state = makeGame(shippedCards);
  assert.equal(state.turn, 0);
  assert.equal(state.round, 1);
  assert.equal(state.revision, 0);
  for (const player of state.players) {
    assert.equal(player.health, 40);
    assert.equal(player.energy, 3);
    assert.equal(player.hand.length, 5);
    assert.equal(player.deck.length, 45);
    assert.equal(new Set([...player.hand, ...player.deck]).size, 50);
    assert.deepEqual(player.discard, []);
  }
  assert.notDeepEqual(state.players[0].hand, state.players[1].hand);
  assert.deepEqual(state, makeGame(shippedCards));
});

test('either starting player gets full resources and rounds advance after both turns',()=>{
  for(const startingPlayer of [0,1]){
    const state=createGame(shippedCards,{startingPlayer});
    assert.equal(state.turn,startingPlayer);
    assert.equal(state.lastEvent.actor,startingPlayer);
    assert.equal(state.round,1);
    for(const player of state.players){assert.equal(player.hand.length,5);assert.equal(player.energy,3);}
    end(state,shippedCards);
    assert.equal(state.turn,1-startingPlayer);
    assert.equal(state.round,1);
    end(state,shippedCards);
    assert.equal(state.turn,startingPlayer);
    assert.equal(state.round,2);
  }
  assert.throws(()=>createGame(shippedCards,{startingPlayer:2}));
});

test('invalid actions do not mutate state or revisions', () => {
  const state = makeGame(shippedCards);
  state.players[0].hand = ['card-01'];
  state.players[0].energy = 0;
  const before = structuredClone(state);
  const attempts = [
    [1, { type: 'end' }],
    [1, { type: 'play', cardId: 'card-01' }],
    [2, { type: 'end' }],
    ['0', { type: 'end' }],
    [0, null],
    [0, { type: 'unknown' }],
    [0, { type: 'play' }],
    [0, { type: 'play', cardId: 'not-in-hand' }],
    [0, { type: 'play', cardId: 'card-01' }],
  ];
  for (const [actor, action] of attempts) {
    assert.equal(applyAction(state, actor, action, shippedCards).ok, false);
    assert.deepEqual(state, before);
  }
});

test('invalid catalog and unavailable card rejection leave a match unchanged', () => {
  const state = makeGame(shippedCards);
  state.players[0].hand = ['card-01'];
  const before = structuredClone(state);
  const invalid = cloneCards();
  invalid[0].effects[0].amount = '100';
  assert.equal(applyAction(state, 0, { type: 'play', cardId: 'card-01' }, invalid).ok, false);
  assert.deepEqual(state, before);
  const changed = cloneCards();
  changed[0].id = 'changed-id';
  assert.equal(applyAction(state, 0, { type: 'play', cardId: 'card-01' }, changed).ok, false);
  assert.deepEqual(state, before);
});

test('playing a card spends energy once, removes it from the hand, and cannot replay it', () => {
  const game = fixture([{ type: 'damage', target: 'opponent', amount: 6 }], { cost: 2 });
  play(game);
  assert.equal(game.state.players[0].energy, 1);
  assert.equal(game.state.players[1].health, 34);
  assert.deepEqual(game.state.players[0].hand, []);
  assert.deepEqual(game.state.players[0].discard, [game.cardId]);
  assert.equal(game.state.revision, 1);
  const before = structuredClone(game.state);
  assert.equal(applyAction(game.state, 0, { type: 'play', cardId: game.cardId }, game.cards).ok, false);
  assert.deepEqual(game.state, before);
});

test('health and energy effects respect caps and can target either player', () => {
  const game = fixture([
    { type: 'damage', target: 'self', amount: 7 },
    { type: 'heal', target: 'self', amount: 100 },
    { type: 'heal', target: 'opponent', amount: 100 },
    { type: 'energy', target: 'self', amount: 100 },
    { type: 'energy', target: 'opponent', amount: -100 },
  ]);
  game.state.players[1].health = 4;
  play(game);
  assert.equal(game.state.players[0].health, 40);
  assert.equal(game.state.players[1].health, 40);
  assert.equal(game.state.players[0].energy, 10);
  assert.equal(game.state.players[1].energy, 0);
});

test('stealing transfers only available energy and never deletes excess at the receiver cap', () => {
  const game = fixture([{ type: 'steal', target: 'opponent', amount: 8 }]);
  game.state.players[0].energy = 9;
  game.state.players[1].energy = 3;
  play(game);
  assert.equal(game.state.players[0].energy, 10);
  assert.equal(game.state.players[1].energy, 2);
  assert.deepEqual(game.state.lastEvent.targets.sort(), [0, 1]);

  const selfSteal = fixture([{ type: 'steal', target: 'self', amount: 8 }]);
  selfSteal.state.players[0].energy = 2;
  play(selfSteal);
  assert.equal(selfSteal.state.players[0].energy, 0);
  assert.equal(selfSteal.state.players[1].energy, 5);
});

test('poison ticks on exactly the victim’s next three own-turn starts', () => {
  const game = fixture([{ type: 'poison', target: 'opponent', amount: 2, rounds: 3 }]);
  play(game);
  assert.equal(game.state.players[1].health, 40);
  for (let tick = 1; tick <= 3; tick += 1) {
    end(game.state, game.cards);
    assert.equal(game.state.turn, 1);
    assert.equal(game.state.players[1].health, 40 - tick * 2);
    assert.equal(game.state.lastEvent.kind, 'poison');
    assert.deepEqual(game.state.players[1].poison, tick === 3 ? [] : [{ amount: 2, remaining: 3 - tick }]);
    end(game.state, game.cards);
    assert.equal(game.state.players[1].health, 40 - tick * 2);
  }
  end(game.state, game.cards);
  assert.equal(game.state.players[1].health, 34);
});

test('stacked poison ticks together, each duration expires independently, and self poison waits', () => {
  const game = fixture([
    { type: 'poison', target: 'self', amount: 3, rounds: 1 },
    { type: 'poison', target: 'opponent', amount: 2, rounds: 3 },
    { type: 'poison', target: 'opponent', amount: 4, rounds: 1 },
  ]);
  play(game);
  end(game.state, game.cards);
  assert.equal(game.state.players[0].health, 40);
  assert.equal(game.state.players[1].health, 34);
  assert.deepEqual(game.state.players[1].poison, [{ amount: 2, remaining: 2 }]);
  end(game.state, game.cards);
  assert.equal(game.state.players[0].health, 37);
  assert.deepEqual(game.state.players[0].poison, []);
});

test('lethal poison ends a game before granting energy or drawing a card', () => {
  const game = fixture([{ type: 'poison', target: 'opponent', amount: 10, rounds: 3 }]);
  game.state.players[1].health = 2;
  const hand = [...game.state.players[1].hand];
  play(game);
  end(game.state, game.cards);
  assert.equal(game.state.status, 'finished');
  assert.equal(game.state.winner, 0);
  assert.equal(game.state.players[1].energy, 3);
  assert.deepEqual(game.state.players[1].hand, hand);
});

test('a multi-effect card resolves all effects before determining a draw', () => {
  const game = fixture([
    { type: 'damage', target: 'opponent', amount: 100 },
    { type: 'damage', target: 'self', amount: 100 },
  ]);
  play(game);
  assert.equal(game.state.status, 'finished');
  assert.equal(game.state.winner, 'draw');
  assert.deepEqual(game.state.players.map(player => player.health), [0, 0]);
});

test('a later heal on the same card can recover from zero before the winner is determined', () => {
  const game = fixture([
    { type: 'damage', target: 'self', amount: 100 },
    { type: 'damage', target: 'opponent', amount: 100 },
    { type: 'heal', target: 'self', amount: 7 },
  ]);
  play(game);
  assert.equal(game.state.players[0].health, 7);
  assert.equal(game.state.winner, 0);
});

test('turn starts grant capped energy, draw one card, and advance full-round count', () => {
  const state = makeGame(shippedCards);
  for (const player of state.players) player.discard.push(player.hand.pop());
  state.players[1].energy = 9;
  end(state, shippedCards);
  assert.equal(state.turn, 1);
  assert.equal(state.round, 1);
  assert.equal(state.players[1].energy, 10);
  assert.equal(state.players[1].hand.length, 5);
  assert.equal(state.players[0].energy, 3);
  end(state, shippedCards);
  assert.equal(state.turn, 0);
  assert.equal(state.round, 2);
  assert.equal(state.players[0].energy, 6);
  assert.equal(state.players[0].hand.length, 5);
});

test('a full five-card hand skips drawing without consuming or changing the deck', () => {
  const state = makeGame(shippedCards);
  const decks = state.players.map(player => [...player.deck]);
  for (let turn = 0; turn < 6; turn += 1) end(state, shippedCards);
  assert.equal(state.players[0].hand.length, RULES.maxHand);
  assert.equal(state.players[0].deck.length, 45);
  assert.equal(state.players[1].hand.length, RULES.maxHand);
  assert.equal(state.players[1].deck.length, 45);
  assert.equal(RULES.maxHand, 5);
  assert.deepEqual(state.players.map(player => player.deck), decks);
});

test('playing a card makes room for exactly one draw on the next turn', () => {
  const cards = cloneCards(), state = makeGame(cards);
  const cardId = state.players[0].hand[0];
  Object.assign(cards.find(card => card.id === cardId), { cost: 0, effects: [{ type: 'heal', target: 'self', amount: 1 }] });
  const game = { cards, state, cardId };
  play(game);
  assert.equal(game.state.players[0].hand.length, 4);
  const nextCard = game.state.players[0].deck.at(-1);
  end(game.state, game.cards);
  end(game.state, game.cards);
  assert.equal(game.state.players[0].hand.length, 5);
  assert.equal(game.state.players[0].hand.at(-1), nextCard);
  assert.equal(game.state.players[0].deck.length, 44);
});

test('an empty deck securely reshuffles discard after restoring a serialized game', () => {
  const state = makeGame(shippedCards);
  state.players[1].deck = [];
  state.players[1].hand = [];
  state.players[1].discard = ['card-01', 'card-02', 'card-03'];
  const restored = JSON.parse(JSON.stringify(state));
  end(state, shippedCards);
  end(restored, shippedCards);
  for (const game of [state, restored]) {
    assert.equal(game.players[1].hand.length, 1);
    assert.equal(game.players[1].deck.length, 2);
    assert.deepEqual(game.players[1].discard, []);
    assert.deepEqual([...game.players[1].deck, ...game.players[1].hand].sort(), ['card-01', 'card-02', 'card-03']);
  }
});

test('views reveal only the viewer’s hand and cannot mutate authoritative state', () => {
  const state = makeGame(shippedCards);
  state.players[0].hand = ['card-01'];
  state.players[1].hand = ['card-50'];
  state.players[1].poison = [{ amount: 2, remaining: 3 }];
  const before = structuredClone(state);
  const view = viewFor(state, 0);
  assert.deepEqual(view.hand, ['card-01']);
  assert.equal(view.players[1].handCount, 1);
  assert.equal(JSON.stringify(view).includes('card-50'), false);
  assert.equal('randomSeed' in view, false);
  for (const player of view.players) {
    assert.equal('hand' in player, false);
    assert.equal('deck' in player, false);
    assert.equal('discard' in player, false);
  }
  view.hand.push('fake');
  view.players[1].poison[0].remaining = 999;
  view.log[0].text = 'changed';
  view.lastEvent.targets.push(1);
  assert.deepEqual(state, before);
  assert.deepEqual(viewFor(state, 1).hand, ['card-50']);
  assert.throws(() => viewFor(state, 2));
});

test('either player can concede; no later action can alter a finished match', () => {
  const state = makeGame(shippedCards);
  assert.deepEqual(applyAction(state, 1, { type: 'concede' }, shippedCards), { ok: true });
  assert.equal(state.winner, 0);
  assert.equal(state.status, 'finished');
  const before = structuredClone(state);
  assert.equal(applyAction(state, 0, { type: 'end' }, shippedCards).ok, false);
  assert.equal(applyAction(state, 0, { type: 'concede' }, shippedCards).ok, false);
  assert.deepEqual(state, before);
});

test('the bot chooses lethal damage ahead of resource gains and avoids lethal self-harm', () => {
  const cards = cloneCards();
  cards[0] = { ...cards[0], cost: 0, effects: [{ type: 'damage', target: 'self', amount: 100 }] };
  cards[1] = { ...cards[1], cost: 0, effects: [{ type: 'energy', target: 'self', amount: 6 }] };
  cards[2] = { ...cards[2], cost: 0, effects: [{ type: 'damage', target: 'opponent', amount: 8 }] };
  const state = makeGame(cards);
  state.players[0].hand = cards.slice(0, 3).map(card => card.id);
  state.players[1].health = 8;
  const before = structuredClone(state);
  assert.deepEqual(pickBotAction(state, 0, cards), { type: 'play', cardId: cards[2].id });
  assert.deepEqual(state, before);
});

test('the bot heals when needed and ends rather than play useless, unaffordable, or harmful cards', () => {
  const cards = cloneCards();
  cards[0] = { ...cards[0], cost: 0, effects: [{ type: 'heal', target: 'self', amount: 8 }] };
  cards[1] = { ...cards[1], cost: 10, effects: [{ type: 'damage', target: 'opponent', amount: 100 }] };
  cards[2] = { ...cards[2], cost: 0, effects: [{ type: 'damage', target: 'self', amount: 100 }] };
  const state = makeGame(cards);
  state.players[0].hand = cards.slice(0, 3).map(card => card.id);
  assert.deepEqual(pickBotAction(state, 0, cards), { type: 'end' });
  state.players[0].health = 10;
  assert.deepEqual(pickBotAction(state, 0, cards), { type: 'play', cardId: cards[0].id });
  assert.deepEqual(pickBotAction(state, 1, cards), { type: 'end' });
});

test('long turn sequences preserve every card and keep logs bounded without hidden identities', () => {
  const state = makeGame(shippedCards);
  for (let count = 0; count < 100; count += 1) end(state, shippedCards);
  assert.equal(state.log.length, 32);
  assert.equal(state.revision, 100);
  for (const player of state.players) {
    assert.equal(player.hand.length + player.deck.length + player.discard.length, 50);
    assert.equal(new Set([...player.hand, ...player.deck, ...player.discard]).size, 50);
    assert.equal(player.energy, 10);
  }
  assert.equal(state.log.some(entry => /card-\d/.test(entry.text)), false);
});


test('only the first 50 entries are dealt and the last active slot can be played', () => {
  const cards = cloneCards();
  const active = new Set(cards.slice(0,50).map(card => card.id));
  assert.equal(RULES.activeCards, 50);
  for (let attempt = 0; attempt < 30; attempt++) {
    const state = createGame(cards);
    for (const player of state.players) {
      const deck = [...player.hand, ...player.deck];
      assert.equal(deck.length, 50);
      assert.deepEqual(new Set(deck), active);
    }
  }
  cards[49] = { ...cards[49], cost:0, effects:[{type:'damage',target:'opponent',amount:1}] };
  const state = makeGame(cards);
  state.players[0].hand = [cards[49].id];
  assert.equal(applyAction(state,0,{type:'play',cardId:cards[49].id},cards).ok,true);
  assert.equal(state.players[1].health,39);
});

test('reserved slots 51–75 cannot be played even if inserted into a hand',()=>{
  const state=makeGame(shippedCards);
  for(const card of shippedCards.slice(50)){
    state.players[0].hand=[card.id];
    const before=structuredClone(state);
    const result=applyAction(state,0,{type:'play',cardId:card.id},shippedCards);
    assert.equal(result.ok,false);
    assert.match(result.error,/not active/);
    assert.deepEqual(state,before);
  }
});

test('compatibility normalization preserves user data and makes common values usable', () => {
  const raw = cloneCards();
  raw[0].accent = 'heart'; raw[1].accent = 'attack';
  raw[0].effects = [{type:'heal', target:'self', amount:'10'}];
  const before = structuredClone(raw), normalized = normalizeCards(raw);
  assert.equal(normalized[0].accent, 'heal'); assert.equal(normalized[1].accent, 'damage');
  assert.equal(normalized[0].effects[0].amount, 10);
  assert.deepEqual(raw, before); assert.equal(validateCards(normalized), true);
});

test('public played-card history survives turns and reconnects without revealing unplayed hands', () => {
  const game = fixture([{type:'damage',target:'opponent',amount:4}]);
  game.state.players[1].hand = ['card-20'];
  play(game);
  end(game.state, game.cards);
  const restored = JSON.parse(JSON.stringify(game.state));
  const opponent = viewFor(restored, 1);
  assert.equal(opponent.playedCards.length, 1);
  assert.equal(opponent.playedCards[0].card.id, game.cardId);
  assert.deepEqual(opponent.playedCards[0].card.effects, game.cards[0].effects);
  assert.equal(opponent.playedCards[0].actor, 0);
  assert.equal(opponent.players[0].hand, undefined);
  opponent.playedCards[0].card.effects[0].amount = 100;
  assert.equal(restored.playedCards[0].card.effects[0].amount, 4);
  applyAction(restored, 1, {type:'concede'}, game.cards);
  assert.equal(viewFor(restored, 0).playedCards.length, 1);
});

test('played-card history stays bounded without losing the latest revealed card', () => {
  const game = fixture([{type:'damage', target:'opponent', amount:1}]);
  for (let count = 0; count < 25; count++) {
    game.state.players[0].hand = [game.cardId];
    play(game);
  }
  assert.equal(game.state.playedCards.length, 20);
  assert.equal(viewFor(game.state, 1).playedCards.at(-1).id, game.state.lastEvent.id);
});
