// Original isometric precision game. All input and timing belong to the shared player.
export default function createGame(api) {
  const W = 960, H = 600, rise = 23;
  const palette = ['#6aafae', '#83b7a8', '#acc49a', '#d6c28e', '#dfaa8e', '#d8919c', '#b798bd', '#939fc7'];
  let tower, moving, fragments, sparks, floors, perfects, streak, camera, targetCamera;
  let elapsed, message, messageTime, ended, ending, lastPlaced, movement;
  const project = (x, z, y) => ({x: W / 2 + (x - z) * .89, y: 480 + (x + z) * .37 - y + camera});
  const darken = (hex, factor) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${Math.floor((n >> 16) * factor)},${Math.floor(((n >> 8) & 255) * factor)},${Math.floor((n & 255) * factor)})`;
  };
  function polygon(ctx, points, fill, stroke) {
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function block(ctx, b, alpha = 1) {
    const y = b.level * rise - (b.fall || 0);
    const a = project(b.x, b.z, y), c = project(b.x + b.w, b.z + b.d, y);
    const r = project(b.x + b.w, b.z, y), l = project(b.x, b.z + b.d, y);
    const down = p => ({x: p.x, y: p.y + rise});
    ctx.save(); ctx.globalAlpha = alpha;
    polygon(ctx, [l, c, down(c), down(l)], darken(b.color, .69));
    polygon(ctx, [r, c, down(c), down(r)], darken(b.color, .82));
    polygon(ctx, [a, r, c, l], b.color, 'rgba(255,255,255,.24)');
    // A fine highlight on the upper edges makes even a narrow surviving block readable.
    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(a.x, a.y); ctx.lineTo(r.x, r.y);
    ctx.strokeStyle = 'rgba(255,255,255,.43)'; ctx.stroke();
    ctx.restore();
  }
  function hud() { api.hud({Floors: floors, Perfect: perfects, Streak: streak}); }
  function nextBlock() {
    const top = tower[tower.length - 1], axis = floors % 2 === 0 ? 'x' : 'z';
    moving = {...top, level: top.level + 1, color: palette[(floors + 1) % palette.length], axis};
    moving.origin = top[axis]; moving[axis] = top[axis] - 285;
    movement = 1;
    targetCamera = Math.max(0, moving.level * rise - 190);
  }
  function reset() {
    tower = [{x: -110, z: -110, w: 220, d: 220, level: 0, color: palette[0]}];
    fragments = []; sparks = []; floors = perfects = streak = 0;
    camera = targetCamera = elapsed = 0; messageTime = ending = 0; message = '';
    ended = false; lastPlaced = -10; nextBlock(); hud();
    api.setHint('Tap or press Space to place a block. Line up the edges; the overhang falls away.');
  }
  function place() {
    if (ended || ending || elapsed - lastPlaced < .16) return;
    lastPlaced = elapsed;
    const top = tower[tower.length - 1], b = {...moving}, axis = moving.axis;
    const size = axis === 'x' ? 'w' : 'd', delta = b[axis] - top[axis];
    // Snap tolerance is deliberately constant in world space, not dependent on frame rate.
    const tolerance = Math.min(7, b[size] * .10);
    if (Math.abs(delta) <= tolerance) {
      b[axis] = top[axis]; perfects++; streak++;
      message = streak > 1 ? `PERFECT ×${streak}` : 'PERFECT'; messageTime = 1.1;
      api.sound('win');
      const p = project(b.x + b.w / 2, b.z + b.d / 2, b.level * rise);
      for (let i = 0; i < 18; i++) {
        const angle = i / 18 * Math.PI * 2;
        sparks.push({x: p.x, y: p.y, vx: Math.cos(angle) * (45 + Math.random() * 65), vy: Math.sin(angle) * 70 - 45, life: .85});
      }
    } else {
      streak = 0;
      const lo = Math.max(b[axis], top[axis]);
      const hi = Math.min(b[axis] + b[size], top[axis] + top[size]);
      if (hi <= lo) {
        fragments.push({...b, velocity: 0, fall: 0, life: 1.8});
        moving = null; ending = .65; api.sound('hit');
        message = 'MISSED'; messageTime = 1.3; return;
      }
      const cut = {...b, velocity: 15, fall: 0, life: 1.65};
      if (delta > 0) { cut[axis] = hi; cut[size] = b[axis] + b[size] - hi; }
      else { cut[axis] = b[axis]; cut[size] = lo - b[axis]; }
      fragments.push(cut); b[axis] = lo; b[size] = hi - lo;
      api.sound('tap'); message = ''; messageTime = 0;
    }
    delete b.axis; delete b.origin;
    tower.push(b); floors++; hud(); nextBlock();
  }
  function update(dt) {
    dt = Math.min(dt, .05); elapsed += dt;
    camera += (targetCamera - camera) * Math.min(1, dt * 4.5);
    messageTime = Math.max(0, messageTime - dt);
    for (const f of fragments) { f.velocity += dt * 660; f.fall += dt * f.velocity; f.life -= dt; }
    fragments = fragments.filter(f => f.life > 0);
    for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 110 * dt; s.life -= dt; }
    sparks = sparks.filter(s => s.life > 0);
    if (ending) {
      ending = Math.max(0, ending - dt);
      if (!ending && !ended) {
        ended = true;
        api.end(floors, 'Tower complete', `${floors} ${floors === 1 ? 'floor' : 'floors'} · ${perfects} perfect placements. Try to keep a wider foundation next time.`);
      }
      return;
    }
    if (!moving || ended) return;
    const speed = Math.min(370, 190 + floors * 7);
    moving[moving.axis] += movement * speed * dt;
    const lower = moving.origin - 285, upper = moving.origin + 285;
    if (moving[moving.axis] > upper) { moving[moving.axis] = upper - (moving[moving.axis] - upper); movement = -1; }
    if (moving[moving.axis] < lower) { moving[moving.axis] = lower + (lower - moving[moving.axis]); movement = 1; }
  }
  function draw(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#f1ebe5'); gradient.addColorStop(1, '#dedfda');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.strokeStyle = 'rgba(85,106,105,.065)'; ctx.lineWidth = 1;
    for (let i = -7; i <= 7; i++) {
      const a = project(-640, i * 95, 0), b = project(640, i * 95, 0);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const c = project(i * 95, -640, 0), d = project(i * 95, 640, 0);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#344b4a'; ctx.textAlign = 'left';
    ctx.font = '700 13px system-ui, sans-serif'; ctx.fillText('STACK THEORY', 38, 45);
    ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = '#74817b';
    ctx.fillText('A little precision goes a long way.', 38, 68);
    ctx.textAlign = 'right'; ctx.fillText(`${floors} / ∞`, W - 38, 45);
    const ground = project(0, 0, -23);
    ctx.fillStyle = 'rgba(34,62,58,.12)'; ctx.beginPath(); ctx.ellipse(ground.x, ground.y + 7, 175, 34, 0, 0, Math.PI * 2); ctx.fill();
    // Draw lower blocks first; offcuts deliberately sit behind the active cap.
    for (const b of tower) {
      const p = project(b.x, b.z, b.level * rise);
      if (p.y < H + 180) block(ctx, b);
    }
    for (const f of fragments) block(ctx, f, Math.min(1, f.life));
    if (moving) {
      const top = tower[tower.length - 1];
      const guide = {...top, level: moving.level, color: 'rgba(255,255,255,.20)'};
      const corners = [project(guide.x, guide.z, guide.level * rise), project(guide.x + guide.w, guide.z, guide.level * rise), project(guide.x + guide.w, guide.z + guide.d, guide.level * rise), project(guide.x, guide.z + guide.d, guide.level * rise)];
      ctx.save(); ctx.setLineDash([4, 5]); polygon(ctx, corners, 'rgba(255,255,255,.08)', 'rgba(68,91,82,.38)'); ctx.restore();
      block(ctx, moving);
    }
    for (const s of sparks) { ctx.globalAlpha = s.life / .85; ctx.fillStyle = '#ffffff'; ctx.fillRect(s.x - 2, s.y - 2, 4, 4); }
    ctx.globalAlpha = 1;
    if (messageTime > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, messageTime * 3); ctx.textAlign = 'center';
      ctx.font = '800 25px system-ui, sans-serif'; ctx.fillStyle = message === 'MISSED' ? '#b05958' : '#3c7470';
      ctx.fillText(message, W / 2, 115 - (1.1 - messageTime) * 8); ctx.restore();
    }
    if (!floors && !ending && !ended) {
      ctx.textAlign = 'center'; ctx.font = '600 14px system-ui, sans-serif'; ctx.fillStyle = '#64746c';
      ctx.fillText('TAP TO PLACE', W / 2, H - 31);
    }
  }
  return {reset, update, draw, pointerDown: place, keyDown(key) { if (key === 'Space' || key === ' ' || key === 'Enter') place(); }};
}
