import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CHARACTERS,DEFAULT_CHARACTER,validCharacter,characterFor} from '../dist/card-pvp/characters.js';
import {createGame,viewFor,normalizeCards} from '../dist/card-pvp/rules.js';
const cards=normalizeCards(JSON.parse(await readFile(new URL('../dist/card-pvp/cards.json',import.meta.url),'utf8')));

test('eight distinct characters map to the eight portrait atlas cells',()=>{
  assert.equal(CHARACTERS.length,8);
  assert.equal(new Set(CHARACTERS.map(c=>c.id)).size,8);
  assert.equal(new Set(CHARACTERS.map(c=>`${c.column},${c.row}`)).size,8);
  for(const character of CHARACTERS){assert.ok(validCharacter(character.id));assert.equal(characterFor(character.id),character);assert.ok(character.column>=0&&character.column<=3);assert.ok(character.row===0||character.row===1);}
  assert.equal(validCharacter('__proto__'),false);
  assert.equal(characterFor('unknown').id,DEFAULT_CHARACTER);
});

test('character choices are public, survive serialization, and never change stats or deck order',()=>{
  const baseline=createGame(cards,{random:()=>.5});
  for(const character of CHARACTERS){
    const game=createGame(cards,{characters:[character.id,'monkey'],random:()=>.5});
    const restored=JSON.parse(JSON.stringify(game));
    for(const viewer of [0,1]){const view=viewFor(restored,viewer);assert.equal(view.players[0].character,character.id);assert.equal(view.players[1].character,'monkey');assert.equal(view.players[1-viewer].hand,undefined);}
    for(const actor of [0,1]){const {character:skin,...actual}=game.players[actor],{character:original,...expected}=baseline.players[actor];assert.deepEqual(actual,expected);}
  }
});

test('older matches and unsupported choices have a safe default portrait',()=>{
  const game=createGame(cards,{characters:['https://attacker.test/portrait',null]});
  assert.equal(game.players[0].character,DEFAULT_CHARACTER);
  delete game.players[1].character;
  assert.equal(viewFor(game,0).players[1].character,DEFAULT_CHARACTER);
});
