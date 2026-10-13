import { createDesign } from './physics.js';

const settings = [
  ['First crossing', 'valley', 8, 3900, 'Connect the banks with road. Add triangles above or below it so the timber carries the car.', 850, 2],
  ['River bend', 'valley', 10, 4700, 'A longer gap needs a connected truss. Shorter timber members resist buckling.', 1000, 2],
  ['Market road', 'valley', 12, 5800, 'Carry two cars across without leaving unsupported road joints.', 1100, 2.2],
  ['Old mill', 'valley', 14, 6500, 'A central stone pier gives you an extra fixed support.', 1300, 2],
  ['Deep water', 'valley', 14, 6700, 'There is no middle support. Use a deeper timber truss to spread the forces.', 1600, 2],
  ['Iron valley', 'canyon', 16, 12600, 'Steel is now available. Stronger members carry the first loaded delivery truck.', 3000, 2],
  ['Freight route', 'canyon', 18, 14500, 'A heavier truck puts the top chord in compression and the road in tension.', 4000, 1.9],
  ['Twin arches', 'canyon', 20, 15200, 'Build around the central pier to divide the long span into two short spans.', 4500, 2],
  ['High gorge', 'canyon', 22, 17400, 'The gorge needs a deep truss and firm connections at both banks.', 3800, 2.2],
  ['Convoy', 'canyon', 24, 19800, 'Two trucks share the bridge. Design for more than one moving load.', 4200, 2.1],
  ['Harbour approach', 'coast', 18, 14200, 'Cables carry tension only. Anchor them high; use road or beams for compression.', 4200, 2],
  ['Navigation channel', 'coast', 24, 19900, 'Keep the marked shipping channel beneath the deck free of structural members.', 5000, 2],
  ['Sea wall', 'coast', 26, 21700, 'Three traffic loads travel in sequence. Pier supports reduce the unsupported lengths.', 5200, 2.2],
  ['Lighthouse run', 'coast', 28, 24900, 'A long unsupported crossing needs a tall, well triangulated structure.', 6000, 2],
  ['Container road', 'coast', 30, 25800, 'A heavy truck tests the structure as it moves between the two middle piers.', 7400, 1.8],
  ['Mountain pass', 'alpine', 32, 28800, 'Wide valleys demand careful material use. Shorter compression members avoid buckling.', 6500, 2],
  ['Snowline', 'alpine', 34, 30200, 'Two loaded trucks cross the alpine river together. Use the pier to share their weight.', 7500, 2],
  ['Glacier channel', 'alpine', 36, 33600, 'Keep the centre channel clear and support the long steel deck from above.', 7000, 2.1],
  ['Grand traverse', 'alpine', 40, 36900, 'Use the two fixed piers to divide the crossing and carry a busy convoy.', 9000, 1.9],
  ['Master builder', 'alpine', 42, 41500, 'The final convoy combines heavy loads, a wide gap and a clear navigation channel.', 10000, 1.8]
];
const piers = { 4: [7], 8: [10], 13: [8, 18], 15: [10, 20], 16: [16], 17: [17], 18: [10, 26], 19: [12, 28], 20: [12, 30] };
export const LEVELS = settings.map((s, index) => {
  const [name, region, span, budget, description, mass, speed] = s, id = index + 1;
  const anchors = [{ id: 'left', x: 0, y: 0, fixed: true }, { id: 'right', x: span, y: 0, fixed: true }];
  for (const [j, x] of (piers[id] || []).entries()) anchors.push({ id: `pier-${j + 1}`, x, y: 0, fixed: true });
  // Existing abutments are useful high cable anchors, never mandatory supports.
  if (id >= 11) { anchors.push({ id: 'tower-left', x: 0, y: 6, fixed: true }); anchors.push({ id: 'tower-right', x: span, y: 6, fixed: true }); }
  if ([17, 19, 20].includes(id)) for (const [j, x] of piers[id].entries()) anchors.push({ id: `tower-pier-${j + 1}`, x, y: 6, fixed: true });
  const vehicles = [{ kind: id < 6 ? 'car' : 'truck', mass, speed, startDelay: 0, color: '#daaa67' }];
  if ([3, 8, 10, 13, 16, 17, 19, 20].includes(id)) vehicles.push({ kind: id < 6 ? 'car' : 'truck', mass: Math.round(mass * .85), speed, startDelay: id < 6 ? 4 : 5, color: '#769eb2' });
  if ([13, 19, 20].includes(id)) vehicles.push({ kind: 'car', mass: 1450, speed, startDelay: 10, color: '#aec0a2' });
  const clearances = [12, 18, 20].includes(id) ? [{ x1: span / 2 - 3, x2: span / 2 + 3, minY: -6, maxY: -.6 }] : [];
  return { id, name, region, description, budget: id < 6 ? budget : Math.round(budget * 1.4 / 100) * 100, span, deckY: 0, anchors,
    bounds: { minX: -4, maxX: span + 4, minY: region === 'canyon' ? -10 : -8, maxY: id >= 11 ? 8 : 6 },
    waterY: region === 'canyon' ? -7 : region === 'alpine' ? -5 : -4, grid: 1,
    materials: id < 6 ? ['road', 'wood'] : id < 11 ? ['road', 'wood', 'steel'] : ['road', 'wood', 'steel', 'cable'], vehicles, clearances,
    tip: id === 1 ? 'A triangle cannot fold like a square. Connect every road joint into triangles.' : id === 11 ? 'Cables go slack under compression. Hang the deck from high anchors, or build a steel truss.' : 'During testing, blue members carry low stress. Orange and red members need stronger support.' };
});

/** Deterministic reference structures for physics regression checks. Not used by the editor. */
export function referenceDesign(level) {
  const design = createDesign(level), structural = level.id < 6 ? 'wood' : 'steel';
  const height = level.id < 5 ? 2 : level.id < 9 ? 3 : 4;
  let serial = 0;
  const add = (a, b, material) => design.members.push({ id: `reference-${++serial}`, a, b, material });
  const supportX = [0, ...level.anchors.filter(a => a.y === 0 && a.x > 0 && a.x < level.span).map(a => a.x), level.span].sort((a, b) => a - b);
  const deck = [];
  for (let si = 0; si < supportX.length - 1; si++) {
    const start = supportX[si], end = supportX[si + 1];
    const points = [];
    for (let x = start; x < end; x += 2) points.push(x);
    points.push(end);
    for (const x of points) {
      if (deck.some(n => Math.abs(n.x - x) < .001)) continue;
      const anchor = level.anchors.find(n => n.y === 0 && Math.abs(n.x - x) < .001);
      const n = anchor ? design.nodes.find(n => n.id === anchor.id) : { id: `deck-${deck.length}`, x, y: 0, fixed: false };
      if (!anchor) design.nodes.push(n);
      deck.push(n);
    }
  }
  deck.sort((a, b) => a.x - b.x);
  for (let i = 0; i < deck.length - 1; i++) add(deck[i].id, deck[i + 1].id, 'road');
  // A roadway can be laid along a separate structural beam on shared joints.
  // Its deck and the steel bottom chord carry force according to their stiffness.
  const chord = deck;
  if (structural === 'steel') {
    for (let i = 0; i < chord.length - 1; i++) add(chord[i].id, chord[i + 1].id, 'steel');
  }
  const tops = [];
  for (let i = 1; i < deck.length - 1; i++) {
    const n = { id: `top-${i}`, x: deck[i].x, y: height, fixed: false };
    design.nodes.push(n); tops.push(n);
    add(chord[i].id, n.id, structural);
  }
  add(chord[0].id, tops[0].id, structural);
  for (let i = 0; i < tops.length - 1; i++) {
    add(tops[i].id, tops[i + 1].id, structural);
    add(tops[i].id, chord[i + 2].id, structural);
  }
  add(tops.at(-1).id, chord.at(-1).id, structural);
  if (level.id === 14) {
    for (const fraction of [.22, .36, .64, .78]) {
      const target = deck.reduce((best, n) => Math.abs(n.x - level.span * fraction) < Math.abs(best.x - level.span * fraction) ? n : best, deck[0]);
      add(fraction < .5 ? 'tower-left' : 'tower-right', target.id, 'cable');
    }
  }
  if ([17, 19].includes(level.id)) {
    for (const anchor of level.anchors.filter(a => a.id.startsWith('tower-pier'))) {
      for (const offset of [-6, 6]) {
        const target = deck.reduce((best, n) => Math.abs(n.x - (anchor.x + offset)) < Math.abs(best.x - (anchor.x + offset)) ? n : best, deck[0]);
        add(anchor.id, target.id, 'cable');
      }
    }
    if (level.id === 17) {
      add('tower-left', deck[3].id, 'cable');
      add('tower-right', deck.at(-4).id, 'cable');
    }
  }
  if (level.id === 20) {
    for (let i = 0; i < tops.length - 1; i++) if (i % 2 === 0) add(chord[i + 1].id, tops[i + 1].id, 'steel');
    for (const fraction of [.38, .47, .53, .62]) {
      const target = deck.reduce((best, n) => Math.abs(n.x - level.span * fraction) < Math.abs(best.x - level.span * fraction) ? n : best, deck[0]);
      add(fraction < .5 ? 'tower-pier-1' : 'tower-pier-2', target.id, 'cable');
    }
  }
  return design;
}
