import test from 'node:test';
import assert from 'node:assert/strict';
import { planCardAnimation } from '../dist/card-pvp/animations.js';

const plan = (id, actor, effects) => planCardAnimation({ id: 1, actor, card: { id, effects } });

test('a missile hits its damage target while the caster receives the separate energy cue', () => {
  for (const actor of [0,1]) {
    const result = plan('card-04',actor,[{type:'damage',target:'opponent',amount:20},{type:'energy',target:'self',amount:10}]);
    assert.deepEqual(result.scenes,[{from:actor,to:1-actor}]);
    assert.deepEqual(result.cues,[{type:'damage',target:1-actor},{type:'energy',target:actor}]);
  }
});

test('drinking water stays on the caster despite cancelling health effects', () => {
  for (const actor of [0,1]) {
    const result = plan('card-14',actor,[{type:'heal',target:'self',amount:1},{type:'damage',target:'self',amount:1}]);
    assert.equal(result.profile.scene,'drink');
    assert.deepEqual(result.scenes,[{from:actor,to:actor}]);
    assert.deepEqual(result.targets,[actor]);
  }
});

test('energy theft and voluntary transfer travel from source to recipient', () => {
  for (const actor of [0,1]) for (const target of ['self','opponent']) {
    const source = target==='self'?actor:1-actor;
    const result = plan('custom',actor,[{type:'steal',target,amount:4}]);
    assert.deepEqual(result.scenes,[{from:source,to:1-source}]);
    assert.deepEqual(result.transfers,[{from:source,to:1-source}]);
    assert.deepEqual(result.cues,[{type:'drain',target:source},{type:'energy',target:1-source}]);
  }
});

test('mixed card themes retain their energy transfer direction', () => {
  const result=plan('card-50',1,[{type:'damage',target:'opponent',amount:4},{type:'steal',target:'opponent',amount:4},{type:'heal',target:'self',amount:2}]);
  assert.equal(result.profile.scene,'dance');
  assert.deepEqual(result.transfers,[{from:0,to:1}]);
  assert.deepEqual(result.targets,[0,1]);
});

test('multi-target damage animates both affected players and deduplicates cues', () => {
  const effects=[{type:'damage',target:'self',amount:20},{type:'damage',target:'opponent',amount:10},{type:'damage',target:'self',amount:1}];
  const result = plan('card-13',0,effects);
  assert.deepEqual(result.scenes,[{from:0,to:0},{from:0,to:1}]);
  assert.deepEqual(result.cues,[{type:'damage',target:0},{type:'damage',target:1}]);
});

test('a gift shows on the recipient and a negative energy effect shows a drain', () => {
  const gift=plan('card-43',1,[{type:'energy',target:'opponent',amount:5}]);
  assert.deepEqual(gift.scenes,[{from:1,to:0}]);
  assert.deepEqual(gift.cues,[{type:'energy',target:0}]);
  assert.deepEqual(plan('custom',0,[{type:'energy',target:'self',amount:'-5'}]).cues,[{type:'drain',target:0}]);
});
