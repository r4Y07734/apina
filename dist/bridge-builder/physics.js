/**
 * Fixed-step, compliant axial truss solver. Lengths are metres, mass kilograms,
 * force Newtons. Connections rotate freely; triangulation carries bending loads
 * as axial tension/compression. Cars apply axle loads to the deforming roadway.
 */
export const MATERIALS = Object.freeze({
  road: { name: 'Road', costPerMeter: 110, maxLength: 4, color: '#617b8b', density: 70, rigidity: 18000000, tension: 32000, compression: 26000, bucklingLength: 3 },
  wood: { name: 'Timber', costPerMeter: 48, maxLength: 6, color: '#b87d49', density: 18, rigidity: 24000000, tension: 54000, compression: 42000, bucklingLength: 3.5 },
  steel: { name: 'Steel', costPerMeter: 125, maxLength: 9, color: '#80a2ae', density: 38, rigidity: 120000000, tension: 260000, compression: 215000, bucklingLength: 4 },
  cable: { name: 'Cable', costPerMeter: 72, maxLength: 20, color: '#d4ad64', density: 8, rigidity: 65000000, tension: 170000, compression: 0, bucklingLength: 0, tensionOnly: true }
});
const FIXED_DT = 1 / 120;
const GRAVITY = 9.81;
const ITERATIONS = 42;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function createDesign(level) {
  return { nodes: level.anchors.map(n => ({ ...n, fixed: true })), members: [] };
}
export function getDesignCost(design) {
  const nodes = new Map(design.nodes.map(n => [n.id, n]));
  return Math.round(design.members.reduce((sum, member) => {
    const a = nodes.get(member.a), b = nodes.get(member.b), material = MATERIALS[member.material];
    return sum + (a && b && material ? distance(a, b) * material.costPerMeter : 0);
  }, 0));
}
export function validateDesign(level, design) {
  const errors = [], nodes = new Map(), pairs = new Set();
  if (!Array.isArray(design?.nodes) || !Array.isArray(design?.members)) return { ok: false, errors: ['Invalid bridge design.'], cost: 0 };
  if (design.nodes.length > 150 || design.members.length > 350) errors.push('This bridge has too many joints or members.');
  for (const n of design.nodes) {
    if (nodes.has(n.id)) errors.push('Joint IDs must be unique.');
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) errors.push('Joint coordinates must be finite.');
    const anchor = level.anchors.find(a => a.id === n.id);
    if (n.fixed && (!anchor || Math.hypot(n.x - anchor.x, n.y - anchor.y) > .001)) errors.push('Only the marked anchor points can be fixed.');
    if (n.x < level.bounds.minX || n.x > level.bounds.maxX || n.y < level.bounds.minY || n.y > level.bounds.maxY) errors.push('A joint is outside the building area.');
    nodes.set(n.id, n);
  }
  for (const anchor of level.anchors) {
    const n = nodes.get(anchor.id);
    if (!n || !n.fixed || distance(n, anchor) > .001) errors.push('Keep all marked anchor points in place.');
  }
  for (const member of design.members) {
    const a = nodes.get(member.a), b = nodes.get(member.b), material = MATERIALS[member.material];
    if (!a || !b || member.a === member.b) { errors.push('Every member needs two different existing joints.'); continue; }
    if (!material || !level.materials.includes(member.material)) { errors.push('A material is not available in this level.'); continue; }
    const length = distance(a, b);
    if (length < .15 || length > material.maxLength + .001) errors.push(`${material.name} members must be between 0.15 and ${material.maxLength} m long.`);
    const pair = [String(member.a), String(member.b)].sort().join('|') + '|' + member.material;
    if (pairs.has(pair)) errors.push('Duplicate members of the same material cannot occupy the same connection.');
    pairs.add(pair);
    if (member.material === 'road' && Math.abs(a.y - b.y) / length > .65) errors.push('A road section is too steep to drive on.');
    for (const c of level.clearances || []) {
      if (intersectsClearance(a, b, c)) errors.push('Keep the marked navigation clearance open.');
    }
  }
  const cost = getDesignCost(design);
  if (cost > level.budget) errors.push(`Bridge exceeds the budget by ${cost - level.budget}.`);
  if (!design.members.some(m => m.material === 'road')) errors.push('Add road sections between the banks.');
  return { ok: errors.length === 0, errors: [...new Set(errors)], cost };
}
function intersectsClearance(a, b, c) {
  // Open rectangle intersection: grazing its edge remains legal.
  let lo = 0, hi = 1;
  for (const [v, delta, min, max] of [[a.x, b.x - a.x, c.x1 + .03, c.x2 - .03], [a.y, b.y - a.y, c.minY + .03, c.maxY - .03]]) {
    if (Math.abs(delta) < 1e-8) { if (v <= min || v >= max) return false; }
    else { const p = (min - v) / delta, q = (max - v) / delta; lo = Math.max(lo, Math.min(p, q)); hi = Math.min(hi, Math.max(p, q)); }
  }
  return lo < hi && hi > 0 && lo < 1;
}

export function createSimulation(level, design) {
  const validation = validateDesign(level, design);
  const nodes = design.nodes.map(n => ({ ...n, restX: n.x, restY: n.y, vx: 0, vy: 0, mass: n.fixed ? 0 : 8, inverseMass: 0, px: n.x, py: n.y, fx: 0, fy: 0 }));
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const members = design.members.map(m => {
    const a = nodeMap.get(m.a), b = nodeMap.get(m.b), material = MATERIALS[m.material];
    const length = a && b ? distance(a, b) : 1;
    if (material && a && b) {
      if (!a.fixed) a.mass += material.density * length / 2;
      if (!b.fixed) b.mass += material.density * length / 2;
    }
    return { ...m, length, stress: 0, axialForce: 0, broken: false, lambda: 0, overloadTime: 0, _a: a, _b: b, _material: material };
  });
  for (const node of nodes) node.inverseMass = node.fixed ? 0 : 1 / node.mass;
  const vehicles = level.vehicles.map((v, index) => {
    const wheelRadius = v.kind === 'truck' ? .42 : .32, wheelbase = v.kind === 'truck' ? 3.4 : 2.4;
    return { ...v, index, x: -3 - wheelbase / 2, y: level.deckY + wheelRadius + (v.kind === 'truck' ? .5 : .38), angle: 0, wheelRadius, wheelbase,
      finished: false, active: false, wheelY: [level.deckY + wheelRadius, level.deckY + wheelRadius], wheelVY: [0, 0], wheelContacts: [true, true], startDelay: v.startDelay || 0 };
  });
  return { level, nodes, members, vehicles, status: validation.ok ? 'running' : 'failed', time: 0, failureReason: validation.ok ? '' : validation.errors[0], maxStress: 0, cost: validation.cost, crossed: 0, total: vehicles.length, accumulator: 0, brokenCount: 0, _nodeMap: nodeMap };
}

export function stepSimulation(sim, dt) {
  if (sim.status !== 'running' || !Number.isFinite(dt) || dt <= 0) return sim;
  sim.accumulator += Math.min(dt, .25);
  let steps = 0;
  while (sim.accumulator + 1e-10 >= FIXED_DT && steps++ < 31 && sim.status === 'running') {
    fixedStep(sim);
    sim.accumulator = Math.max(0, sim.accumulator - FIXED_DT);
  }
  return sim;
}
function fixedStep(sim) {
  const dt = FIXED_DT, dt2 = dt * dt;
  sim.time += dt;
  for (const n of sim.nodes) { n.fx = 0; n.fy = -n.mass * GRAVITY * Math.min(1, sim.time / .6); }
  updateVehicles(sim, dt);
  if (sim.status !== 'running') return;
  for (const n of sim.nodes) {
    n.px = n.x; n.py = n.y;
    if (!n.fixed) {
      n.vx = (n.vx + n.fx * n.inverseMass * dt) * .99;
      n.vy = (n.vy + n.fy * n.inverseMass * dt) * .99;
      n.x += n.vx * dt; n.y += n.vy * dt;
    }
  }
  for (const m of sim.members) m.lambda = 0;
  // Alternating sweep reduces directional bias through long bridge spans.
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    const reverse = iteration % 2 === 1;
    for (let j = 0; j < sim.members.length; j++) {
      const m = sim.members[reverse ? sim.members.length - 1 - j : j];
      if (m.broken || !m._material || !m._a || !m._b) continue;
      const a = m._a, b = m._b, material = m._material;
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
      if (length < 1e-8) continue;
      const constraint = length - m.length;
      const compliance = m.length / material.rigidity / dt2;
      const denominator = a.inverseMass + b.inverseMass + compliance;
      if (denominator <= 0) continue;
      let change = (-constraint - compliance * m.lambda) / denominator;
      if (material.tensionOnly) {
        const next = Math.min(0, m.lambda + change);
        change = next - m.lambda;
      }
      m.lambda += change;
      const nx = dx / length, ny = dy / length;
      a.x -= a.inverseMass * change * nx; a.y -= a.inverseMass * change * ny;
      b.x += b.inverseMass * change * nx; b.y += b.inverseMass * change * ny;
    }
  }
  let disconnectedDeck = false;
  for (const m of sim.members) {
    if (m.broken || !m._material) continue;
    const material = m._material;
    m.axialForce = m.lambda === 0 ? 0 : -m.lambda / dt2;
    const capacity = m.axialForce >= 0 ? material.tension : material.compression * Math.min(1, (material.bucklingLength / m.length) ** 2);
    m.stress = capacity > 0 ? Math.abs(m.axialForce) / capacity : 0;
    sim.maxStress = Math.max(sim.maxStress, m.stress);
    m.overloadTime = m.stress > 1 ? m.overloadTime + dt : Math.max(0, m.overloadTime - dt * 2);
    if (m.overloadTime >= .075) { m.broken = true; sim.brokenCount++; }
    if (m.material === 'road' && (m._a.y < sim.level.deckY - 3 || m._b.y < sim.level.deckY - 3)) disconnectedDeck = true;
  }
  for (const n of sim.nodes) {
    if (!n.fixed) {
      n.vx = (n.x - n.px) / dt; n.vy = (n.y - n.py) / dt;
      if (!Number.isFinite(n.x + n.y + n.vx + n.vy)) { fail(sim, 'The bridge became unstable.'); return; }
      // Debris rests on the riverbed; it never becomes a new road support.
      const riverbed = (sim.level.waterY || -4) - 2.5;
      if (n.y < riverbed) { n.y = riverbed; n.vy = 0; n.vx *= .95; }
    }
  }
  if (disconnectedDeck) { fail(sim, 'The roadway collapsed. Triangles help carry the load.'); return; }
  if (sim.vehicles.length && sim.vehicles.every(v => v.finished)) sim.status = 'success';
  if (sim.time > 95) fail(sim, 'The vehicles could not finish crossing.');
}
function roadContact(sim, x) {
  if (x <= 0 || x >= sim.level.span) return { y: sim.level.deckY, vy: 0, bank: true };
  let contact = null;
  for (const m of sim.members) {
    if (m.broken || m.material !== 'road' || !m._a || !m._b) continue;
    const a = m._a, b = m._b;
    if (Math.abs(b.x - a.x) < .1) continue;
    const t = (x - a.x) / (b.x - a.x);
    if (t < -.01 || t > 1.01) continue;
    const clamped = Math.max(0, Math.min(1, t)), y = a.y * (1 - clamped) + b.y * clamped;
    if (!contact || y > contact.y) contact = { y, vy: a.vy * (1 - clamped) + b.vy * clamped, a, b, t: clamped };
  }
  return contact;
}
function updateVehicles(sim, dt) {
  for (const v of sim.vehicles) {
    if (v.finished || sim.time < v.startDelay + .8) continue;
    v.active = true;
    v.x += v.speed * dt;
    for (let i = 0; i < 2; i++) {
      const wheelX = v.x + (i === 0 ? -1 : 1) * v.wheelbase / 2;
      const contact = roadContact(sim, wheelX);
      v.wheelVY[i] -= GRAVITY * dt;
      v.wheelY[i] += v.wheelVY[i] * dt;
      v.wheelContacts[i] = false;
      if (contact && v.wheelY[i] - v.wheelRadius <= contact.y + .045) {
        const before = v.wheelVY[i];
        v.wheelY[i] = contact.y + v.wheelRadius;
        v.wheelVY[i] = contact.vy;
        v.wheelContacts[i] = true;
        if (!contact.bank) {
          // Wheel spring caps impact amplification at 2.5 g; both axle masses
          // still transfer their full static gravitational load to the deck.
          const impact = Math.max(0, Math.min(GRAVITY * 1.5, (contact.vy - before) / dt - GRAVITY));
          const load = v.mass * .5 * (GRAVITY + impact);
          contact.a.fy -= load * (1 - contact.t); contact.b.fy -= load * contact.t;
        }
      }
    }
    v.y = (v.wheelY[0] + v.wheelY[1]) / 2 + (v.kind === 'truck' ? .5 : .38);
    v.angle = Math.atan2(v.wheelY[1] - v.wheelY[0], v.wheelbase);
    if (Math.min(...v.wheelY) < sim.level.deckY - 2.25 || Math.abs(v.angle) > .85) { fail(sim, 'A vehicle fell from the bridge. Strengthen the road and its supports.'); return; }
    if (v.x - v.wheelbase / 2 > sim.level.span + 1.5) { v.finished = true; sim.crossed++; }
  }
}
function fail(sim, reason) { sim.status = 'failed'; sim.failureReason = reason; }
