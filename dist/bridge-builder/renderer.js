// Original canvas artwork. Physics positions remain the source of every beam and vehicle.
const PALETTES = {
  valley: { sky: ['#dceaf0', '#b7d3dc', '#f0efe3'], far: '#a9bec1', mountain: '#7e9ca0', mountainDark: '#547a78', grass: '#829164', grassDark: '#526849', rock: '#8b8974', rockDark: '#5c6459', water: '#638e91', waterDark: '#335d65', foliage: '#3d6455', light: '#f7eac9' },
  canyon: { sky: ['#e7e2d7', '#d5d6d1', '#f9e6cd'], far: '#c7b3a0', mountain: '#af8971', mountainDark: '#996953', grass: '#ab9c73', grassDark: '#84785b', rock: '#bc947a', rockDark: '#885e4e', water: '#769392', waterDark: '#496c73', foliage: '#687963', light: '#ffebc5' },
  coast: { sky: ['#d2e7ee', '#b1d4df', '#e8f1ee'], far: '#b0c9ce', mountain: '#8fabb0', mountainDark: '#708d90', grass: '#8f9b74', grassDark: '#627657', rock: '#939b8e', rockDark: '#636f6a', water: '#5a98a5', waterDark: '#356c7e', foliage: '#497363', light: '#f1eddb' },
  alpine: { sky: ['#d4e5ee', '#abc9d9', '#edf0eb'], far: '#b6c6cc', mountain: '#91a7af', mountainDark: '#697f89', grass: '#788e68', grassDark: '#46664e', rock: '#909792', rockDark: '#606e6c', water: '#6a9b9c', waterDark: '#3d6974', foliage: '#315c50', light: '#f6efd9' },
};

const MATERIAL_COLORS = { road: '#6d7d83', deck: '#6d7d83', wood: '#b38c5d', steel: '#719499', cable: '#7b8581' };
const TAU = Math.PI * 2;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const lerp = (a, b, t) => a + (b - a) * t;
const finite = (n, fallback) => Number.isFinite(n) ? n : fallback;

function seeded(seed) {
  let value = 2166136261;
  for (const character of String(seed)) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return () => { value = Math.imul(value ^ value >>> 15, 2246822519); value = Math.imul(value ^ value >>> 13, 3266489917); return (value >>> 0) / 4294967296; };
}

function hexMix(a, b, amount) {
  const channels = [1, 3, 5].map(index => Math.round(lerp(parseInt(a.slice(index, index + 2), 16), parseInt(b.slice(index, index + 2), 16), amount)));
  return `rgb(${channels.join(',')})`;
}

export function createBridgeRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let width = 960, height = 460, ratio = 1;
  let camera = { scale: 25, left: 80, top: 60, minX: -4, maxY: 8 };
  let currentLevel = null;
  let scenery = null;
  let lastMode = 'build';
  const brokenAt = new Map();

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width || canvas.clientWidth || 960);
    height = Math.max(1, rect.height || canvas.clientHeight || 460);
    ratio = Math.min(2, globalThis.devicePixelRatio || 1);
    const targetWidth = Math.round(width * ratio), targetHeight = Math.round(height * ratio);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    if (currentLevel) updateCamera(currentLevel);
  }

  function updateCamera(level) {
    const span = finite(level.span, 16);
    const bounds = level.bounds || {};
    const minX = finite(bounds.minX, -4), maxX = finite(bounds.maxX, span + 4);
    const minY = finite(bounds.minY, -8), maxY = finite(bounds.maxY, 7);
    const marginX = width < 550 ? 16 : 36, marginY = height < 330 ? 18 : 32;
    const scale = Math.max(.1, Math.min((width - 2 * marginX) / (maxX - minX), (height - 2 * marginY) / (maxY - minY)));
    camera = { scale, left: (width - (maxX - minX) * scale) / 2, top: (height - (maxY - minY) * scale) / 2, minX, maxY, minY, maxX };
  }

  function worldToScreen(point) {
    return { x: camera.left + (point.x - camera.minX) * camera.scale, y: camera.top + (camera.maxY - point.y) * camera.scale };
  }

  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { x: (clientX - rect.left - camera.left) / camera.scale + camera.minX, y: camera.maxY - (clientY - rect.top - camera.top) / camera.scale };
  }

  function path(points, close = false) {
    ctx.beginPath();
    points.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
    if (close) ctx.closePath();
  }

  function line(a, b, color, lineWidth = 1) {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.stroke();
  }

  function circle(x, y, radius, fill, stroke = null, lineWidth = 1) {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function roundedRect(x, y, w, h, radius) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius);
  }

  function makeScenery(level) {
    const random = seeded(level.id ?? `${level.region}-${level.span}`);
    return {
      mountains: Array.from({ length: 3 }, (_, layer) => Array.from({ length: 19 }, (_, index) => ({ x: index / 18, height: random() * (.07 + layer * .024), sharp: random() }))),
      ripples: Array.from({ length: 54 }, () => ({ x: random(), y: random(), length: .012 + random() * .07, speed: .1 + random() * .25, phase: random() * TAU })),
      bankDetails: Array.from({ length: 34 }, () => ({ x: random(), y: random(), scale: random(), side: random() > .5 ? 1 : 0 })),
      trees: Array.from({ length: 13 }, () => ({ x: random(), scale: .5 + random() * .65, side: random() > .5 ? 1 : 0, shape: random() })),
      clouds: Array.from({ length: 5 }, () => ({ x: random(), y: .075 + random() * .15, scale: .3 + random() * .7 })),
    };
  }

  function drawSky(palette, level, time) {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, palette.sky[0]); sky.addColorStop(.55, palette.sky[1]); sky.addColorStop(1, palette.sky[2]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    const sun = ctx.createRadialGradient(width * .77, height * .17, 0, width * .77, height * .17, width * .26);
    sun.addColorStop(0, '#fffcde58'); sun.addColorStop(.22, '#fff9dc22'); sun.addColorStop(1, '#fff9dc00');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, width, height);
    scenery.clouds.forEach(cloud => {
      const x = width * cloud.x + Math.sin(time * .009 + cloud.x) * 5, y = height * cloud.y;
      ctx.save(); ctx.translate(x, y); ctx.scale(cloud.scale, cloud.scale * .4);
      const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, 90);
      haze.addColorStop(0, '#fffff53b'); haze.addColorStop(1, '#fffff500');
      ctx.fillStyle = haze; ctx.fillRect(-95, -95, 190, 190); ctx.restore();
    });
    const deckY = worldToScreen({ x: 0, y: 0 }).y;
    const horizon = clamp(deckY + camera.scale * .5, height * .3, height * .74);
    scenery.mountains.forEach((ridge, layer) => {
      const baseline = horizon - (2 - layer) * height * .035;
      const peaks = ridge.map(point => ({ x: point.x * width, y: baseline - height * (.075 + point.height + Math.sin(point.x * 10 + layer * 2) * .05) }));
      const gradient = ctx.createLinearGradient(0, baseline - height * .28, 0, baseline + height * .12);
      gradient.addColorStop(0, [palette.far, palette.mountain, palette.mountainDark][layer]);
      gradient.addColorStop(1, palette.sky[2]);
      path([{ x: -20, y: horizon + 70 }, ...peaks, { x: width + 20, y: horizon + 70 }], true);
      ctx.fillStyle = gradient; ctx.fill();
      if (level.region === 'alpine' && layer < 2) {
        peaks.forEach((peak, index) => {
          if (index < 1 || index >= peaks.length - 1 || peak.y > peaks[index - 1].y || peak.y > peaks[index + 1].y) return;
          path([peak, { x: peak.x + width * .025, y: peak.y + height * .029 }, { x: peak.x + width * .009, y: peak.y + height * .023 }, { x: peak.x, y: peak.y + height * .034 }, { x: peak.x - width * .019, y: peak.y + height * .021 }], true);
          ctx.fillStyle = layer === 0 ? '#e9eeeb99' : '#dce7e2a0'; ctx.fill();
        });
      }
      // Shadowed rock faces give the horizon actual facets instead of a flat silhouette.
      if (layer === 2) peaks.forEach((peak, index) => {
        if (index < peaks.length - 1 && peak.y < peaks[index + 1].y) {
          path([peak, peaks[index + 1], { x: peak.x + width * .028, y: horizon + 45 }], true);
          ctx.fillStyle = level.region === 'canyon' ? '#654b3914' : '#37595b12'; ctx.fill();
        }
      });
    });
    const veil = ctx.createLinearGradient(0, horizon - 20, 0, horizon + 65);
    veil.addColorStop(0, '#edf2e500'); veil.addColorStop(1, '#edf2e551');
    ctx.fillStyle = veil; ctx.fillRect(0, horizon - 20, width, 85);
  }

  function drawWater(palette, level, time) {
    const waterY = worldToScreen({ x: 0, y: finite(level.waterY, -5) }).y;
    const surface = Math.min(height - 10, waterY);
    const water = ctx.createLinearGradient(0, surface, 0, height);
    water.addColorStop(0, palette.water); water.addColorStop(1, palette.waterDark);
    ctx.fillStyle = water; ctx.fillRect(0, surface, width, height - surface);
    const shine = ctx.createLinearGradient(width * .1, 0, width * .8, 0);
    shine.addColorStop(0, '#eaf2d800'); shine.addColorStop(.63, '#eff3d529'); shine.addColorStop(1, '#eff3d500');
    ctx.fillStyle = shine; ctx.fillRect(0, surface, width, height - surface);
    scenery.ripples.forEach(ripple => {
      const bandHeight = Math.max(15, height - surface);
      const y = surface + ripple.y * bandHeight;
      const drift = time * ripple.speed * .007;
      const x = ((ripple.x + drift) % 1.15 - .075) * width;
      const length = width * ripple.length * (.5 + ripple.y);
      const shimmer = .035 + .09 * (Math.sin(time * .6 + ripple.phase) + 1) * .5;
      line({ x, y }, { x: x + length, y: y + Math.sin(ripple.phase + time * .3) * 1.1 }, `rgba(222,239,217,${shimmer})`, .8 + ripple.y);
      if (ripple.y > .2) line({ x: x + 8, y: y + 3.5 }, { x: x + length * .68, y: y + 3.5 }, '#254b5715', 1);
    });
    // An irregular river edge reads as running water, not a solid block.
    ctx.beginPath();
    for (let x = 0; x <= width + 12; x += 12) {
      const y = surface + Math.sin(x * .023 + time * .35) * .8;
      if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#d9e6cf44'; ctx.lineWidth = 1; ctx.stroke();
  }

  function bankGeometry(side, level) {
    const span = finite(level.span, 16), waterY = finite(level.waterY, -5);
    const edge = side === 0 ? 0 : span, sign = side === 0 ? 1 : -1;
    const top = worldToScreen({ x: edge, y: 0 });
    const shore = worldToScreen({ x: edge + sign * 1.7, y: waterY - .45 });
    const cliff = [top, worldToScreen({ x: edge + sign * .5, y: -1.15 }), worldToScreen({ x: edge + sign * .25, y: -2.15 }), worldToScreen({ x: edge + sign * 1.15, y: waterY + 1.2 }), shore];
    const outerX = side === 0 ? -10 : width + 10;
    return { top, shore, cliff, sign, outerX };
  }

  function drawBanks(palette, level) {
    for (let side = 0; side < 2; side++) {
      const bank = bankGeometry(side, level), { top, shore, cliff, outerX, sign } = bank;
      path([{ x: outerX, y: top.y - 10 }, ...cliff, { x: outerX, y: height + 20 }], true);
      const rock = ctx.createLinearGradient(0, top.y, 0, height);
      rock.addColorStop(0, palette.rock); rock.addColorStop(.65, palette.rockDark); rock.addColorStop(1, palette.rockDark);
      ctx.fillStyle = rock; ctx.fill();
      ctx.save(); ctx.clip();
      for (let strata = 0; strata < 10; strata++) {
        const y = top.y + 18 + strata * camera.scale * .65;
        ctx.beginPath(); ctx.moveTo(outerX, y - sign * 9); ctx.bezierCurveTo(top.x - sign * 75, y - 6, top.x - sign * 15, y + 10, shore.x + sign * 20, y - 2);
        ctx.strokeStyle = strata % 2 ? '#ffffff0c' : '#1d332526'; ctx.lineWidth = strata % 2 ? 3 : 1.2; ctx.stroke();
      }
      scenery.bankDetails.filter(detail => detail.side === side).forEach(detail => {
        const x = lerp(outerX, top.x, detail.x), y = top.y + 12 + detail.y * (height - top.y);
        const size = 3 + detail.scale * 12;
        path([{ x, y }, { x: x + size * .8, y: y - size * .22 }, { x: x + size, y: y + size * .45 }, { x: x + size * .2, y: y + size * .55 }], true);
        ctx.fillStyle = detail.scale > .6 ? '#25392d15' : '#f0e6ce16'; ctx.fill();
        if (detail.scale > .7) line({ x: x + 2, y: y + 1 }, { x: x + size * .7, y: y - size * .15 }, '#f0e8d41c', 1);
      });
      ctx.restore();
      // A broad turf edge sits behind the road and the marked anchor.
      ctx.beginPath(); ctx.moveTo(outerX, top.y - 7); ctx.bezierCurveTo(lerp(outerX, top.x, .45), top.y - 18, top.x - sign * 30, top.y - 4, top.x, top.y - 3);
      ctx.lineTo(top.x + sign * 5, top.y + 7); ctx.lineTo(outerX, top.y + 12); ctx.closePath();
      const turf = ctx.createLinearGradient(0, top.y - 14, 0, top.y + 12);
      turf.addColorStop(0, palette.grass); turf.addColorStop(1, palette.grassDark);
      ctx.fillStyle = turf; ctx.fill();
      line({ x: outerX, y: top.y - 7 }, { x: top.x - sign * 4, y: top.y - 3 }, '#eef0c52e', 1.1);
      // Shore boulders and a small patch of moss soften the cut-bank edge.
      [0, 1, 2].forEach(index => {
        const x = shore.x - sign * (index * 10 + 6), y = shore.y + index * 4;
        ctx.beginPath(); ctx.ellipse(x, y, 11 - index * 2, 5, -.2 * sign, 0, TAU); ctx.fillStyle = palette.rockDark; ctx.fill();
        ctx.beginPath(); ctx.ellipse(x - 1, y - 1, 8 - index, 2.3, -.2 * sign, Math.PI, TAU); ctx.strokeStyle = '#d3dcc438'; ctx.lineWidth = 2; ctx.stroke();
      });
    }
  }

  function tree(x, y, size, palette, pine) {
    ctx.save();
    ctx.strokeStyle = '#635d49'; ctx.lineWidth = Math.max(1.3, size * .037);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - size * .65); ctx.stroke();
    if (pine) {
      for (let tier = 0; tier < 4; tier++) {
        const top = y - size + tier * size * .16, bottom = top + size * .43, spread = size * (.15 + tier * .045);
        path([{ x, y: top }, { x: x + spread, y: bottom }, { x: x + spread * .35, y: bottom - 2 }, { x: x - spread, y: bottom }], true);
        ctx.fillStyle = tier % 2 ? hexMix(palette.foliage, '#243f37', .13) : palette.foliage; ctx.fill();
        line({ x: x - spread * .72, y: bottom - 2 }, { x: x, y: top + 4 }, '#becaa415', .9);
      }
    } else {
      const foliage = ctx.createRadialGradient(x - size * .07, y - size * .74, 0, x, y - size * .66, size * .4);
      foliage.addColorStop(0, hexMix(palette.foliage, '#bac392', .25)); foliage.addColorStop(1, palette.foliage);
      [[-.17, -.65, .25], [.13, -.67, .28], [0, -.9, .24]].forEach(([dx, dy, r]) => circle(x + size * dx, y + size * dy, size * r, foliage));
      ctx.beginPath(); ctx.moveTo(x, y - size * .3); ctx.lineTo(x - size * .14, y - size * .69); ctx.moveTo(x, y - size * .46); ctx.lineTo(x + size * .11, y - size * .73);
      ctx.strokeStyle = '#635d4970'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  }

  function drawTrees(palette, level) {
    const a = worldToScreen({ x: 0, y: 0 }), b = worldToScreen({ x: level.span, y: 0 });
    scenery.trees.forEach(item => {
      const sideWidth = item.side === 0 ? a.x : width - b.x;
      if (sideWidth < 34) return;
      const distance = 28 + item.x * Math.max(12, sideWidth - 28);
      const x = item.side === 0 ? a.x - distance : b.x + distance;
      const y = a.y - 8 - Math.sin(item.x * 3) * 6;
      const size = clamp(camera.scale * 2.2 * item.scale, 22, 75);
      if (level.region === 'canyon' && item.shape < .45) {
        line({ x, y }, { x, y: y - size * .45 }, palette.foliage, size * .045);
        ctx.beginPath(); ctx.ellipse(x, y - size * .5, size * .3, size * .12, 0, 0, TAU); ctx.fillStyle = palette.foliage; ctx.fill();
      } else tree(x, y, size, palette, level.region === 'alpine' || item.shape > .5);
    });
  }

  function drawApproaches(level) {
    const left = worldToScreen({ x: 0, y: 0 }), right = worldToScreen({ x: level.span, y: 0 });
    for (const [start, end] of [[{ x: -10, y: left.y }, left], [right, { x: width + 10, y: right.y }]]) {
      line({ x: start.x, y: start.y + 6 }, { x: end.x, y: end.y + 6 }, '#293b3c33', 11);
      line(start, end, '#525f60', Math.max(6, camera.scale * .19));
      line({ x: start.x, y: start.y - 2 }, { x: end.x, y: end.y - 2 }, '#ced1bb', 1.4);
      ctx.setLineDash([11, 15]); line({ x: start.x, y: start.y + 1 }, { x: end.x, y: end.y + 1 }, '#e2dac88c', .85); ctx.setLineDash([]);
      line({ x: start.x, y: start.y + 5 }, { x: end.x, y: end.y + 5 }, '#8c9388', 2);
    }
  }

  function drawPiers(level, nodes, palette) {
    // A tower and its road anchor share one pier; render only the tallest at each x.
    const byX = new Map();
    nodes.filter(node => node.fixed).forEach(node => {
      const existing = byX.get(node.x);
      if (!existing || node.y > existing.y) byX.set(node.x, node);
    });
    const fixedNodes = [...byX.values()];
    fixedNodes.forEach(node => {
      // River supports are independent structures; outer banks already support their anchors.
      const onBank = node.x < .2 || node.x > level.span - .2;
      if (onBank && node.y <= 0) return;
      const p = worldToScreen(node), foot = worldToScreen({ x: node.x, y: onBank ? -.5 : finite(level.waterY, -5) - 2.6 });
      const pierWidth = clamp(camera.scale * .68, 8, 24), baseWidth = pierWidth * 1.4;
      const face = ctx.createLinearGradient(p.x - baseWidth, 0, p.x + baseWidth, 0);
      face.addColorStop(0, '#afb3a5'); face.addColorStop(.5, '#d2d2c0'); face.addColorStop(1, '#8d988f');
      path([{ x: p.x - pierWidth * .45, y: p.y + 3 }, { x: p.x + pierWidth * .45, y: p.y + 3 }, { x: p.x + baseWidth * .5, y: foot.y }, { x: p.x - baseWidth * .5, y: foot.y }], true);
      ctx.fillStyle = face; ctx.fill();
      line({ x: p.x - pierWidth * .45, y: p.y + 5 }, { x: p.x - baseWidth * .5, y: foot.y }, '#ebefde50', 1);
      const waterScreenY = worldToScreen({ x: node.x, y: finite(level.waterY, -5) }).y;
      ctx.save();
      ctx.beginPath(); ctx.rect(p.x - baseWidth, waterScreenY, baseWidth * 2, height); ctx.clip();
      ctx.fillStyle = `${palette.waterDark}59`; ctx.fillRect(p.x - baseWidth * .5, waterScreenY, baseWidth, height);
      ctx.restore();
      line({ x: p.x - pierWidth * .62, y: p.y + 3 }, { x: p.x + pierWidth * .62, y: p.y + 3 }, '#dbddca', Math.max(4, camera.scale * .18));
      for (let y = p.y + 15; y < Math.min(foot.y, height); y += camera.scale * .8) line({ x: p.x - pierWidth * .48, y }, { x: p.x + pierWidth * .48, y }, '#5b726218', 1);
      if (!onBank && waterScreenY < height) {
        ctx.beginPath(); ctx.ellipse(p.x, waterScreenY + 2, baseWidth + 6, 3, 0, 0, TAU); ctx.strokeStyle = '#c9e0d34d'; ctx.lineWidth = 1; ctx.stroke();
      }
    });
  }

  function drawClearances(level) {
    for (const clearance of level.clearances || []) {
      const topLeft = worldToScreen({ x: clearance.x1, y: clearance.maxY });
      const bottomRight = worldToScreen({ x: clearance.x2, y: clearance.minY });
      const w = bottomRight.x - topLeft.x, h = bottomRight.y - topLeft.y;
      ctx.save();
      roundedRect(topLeft.x, topLeft.y, w, h, 3);
      ctx.fillStyle = '#e2f1e81e'; ctx.fill();
      ctx.setLineDash([3, 5]); ctx.strokeStyle = '#386f7973'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      const label = 'KEEP CHANNEL CLEAR';
      ctx.font = '600 8px system-ui,sans-serif'; ctx.textAlign = 'center';
      const labelWidth = ctx.measureText(label).width + 12;
      const centerX = (topLeft.x + bottomRight.x) / 2;
      roundedRect(centerX - labelWidth / 2, bottomRight.y - 18, labelWidth, 15, 3);
      ctx.fillStyle = '#e4eee2bf'; ctx.fill();
      ctx.fillStyle = '#426671'; ctx.fillText(label, centerX, bottomRight.y - 7);
      ctx.restore();
    }
  }

  function drawGrid(level) {
    const bounds = level.bounds || { minX: -4, maxX: level.span + 4, minY: -8, maxY: 7 };
    const spacing = camera.scale < 13 ? 2 : 1;
    ctx.fillStyle = '#254d5d32';
    for (let x = Math.ceil(bounds.minX); x <= bounds.maxX; x += spacing) {
      for (let y = Math.ceil(bounds.minY); y <= bounds.maxY; y += spacing) {
        const p = worldToScreen({ x, y });
        if (p.x < 15 || p.x > width - 15 || p.y < 16 || p.y > height - 16) continue;
        ctx.beginPath(); ctx.arc(p.x, p.y, .85, 0, TAU); ctx.fill();
      }
    }
    // The road datum is the only long guide line; it stays quiet behind the structure.
    const start = worldToScreen({ x: 0, y: 0 }), end = worldToScreen({ x: level.span, y: 0 });
    ctx.setLineDash([3, 7]); line(start, end, '#284d5b30', 1); ctx.setLineDash([]);
  }

  function stressColor(member) {
    const amount = clamp(finite(member.stress, 0), 0, 1);
    if (amount < .55) return hexMix('#6ca79c', '#d9bd64', amount / .55);
    return hexMix('#d9bd64', '#e4755f', (amount - .55) / .45);
  }

  function drawMember(member, a, b, stressView, selected, time, reducedMotion) {
    const from = worldToScreen(a), to = worldToScreen(b);
    const material = member.material || 'wood';
    const isRoad = material === 'road' || material === 'deck';
    const isCable = material === 'cable';
    const beamWidth = isCable ? Math.max(1.5, camera.scale * .035) : isRoad ? clamp(camera.scale * .21, 5, 9) : clamp(camera.scale * .14, 3.2, 7);
    let color = MATERIAL_COLORS[material] || MATERIAL_COLORS.wood;
    if (stressView && !member.broken) color = stressColor(member);
    ctx.save(); ctx.lineCap = isCable ? 'round' : 'butt';
    if (selected) {
      ctx.shadowColor = '#f6c777b0'; ctx.shadowBlur = 11;
      line(from, to, '#fff6d7', beamWidth + 6); ctx.shadowBlur = 0;
    }
    if (member.broken) {
      if (!brokenAt.has(member.id)) brokenAt.set(member.id, time);
      const elapsed = reducedMotion ? .2 : clamp(time - brokenAt.get(member.id), 0, 2);
      const down = Math.min(height * .65, elapsed * elapsed * camera.scale * 1.8);
      const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      const breakGap = Math.max(6, beamWidth * 1.2);
      const firstTip = { x: middle.x - breakGap, y: middle.y + down };
      const secondTip = { x: middle.x + breakGap, y: middle.y + down * .78 };
      line({ x: from.x, y: from.y + down * .23 }, firstTip, '#263b3b40', beamWidth + 3);
      line(firstTip, { x: from.x, y: from.y + down * .23 }, color, beamWidth);
      line(secondTip, { x: to.x, y: to.y + down * .19 }, color, beamWidth);
      if (elapsed < .6 && !reducedMotion) {
        const random = seeded(member.id);
        for (let i = 0; i < 7; i++) {
          const direction = random() * TAU, speed = 10 + random() * 24;
          const x = middle.x + Math.cos(direction) * elapsed * speed;
          const y = middle.y + Math.sin(direction) * elapsed * speed + elapsed * elapsed * 24;
          circle(x, y, 1 + random() * 1.6, `rgba(223,189,143,${Math.max(0, .6 - elapsed)})`);
        }
      }
      ctx.restore(); return;
    }
    // Member extrusion/shadow gives depth while keeping the measured centerline exact.
    if (!isCable) line({ x: from.x + 1.8, y: from.y + 3 }, { x: to.x + 1.8, y: to.y + 3 }, '#29413f5c', beamWidth + 1.2);
    line(from, to, color, beamWidth);
    if (isRoad) {
      line({ x: from.x, y: from.y - beamWidth * .4 }, { x: to.x, y: to.y - beamWidth * .4 }, stressView ? '#fff5d965' : '#c6d0c4', 1.2);
      line({ x: from.x, y: from.y + beamWidth * .35 }, { x: to.x, y: to.y + beamWidth * .35 }, '#3d5559', 1.4);
      ctx.setLineDash([5, 9]); line(from, to, '#d8decd6b', .8); ctx.setLineDash([]);
    } else if (material === 'steel') {
      line({ x: from.x - .7, y: from.y - beamWidth * .28 }, { x: to.x - .7, y: to.y - beamWidth * .28 }, '#e7f3e34d', 1);
      line({ x: from.x + .4, y: from.y + beamWidth * .3 }, { x: to.x + .4, y: to.y + beamWidth * .3 }, '#2b4f5b68', 1);
    } else if (material === 'wood') {
      line({ x: from.x, y: from.y - beamWidth * .27 }, { x: to.x, y: to.y - beamWidth * .27 }, '#ffe4b261', .8);
      line({ x: from.x, y: from.y + beamWidth * .13 }, { x: to.x, y: to.y + beamWidth * .13 }, '#754f3460', .8);
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      if (length > 32) {
        const direction = Math.atan2(to.y - from.y, to.x - from.x);
        ctx.save(); ctx.translate(lerp(from.x, to.x, .58), lerp(from.y, to.y, .58)); ctx.rotate(direction);
        ctx.beginPath(); ctx.ellipse(0, 0, 3, .8, 0, 0, TAU); ctx.strokeStyle = '#79523680'; ctx.lineWidth = .7; ctx.stroke(); ctx.restore();
      }
    } else if (isCable) {
      line({ x: from.x, y: from.y - .5 }, { x: to.x, y: to.y - .5 }, '#d9e3d972', .65);
    }
    ctx.restore();
  }

  function drawNodes(nodes, members, mode, hover, time, reducedMotion) {
    const connected = new Set(members.flatMap(member => [member.a, member.b]));
    nodes.forEach(node => {
      const p = worldToScreen(node);
      const isHovered = hover && Math.hypot(hover.x - node.x, hover.y - node.y) < .15;
      if (isHovered) circle(p.x, p.y, 10 + (reducedMotion ? 0 : Math.sin(time * 4) * 1.5), '#fff5ca35', '#f7d59ab0', 1.3);
      if (node.fixed) {
        ctx.save(); ctx.translate(p.x, p.y);
        roundedRect(-7.8, -5.8, 15.6, 11.6, 2.4); ctx.fillStyle = '#303f3e'; ctx.fill();
        roundedRect(-6.8, -5.1, 13.6, 9.7, 1.6); ctx.fillStyle = '#dca464'; ctx.fill();
        [[-4, -2.4], [4, -2.4], [-4, 2.4], [4, 2.4]].forEach(([x, y]) => circle(x, y, .85, '#745237'));
        circle(0, 0, 3.1, '#f3d19a', '#765b43', 1);
        line({ x: -1.1, y: 0 }, { x: 1.1, y: 0 }, '#876a45', 1); ctx.restore();
        if (mode === 'build') {
          circle(p.x, p.y, 11, null, '#ac76466b', .9);
          if (camera.scale > 15) { ctx.fillStyle = '#425355'; ctx.font = '500 9px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ANCHOR', p.x, p.y + 23); }
        }
      } else if (connected.has(node.id)) {
        circle(p.x + .8, p.y + 1.5, mode === 'build' ? 4.4 : 3.6, '#263e4159');
        circle(p.x, p.y, mode === 'build' ? 4.3 : 3.4, '#9bb0a9', '#466569', .9);
        circle(p.x, p.y, 1.1, '#e5e6d5');
      } else if (mode === 'build') circle(p.x, p.y, 3.6, '#f4ead4', '#426b73', 1.4);
    });
  }

  function drawVehicle(vehicle, time, reducedMotion) {
    if (vehicle.finished || vehicle.active === false) return;
    const isTruck = vehicle.kind === 'truck', p = worldToScreen(vehicle);
    const wheelbase = finite(vehicle.wheelbase, isTruck ? 3.4 : 2.4), radius = finite(vehicle.wheelRadius, isTruck ? .42 : .32);
    const s = camera.scale;
    const hubOffset = (isTruck ? .5 : .38) * s;
    const w = (wheelbase + (isTruck ? 1.5 : 1.35)) * s;
    const wheelRadius = radius * s;
    const bodyHeight = (isTruck ? 1 : .64) * s;
    const paint = /^#[\da-f]{6}$/i.test(vehicle.color || '') ? vehicle.color : isTruck ? '#a55543' : '#ca984f';
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-finite(vehicle.angle, 0));
    // The chassis is elevated above hubs; wheel positions agree with physics contact radii.
    ctx.beginPath(); ctx.ellipse(0, hubOffset + wheelRadius + 3, w * .48, Math.max(2, s * .12), 0, 0, TAU); ctx.fillStyle = '#213c3f30'; ctx.fill();
    const rearX = -wheelbase * s / 2, frontX = wheelbase * s / 2;
    if (isTruck) {
      const cabinX = w * .17;
      const cargo = ctx.createLinearGradient(0, -bodyHeight * 1.22, 0, bodyHeight * .24);
      cargo.addColorStop(0, '#ece2bf'); cargo.addColorStop(.55, '#cdbb91'); cargo.addColorStop(1, '#9a8d76');
      roundedRect(-w * .48, -bodyHeight * 1.28, w * .62, bodyHeight * 1.46, 2); ctx.fillStyle = cargo; ctx.fill();
      line({ x: -w * .47, y: -bodyHeight * 1.21 }, { x: w * .13, y: -bodyHeight * 1.21 }, '#fff4d387', 1.1);
      for (let x = -w * .4; x < w * .13; x += s * .3) line({ x, y: -bodyHeight * 1.12 }, { x, y: bodyHeight * .12 }, '#796f4f29', .8);
      const cabin = ctx.createLinearGradient(0, -bodyHeight, 0, bodyHeight * .3);
      cabin.addColorStop(0, hexMix(paint, '#f0e7cf', .12)); cabin.addColorStop(.5, paint); cabin.addColorStop(1, hexMix(paint, '#3b4440', .3));
      path([{ x: cabinX, y: -bodyHeight }, { x: w * .38, y: -bodyHeight }, { x: w * .45, y: -bodyHeight * .5 }, { x: w * .49, y: -bodyHeight * .38 }, { x: w * .49, y: bodyHeight * .22 }, { x: cabinX, y: bodyHeight * .22 }], true);
      ctx.fillStyle = cabin; ctx.fill();
      path([{ x: cabinX + 3, y: -bodyHeight * .88 }, { x: w * .365, y: -bodyHeight * .88 }, { x: w * .405, y: -bodyHeight * .43 }, { x: cabinX + 3, y: -bodyHeight * .43 }], true);
      ctx.fillStyle = '#adc5c0'; ctx.fill();
      line({ x: cabinX + 3, y: -bodyHeight * .88 }, { x: w * .365, y: -bodyHeight * .88 }, '#dfebe39c', 1);
      line({ x: cabinX + 3, y: -bodyHeight * .25 }, { x: cabinX + s * .32, y: -bodyHeight * .25 }, '#653c328c', 1.3);
      line({ x: -w * .49, y: bodyHeight * .28 }, { x: w * .49, y: bodyHeight * .28 }, '#354d4d', Math.max(2, s * .12));
    } else {
      const body = ctx.createLinearGradient(0, -bodyHeight * 1.05, 0, bodyHeight * .5);
      body.addColorStop(0, hexMix(paint, '#f6ebcb', .19)); body.addColorStop(.45, paint); body.addColorStop(1, hexMix(paint, '#3c443c', .23));
      path([{ x: -w * .5, y: -bodyHeight * .16 }, { x: -w * .4, y: -bodyHeight * .35 }, { x: -w * .21, y: -bodyHeight * .38 }, { x: -w * .12, y: -bodyHeight * 1.03 }, { x: w * .2, y: -bodyHeight * 1.03 }, { x: w * .34, y: -bodyHeight * .4 }, { x: w * .48, y: -bodyHeight * .29 }, { x: w * .5, y: bodyHeight * .29 }, { x: -w * .49, y: bodyHeight * .29 }], true);
      ctx.fillStyle = body; ctx.fill();
      path([{ x: -w * .105, y: -bodyHeight * .92 }, { x: w * .185, y: -bodyHeight * .92 }, { x: w * .295, y: -bodyHeight * .39 }, { x: -w * .18, y: -bodyHeight * .39 }], true);
      const windows = ctx.createLinearGradient(0, -bodyHeight, 0, 0); windows.addColorStop(0, '#c3d9d5'); windows.addColorStop(1, '#647f83');
      ctx.fillStyle = windows; ctx.fill();
      line({ x: w * .065, y: -bodyHeight * .91 }, { x: w * .065, y: -bodyHeight * .4 }, paint, 1.8);
      line({ x: -w * .46, y: -bodyHeight * .13 }, { x: w * .45, y: -bodyHeight * .13 }, '#ffdfa766', 1);
      line({ x: -w * .43, y: bodyHeight * .26 }, { x: w * .43, y: bodyHeight * .26 }, '#694e3e', 2);
      line({ x: w * .08, y: -bodyHeight * .16 }, { x: w * .17, y: -bodyHeight * .16 }, '#775a3a', 1.1);
      line({ x: w * .07, y: -bodyHeight * .33 }, { x: w * .07, y: bodyHeight * .13 }, '#97724266', .75);
    }
    // Small mirrors, lamps, bumpers and metal rims remain legible at laptop scale.
    line({ x: w * .435, y: -bodyHeight * .43 }, { x: w * .48, y: -bodyHeight * .46 }, '#536a6a', 1.3);
    roundedRect(w * .46, -bodyHeight * .12, Math.max(2, s * .07), Math.max(2, s * .12), .5); ctx.fillStyle = '#f6ecc9'; ctx.fill();
    roundedRect(-w * .51, -bodyHeight * .02, Math.max(2, s * .07), Math.max(2, s * .1), .5); ctx.fillStyle = '#a7483e'; ctx.fill();
    line({ x: w * .47, y: bodyHeight * .2 }, { x: w * .53, y: bodyHeight * .2 }, '#adbbb2', Math.max(1, s * .07));
    [rearX, frontX].forEach(wheelX => {
      circle(wheelX, hubOffset, wheelRadius + .8, '#253337');
      circle(wheelX, hubOffset, wheelRadius * .62, '#9bada9', '#5a7473', .8);
      circle(wheelX, hubOffset, wheelRadius * .36, '#ced5c5', '#8a9b91', .7);
      const rotation = reducedMotion ? 0 : finite(vehicle.x, 0) / radius;
      for (let spoke = 0; spoke < 5; spoke++) {
        const angle = spoke * TAU / 5 + rotation;
        line({ x: wheelX, y: hubOffset }, { x: wheelX + Math.cos(angle) * wheelRadius * .5, y: hubOffset + Math.sin(angle) * wheelRadius * .5 }, '#647d78', Math.max(.6, s * .018));
      }
      circle(wheelX, hubOffset, Math.max(1, s * .035), '#e0dfce');
    });
    ctx.restore();
  }

  function drawFlags(level, time, reducedMotion) {
    [{ x: -.65, finish: false }, { x: level.span + .8, finish: true }].forEach(flag => {
      const base = worldToScreen({ x: flag.x, y: 0 });
      const flagHeight = clamp(camera.scale * 1.2, 24, 42);
      line({ x: base.x, y: base.y - 3 }, { x: base.x, y: base.y - flagHeight }, '#64766d', 1.6);
      const wave = reducedMotion ? 0 : Math.sin(time * 1.8 + flag.x) * 1.5;
      const flagY = base.y - flagHeight + 2, flagWidth = Math.max(10, camera.scale * .48);
      path([{ x: base.x + 1, y: flagY }, { x: base.x + flagWidth, y: flagY + wave }, { x: base.x + flagWidth - 2, y: flagY + 9 + wave }, { x: base.x + 1, y: flagY + 9 }], true);
      ctx.fillStyle = flag.finish ? '#e9e8d3' : '#967653'; ctx.fill();
      if (flag.finish) {
        for (let row = 0; row < 2; row++) for (let column = 0; column < 3; column++) {
          if ((row + column) % 2 === 0) { ctx.fillStyle = '#54706b'; ctx.fillRect(base.x + 1 + column * flagWidth / 3, flagY + row * 4.5 + wave * column / 3, flagWidth / 3, 4.5); }
        }
      } else line({ x: base.x + 3, y: flagY + 4 }, { x: base.x + flagWidth - 3, y: flagY + 4 }, '#edddbd8c', 1);
    });
  }

  function drawPreview(preview, tool) {
    if (!preview?.from || !preview?.to) return;
    const from = worldToScreen(preview.from), to = worldToScreen(preview.to);
    const color = preview.valid === false ? '#b9604e' : '#edc880';
    ctx.save();
    ctx.shadowColor = `${color}44`; ctx.shadowBlur = 7;
    ctx.setLineDash([7, 5]); line(from, to, color, tool === 'cable' ? 2 : 3); ctx.setLineDash([]); ctx.shadowBlur = 0;
    circle(from.x, from.y, 5, '#fff0cd', '#806e52', 1.2);
    circle(to.x, to.y, 5, '#fff0cd', preview.valid === false ? '#b9604e' : '#806e52', 1.2);
    circle(to.x, to.y, 10, null, `${color}aa`, 1);
    const length = Math.hypot(preview.to.x - preview.from.x, preview.to.y - preview.from.y);
    const label = `${length.toFixed(1)} m`;
    ctx.font = '600 11px system-ui,sans-serif';
    const labelWidth = ctx.measureText(label).width + 16;
    const x = clamp((from.x + to.x) / 2 - labelWidth / 2, 8, width - labelWidth - 8), y = clamp((from.y + to.y) / 2 - 29, 8, height - 28);
    roundedRect(x, y, labelWidth, 22, 6); ctx.fillStyle = '#f3f0e6f0'; ctx.fill(); ctx.strokeStyle = '#6c817340'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = preview.valid === false ? '#9f4839' : '#3d5658'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + labelWidth / 2, y + 11);
    ctx.restore();
  }

  function drawHover(hover, nodes, tool) {
    if (!hover || !Number.isFinite(hover.x) || !Number.isFinite(hover.y) || tool === 'erase' || tool === 'delete' || tool === 'select') return;
    if (nodes.some(node => Math.hypot(node.x - hover.x, node.y - hover.y) < .1)) return;
    const p = worldToScreen(hover);
    circle(p.x, p.y, 4, '#ffffe25c', '#f4daabbd', 1.1);
    line({ x: p.x - 8, y: p.y }, { x: p.x - 5, y: p.y }, '#294f615e', .8);
    line({ x: p.x + 5, y: p.y }, { x: p.x + 8, y: p.y }, '#294f615e', .8);
    line({ x: p.x, y: p.y - 8 }, { x: p.x, y: p.y - 5 }, '#294f615e', .8);
    line({ x: p.x, y: p.y + 5 }, { x: p.x, y: p.y + 8 }, '#294f615e', .8);
  }

  function draw(view = {}) {
    const level = view.level;
    if (!level) return;
    if (currentLevel?.id !== level.id || !scenery) { scenery = makeScenery(level); brokenAt.clear(); }
    currentLevel = level;
    updateCamera(level);
    const palette = PALETTES[level.region] || PALETTES.valley;
    const rawTime = finite(view.time, 0), time = rawTime > 100000 ? rawTime / 1000 : rawTime;
    const environmentalTime = view.reducedMotion ? 0 : time;
    if (view.mode === 'build' && lastMode !== 'build') brokenAt.clear();
    lastMode = view.mode;
    const design = view.design || { nodes: [], members: [] };
    const simulation = view.mode === 'test' && view.simulation ? view.simulation : null;
    const nodes = Array.isArray(simulation?.nodes) ? simulation.nodes : design.nodes || [];
    const members = Array.isArray(simulation?.members) ? simulation.members : design.members || [];
    const byId = new Map(nodes.map(node => [node.id, node]));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.textBaseline = 'alphabetic';
    drawSky(palette, level, environmentalTime);
    drawWater(palette, level, environmentalTime);
    drawBanks(palette, level);
    drawTrees(palette, level);
    drawApproaches(level);
    drawPiers(level, design.nodes || [], palette);
    if (view.mode === 'build') drawClearances(level);
    if (view.mode === 'build' && view.gridOn !== false) drawGrid(level);
    drawFlags(level, environmentalTime, view.reducedMotion);
    // Cables render behind rigid beams, and roadway renders last for natural intersections.
    const sorted = [...members].sort((a, b) => {
      const order = { cable: 0, wood: 1, steel: 1, road: 2, deck: 2 };
      return (order[a.material] ?? 1) - (order[b.material] ?? 1);
    });
    sorted.forEach(member => {
      const a = byId.get(member.a), b = byId.get(member.b);
      if (!a || !b) return;
      const selected = view.selectedMember === member.id || view.selectedMember?.id === member.id;
      drawMember(member, a, b, !!view.stressView, selected, time, !!view.reducedMotion);
    });
    drawNodes(nodes, members, view.mode, view.hover, time, !!view.reducedMotion);
    const firstVehicle = level.vehicles?.[0] || { kind: 'car' };
    const parkedTruck = firstVehicle.kind === 'truck';
    const vehicles = simulation?.vehicles || (view.mode === 'build' ? [{ ...firstVehicle, x: parkedTruck ? -2.75 : -2.15, y: parkedTruck ? .92 : .7, angle: 0 }] : []);
    vehicles.forEach(vehicle => drawVehicle(vehicle, time, !!view.reducedMotion));
    if (view.mode === 'build') { drawHover(view.hover, nodes, view.tool); drawPreview(view.preview, view.tool); }
    // A restrained vignette keeps the structural work area visually central.
    const vignette = ctx.createRadialGradient(width * .5, height * .45, height * .4, width * .5, height * .45, width * .7);
    vignette.addColorStop(0, '#274a4b00'); vignette.addColorStop(1, '#1d3e451a');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
  }

  resize();
  return { resize, draw, worldToScreen, screenToWorld };
}
