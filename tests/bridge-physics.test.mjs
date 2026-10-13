import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIALS, createDesign, getDesignCost, validateDesign, createSimulation, stepSimulation } from '../dist/bridge-builder/physics.js';
import { LEVELS, referenceDesign } from '../dist/bridge-builder/levels.js';

function finish(sim, frame = 1 / 30) {
  let frames = 0;
  while (sim.status === 'running' && frames++ < 12000) stepSimulation(sim, frame);
  assert.ok(frames < 12000, 'simulation must terminate');
  return sim;
}
function finite(sim) {
  for (const n of sim.nodes) for (const key of ['x', 'y', 'vx', 'vy']) assert.ok(Number.isFinite(n[key]), `finite joint ${key}`);
  for (const m of sim.members) for (const key of ['stress', 'axialForce']) assert.ok(Number.isFinite(m[key]), `finite member ${key}`);
  for (const v of sim.vehicles) for (const key of ['x', 'y', 'angle']) assert.ok(Number.isFinite(v[key]), `finite vehicle ${key}`);
}

test('twenty authored levels progressively introduce loads, piers, materials and clearance', () => {
  assert.equal(LEVELS.length, 20);
  assert.deepEqual(LEVELS.map(l => l.id), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.equal(new Set(LEVELS.map(l => l.name)).size, 20);
  assert.deepEqual(LEVELS[0].materials, ['road', 'wood']);
  assert.ok(LEVELS[5].materials.includes('steel'));
  assert.ok(LEVELS[10].materials.includes('cable'));
  assert.ok(LEVELS.some(l => l.vehicles.length === 3));
  assert.ok(LEVELS.some(l => l.anchors.some(n => n.id.startsWith('pier'))));
  assert.ok(LEVELS.some(l => l.clearances.length));
  assert.equal(new Set(LEVELS.map(l => l.region)).size, 4);
});

for (const level of LEVELS) {
  test(`level ${level.id}: budget-valid reference bridge physically carries every vehicle`, () => {
    const design = referenceDesign(level), validation = validateDesign(level, design);
    assert.deepEqual(validation.errors, []);
    assert.ok(validation.cost <= level.budget);
    assert.equal(validation.cost, getDesignCost(design));
    const sim = finish(createSimulation(level, design));
    finite(sim);
    assert.equal(sim.status, 'success', sim.failureReason);
    assert.equal(sim.crossed, level.vehicles.length);
    assert.ok(sim.vehicles.every(v => v.finished && v.x - v.wheelbase / 2 > level.span));
    assert.equal(sim.brokenCount, 0);
    assert.ok(sim.maxStress > .05, 'a real axle load must stress the structure');
    assert.ok(sim.nodes.some(n => !n.fixed && Math.abs(n.y - n.restY) > .000001), 'elastic deformation must be simulated');
  });
}

test('an unbraced road has connectivity but breaks under the car load', () => {
  const level = LEVELS[0], design = createDesign(level);
  for (let x = 2; x < level.span; x += 2) design.nodes.push({ id: `road-${x}`, x, y: 0, fixed: false });
  const road = [...design.nodes].sort((a, b) => a.x - b.x);
  for (let i = 0; i < road.length - 1; i++) design.members.push({ id: `member-${i}`, a: road[i].id, b: road[i + 1].id, material: 'road' });
  assert.equal(validateDesign(level, design).ok, true);
  const sim = finish(createSimulation(level, design));
  finite(sim);
  assert.equal(sim.status, 'failed');
  assert.ok(sim.maxStress > 1);
  assert.ok(sim.brokenCount > 0);
  assert.equal(sim.crossed, 0);
});

test('a road gap makes the vehicle fall even when the truss itself survives', () => {
  const level = LEVELS[0], design = referenceDesign(level);
  design.members = design.members.filter(m => !(m.material === 'road' && m.a === 'deck-1'));
  assert.equal(validateDesign(level, design).ok, true);
  const sim = finish(createSimulation(level, design));
  assert.equal(sim.status, 'failed');
  assert.match(sim.failureReason, /vehicle fell/);
  assert.equal(sim.brokenCount, 0, 'missing wheel support, rather than an unrelated stress failure');
  assert.equal(sim.crossed, 0);
});

test('an overweight vehicle overloads and breaks an otherwise valid timber bridge', () => {
  const level = { ...LEVELS[0], vehicles: [{ ...LEVELS[0].vehicles[0], mass: 50000 }] };
  const sim = finish(createSimulation(level, referenceDesign(level)));
  finite(sim);
  assert.equal(sim.status, 'failed');
  assert.ok(sim.members.some(m => m.material === 'wood' && m.broken && m.stress > 1));
});

function cableFixture(hanging) {
  const level = { ...LEVELS[0], span: 4, budget: 10000, materials: ['road', 'cable', 'wood'], vehicles: [],
    anchors: [{ id: 'left', x: 0, y: 0, fixed: true }, { id: 'right', x: 4, y: 0, fixed: true }, { id: 'tower', x: 0, y: 4, fixed: true }] };
  const design = createDesign(level);
  design.nodes.push({ id: 'load', x: 0, y: 2, fixed: false });
  design.members.push({ id: 'deck', a: 'left', b: 'right', material: 'road' });
  design.members.push({ id: 'test-cable', a: hanging ? 'tower' : 'left', b: 'load', material: 'cable' });
  return createSimulation(level, design);
}
test('a cable goes slack in compression and carries a hanging load in tension', () => {
  const slack = cableFixture(false), tight = cableFixture(true);
  for (let i = 0; i < 60; i++) { stepSimulation(slack, 1 / 120); stepSimulation(tight, 1 / 120); }
  const a = slack.members.find(m => m.id === 'test-cable'), b = tight.members.find(m => m.id === 'test-cable');
  assert.equal(a.axialForce, 0);
  assert.equal(a.stress, 0);
  assert.ok(slack.nodes.find(n => n.id === 'load').y < 1.9);
  assert.ok(b.axialForce > 0);
  assert.ok(tight.nodes.find(n => n.id === 'load').y > 1.99);
});

test('fixed substeps make different render frame rates deterministic', () => {
  const level = LEVELS[9], a = createSimulation(level, referenceDesign(level)), b = createSimulation(level, referenceDesign(level));
  for (let i = 0; i < 120; i++) stepSimulation(a, 1 / 30);
  for (let i = 0; i < 240; i++) stepSimulation(b, 1 / 60);
  assert.equal(a.time, b.time);
  assert.equal(a.maxStress, b.maxStress);
  assert.deepEqual(a.nodes.map(n => [n.x, n.y]), b.nodes.map(n => [n.x, n.y]));
  assert.deepEqual(a.vehicles.map(v => [v.x, v.y, v.angle]), b.vehicles.map(v => [v.x, v.y, v.angle]));
});

test('validation enforces real build limits and does not allow invented anchors', () => {
  const level = LEVELS[0];
  const invalid = createDesign(level);
  invalid.nodes.push({ id: 'cheat', x: 4, y: 0, fixed: true });
  invalid.members.push({ id: 'long', a: 'left', b: 'right', material: 'road' });
  const result = validateDesign(level, invalid);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(s => s.includes('marked anchor')));
  assert.ok(result.errors.some(s => s.includes('4 m')));
  const unavailable = referenceDesign(level);
  unavailable.members[0].material = 'steel';
  assert.equal(validateDesign(level, unavailable).ok, false);
});

test('road can share joints with a steel beam, but identical material duplicates are rejected', () => {
  const level = LEVELS[5], design = referenceDesign(level);
  assert.equal(validateDesign(level, design).ok, true);
  const road = design.members.find(m => m.material === 'road');
  assert.ok(design.members.some(m => m.material === 'steel' && m.a === road.a && m.b === road.b));
  design.members.push({ ...road, id: 'duplicate' });
  assert.ok(validateDesign(level, design).errors.some(s => s.includes('Duplicate members')));
});

test('all reference designs use the editor grid and stay within practical joint limits', () => {
  for (const level of LEVELS) {
    const design = referenceDesign(level);
    assert.ok(design.nodes.length < 100);
    assert.ok(design.members.length < 180);
    for (const node of design.nodes) {
      assert.equal(node.x % level.grid, 0);
      assert.equal(node.y % level.grid, 0);
    }
  }
});

test('shipping clearance prevents members from cutting through the navigation channel', () => {
  const level = LEVELS[11], design = referenceDesign(level);
  design.nodes.push({ id: 'channel-a', x: level.span / 2 - 2, y: -2 });
  design.nodes.push({ id: 'channel-b', x: level.span / 2 + 2, y: -2 });
  design.members.push({ id: 'channel-beam', a: 'channel-a', b: 'channel-b', material: 'wood' });
  assert.ok(validateDesign(level, design).errors.some(s => s.includes('navigation clearance')));
});

test('all material properties preserve positive stiffness, mass and safe finite costs', () => {
  for (const material of Object.values(MATERIALS)) {
    for (const key of ['rigidity', 'density', 'costPerMeter', 'maxLength', 'tension']) assert.ok(Number.isFinite(material[key]) && material[key] > 0);
  }
  const sim = createSimulation(LEVELS[0], referenceDesign(LEVELS[0]));
  const time = sim.time;
  for (const dt of [0, -1, NaN, Infinity]) stepSimulation(sim, dt);
  assert.equal(sim.time, time);
});
