// Five hand-authored gravity courses. No network, assets, or global listeners.
export default function createGame(api) {
  const W = 960, H = 600, STEP = 1 / 240;
  const courses = [
    { name: 'First contact', start: [105, 300], solution: [230, -22], duration: 3.2, planets: [[480, 435, 48, 170000, '#b88d69']], marks: [1.5] },
    { name: 'The long way around', start: [100, 425], solution: [245, -42], duration: 3, planets: [[460, 270, 55, 220000, '#aa8cbd']], marks: [.9, 2.05] },
    { name: 'Between two worlds', start: [110, 300], solution: [265, -38], duration: 2.75, planets: [[370, 410, 45, 180000, '#799b9c'], [675, 120, 42, 160000, '#c6a06e']], marks: [.75, 1.85] },
    { name: 'A little momentum', start: [100, 150], solution: [268, 73], duration: 2.8, planets: [[375, 320, 46, 170000, '#bc8b7c'], [650, 410, 44, 180000, '#819bb4']], marks: [.6, 1.4, 2.2] },
    { name: 'Thread the needle', start: [100, 445], solution: [282, -118], duration: 2.8, planets: [[375, 250, 47, 210000, '#a39c73'], [665, 380, 43, 175000, '#a781a0']], marks: [.6, 1.5, 2.25] }
  ];
  const stars = Array.from({ length: 115 }, (_, i) => ({ x: (i * 193.79 + 47) % W, y: (i * 97.31 + 29) % H, size: i % 5 ? 1 : 1.8, a: .2 + (i % 7) / 15 }));
  let level, course, ship, goal, beacons, velocity, aim, mode, dragging, anchor;
  let elapsed, clock, wait, trail, accumulator, attempts, totalAttempts, faults, points, finished;

  function advanceBody(body, seconds, planets) {
    let ax = 0, ay = 0;
    for (const p of planets) {
      const dx = p[0] - body.x, dy = p[1] - body.y;
      const denominator = Math.pow(Math.max(60, Math.hypot(dx, dy)), 3);
      ax += p[3] * dx / denominator;
      ay += p[3] * dy / denominator;
    }
    body.vx += ax * seconds; body.vy += ay * seconds;
    body.x += body.vx * seconds; body.y += body.vy * seconds;
  }
  function reference(c) {
    const body = { x: c.start[0], y: c.start[1], vx: c.solution[0], vy: c.solution[1] };
    const marks = [];
    let n = 0;
    for (let i = 1; i <= Math.round(c.duration / STEP); i++) {
      advanceBody(body, STEP, c.planets);
      if (n < c.marks.length && i * STEP >= c.marks[n]) { marks.push({ x: body.x, y: body.y, hit: false }); n++; }
    }
    return { goal: { x: body.x, y: body.y }, marks };
  }
  function hud() {
    api.hud({ Course: `${level + 1} / 5`, Beacons: `${beacons.filter(b => b.hit).length} / ${beacons.length}`, Launches: totalAttempts });
  }
  function retry() {
    ship = { x: course.start[0], y: course.start[1] };
    velocity = { x: 0, y: 0 }; mode = 'ready'; elapsed = 0; wait = 0;
    accumulator = 0; trail = []; dragging = false;
    beacons.forEach(b => b.hit = false);
    hud();
  }
  function loadCourse() {
    course = courses[level];
    const ref = reference(course); goal = ref.goal; beacons = ref.marks;
    attempts = 0;
    // A useful starting direction; drag to refine the orbit from the preview.
    aim = { x: 240, y: level === 0 ? -22 : level === 3 ? 35 : level === 4 ? -70 : -10 };
    retry();
    api.setHint('Drag back anywhere to aim, then release. Collect every beacon and reach the gate. Arrows aim / power · Space launches · R retries.');
  }
  function reset() {
    level = 0; clock = 0; points = 0; faults = 0; totalAttempts = 0; finished = false;
    loadCourse();
  }
  function launch() {
    if (mode !== 'ready' || finished) return;
    const speed = Math.hypot(aim.x, aim.y);
    if (speed < 60) return;
    mode = 'flying'; velocity = { ...aim }; elapsed = 0; attempts++; totalAttempts++;
    trail = [{ ...ship }]; accumulator = 0; api.sound('tap'); hud();
  }
  function crash(reason) {
    if (mode !== 'flying') return;
    mode = 'crashed'; wait = 1.25; faults++; dragging = false; api.sound('hit');
    api.setHint(`${reason} Tap to try this course again, or press R. Your previous aim is kept.`);
  }
  function update(dt) {
    clock += dt;
    if (finished) return;
    if (mode === 'cleared') {
      wait -= dt;
      if (wait <= 0) {
        if (level === courses.length - 1) {
          finished = true; mode = 'finished';
          api.end(points, 'All five orbits secured', `${totalAttempts} launches. ${faults} collisions or missed gates. Try again to improve your flight score.`);
        } else { level++; loadCourse(); }
      }
      return;
    }
    if (mode === 'crashed') { wait = Math.max(0, wait - dt); return; }
    if (mode !== 'flying') return;
    accumulator += Math.min(dt, .08);
    while (accumulator >= STEP && mode === 'flying') {
      const body = { x: ship.x, y: ship.y, vx: velocity.x, vy: velocity.y };
      advanceBody(body, STEP, course.planets);
      ship.x = body.x; ship.y = body.y; velocity.x = body.vx; velocity.y = body.vy;
      accumulator -= STEP; elapsed += STEP;
      for (const p of course.planets) if (Math.hypot(ship.x - p[0], ship.y - p[1]) < p[2] + 6) { crash('The probe hit a planet.'); break; }
      if (mode !== 'flying') break;
      let changed = false;
      for (const b of beacons) if (!b.hit && Math.hypot(ship.x - b.x, ship.y - b.y) < 26) { b.hit = true; changed = true; api.sound('tap'); }
      if (changed) hud();
      if (Math.hypot(ship.x - goal.x, ship.y - goal.y) < 33) {
        if (beacons.every(b => b.hit)) {
          mode = 'cleared'; wait = 1.55;
          points += Math.max(350, 1200 - (attempts - 1) * 120 - Math.round(elapsed * 25));
          api.sound('win'); api.setHint(level === 4 ? 'Mission complete.' : 'Orbit secured. Next course incoming…');
        } else crash('The gate needs every beacon.');
      }
      if (ship.x < -25 || ship.x > W + 25 || ship.y < -25 || ship.y > H + 25 || elapsed > 9) crash('The probe drifted out of range.');
    }
    if (mode === 'flying') { trail.push({ ...ship }); if (trail.length > 180) trail.shift(); }
  }
  function pointerDown(x, y) {
    if (mode === 'crashed') { retry(); return; }
    if (mode !== 'ready') return;
    dragging = true; anchor = { x, y };
  }
  function pointerMove(x, y) {
    if (!dragging || mode !== 'ready') return;
    const dx = anchor.x - x, dy = anchor.y - y, length = Math.hypot(dx, dy);
    if (length < 2) return;
    const power = Math.min(360, Math.max(65, length * 2.8));
    aim = { x: dx / length * power, y: dy / length * power };
  }
  function pointerUp(x, y) {
    if (!dragging) return;
    pointerMove(x, y); dragging = false;
    if (Math.hypot(x - anchor.x, y - anchor.y) > 9) launch();
  }
  function pointerCancel() { dragging = false; }
  function keyDown(key) {
    if (key === 'r' || key === 'R') { if (!finished && mode !== 'cleared') retry(); return; }
    if (key === 'Space' || key === ' ' || key === 'Enter') { if (mode === 'crashed') retry(); else launch(); return; }
    if (mode !== 'ready') return;
    let angle = Math.atan2(aim.y, aim.x), speed = Math.hypot(aim.x, aim.y);
    if (key === 'ArrowLeft' || key === 'a') angle -= .045;
    if (key === 'ArrowRight' || key === 'd') angle += .045;
    if (key === 'ArrowUp' || key === 'w') speed = Math.min(360, speed + 8);
    if (key === 'ArrowDown' || key === 's') speed = Math.max(65, speed - 8);
    aim = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  }
  function circle(ctx, x, y, r, fill, stroke) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function label(ctx, text, x, y, color = '#dce9e8', size = 13, align = 'left') {
    ctx.font = `${size}px system-ui, sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(text, x, y);
  }
  function drawPreview(ctx) {
    const body = { x: ship.x, y: ship.y, vx: aim.x, vy: aim.y };
    let blocked = false;
    for (let i = 1; i < 1200; i++) {
      advanceBody(body, STEP, course.planets);
      if (course.planets.some(p => Math.hypot(body.x - p[0], body.y - p[1]) < p[2] + 6)) { blocked = true; break; }
      if (body.x < 0 || body.x > W || body.y < 0 || body.y > H) break;
      if (i % 13 === 0) circle(ctx, body.x, body.y, 1.7, `rgba(182,218,217,${.55 - i / 2700})`);
      if (Math.hypot(body.x - goal.x, body.y - goal.y) < 20) break;
    }
    if (blocked) {
      ctx.strokeStyle = '#d49a82'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(body.x - 5, body.y - 5); ctx.lineTo(body.x + 5, body.y + 5); ctx.moveTo(body.x + 5, body.y - 5); ctx.lineTo(body.x - 5, body.y + 5); ctx.stroke();
    }
    const angle = Math.atan2(aim.y, aim.x);
    ctx.strokeStyle = '#acd6d2'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ship.x, ship.y); ctx.lineTo(ship.x + Math.cos(angle) * 40, ship.y + Math.sin(angle) * 40); ctx.stroke();
    label(ctx, `${Math.round(Math.hypot(aim.x, aim.y))} m/s`, ship.x, ship.y + 38, '#9ab5b9', 12, 'center');
  }
  function draw(ctx) {
    const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#101c2a'); bg.addColorStop(1, '#080d16');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (const s of stars) circle(ctx, s.x, s.y, s.size, `rgba(217,231,243,${s.a})`);
    ctx.strokeStyle = '#20303f'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(32, 84); ctx.lineTo(W - 32, 84); ctx.stroke();
    label(ctx, `0${level + 1}  /  ORBIT`, 32, 38, '#7fa9ad', 12);
    label(ctx, course.name, 32, 66, '#e3eeeb', 21);
    label(ctx, 'BEACONS → GATE', W - 32, 52, '#749095', 12, 'right');
    for (const p of course.planets) {
      ctx.save();
      ctx.setLineDash([2, 8]); ctx.lineWidth = 1; circle(ctx, p[0], p[1], p[2] + 44, null, '#3d4c59'); ctx.setLineDash([]);
      const halo = ctx.createRadialGradient(p[0], p[1], p[2] * .8, p[0], p[1], p[2] * 1.7);
      halo.addColorStop(0, p[4] + '26'); halo.addColorStop(1, p[4] + '00'); circle(ctx, p[0], p[1], p[2] * 1.7, halo);
      const surface = ctx.createRadialGradient(p[0] - p[2] * .35, p[1] - p[2] * .4, 2, p[0] + p[2] * .3, p[1] + p[2] * .2, p[2] * 1.25);
      surface.addColorStop(0, p[4]); surface.addColorStop(1, '#17212a'); circle(ctx, p[0], p[1], p[2], surface);
      ctx.beginPath(); ctx.arc(p[0], p[1], p[2], 0, Math.PI * 2); ctx.clip();
      ctx.strokeStyle = '#d7dacf14'; ctx.lineWidth = 6;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(p[0], p[1] + i * 22, p[2] * 1.1, 12, -.35, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
    for (let i = 0; i < beacons.length; i++) {
      const b = beacons[i]; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = b.hit ? '#9fd0c0' : '#ecba70'; ctx.shadowColor = b.hit ? '#9fd0c0' : '#ecba70'; ctx.shadowBlur = b.hit ? 4 : 12;
      ctx.fillRect(-6, -6, 12, 12); ctx.restore();
      if (!b.hit) label(ctx, String(i + 1), b.x, b.y - 18, '#b7a28b', 11, 'center');
    }
    const open = beacons.every(b => b.hit);
    ctx.lineWidth = 3; circle(ctx, goal.x, goal.y, 30 + Math.sin(clock * 2) * 1.5, '#80c2bd0b', open ? '#9ad2c5' : '#6c999c');
    ctx.lineWidth = 1; circle(ctx, goal.x, goal.y, 22, null, '#b6dad94d');
    label(ctx, 'GATE', goal.x, goal.y + 51, '#9ec0c2', 11, 'center');
    if (trail.length > 1) {
      ctx.strokeStyle = '#9fc7cf70'; ctx.lineWidth = 1.5; ctx.beginPath();
      trail.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    }
    if (mode === 'ready') drawPreview(ctx);
    ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(Math.atan2(mode === 'ready' ? aim.y : velocity.y, mode === 'ready' ? aim.x : velocity.x));
    if (mode === 'flying') { ctx.fillStyle = '#dcb887'; ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-19 - Math.sin(clock * 45) * 3, 0); ctx.lineTo(-8, 3); ctx.fill(); }
    ctx.fillStyle = mode === 'crashed' ? '#dc977e' : '#e9f2ed'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -6); ctx.lineTo(-3, 0); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.restore();
    if (mode === 'ready') label(ctx, dragging ? 'Release to launch' : 'Pull back. Find your orbit.', W / 2, H - 31, '#9bb3b8', 14, 'center');
    if (mode === 'crashed' || mode === 'cleared') {
      ctx.fillStyle = '#0b1525df'; ctx.fillRect(300, 246, 360, 103);
      label(ctx, mode === 'crashed' ? 'Try another trajectory' : 'Orbit secured', 480, 286, mode === 'crashed' ? '#e1ba9e' : '#b4dece', 23, 'center');
      label(ctx, mode === 'crashed' ? 'Tap anywhere or press R to retry' : level === 4 ? 'Mission complete' : 'Preparing the next course…', 480, 320, '#9caeb8', 13, 'center');
    }
  }
  reset();
  return { reset, update, draw, pointerDown, pointerMove, pointerUp, pointerCancel, keyDown };
}
