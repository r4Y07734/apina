import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CARD_ANIMATIONS, animationFor, resolveAnimationTargets } from '../dist/card-pvp/animation-profiles.js';

const catalogUrl = new URL('../dist/card-pvp/cards.json', import.meta.url);
const catalogBytes = await readFile(catalogUrl);
const cards = JSON.parse(catalogBytes.toString('utf8'));

const renderScenes = new Set([
  'transfer', 'scam', 'charge', 'missile', 'mushrooms', 'splash', 'collapse', 'nuclear',
  'balance', 'slash', 'poison', 'bomb', 'drink', 'sniper', 'apple', 'charity', 'circuitry',
  'reactor', 'battery', 'music', 'sand', 'car', 'vitality', 'projectile', 'drain', 'fracture',
  'traffic', 'atom', 'cannon', 'numbers', 'balloon', 'meal', 'money', 'storm', 'equalize',
  'profit', 'investment', 'toxin', 'gust', 'gift', 'jackpot', 'barrel', 'plague',
  'contamination', 'alchemy', 'sonic', 'dance',
]);

function checkProfile(value) {
  assert.ok(renderScenes.has(value.scene));
  assert.ok(Number.isInteger(value.duration) && value.duration >= 900 && value.duration <= 1700);
  assert.match(value.color, /^#[a-f0-9]{6}$/i);
  assert.deepEqual(Object.keys(value).sort(), ['color', 'duration', 'scene']);
}

function freezeTree(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}

test('all 50 shipped slots have valid explicit animation profiles', () => {
  const ids = Array.from({ length: 50 }, (_, index) => `card-${String(index + 1).padStart(2, '0')}`);
  assert.deepEqual(Object.keys(CARD_ANIMATIONS), ids);
  assert.deepEqual(cards.slice(0,50).map(card => card.id), ids);
  for (const card of cards) {
    checkProfile(animationFor(card));
    if(CARD_ANIMATIONS[card.id])assert.equal(animationFor(card), CARD_ANIMATIONS[card.id]);
  }
  assert.equal(CARD_ANIMATIONS['card-04'].scene, 'missile');
  assert.equal(CARD_ANIMATIONS['card-12'].scene, 'missile');
  assert.equal(CARD_ANIMATIONS['card-14'].scene, 'drink');
  assert.equal(CARD_ANIMATIONS['card-50'].scene, 'dance');
});

test('self and opponent effects resolve correctly for either absolute match actor', () => {
  for (const card of cards) {
    for (const actor of [0, 1]) {
      const expected = [];
      for (const effect of card.effects) {
        const target = effect.target === 'self' ? actor : 1 - actor;
        if (!expected.includes(target)) expected.push(target);
      }
      assert.deepEqual(resolveAnimationTargets(card, actor), expected, `${card.id}, actor ${actor}`);
    }
  }
  assert.deepEqual(resolveAnimationTargets(cards[3], 0), [1, 0]);
  assert.deepEqual(resolveAnimationTargets(cards[3], 1), [0, 1]);
  assert.deepEqual(resolveAnimationTargets(cards[4], 0), [0]);
  assert.deepEqual(resolveAnimationTargets(cards[18], 1), [1, 0]);
});

test('stealing targets the energy source, including a self-targeted transfer', () => {
  const give = { effects: [{ type: 'steal', target: 'self', amount: 4 }] };
  const take = { effects: [{ type: 'steal', target: 'opponent', amount: 4 }] };
  for (const actor of [0, 1]) {
    assert.deepEqual(resolveAnimationTargets(give, actor), [actor]);
    assert.deepEqual(resolveAnimationTargets(take, actor), [1 - actor]);
  }
  // This shipped card transfers away energy and also heals the caster.
  assert.deepEqual(resolveAnimationTargets(cards[38], 0), [0]);
});

test('duplicate targets are removed while effect order is preserved', () => {
  const card = { effects: [
    { type: 'damage', target: 'opponent', amount: 2 },
    { type: 'steal', target: 'opponent', amount: 1 },
    { type: 'heal', target: 'self', amount: 2 },
    { type: 'energy', target: 'self', amount: 1 },
  ] };
  assert.deepEqual(resolveAnimationTargets(card, 0), [1, 0]);
  assert.deepEqual(resolveAnimationTargets(card, 1), [0, 1]);
});

test('custom card IDs receive safe effect-based scenes instead of interpreting text', () => {
  const cases = [
    [{ type: 'poison', target: 'opponent', amount: 2 }, 'poison'],
    [{ type: 'steal', target: 'self', amount: 2 }, 'transfer'],
    [{ type: 'heal', target: 'self', amount: 2 }, 'vitality'],
    [{ type: 'energy', target: 'opponent', amount: 2 }, 'charge'],
    [{ type: 'energy', target: 'self', amount: '-2' }, 'drain'],
    [{ type: 'damage', target: 'opponent', amount: 2 }, 'projectile'],
  ];
  for (const [effect, scene] of cases) {
    const card = { id: 'custom', name: '<script>untrusted text</script>', effects: [effect] };
    assert.equal(animationFor(card).scene, scene);
    checkProfile(animationFor(card));
  }
  assert.equal(animationFor({ id: '__proto__', effects: [] }).scene, 'balance');
  assert.equal(animationFor({ id: 'toString', effects: [] }).scene, 'balance');
  assert.equal(animationFor({ effects: [{ type: 'damage' }, { type: 'poison' }] }).scene, 'poison');
});

test('missing or malformed optional presentation data cannot select an invalid actor', () => {
  for (const card of [null, undefined, {}, { effects: null }, { effects: 'self' }, { effects: [null, { target: 'everyone' }] }]) {
    checkProfile(animationFor(card));
    assert.deepEqual(resolveAnimationTargets(card, 0), []);
  }
  for (const actor of [null, undefined, -1, 2, '0', NaN]) {
    assert.deepEqual(resolveAnimationTargets(cards[0], actor), []);
  }
});

test('animations preserve every catalog field and cannot mutate shared profiles', async () => {
  const before = structuredClone(cards);
  freezeTree(cards);
  for (const card of cards) {
    animationFor(card);
    resolveAnimationTargets(card, 0);
    resolveAnimationTargets(card, 1);
  }
  assert.deepEqual(cards, before);
  assert.deepEqual(await readFile(catalogUrl), catalogBytes);
  assert.ok(Object.isFrozen(CARD_ANIMATIONS));
  for (const value of Object.values(CARD_ANIMATIONS)) assert.ok(Object.isFrozen(value));
  assert.throws(() => { CARD_ANIMATIONS['card-14'].scene = 'missile'; }, TypeError);
});
