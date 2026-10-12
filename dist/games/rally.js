// Original top-down circuit. Ordered physical gates verify every lap.
export default function createGame(api) {
  const W = 960, H = 600, LAPS = 2;let ROAD_WIDTH=92,activeMap=0;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const held = (...names) => names.some(n => api.input.keys.has(n));
  const maps=[
    {name:'Club Circuit',width:92,ground:'#c4b594',points:[[255,140],[485,105],[747,141],[831,239],[759,354],[690,446],[505,441],[400,363],[260,439],[143,391],[139,270],[186,185]]},
    {name:'Canyon Loop',width:86,ground:'#c99477',points:[[200,130],[470,100],[760,150],[835,310],[710,465],[470,440],[260,475],[125,340],[145,220]]},
    {name:'Coastal Ring',width:108,ground:'#a8c3b3',points:[[210,150],[480,115],[740,150],[825,300],[740,445],[480,480],[210,440],[135,300]]},
    {name:'Alpine Switchbacks',width:84,ground:'#b9c2ad',points:[[160,130],[390,135],[565,100],[790,170],[810,330],[700,430],[490,475],[330,390],[160,440],[115,280]]}
  ];let anchors=maps[0].points;

  const samples = [], gates = [], trees = [];
  let car, elapsed, penalty, passed, next, done, offTime, flash, lastHud, trail, saved, lapTimes, lastLap, driving;
  const lerp = (a, b, t) => a + (b - a) * t;
  function catmull(a, b, c, d, t) {
    return .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  }
  function nearest(x, y) {
    let best = samples[0], dist = Infinity;
    for (const p of samples) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < dist) { best = p; dist = d; } }
    return { p: best, dist: Math.sqrt(dist) };
  }
  function buildCircuit(){activeMap=Math.max(0,Math.min(3,Number(api.options?.course)||0));anchors=maps[activeMap].points;ROAD_WIDTH=maps[activeMap].width;samples.length=0;gates.length=0;trees.length=0;
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[(i - 1 + anchors.length) % anchors.length], b = anchors[i], c = anchors[(i + 1) % anchors.length], d = anchors[(i + 2) % anchors.length];
    for (let j = 0; j < 28; j++) { const t = j / 28; samples.push({ x: catmull(a[0], b[0], c[0], d[0], t), y: catmull(a[1], b[1], c[1], d[1], t) }); }
  }
  let length = 0;
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i], q = samples[(i + 1) % samples.length];
    p.arc = length; p.tx = q.x - p.x; p.ty = q.y - p.y; const mag = Math.hypot(p.tx, p.ty); p.tx /= mag; p.ty /= mag; length += mag;
  }
  for (let i = 0; i < 20; i++) {
    const target = i * length / 20;
    const p = samples.reduce((best, p) => Math.abs(p.arc - target) < Math.abs(best.arc - target) ? p : best, samples[0]);
    gates.push({ ...p });
  }
  // Decorative trees occupy grass only and never change the collision geometry.
  for (let i = 0; i < 170; i++) {
    const x = 40 + ((i * 173 + i * i * 37) % 880), y = 72 + ((i * 97 + i * i * 13) % 452);
    if (nearest(x, y).dist > 83 && !(x > 355 && x < 610 && y > 210 && y < 300)) trees.push({ x, y, r: 9 + i % 9, shade: i % 3 });
  }
  }
  function reset() {
    buildCircuit();
    const g = gates[0];
    car = { x: g.x - g.tx * 25, y: g.y - g.ty * 25, angle: Math.atan2(g.ty, g.tx), speed: 0, vx: 0, vy: 0 };
    elapsed = 0; penalty = 0; passed = 0; next = 0; done = false; offTime = 0; flash = 0; lastHud = -1; trail = []; lapTimes = []; lastLap = 0; driving = false;
    saved = { x: car.x, y: car.y, angle: car.angle };
    api.hud({Map:maps[activeMap].name, Time: '0:00.0', Lap: '1 / 2', Gate: 'Start', Penalty: '+0s' });
    api.setHint('↑ / W accelerate · ↓ / S brake · ← → / A D steer. Follow the green checkpoint.');
  }
  function clock(seconds) { return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`; }
  function recover() {
    penalty += 3; offTime = 0; flash = 1.25;
    car.x = saved.x; car.y = saved.y; car.angle = saved.angle; car.speed = 0; car.vx = 0; car.vy = 0;
    api.sound('hit');
    api.setHint('Back to your last checkpoint · +3s. Brake before the tighter corners.');
  }
  function step(dt) {
    const close = nearest(car.x, car.y), onRoad = close.dist < ROAD_WIDTH / 2 + 3;
    const throttle = held('ArrowUp', 'w', 'W'), braking = held('ArrowDown', 's', 'S', 'Space', ' ');
    const steer = (held('ArrowRight', 'd', 'D') ? 1 : 0) - (held('ArrowLeft', 'a', 'A') ? 1 : 0);
    if (throttle || car.speed > 4) driving = true;
    if (driving) elapsed += dt;
    car.speed += (throttle && !braking ? 153 : braking ? -255 : -47) * dt;
    car.speed = clamp(car.speed, 0, onRoad ? 225 : 100);
    car.angle += steer * dt * (car.speed > 6 ? .65 + 1.8 * Math.min(1, car.speed / 150) : 0);
    const grip = onRoad ? (braking ? 10 : 7) : 3.5;
    car.vx = lerp(car.vx, Math.cos(car.angle) * car.speed, Math.min(1, dt * grip));
    car.vy = lerp(car.vy, Math.sin(car.angle) * car.speed, Math.min(1, dt * grip));
    const prevX = car.x, prevY = car.y;
    car.x += car.vx * dt; car.y += car.vy * dt;
    car.x = clamp(car.x, 12, W - 12); car.y = clamp(car.y, 12, H - 12);
    const current = nearest(car.x, car.y);
    if (current.dist > ROAD_WIDTH / 2 + 8) offTime += dt;
    else offTime = Math.max(0, offTime - dt * 2);
    // Leaving the road cannot advance gates. Recovery prevents cutting across the infield.
    if (offTime > .68 || current.dist > 100) { recover(); return; }
    const g = gates[next];
    const before = (prevX - g.x) * g.tx + (prevY - g.y) * g.ty;
    const after = (car.x - g.x) * g.tx + (car.y - g.y) * g.ty;
    const across = Math.abs((car.x - g.x) * -g.ty + (car.y - g.y) * g.tx);
    if (before < 0 && after >= 0 && across < ROAD_WIDTH / 2 + 2 && current.dist < ROAD_WIDTH / 2 + 4 && offTime < .15) {
      const finishingLap = passed > 0 && next === 0;
      passed++; next = (next + 1) % gates.length;
      saved = { x: g.x + g.tx * 15, y: g.y + g.ty * 15, angle: Math.atan2(g.ty, g.tx) };
      if (finishingLap) {
        lapTimes.push(elapsed + penalty - lastLap); lastLap = elapsed + penalty;
        if (lapTimes.length >= LAPS) {
          done = true; const time = elapsed + penalty;
          api.hud({Map:maps[activeMap].name, Time: clock(time), Lap: '2 / 2', Gate: 'Finished', Penalty: `+${penalty}s` });
          api.end(Math.max(1, Math.round(200000 - time * 1000)), `${maps[activeMap].name} · finish`, `Two verified laps in ${clock(time)} · Lap 1 ${clock(lapTimes[0])} · Lap 2 ${clock(lapTimes[1])}`);
          api.sound('win'); return;
        }
        api.sound('win'); flash = .35;
      } else api.sound('tap');
    }
    if (Math.abs(steer) > 0 && car.speed > 125 && onRoad) {
      trail.push({ x: car.x, y: car.y, angle: car.angle, t: 8 });
    }
  }
  function update(dt) {
    if (done) return;
    // Substeps keep crossing tests and handling stable at slower frame rates.
    const count = Math.max(1, Math.ceil(dt / .012)), slice = dt / count;
    for (let i = 0; i < count && !done; i++) step(slice);
    if (done) return;
    flash = Math.max(0, flash - dt);
    trail.forEach(p => p.t -= dt); trail = trail.filter(p => p.t > 0).slice(-1100);
    if (elapsed - lastHud > .12 || lastHud < 0) {
      lastHud = elapsed;
      api.hud({Map:maps[activeMap].name, Time: clock(elapsed + penalty), Lap: `${Math.min(2, Math.floor(Math.max(0, passed - 1) / gates.length) + 1)} / 2`, Gate: passed ? `${next || gates.length} / ${gates.length}` : 'Start', Penalty: `+${penalty}s` });
      if (!flash) api.setHint(offTime > .1 ? 'Off the circuit! Return to the road to avoid a +3s recovery.' : '↑ / W accelerate · ↓ / S brake · ← → / A D steer. Follow the green checkpoint.');
    }
  }
  function path(ctx) { ctx.beginPath(); samples.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); }
  function round(ctx, x, y, w, h, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
  function arrow(ctx, x, y, angle, color, size = 11) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-size, -size * .65); ctx.lineTo(0, 0); ctx.lineTo(-size, size * .65); ctx.stroke(); ctx.restore();
  }
  function draw(ctx) {
    ctx.fillStyle = maps[activeMap].ground; ctx.fillRect(0, 0, W, H);
    // Deliberately restrained landscape: warm gravel, dark asphalt, painted curbs.
    ctx.fillStyle = '#b6aa88';
    for (let i = 0; i < 180; i++) ctx.fillRect((i * 157) % W, (i * 113) % H, 2 + i % 3, 2);
    path(ctx); ctx.strokeStyle = '#a59678'; ctx.lineWidth = ROAD_WIDTH + 31; ctx.lineJoin = 'round'; ctx.stroke();
    path(ctx); ctx.strokeStyle = '#bd715a'; ctx.lineWidth = ROAD_WIDTH + 12; ctx.stroke();
    ctx.setLineDash([15, 15]); path(ctx); ctx.strokeStyle = '#e4d9bc'; ctx.lineWidth = ROAD_WIDTH + 12; ctx.stroke(); ctx.setLineDash([]);
    path(ctx); ctx.strokeStyle = '#343a3d'; ctx.lineWidth = ROAD_WIDTH; ctx.stroke();
    ctx.setLineDash([13, 18]); path(ctx); ctx.strokeStyle = '#646967'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.setLineDash([]);
    for (const t of trees) {
      ctx.fillStyle = '#877e64'; ctx.beginPath(); ctx.ellipse(t.x + 7, t.y + 9, t.r, t.r * .6, -.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ['#6b775a', '#7f8b64', '#596b53'][t.shade]; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#93a073'; ctx.beginPath(); ctx.arc(t.x - 3, t.y - 4, t.r * .5, 0, Math.PI * 2); ctx.fill();
    }
    round(ctx, 361, 211, 241, 88, 4, '#b5a484');
    ctx.fillStyle = '#746f5a'; ctx.font = '800 32px system-ui'; ctx.textAlign = 'center'; ctx.fillText('DUST RALLY', 481, 251);
    ctx.font = '600 11px system-ui'; ctx.fillText(`${maps[activeMap].name.toUpperCase()} / TWO LAPS`,481,274); ctx.textAlign = 'left';
    for (const p of trail) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.globalAlpha = Math.min(.3, p.t * .05); ctx.fillStyle = '#111b20'; ctx.fillRect(-8, -8, 3, 2); ctx.fillRect(-8, 6, 3, 2); ctx.restore();
    }
    const start = gates[0];
    ctx.save(); ctx.translate(start.x, start.y); ctx.rotate(Math.atan2(start.ty, start.tx));
    for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#282e32' : '#f0e3c7'; ctx.fillRect(-5, -46 + i * 8, 5, 8); ctx.fillStyle = i % 2 ? '#f0e3c7' : '#282e32'; ctx.fillRect(0, -46 + i * 8, 5, 8); }
    ctx.restore();
    // Small direction markings make the route readable before the first run.
    for (let i = 2; i < gates.length; i += 3) { const g = gates[i]; arrow(ctx, g.x, g.y, Math.atan2(g.ty, g.tx), '#929486', 8); }
    if (!done) {
      const g = gates[next], a = Math.atan2(g.ty, g.tx);
      ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(a);
      ctx.fillStyle = '#c0d771'; ctx.globalAlpha = .2 + Math.sin(elapsed * 5) * .035; ctx.fillRect(-8, -46, 16, 92); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#d2e786'; ctx.lineWidth = 3; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(0, 46); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#d2e786'; ctx.beginPath(); ctx.arc(0, -51, 5, 0, Math.PI * 2); ctx.arc(0, 51, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      arrow(ctx, g.x + g.tx * 20, g.y + g.ty * 20, a, '#d2e786');
      // A quiet pointer always identifies the next gate, even after a spin.
      const targetAngle = Math.atan2(g.y - car.y, g.x - car.x);
      if (Math.hypot(g.x - car.x, g.y - car.y) > 70) arrow(ctx, car.x + Math.cos(targetAngle) * 35, car.y + Math.sin(targetAngle) * 35, targetAngle, '#e4eba9', 7);
    }
    ctx.save(); ctx.translate(car.x + 3, car.y + 5); ctx.rotate(car.angle + Math.PI / 2); round(ctx, -11, -19, 22, 40, 5, '#22292b'); ctx.restore();
    ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle + Math.PI / 2);
    round(ctx, -13, -12, 5, 11, 1, '#192125'); round(ctx, 8, -12, 5, 11, 1, '#192125'); round(ctx, -13, 9, 5, 11, 1, '#192125'); round(ctx, 8, 9, 5, 11, 1, '#192125');
    round(ctx, -10, -23, 20, 46, 4, '#dc804f'); ctx.fillStyle = '#f0aa6d'; ctx.fillRect(-9, -20, 18, 10);
    round(ctx, -8, -7, 16, 11, 2, '#243b43'); round(ctx, -8, 11, 16, 7, 2, '#31434a');
    ctx.fillStyle = '#eddbc0'; ctx.fillRect(-2, -22, 4, 13); ctx.fillRect(-2, 5, 4, 5);
    ctx.fillStyle = '#f5dd9d'; ctx.fillRect(-8, -23, 5, 3); ctx.fillRect(3, -23, 5, 3);
    ctx.fillStyle = held('ArrowDown', 's', 'S', 'Space', ' ') ? '#ff6756' : '#994936'; ctx.fillRect(-8, 20, 5, 3); ctx.fillRect(3, 20, 5, 3);
    ctx.restore();
    round(ctx, 25, 20, 213, 57, 6, '#30383a'); ctx.fillStyle = '#efe3c9'; ctx.font = '700 12px system-ui'; ctx.fillText(maps[activeMap].name.toUpperCase(),39,42); ctx.font = '500 13px system-ui'; ctx.fillText(`${Math.round(car.speed * .65)} km/h`, 39, 63);
    round(ctx, 755, 20, 180, 57, 6, '#30383a'); ctx.font = '700 22px ui-monospace, monospace'; ctx.fillText(clock(elapsed + penalty), 770, 48); ctx.font = '500 11px system-ui'; ctx.fillText(`LAP ${Math.min(2, Math.floor(Math.max(0, passed - 1) / gates.length) + 1)} / 2`, 771, 66);
    if (flash > .4) { round(ctx, 342, 526, 276, 42, 5, '#30383a'); ctx.fillStyle = '#efd1a2'; ctx.font = '700 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('RECOVERED AT CHECKPOINT  +3s', 480, 552); ctx.textAlign = 'left'; }
  }
  reset();
  return { reset, update, draw };
}
