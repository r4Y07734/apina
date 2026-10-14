// Original Canvas artwork. This module only paints; the game owns time and state.
const TAU = Math.PI * 2;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - (1 - clamp(t)) ** 3;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const phase = (p, begin, end) => clamp((p - begin) / (end - begin));
const random = (seed, index) => {
  const v = Math.sin((Number(seed) || 1) * 17.71 + index * 91.337) * 43758.5453;
  return v - Math.floor(v);
};
const palette = {
  metal: '#41526a', dark: '#162132', line: '#dae9f8', blue: '#70cbff',
  green: '#80e6a2', gold: '#f6cc78', orange: '#ffac6b', purple: '#c49cff', red: '#ff8c87',
};

function path(ctx, points, fill, stroke = palette.line, closed = true) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  if (closed) ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
function circle(ctx, x, y, radius, fill, stroke) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(.01, radius), 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
function line(ctx, x1, y1, x2, y2, color = palette.line, width = 2) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function roundRect(ctx, x, y, width, height, radius, fill, stroke = palette.line) {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
function star(ctx, x, y, radius, color) {
  path(ctx, [[x, y - radius], [x + radius * .25, y - radius * .25], [x + radius, y],
    [x + radius * .25, y + radius * .25], [x, y + radius],
    [x - radius * .25, y + radius * .25], [x - radius, y], [x - radius * .25, y - radius * .25]], color, null);
}
function bolt(ctx, color = palette.gold) {
  path(ctx, [[4, -23], [-15, 3], [-2, 3], [-6, 23], [16, -6], [3, -6]], color, '#fff3c9');
}
function heart(ctx, color = palette.green, cracked = false) {
  ctx.beginPath(); ctx.moveTo(0, 19);
  ctx.bezierCurveTo(-6, 14, -23, 3, -22, -9);
  ctx.bezierCurveTo(-21, -22, -6, -24, 0, -13);
  ctx.bezierCurveTo(6, -24, 21, -22, 22, -9);
  ctx.bezierCurveTo(23, 3, 6, 14, 0, 19);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#effff4'; ctx.stroke();
  if (cracked) path(ctx, [[2, -14], [-4, -4], [4, 3], [-2, 12]], null, palette.dark, false);
  else path(ctx, [[-15, -9], [-10, -9], [-6, -16], [-1, 4], [4, -4], [13, -4]], null, '#effff4', false);
}
function coin(ctx, x = 0, y = 0, radius = 17) {
  circle(ctx, x, y, radius, '#d49337', '#ffe4a1');
  circle(ctx, x, y, radius * .72, '#edba59', '#b87d26');
  line(ctx, x, y - radius * .39, x, y + radius * .39, '#fff0b4', 2.8);
  line(ctx, x - radius * .28, y - radius * .23, x + radius * .24, y - radius * .23, '#fff0b4', 2.8);
  line(ctx, x - radius * .24, y + radius * .23, x + radius * .28, y + radius * .23, '#fff0b4', 2.8);
}
function flask(ctx, color, t) {
  path(ctx, [[-7, -23], [7, -23], [7, -6], [20, 17], [17, 22], [-17, 22], [-20, 17], [-7, -6]], '#243a49', '#cae9f5');
  path(ctx, [[-11, 4], [11, 4], [17, 17], [14, 19], [-14, 19], [-17, 17]], color, null);
  line(ctx, -9, -23, 9, -23, '#ecf5ff', 4);
  circle(ctx, -5, 11, 2.5, '#edfff5'); circle(ctx, 6, 15, 2, '#edfff5');
  circle(ctx, 3, mix(4, -11, (t * 2) % 1), 1.8, color);
  line(ctx, -10, 10, -7, 3, '#ffffff99', 2);
}

/** Paint one original object in a normalized 48×48 box. */
function object(ctx, name, x, y, size, angle = 0, t = 0, color = palette.blue) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(size / 48, size / 48);
  ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (name) {
    case 'missile':
      path(ctx, [[-15, -5], [11, -5], [24, 0], [11, 5], [-15, 5]], '#e5edf3', '#a6c5dc');
      path(ctx, [[10, -5], [24, 0], [10, 5]], '#e77972', '#f8bab0');
      path(ctx, [[-10, -5], [-20, -14], [-19, -3], [-13, -3]], '#657b95', '#c8e1f6');
      path(ctx, [[-10, 5], [-20, 14], [-19, 3], [-13, 3]], '#657b95', '#c8e1f6');
      line(ctx, -8, 0, 8, 0, '#9badbc', 1.4);
      path(ctx, [[-17, -4], [-31 - Math.sin(t * 60) * 4, 0], [-17, 4]], '#ffc977', null);
      break;
    case 'glass':
      path(ctx, [[-16, -23], [16, -23], [12, 22], [-12, 22]], '#294759cc', '#dcf4ff');
      path(ctx, [[-13, -7], [13, -7], [10, 19], [-10, 19]], '#67c9f2cc', null);
      line(ctx, -10, -17, -8, 13, '#e0faff', 2.5); line(ctx, -16, -23, 16, -23, '#e7faff', 2.8);
      circle(ctx, 4, 8, 2, '#d8f5ff'); circle(ctx, -3, 14, 1.5, '#d8f5ff');
      break;
    case 'drop':
      ctx.beginPath(); ctx.moveTo(0, -23); ctx.bezierCurveTo(-6, -13, -19, 0, -16, 12);
      ctx.bezierCurveTo(-12, 27, 12, 27, 16, 12); ctx.bezierCurveTo(19, 0, 6, -13, 0, -23);
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#d6f5ff'; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 9, 9, .25, 1.8); ctx.strokeStyle = '#c5f1ff'; ctx.stroke();
      break;
    case 'mushroom':
      path(ctx, [[-6, -1], [7, -1], [9, 21], [-9, 21]], '#ead1a9', '#fff0d6');
      ctx.beginPath(); ctx.moveTo(-23, 0); ctx.bezierCurveTo(-23, -28, 23, -28, 23, 0); ctx.closePath();
      ctx.fillStyle = '#bb8be2'; ctx.fill(); ctx.strokeStyle = '#e2c9ff'; ctx.stroke();
      circle(ctx, -10, -8, 4, '#eedbff'); circle(ctx, 5, -13, 4, '#eedbff'); circle(ctx, 14, -5, 2.5, '#eedbff');
      line(ctx, -20, 1, 20, 1, '#8d57b5', 2);
      break;
    case 'apple':
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.bezierCurveTo(-13, -26, -30, -9, -19, 11);
      ctx.bezierCurveTo(-10, 28, -3, 18, 0, 19); ctx.bezierCurveTo(3, 18, 10, 28, 19, 11);
      ctx.bezierCurveTo(30, -9, 13, -26, 0, -13); ctx.closePath();
      ctx.fillStyle = '#e8bc55'; ctx.fill(); ctx.strokeStyle = '#fff0b1'; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(7, -23, 8, 3.5, -.55, 0, TAU); ctx.fillStyle = '#85c981'; ctx.fill();
      line(ctx, 0, -13, 0, -23, '#ae865b', 3); ctx.beginPath(); ctx.arc(-8, -5, 7, 3.2, 4.6); ctx.strokeStyle = '#fff5cf'; ctx.stroke();
      break;
    case 'battery':
      roundRect(ctx, -16, -20, 32, 42, 5, '#233d4a', '#cfedf5');
      roundRect(ctx, -6, -25, 12, 5, 1, '#cfedf5', null);
      for (let i = 0; i < 3; i++) roundRect(ctx, -10, 9 - i * 12, 20, 8, 1, i <= Math.floor(t * 3) ? color : '#405765', null);
      break;
    case 'bolt': bolt(ctx, color); break;
    case 'heart': heart(ctx, color); break;
    case 'fracture': heart(ctx, '#db8f9d', true); break;
    case 'coin': coin(ctx); break;
    case 'bomb':
      circle(ctx, 0, 4, 18, '#35435b', '#acbad0');
      roundRect(ctx, -6, -18, 12, 6, 1, '#62748b', '#b9cce0');
      ctx.beginPath(); ctx.moveTo(0, -18); ctx.bezierCurveTo(1, -29, 17, -12, 15, -27);
      ctx.strokeStyle = '#d4b482'; ctx.stroke(); star(ctx, 15, -25, 6 + Math.sin(t * 80), '#ffc983');
      ctx.beginPath(); ctx.arc(-3, 3, 11, 3.2, 4.6); ctx.strokeStyle = '#9aabc2'; ctx.stroke();
      break;
    case 'car':
      path(ctx, [[-24, 2], [-20, -7], [-11, -9], [-5, -19], [13, -19], [20, -7], [27, -3], [27, 12], [-24, 12]], color, '#cfe4fb');
      path(ctx, [[-8, -8], [-3, -16], [10, -16], [15, -8]], '#1c324b', '#adcfe6');
      line(ctx, 2, -16, 2, -8, '#adcfe6', 1.5);
      circle(ctx, -14, 12, 7, '#192334', '#b5c7d8'); circle(ctx, 17, 12, 7, '#192334', '#b5c7d8');
      circle(ctx, -14, 12, 2.5, '#91a7bb'); circle(ctx, 17, 12, 2.5, '#91a7bb');
      line(ctx, 22, 1, 27, 1, '#ffdf9e', 3); line(ctx, -24, 2, -21, 2, '#ff887d', 3);
      break;
    case 'gift':
      roundRect(ctx, -19, -5, 38, 29, 2, '#5b8eba', '#d8edff');
      roundRect(ctx, -22, -10, 44, 9, 2, '#77a9d0', '#d8edff');
      roundRect(ctx, -4, -9, 8, 33, 1, '#f6cb81', null);
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.bezierCurveTo(-32, -16, -14, -35, 0, -10);
      ctx.bezierCurveTo(14, -35, 32, -16, 0, -10); ctx.strokeStyle = '#ffdfa0'; ctx.lineWidth = 4; ctx.stroke();
      break;
    case 'barrel':
      ctx.beginPath(); ctx.ellipse(0, -17, 16, 6, 0, 0, TAU); ctx.fillStyle = '#887351'; ctx.fill(); ctx.strokeStyle = '#d9c298'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-16, -17); ctx.bezierCurveTo(-23, 0, -19, 18, -15, 21);
      ctx.bezierCurveTo(-6, 27, 6, 27, 15, 21); ctx.bezierCurveTo(19, 18, 23, 0, 16, -17);
      ctx.strokeStyle = '#d9c298'; ctx.fillStyle = '#9f8050'; ctx.fill(); ctx.stroke();
      path(ctx, [[-19, -6], [19, -6], [20, 0], [-20, 0]], '#4f6070', '#98a7b8');
      path(ctx, [[-19, 12], [19, 12], [17, 18], [-17, 18]], '#4f6070', '#98a7b8');
      line(ctx, -7, 0, -6, 11, '#ccb27f', 1.5); line(ctx, 7, 0, 6, 11, '#ccb27f', 1.5);
      break;
    case 'flask': flask(ctx, color, t); break;
    case 'vial':
      roundRect(ctx, -8, -18, 16, 40, 7, '#263b48', '#cbe5ef');
      roundRect(ctx, -5, 3, 10, 15, 4, color, null); roundRect(ctx, -10, -24, 20, 8, 2, '#78909d', '#d4e7ed');
      circle(ctx, 1, 9, 1.5, '#e9ffff'); line(ctx, -4, -10, -4, 0, '#d4f2fb', 1.5);
      break;
    case 'dice':
      roundRect(ctx, -21, -21, 42, 42, 8, '#dfd6c4', '#fff4e1');
      for (const [x, y] of [[-10, -10], [10, -10], [0, 0], [-10, 10], [10, 10]]) circle(ctx, x, y, 3.4, '#4e4552');
      break;
    case 'meal':
      ctx.beginPath(); ctx.ellipse(0, 17, 28, 7, 0, 0, TAU); ctx.fillStyle = '#a9c5d7'; ctx.fill(); ctx.strokeStyle = '#e7f0f7'; ctx.stroke();
      roundRect(ctx, -19, 6, 38, 10, 4, '#d7a264', '#f4d29c');
      path(ctx, [[-21, 2], [-17, -3], [-9, 2], [0, -3], [8, 2], [17, -3], [21, 2]], '#9fc67a', '#cff098');
      roundRect(ctx, -20, -3, 40, 7, 2, '#87604a', '#bd8d60');
      ctx.beginPath(); ctx.moveTo(-20, -5); ctx.bezierCurveTo(-19, -28, 19, -28, 20, -5); ctx.closePath();
      ctx.fillStyle = '#e5b375'; ctx.fill(); ctx.strokeStyle = '#ffe0ad'; ctx.stroke();
      for (let i = 0; i < 5; i++) line(ctx, -12 + i * 6, -12 - Math.sin(i) * 3, -10 + i * 6, -14 - Math.sin(i) * 3, '#fff1d3', 1.6);
      break;
    case 'note':
      line(ctx, -6, 14, -6, -17, color, 4); line(ctx, 16, 7, 16, -23, color, 4); line(ctx, -6, -17, 16, -23, color, 5);
      ctx.beginPath(); ctx.ellipse(-12, 14, 8, 5, -.4, 0, TAU); ctx.ellipse(10, 7, 8, 5, -.4, 0, TAU); ctx.fillStyle = color; ctx.fill();
      break;
    case 'sword':
      path(ctx, [[-4, 8], [-4, -16], [0, -26], [4, -16], [4, 8]], '#a9c9dc', '#edf7ff');
      line(ctx, 0, -19, 0, 7, '#effaff', 1.4); line(ctx, -11, 10, 11, 10, '#d4b277', 4);
      roundRect(ctx, -3, 11, 6, 13, 1, '#785b45', '#cba374');
      break;
    case 'reactor':
      path(ctx, [[-24, 20], [-18, -14], [-5, -14], [1, 20]], '#667b8b', '#c7dce8');
      ctx.beginPath(); ctx.ellipse(-12, -14, 6, 2.5, 0, 0, TAU); ctx.fillStyle = '#223c4a'; ctx.fill(); ctx.strokeStyle = '#c7dce8'; ctx.stroke();
      path(ctx, [[3, 20], [7, -23], [19, -23], [25, 20]], '#879dad', '#d2e3ed');
      ctx.beginPath(); ctx.ellipse(13, -23, 6, 2.5, 0, 0, TAU); ctx.fillStyle = '#284354'; ctx.fill(); ctx.strokeStyle = '#d2e3ed'; ctx.stroke();
      roundRect(ctx, -24, 15, 49, 8, 2, '#596d80', '#c1d8e5');
      break;
    case 'atom':
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 3 + t * 2);
        ctx.beginPath(); ctx.ellipse(0, 0, 23, 8, 0, 0, TAU); ctx.strokeStyle = color; ctx.stroke();
        circle(ctx, 23 * Math.cos(t * 8 + i * 2), 8 * Math.sin(t * 8 + i * 2), 2.4, '#edfff8'); ctx.restore();
      }
      circle(ctx, 0, 0, 5, '#f2dd9e', '#fff1c9');
      break;
    case 'balloon':
      ctx.beginPath(); ctx.ellipse(0, -4, 16, 22, 0, 0, TAU); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#e7cfff'; ctx.stroke();
      path(ctx, [[0, 18], [-3, 23], [3, 23]], color, null);
      ctx.beginPath(); ctx.moveTo(0, 22); ctx.bezierCurveTo(14, 29, -13, 33, 0, 40); ctx.strokeStyle = '#dae1ef'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-7, -10, 3, 7, .3, 0, TAU); ctx.fillStyle = '#ffffff66'; ctx.fill();
      break;
    case 'cannon':
      ctx.save(); ctx.rotate(-.18); roundRect(ctx, -19, -8, 43, 17, 4, '#758494', '#d1e1e9');
      roundRect(ctx, 17, -11, 9, 22, 2, '#506278', '#b2c8dc'); ctx.restore();
      path(ctx, [[-20, 14], [-3, -3], [14, 14]], '#93734a', '#d0af7c');
      circle(ctx, -4, 16, 9, '#4c4b4a', '#c1b299'); circle(ctx, -4, 16, 3, '#d5c4a7');
      break;
    case 'traffic':
      roundRect(ctx, -12, -25, 24, 45, 6, '#303e4c', '#b6c9db');
      for (let i = 0; i < 3; i++) circle(ctx, 0, -16 + i * 13, 4.4, ['#ff8f8a', '#ffdb83', '#8be3a4'][i], '#203043');
      line(ctx, 0, 20, 0, 28, '#b6c9db', 3);
      break;
    case 'scales':
      line(ctx, 0, -21, 0, 22, '#d1dce8', 3); line(ctx, -15, 23, 15, 23, '#d1dce8', 3);
      ctx.save(); ctx.rotate(Math.sin(t * TAU) * .16); line(ctx, -23, -13, 23, -13, '#ead099', 3);
      for (const x of [-19, 19]) {
        line(ctx, x, -13, x - 9, 7, '#c6d8e5', 1.3); line(ctx, x, -13, x + 9, 7, '#c6d8e5', 1.3);
        ctx.beginPath(); ctx.moveTo(x - 10, 7); ctx.quadraticCurveTo(x, 20, x + 10, 7); ctx.closePath();
        ctx.fillStyle = '#b3955e'; ctx.fill(); ctx.strokeStyle = '#ffe6ac'; ctx.stroke();
      }
      ctx.restore(); circle(ctx, 0, -13, 3, '#ffe6ac');
      break;
    case 'wallet':
      roundRect(ctx, -24, -17, 46, 34, 5, '#75664a', '#e6d0a0');
      roundRect(ctx, 0, -7, 26, 15, 3, '#927b51', '#e6d0a0'); circle(ctx, 7, 0, 2, '#fff0b9');
      line(ctx, -19, -12, 15, -12, '#b29b6f', 1.3);
      break;
    case 'chart':
      roundRect(ctx, -22, -24, 44, 48, 4, '#253a4b', '#c8e0ec');
      for (let i = 0; i < 3; i++) roundRect(ctx, -14 + i * 10, 12 - i * 8, 6, 8 + i * 8, 1, '#679fbc', null);
      path(ctx, [[-14, 1], [-4, -5], [4, -4], [14, -15]], null, '#97e7b5', false);
      path(ctx, [[6, -15], [14, -15], [14, -7]], null, '#97e7b5', false);
      break;
    case 'virus':
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8; line(ctx, Math.cos(a) * 12, Math.sin(a) * 12, Math.cos(a) * 22, Math.sin(a) * 22, color, 2.5);
        circle(ctx, Math.cos(a) * 22, Math.sin(a) * 22, 3, color);
      }
      circle(ctx, 0, 0, 13, '#384e45', color); circle(ctx, -5, -4, 3, color); circle(ctx, 5, 3, 2, color); circle(ctx, -3, 7, 2, color);
      break;
    case 'cloud':
      ctx.beginPath(); ctx.moveTo(-25, 10); ctx.bezierCurveTo(-37, 6, -28, -11, -17, -10);
      ctx.bezierCurveTo(-18, -30, 9, -31, 13, -15); ctx.bezierCurveTo(30, -24, 40, 7, 23, 10); ctx.closePath();
      ctx.fillStyle = '#5c708a'; ctx.fill(); ctx.strokeStyle = '#cbd9ed'; ctx.stroke();
      path(ctx, [[2, 7], [-6, 21], [3, 21], [-2, 32]], null, '#ffe6a2', false);
      break;
    case 'numbers':
      ctx.font = '700 37px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = color; ctx.fillText(t < .5 ? '6' : '7', 0, 1);
      break;
    default: star(ctx, 0, 0, 21, color);
  }
  ctx.restore();
}

function ring(ctx, x, y, radius, color, alpha, width = 2) {
  ctx.save(); ctx.globalAlpha *= clamp(alpha); ctx.lineWidth = width;
  circle(ctx, x, y, radius, null, color); ctx.restore();
}
function glow(ctx, x, y, radius, color, alpha = .2) {
  if (!alpha || radius <= 0) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color); gradient.addColorStop(1, 'transparent');
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2); ctx.restore();
}
function burst(ctx, x, y, size, p, color, seed, count = 15, kind = 'spark') {
  if (p <= 0 || p >= 1) return;
  const elapsed = ease(p);
  ctx.save(); ctx.globalAlpha *= (1 - p) ** .65;
  for (let i = 0; i < count; i++) {
    const angle = random(seed, i * 3) * TAU;
    const distance = elapsed * size * (.6 + random(seed, i * 3 + 1) * 1.3);
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance + p * p * size * .25;
    const radius = size * (.035 + random(seed, i * 3 + 2) * .035) * (1 - p * .55);
    if (kind === 'drop') object(ctx, 'drop', px, py, radius * 3, angle + Math.PI / 2, p, color);
    else if (kind === 'dust') circle(ctx, px, py, radius * 2.5, color);
    else if (i % 4 === 0) star(ctx, px, py, radius * 1.4, color);
    else line(ctx, px, py, px - Math.cos(angle) * radius * 3, py - Math.sin(angle) * radius * 3, color, Math.max(1, radius));
  }
  ctx.restore();
}
function impact(ctx, point, size, p, color, seed, soft = false) {
  if (p <= 0) return;
  glow(ctx, point.x, point.y, size * (1 + p), color, (1 - p) * (soft ? .16 : .29));
  ring(ctx, point.x, point.y, size * (.18 + ease(p) * 1.35), color, (1 - p) * .75, 2 - p);
  if (!soft) ring(ctx, point.x, point.y, size * (.06 + ease(p) * .72), '#fff0c5', (1 - p) * .6, 2.5);
  burst(ctx, point.x, point.y, size, p, color, seed, soft ? 10 : 18);
}
function arcPoint(from, to, t, lift) {
  return { x: mix(from.x, to.x, t), y: mix(from.y, to.y, t) - Math.sin(t * Math.PI) * lift };
}
function travel(ctx, { from, to, size, p, seed }, name, color, options = {}) {
  const end = options.end || .62;
  const t = phase(p, .05, end);
  const lift = options.lift ?? size * 1.5;
  if (p < end) {
    const where = arcPoint(from, to, smooth(t), lift);
    const heading = Math.atan2(to.y - from.y - Math.cos(smooth(t) * Math.PI) * Math.PI * lift, to.x - from.x);
    if (options.trail !== false) {
      for (let i = 1; i <= 12; i++) {
        const back = Math.max(0, smooth(t) - i * .018);
        const dot = arcPoint(from, to, back, lift);
        ctx.save(); ctx.globalAlpha *= (1 - i / 13) * .24;
        circle(ctx, dot.x, dot.y, size * (.12 + i * .008), options.smoke ? '#bdc9d7' : color);
        ctx.restore();
      }
    }
    glow(ctx, where.x, where.y, size * .8, color, .16);
    if (options.mirror) {
      ctx.save(); ctx.translate(where.x, where.y); ctx.scale(to.x < from.x ? -1 : 1, 1);
      object(ctx, name, 0, 0, size, 0, p, color); ctx.restore();
    } else {
      object(ctx, name, where.x, where.y, size, options.rotate ? t * TAU * options.rotate : options.orient ? heading : 0, p, color);
    }
  }
  const hit = phase(p, end, 1);
  if (hit) impact(ctx, to, size, hit, color, seed, options.soft);
}
function orbitObjects(ctx, name, target, size, p, color, seed, count = 5) {
  for (let i = 0; i < count; i++) {
    const angle = i * TAU / count + p * 2.4;
    const radius = size * (1.2 - ease(phase(p, .3, .9)) * .7);
    const x = target.x + Math.cos(angle) * radius;
    const y = target.y + Math.sin(angle) * radius * .65 - size * .1;
    ctx.save(); ctx.globalAlpha *= Math.min(phase(p, i * .03, .23), 1 - phase(p, .78, 1));
    object(ctx, name, x, y, size * (.38 + random(seed, i) * .14), Math.sin(p * 5 + i) * .3, p, color);
    ctx.restore();
  }
}
function rise(ctx, name, to, size, p, color, seed) {
  const t = ease(phase(p, 0, .2));
  const x = to.x;
  const y = to.y - size * (.1 + smooth(phase(p, .12, .8)) * .65);
  glow(ctx, x, y, size * 1.4, color, .17);
  object(ctx, name, x, y, size * t * (1 + Math.sin(p * Math.PI) * .1), Math.sin(p * TAU) * .035, p, color);
  burst(ctx, to.x, to.y, size * .75, phase(p, .3, 1), color, seed, 9);
}

function waterScene(ctx, frame, drink = false) {
  const { to, size, p, seed } = frame;
  if (!drink) {
    travel(ctx, frame, 'drop', palette.blue, { lift: size * 1.4, end: .48, soft: true });
    const t = phase(p, .46, 1);
    if (t) {
      burst(ctx, to.x, to.y, size * 1.05, t, palette.blue, seed, 23, 'drop');
      for (let i = 0; i < 2; i++) ring(ctx, to.x, to.y + size * .2, size * (.3 + ease(t) * (1 + i * .4)), '#9bdfff', (1 - t) * .5);
    }
    return;
  }
  const lift = smooth(phase(p, .05, .34));
  const lower = smooth(phase(p, .72, 1));
  const side = frame.from.x <= to.x ? 1 : -1;
  const mouthY = to.y - (Number(to.size) || size / .67) * .13;
  const x = to.x + side * size * mix(.78, .38, lift) + side * size * lower * .35;
  const y = mix(to.y + size * .58, mouthY + size * .2, lift) + size * lower * .65;
  const tilt = side * (-.05 - Math.sin(phase(p, .26, .82) * Math.PI) * .8);
  object(ctx, 'glass', x, y, size * .78, tilt, p, palette.blue);
  if (p > .3 && p < .77) {
    const sipping = phase(p, .3, .77);
    for (let i = 0; i < 5; i++) {
      const t = (sipping * 3 + i / 5) % 1;
      const drop = arcPoint({ x: x - side * size * .17, y: y - size * .25 },
        { x: to.x, y: mouthY }, t, size * .1);
      circle(ctx, drop.x, drop.y, size * .035, '#bbebff');
    }
  }
  if (p > .56) {
    impact(ctx, to, size * .72, phase(p, .56, 1), '#8cd8f4', seed, true);
    star(ctx, to.x - size * .45, to.y - size * .65, size * .12 * Math.sin(phase(p, .56, 1) * Math.PI), '#bcf0ff');
  }
}
function energyScene(ctx, frame, drain = false) {
  const { from, to, size, p, seed, color } = frame;
  const head = phase(p, .03, .72);
  ctx.save(); ctx.globalAlpha *= Math.sin(p * Math.PI) * .65;
  ctx.beginPath(); ctx.moveTo(from.x, from.y);
  ctx.bezierCurveTo(mix(from.x, to.x, .32), from.y - size * .8,
    mix(from.x, to.x, .68), to.y - size * .8, to.x, to.y);
  ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.setLineDash([3, 9]); ctx.stroke(); ctx.restore();
  for (let i = 0; i < 6; i++) {
    const local = phase(p, .04 + i * .055, .5 + i * .055);
    if (local <= 0 || local >= 1) continue;
    const at = arcPoint(from, to, smooth(local), size * .65);
    glow(ctx, at.x, at.y, size * .36, color, .25);
    object(ctx, drain ? 'drop' : 'bolt', at.x, at.y, size * .27, .15 * Math.sin(local * 10), p, color);
  }
  ring(ctx, from.x, from.y, size * (.72 - head * .38), color, (1 - head) * .65);
  if (p > .4) impact(ctx, to, size, phase(p, .4, 1), color, seed, true);
}
function gasScene(ctx, frame, kind) {
  const { to, size, p, seed } = frame;
  const color = kind === 'mushrooms' ? palette.purple : kind === 'contamination' ? '#b8d779' : '#90daa1';
  for (let i = 0; i < 7; i++) {
    const t = phase(p, i * .035, .6 + i * .04);
    if (!t || t >= 1) continue;
    const x = to.x + (random(seed, i) - .5) * size * 1.5 + Math.sin(t * 4 + i) * size * .22;
    const y = to.y + size * .45 - t * size * 1.6;
    ctx.save(); ctx.globalAlpha *= Math.sin(t * Math.PI) * .28;
    circle(ctx, x, y, size * (.12 + t * .28), color); ctx.restore();
    if (i % 2 === 0) ring(ctx, x + size * .08, y, size * .04, color, Math.sin(t * Math.PI) * .7, 1.3);
  }
  if (kind === 'mushrooms') {
    for (let i = 0; i < 3; i++) {
      const t = ease(phase(p, i * .055, .25 + i * .055));
      object(ctx, 'mushroom', to.x + (i - 1) * size * .46, to.y + size * .35,
        size * t * (i === 1 ? .7 : .49), (i - 1) * .13, p, color);
    }
  } else if (kind === 'plague') {
    orbitObjects(ctx, 'virus', to, size, p, color, seed, 4);
  } else {
    rise(ctx, kind === 'contamination' ? 'barrel' : 'vial', to, size * .78, p, color, seed);
  }
}
function stormScene(ctx, frame, gust = false) {
  const { to, size, p, seed } = frame;
  if (!gust) {
    object(ctx, 'cloud', to.x, to.y - size * .65, size * .96, 0, p, palette.blue);
    if (p > .3 && p < .72) {
      const flash = .4 + Math.sin(p * 49) ** 8 * .6;
      ctx.save(); ctx.globalAlpha *= flash;
      path(ctx, [[to.x + size * .15, to.y - size * .4], [to.x - size * .16, to.y - size * .04],
        [to.x + size * .08, to.y - size * .04], [to.x - size * .18, to.y + size * .4]], null, '#ffe7a6', false);
      ctx.lineWidth = 2.8; ctx.stroke(); glow(ctx, to.x, to.y, size, '#ffdf83', .16); ctx.restore();
    }
    for (let i = 0; i < 13; i++) {
      const t = (p * 1.8 + i / 13) % 1;
      const x = to.x + (random(seed, i) - .5) * size * 1.1 - t * size * .18;
      const y = to.y - size * .55 + t * size * 1.1;
      line(ctx, x, y, x - size * .035, y + size * .15, '#8cbcdf', 1.2);
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const t = (p * 1.7 + i / 7) % 1;
      const spread = size * (.3 + i * .045);
      ctx.save(); ctx.globalAlpha *= Math.sin(t * Math.PI) * .8;
      ctx.beginPath(); ctx.ellipse(to.x, to.y + (i - 3) * size * .12, spread, size * .1, t * .3, -.6 + p * 5, 4.7 + p * 5);
      ctx.strokeStyle = '#bcdded'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
    }
    burst(ctx, to.x, to.y, size, phase(p, .24, 1), '#b2cdb9', seed, 10, 'dust');
  }
}
function debrisScene(ctx, frame) {
  const { to, size, p, seed } = frame;
  const fall = phase(p, .03, .62);
  for (let i = 0; i < 6; i++) {
    const offset = (random(seed, i) - .5) * size * 1.7;
    const t = phase(p, i * .04, .46 + i * .04);
    if (t >= 1) continue;
    const y = to.y - size * 1.5 + t * t * size * 1.8;
    ctx.save(); ctx.translate(to.x + offset, y); ctx.rotate(t * 2 + i);
    const r = size * (.08 + random(seed, i + 7) * .1);
    path(ctx, [[-r, -.6 * r], [.2 * r, -r], [r, -.3 * r], [.7 * r, r], [-.7 * r, .7 * r]], '#75869c', '#bbcadb'); ctx.restore();
  }
  if (fall > .5) {
    const t = phase(p, .35, 1);
    burst(ctx, to.x, to.y + size * .3, size, t, '#b0aa9a', seed, 18, 'dust');
    impact(ctx, to, size * .65, t, '#c0b7aa', seed, true);
  }
}
function coinScene(ctx, frame, kind) {
  const { from, to, size, p, seed } = frame;
  const local = ['money', 'profit', 'investment', 'jackpot', 'charity'].includes(kind);
  if (kind === 'investment' || kind === 'profit') rise(ctx, 'chart', to, size * .8, p, palette.green, seed);
  else if (kind === 'scam') rise(ctx, 'wallet', to, size * .86, p, palette.gold, seed);
  else if (kind === 'jackpot') {
    object(ctx, 'dice', to.x - size * .25, to.y - size * .2, size * .65, Math.sin(p * 8) * .5 * (1 - p), p, palette.gold);
    object(ctx, 'dice', to.x + size * .3, to.y + size * .13, size * .56, -.25 - Math.sin(p * 7) * .3 * (1 - p), p, palette.gold);
  }
  for (let i = 0; i < 7; i++) {
    const t = phase(p, i * .05, .5 + i * .055);
    if (t <= 0 || t >= 1) continue;
    const begin = local ? { x: to.x + (random(seed, i) - .5) * size * 1.4, y: to.y - size * 1.25 } : from;
    const at = local ? { x: mix(begin.x, to.x, t * .45), y: mix(begin.y, to.y + size * .45, t * t) }
      : arcPoint(begin, to, smooth(t), size * (1 + i * .05));
    ctx.save(); ctx.globalAlpha *= Math.sin(t * Math.PI);
    object(ctx, 'coin', at.x, at.y, size * .32, t * 3, p, palette.gold); ctx.restore();
  }
  if (p > .5) impact(ctx, to, size * .7, phase(p, .5, 1), palette.gold, seed, true);
}

/**
 * Draw one card's scene. Coordinates and dimensions are CSS pixels. The caller
 * clears the canvas and manages DPR, clipping, reduced motion and duration.
 */
export function drawCardScene(ctx, frame) {
  if (!ctx || !frame?.from || !frame?.to) return;
  const p = clamp(Number(frame.progress) || 0);
  if (p <= 0 || p >= 1) return;
  const source = frame.from, target = frame.to;
  if (![source.x, source.y, target.x, target.y].every(Number.isFinite)) return;
  const size = clamp((Number(target.size) || 80) * .67, 30, 62);
  const f = { ...frame, from: source, to: target, size, p, color: frame.color || palette.gold, seed: frame.seed || 1 };
  const { from, to, color, seed } = f;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalAlpha *= smooth(phase(p, 0, .08)) * (1 - smooth(phase(p, .88, 1)));
  switch (frame.scene) {
    case 'missile':
      travel(ctx, f, 'missile', palette.orange, { orient: true, smoke: true, lift: size * .7 }); break;
    case 'drink': waterScene(ctx, f, true); break;
    case 'splash': waterScene(ctx, f); break;
    case 'transfer': energyScene(ctx, f); break;
    case 'drain': energyScene(ctx, { ...f, color: palette.purple }, true); break;
    case 'charge':
      rise(ctx, 'bolt', to, size, p, palette.gold, seed);
      for (let i = 0; i < 3; i++) ring(ctx, to.x, to.y, size * (.5 + phase(p, .1 + i * .1, 1) * .8), palette.gold, (1 - p) * .35);
      break;
    case 'mushrooms': case 'poison': case 'toxin': case 'plague': case 'contamination':
      gasScene(ctx, f, frame.scene); break;
    case 'collapse': debrisScene(ctx, f); break;
    case 'nuclear': {
      const t = phase(p, .25, 1);
      if (p < .48) object(ctx, 'atom', to.x, to.y, size * (.5 + phase(p, 0, .35) * .7), 0, p, '#ffdda0');
      if (t) {
        impact(ctx, to, size * 1.25, t, '#ffd28e', seed);
        const rise = ease(t);
        ctx.save(); ctx.globalAlpha *= Math.sin(t * Math.PI) * .48;
        circle(ctx, to.x, to.y - rise * size * .8, size * (.1 + rise * .65), '#b7a08b');
        circle(ctx, to.x - size * .32, to.y - rise * size * .84, size * (.05 + rise * .4), '#d4b495');
        circle(ctx, to.x + size * .32, to.y - rise * size * .84, size * (.05 + rise * .4), '#d4b495');
        roundRect(ctx, to.x - size * .09, to.y - rise * size * .5, size * .18, size * .55, size * .07, '#c5ac94', null);
        ctx.restore();
      }
      break;
    }
    case 'balance': case 'equalize':
      rise(ctx, 'scales', to, size, p, palette.gold, seed);
      ring(ctx, to.x, to.y, size * (.65 + ease(p) * .45), '#b6d8e5', Math.sin(p * Math.PI) * .45);
      break;
    case 'slash': {
      const swipe = phase(p, .12, .62);
      if (p < .72) {
        object(ctx, 'sword', to.x + mix(-size * .6, size * .5, smooth(swipe)),
          to.y + mix(size * .4, -size * .4, smooth(swipe)), size * .94, mix(-1, .8, smooth(swipe)), p, color);
        ctx.save(); ctx.globalAlpha *= Math.sin(swipe * Math.PI);
        ctx.beginPath(); ctx.ellipse(to.x, to.y, size * .87, size * .32, -.55, -.8, 2.3);
        ctx.strokeStyle = '#e2f3ff'; ctx.lineWidth = 3.5; ctx.stroke(); ctx.restore();
      }
      impact(ctx, to, size * .8, phase(p, .48, 1), palette.blue, seed); break;
    }
    case 'bomb': travel(ctx, f, 'bomb', palette.orange, { lift: size * 2.1, rotate: 1.4 }); break;
    case 'sniper': {
      const aim = phase(p, .06, .48);
      const r = size * (1.15 - smooth(aim) * .55);
      ctx.save(); ctx.globalAlpha *= p < .57 ? 1 : 1 - phase(p, .57, .75);
      ring(ctx, to.x, to.y, r, '#e4ddd0', 1, 1.5);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; line(ctx, to.x + Math.cos(a) * r * .6, to.y + Math.sin(a) * r * .6,
        to.x + Math.cos(a) * r * 1.25, to.y + Math.sin(a) * r * 1.25, '#e4ddd0', 1.6); }
      circle(ctx, to.x, to.y, 2, '#ffd9a0'); ctx.restore();
      if (p > .45 && p < .56) line(ctx, from.x, from.y, to.x, to.y, '#ffdc96', 2.4);
      impact(ctx, to, size * .65, phase(p, .5, 1), palette.orange, seed); break;
    }
    case 'apple': {
      const lift = smooth(phase(p, .05, .52));
      const x = to.x + mix(size * .64, size * .08, lift);
      const y = mix(to.y + size * .46, to.y - (Number(to.size) || 80) * .13, lift);
      ctx.save(); ctx.globalAlpha *= 1 - phase(p, .62, .81);
      object(ctx, 'apple', x, y, size * .76, -.2 + lift * .3, p, palette.red); ctx.restore();
      if (p > .47) impact(ctx, to, size * .8, phase(p, .47, 1), palette.green, seed, true); break;
    }
    case 'scam': case 'charity': case 'money': case 'profit': case 'investment': case 'jackpot':
      coinScene(ctx, f, frame.scene); break;
    case 'circuitry': {
      glow(ctx, to.x, to.y, size * 1.5, palette.blue, .16);
      for (let i = 0; i < 7; i++) {
        const a = i * TAU / 7;
        const x = to.x + Math.cos(a) * size * .8, y = to.y + Math.sin(a) * size * .8;
        const t = phase(p, i * .04, .38 + i * .04);
        if (!t) continue;
        const bx = mix(to.x, x, .45), by = mix(to.y, y, .45);
        ctx.save(); ctx.globalAlpha *= .6 + Math.sin(p * 17 + i) * .3;
        path(ctx, [[to.x, to.y], [bx, to.y], [bx, by], [x, y]], null, '#84d8ef', false);
        circle(ctx, x, y, 3.2, '#b4eefe', '#4da2b6'); ctx.restore();
      }
      object(ctx, 'bolt', to.x, to.y, size * .48, 0, p, '#abecfa'); break;
    }
    case 'reactor':
      rise(ctx, 'reactor', to, size, p, palette.gold, seed);
      for (let i = 0; i < 6; i++) {
        const t = (p * 1.25 + i / 6) % 1;
        ctx.save(); ctx.globalAlpha *= Math.sin(t * Math.PI) * .28;
        circle(ctx, to.x + size * .17 + Math.sin(t * 6) * size * .08, to.y - size * .73 - t * size * .8,
          size * (.06 + t * .15), '#c3d6e5'); ctx.restore();
      }
      break;
    case 'battery': rise(ctx, 'battery', to, size, p, palette.green, seed); break;
    case 'music': case 'sonic': case 'dance': {
      const notes = frame.scene === 'dance' ? 6 : 4;
      orbitObjects(ctx, 'note', to, size, p, frame.scene === 'sonic' ? palette.blue : palette.purple, seed, notes);
      if (frame.scene !== 'dance') {
        for (let i = 0; i < 3; i++) {
          const t = phase(p, i * .13, .7 + i * .1);
          if (t > 0 && t < 1) ring(ctx, to.x, to.y, size * (.24 + t * 1.1), '#c5b2f3', (1 - t) * .5);
        }
      } else {
        const bounce = Math.sin(p * TAU * 3) * size * .1;
        for (let side = -1; side <= 1; side += 2) {
          const x = to.x + side * size * .32;
          ctx.save(); ctx.globalAlpha *= Math.sin(p * Math.PI) * .8;
          ctx.beginPath(); ctx.ellipse(x, to.y + size * .66 + side * bounce, size * .12, size * .2, side * .2, 0, TAU);
          ctx.fillStyle = '#9d8aca'; ctx.fill(); ctx.restore();
        }
      }
      break;
    }
    case 'sand': {
      const end = .62, t = phase(p, .04, end);
      for (let i = 0; i < 32; i++) {
        const offset = (random(seed, i) - .5) * size * .55;
        const at = arcPoint(from, to, clamp(smooth(t) - random(seed, i + 40) * .1), size * .35);
        ctx.save(); ctx.globalAlpha *= p < end ? .8 : 1 - phase(p, end, 1);
        circle(ctx, at.x + offset, at.y + offset * .4, size * (.013 + random(seed, i + 80) * .025), '#e5cc94'); ctx.restore();
      }
      burst(ctx, to.x, to.y, size, phase(p, .5, 1), '#d9c398', seed, 22, 'dust'); break;
    }
    case 'car': travel(ctx, f, 'car', palette.blue, { lift: 0, trail: false, end: .66, mirror: true }); break;
    case 'vitality': rise(ctx, 'heart', to, size, p, palette.green, seed); break;
    case 'projectile': {
      const t = phase(p, .05, .58), at = arcPoint(from, to, smooth(t), size * .36);
      if (p < .58) {
        glow(ctx, at.x, at.y, size * .55, color, .4); circle(ctx, at.x, at.y, size * .11, '#fff5df', color);
        for (let i = 0; i < 8; i++) {
          const previous = arcPoint(from, to, Math.max(0, smooth(t) - i * .018), size * .36);
          ctx.save(); ctx.globalAlpha *= (1 - i / 8) * .5;
          circle(ctx, previous.x, previous.y, size * (.09 - i * .007), color); ctx.restore();
        }
      }
      impact(ctx, to, size, phase(p, .58, 1), color, seed); break;
    }
    case 'fracture':
      rise(ctx, 'fracture', to, size, p, palette.red, seed);
      burst(ctx, to.x, to.y, size, phase(p, .35, 1), '#e5a5b7', seed, 12); break;
    case 'traffic':
      rise(ctx, 'traffic', to, size, p, palette.gold, seed);
      ring(ctx, to.x, to.y + size * .42, size * (.4 + ease(p) * .5), '#eab48c', Math.sin(p * Math.PI) * .5); break;
    case 'atom': rise(ctx, 'atom', to, size, p, palette.blue, seed); break;
    case 'cannon': {
      const direction = to.x >= from.x ? 1 : -1;
      ctx.save(); ctx.translate(from.x, from.y + size * .22); ctx.scale(direction, 1);
      object(ctx, 'cannon', -Math.sin(phase(p, .2, .48) * Math.PI) * size * .1, 0, size, 0, p, color); ctx.restore();
      const t = phase(p, .23, .64);
      if (p > .23 && p < .64) {
        const at = arcPoint({ x: from.x + direction * size * .4, y: from.y }, to, smooth(t), size * .45);
        circle(ctx, at.x, at.y, size * .11, '#46576c', '#c5d7e9');
      }
      impact(ctx, to, size, phase(p, .64, 1), palette.orange, seed); break;
    }
    case 'numbers': orbitObjects(ctx, 'numbers', to, size, p, palette.blue, seed, 5); break;
    case 'balloon':
      object(ctx, 'balloon', to.x + Math.sin(p * 4) * size * .2, to.y + size * (.3 - ease(p) * 1.3), size * .72, Math.sin(p * 6) * .09, p, palette.purple);
      burst(ctx, to.x, to.y, size * .75, phase(p, .36, 1), '#dbc3f9', seed, 10); break;
    case 'meal':
      rise(ctx, 'meal', to, size, p, palette.gold, seed);
      for (let i = 0; i < 3; i++) {
        const x = to.x + (i - 1) * size * .19;
        ctx.save(); ctx.globalAlpha *= Math.sin(p * Math.PI) * .4;
        ctx.beginPath(); ctx.moveTo(x, to.y - size * .62); ctx.bezierCurveTo(x - size * .12, to.y - size * .78,
          x + size * .1, to.y - size * .86, x, to.y - size); ctx.strokeStyle = '#eef4e9'; ctx.lineWidth = 1.4; ctx.stroke(); ctx.restore();
      }
      break;
    case 'storm': stormScene(ctx, f); break;
    case 'gust': stormScene(ctx, f, true); break;
    case 'gift': travel(ctx, f, 'gift', palette.gold, { lift: size * .9, soft: true, rotate: .2 }); break;
    case 'barrel': travel(ctx, f, 'barrel', palette.orange, { lift: size * .4, rotate: 1.4 }); break;
    case 'alchemy':
      rise(ctx, 'flask', to, size, p, '#a6d897', seed);
      orbitObjects(ctx, 'star', to, size * .75, p, '#daceff', seed, 5); break;
    default:
      rise(ctx, 'bolt', to, size, p, color, seed);
  }
  ctx.restore();
}
