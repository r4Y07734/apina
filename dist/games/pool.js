// Solo eight-ball: full rack, six pockets, finite-speed collision physics.
export default function createGame(api) {
  const W = 960, H = 600, R = 11, STEP = 1 / 180;
  const table = { left: 72, right: 888, top: 96, bottom: 504 };
  const pockets = [[72, 96], [480, 96], [888, 96], [72, 504], [480, 504], [888, 504]];
  const colors = ['#eeeade', '#d9af37', '#386bae', '#b04943', '#766092', '#d27f3f', '#3b8973', '#883f4b', '#25282c', '#d9af37', '#386bae', '#b04943', '#766092', '#d27f3f', '#3b8973', '#883f4b'];
  let balls, cue, shots, scratches, score, mode, dragging, anchor, aim, power, accumulator, clock;
  let shotScratch, eightPotted, earlyEight, finished, pocketed, lastMessage, messageTime, idleFrames,sinking;
  function hud() {
    api.hud({ 'Balls left': balls.filter(b => b.n && b.n !== 8 && b.active).length, Shots: shots, Scratches: scratches });
  }
  function ball(n, x, y) { return { n, x, y, vx: 0, vy: 0, active: true, spin: n * .7 }; }
  function reset() {
    cue = ball(0, 260, 300); balls = [cue];
    // The eight is in the centre, and every starting gap exceeds two radii.
    const order = [1, 9, 2, 3, 8, 10, 11, 4, 12, 5, 6, 13, 7, 14, 15];
    let i = 0;
    for (let row = 0; row < 5; row++) for (let col = 0; col <= row; col++) {
      balls.push(ball(order[i++], 628 + row * 20.6, 300 + (col - row / 2) * 23.8));
    }
    shots = 0; scratches = 0; score = 0; mode = 'aim'; dragging = false;anchor=null;
    aim = 0; power = Math.max(120,Math.min(1000,(Number(api.options?.power)||55)*10));sinking=[]; accumulator = 0; clock = 0; shotScratch = false;
    eightPotted = false; earlyEight = false; finished = false; pocketed = [];
    lastMessage = 'Clear all 14 colours. Then pocket the eight.'; messageTime = 5; idleFrames = 0;
    api.setHint('Click or tap a target to aim. Set power below, then Shoot or Space. You can also drag back from the cue ball and release. Colours first, eight last.');
    hud();
  }
  function announce(text) { lastMessage = text; messageTime = 3; }
  function shoot() {
    if (mode !== 'aim' || !cue.active || finished) return;
    shots++; shotScratch = false; mode = 'moving'; dragging = false; idleFrames = 0;
    cue.vx = Math.cos(aim) * power; cue.vy = Math.sin(aim) * power;
    accumulator = 0; api.sound('tap'); hud();
  }
  function sink(b) {
    const pocket=pockets.reduce((best,p)=>Math.hypot(b.x-p[0],b.y-p[1])<Math.hypot(b.x-best[0],b.y-best[1])?p:best,pockets[0]);sinking.push({...b,px:pocket[0],py:pocket[1],t:.32});
    b.active = false; b.vx = 0; b.vy = 0;
    if (b.n === 0) {
      shotScratch = true; scratches++; announce('Scratch. The cue ball returns when the table settles.'); api.sound('hit');
    } else {
      pocketed.push(b.n); api.sound('tap');
      if (b.n === 8) {
        eightPotted = true;
        earlyEight = balls.some(other => other.n && other.n !== 8 && other.active);
        announce(earlyEight ? 'The eight went down before the colours.' : 'Eight ball pocketed…');
      } else {
        score += 300;
        const left = balls.filter(other => other.n && other.n !== 8 && other.active).length;
        if (left === 0) announce('All colours cleared. The eight is yours.');
        else if (!shotScratch) announce(`${b.n} in the pocket. ${left} colours left.`);
      }
    }
    hud();
  }
  function physics() {
    for (const b of balls) {
      if (!b.active) continue;
      b.x += b.vx * STEP; b.y += b.vy * STEP;
      const pocket=pockets.find(p=>Math.hypot(b.x-p[0],b.y-p[1])<35);
      if(pocket){const dx=pocket[0]-b.x,dy=pocket[1]-b.y,d=Math.hypot(dx,dy);if(d<24){sink(b);continue;}if(b.vx*dx+b.vy*dy>0){b.vx+=dx*STEP*24;b.vy+=dy*STEP*24;}}
      const topMouth=pockets.slice(0,3).some(p=>Math.abs(b.x-p[0])<30),bottomMouth=pockets.slice(3).some(p=>Math.abs(b.x-p[0])<30);
      const sideMouth=Math.abs(b.y-table.top)<32||Math.abs(b.y-table.bottom)<32;
      if(b.x<table.left+R&&!sideMouth){b.x=table.left+R;b.vx=Math.abs(b.vx)*.86;}
      if(b.x>table.right-R&&!sideMouth){b.x=table.right-R;b.vx=-Math.abs(b.vx)*.86;}
      if(b.y<table.top+R&&!topMouth){b.y=table.top+R;b.vy=Math.abs(b.vy)*.86;}
      if(b.y>table.bottom-R&&!bottomMouth){b.y=table.bottom-R;b.vy=-Math.abs(b.vy)*.86;}
      // A ball crossing an open mouth is captured, not bounced by an invisible rail.
      if(b.x<table.left-8||b.x>table.right+8||b.y<table.top-8||b.y>table.bottom+8){sink(b);continue;}
      const speed = Math.hypot(b.vx, b.vy);
      const next = Math.max(0, speed - 112 * STEP);
      if (speed > 0) { b.vx *= next / speed; b.vy *= next / speed; }
      if (next < 3.5) { b.vx = 0; b.vy = 0; }
      b.spin += speed * STEP / 24;
    }
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]; if (!a.active) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j]; if (!b.active) continue;
        let dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
        if (distance >= R * 2) continue;
        if (distance < .0001) { dx = .001; dy = 0; distance = .001; }
        const nx = dx / distance, ny = dy / distance;
        const overlap = (R * 2 - distance + .015) * .5;
        a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
        const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (closing >= 0) continue;
        const impulse = -(1 + .96) * closing / 2;
        a.vx -= impulse * nx; a.vy -= impulse * ny; b.vx += impulse * nx; b.vy += impulse * ny;
      }
    }
  }
  function replaceCue() {
    const candidates = [{ x: 260, y: 300 }];
    for (let x = 170; x < 410; x += 32) for (let y = 155; y < 455; y += 32) candidates.push({ x, y });
    const spot = candidates.find(p => balls.every(b => !b.active || !b.n || Math.hypot(p.x - b.x, p.y - b.y) > R * 2 + 2));
    if (spot) { cue.x = spot.x; cue.y = spot.y; cue.active = true; cue.vx = 0; cue.vy = 0; }
  }
  function resolveShot() {
    if (eightPotted) {
      finished = true; mode = 'finished';
      if (earlyEight) api.end(Math.max(0, score - scratches * 200), 'Eight ball too soon', 'Clear all fourteen coloured balls before pocketing the eight. Restart for a fresh rack.');
      else if (shotScratch) api.end(Math.max(0, score - scratches * 200), 'Scratch on the eight', 'The cue ball must stay on the table on your final shot. Restart and try again.');
      else {
        api.sound('win');
        api.end(Math.max(4500, score + 6000 - shots * 110 - scratches * 300), 'Table cleared', `${shots} shots and ${scratches} scratches. Fewer shots earn a higher score.`);
      }
      return;
    }
    if (!cue.active) replaceCue();
    mode = 'aim'; hud();
  }
  function update(dt) {
    clock += dt; messageTime = Math.max(0, messageTime - dt);for(const b of sinking)b.t-=dt;sinking=sinking.filter(b=>b.t>0);
    if (mode !== 'moving' || finished) return;
    accumulator += Math.min(.08, dt);
    while (accumulator >= STEP) { physics(); accumulator -= STEP; }
    if (balls.every(b => !b.active || Math.hypot(b.vx, b.vy) < 3.5)) idleFrames += dt;
    else idleFrames = 0;
    if (idleFrames > .12) resolveShot();
  }
  function pointerDown(x,y){if(mode!=='aim'||finished||y<64||y>540)return;anchor={x,y,pull:Math.hypot(x-cue.x,y-cue.y)<36};dragging=anchor.pull;if(!anchor.pull){aim=Math.atan2(y-cue.y,x-cue.x);announce('Aim set. Adjust power, then press Shoot.');}}
  function pointerMove(x,y){if(mode!=='aim')return;if(dragging){const dx=cue.x-x,dy=cue.y-y,l=Math.hypot(dx,dy);if(l>4){aim=Math.atan2(dy,dx);power=Math.max(120,Math.min(1000,l*5));api.setControlValue?.('power',Math.round(power/10));}}else if(anchor&&!anchor.pull&&api.input.pointer.down)aim=Math.atan2(y-cue.y,x-cue.x);}
  function pointerUp(x,y){if(!anchor)return;if(dragging){pointerMove(x,y);dragging=false;if(Math.hypot(x-anchor.x,y-anchor.y)>10)shoot();}anchor=null;}
  function setPower(value){power=Math.max(120,Math.min(1000,Number(value)*10));}
  function pointerCancel() { dragging = false; anchor=null; }
  function keyDown(key) {
    if (mode !== 'aim') return;
    if (key === 'Space' || key === ' ' || key === 'Enter') shoot();
    if (key === 'ArrowLeft' || key === 'a') aim -= .035;
    if (key === 'ArrowRight' || key === 'd') aim += .035;
    if (key === 'ArrowUp' || key === 'w') {power = Math.min(1000, power + 25);api.setControlValue?.('power',Math.round(power/10));}
    if (key === 'ArrowDown' || key === 's') {power = Math.max(120, power - 25);api.setControlValue?.('power',Math.round(power/10));}
  }
  function circle(ctx, x, y, r, fill, stroke) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function rect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  }
  function text(ctx, value, x, y, size, color, align = 'left') {
    ctx.font = `${size}px system-ui, sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y);
  }
  function drawBall(ctx, b, x = b.x, y = b.y, radius = R) {
    ctx.save(); ctx.shadowColor = '#0008'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 2;
    circle(ctx, x, y, radius, b.n > 8 ? '#e9e4d5' : colors[b.n]); ctx.restore();
    if (b.n > 8) {
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = colors[b.n]; ctx.fillRect(x - radius, y - radius * .52, radius * 2, radius * 1.04); ctx.restore();
    }
    const gloss = ctx.createRadialGradient(x - radius * .35, y - radius * .4, 0, x + radius * .3, y + radius * .35, radius * 1.35);
    gloss.addColorStop(0, '#ffffff55'); gloss.addColorStop(.5, '#ffffff00'); gloss.addColorStop(1, '#00000055'); circle(ctx, x, y, radius, gloss);
    if (b.n) {
      circle(ctx, x, y, radius * .46, '#eeeadf');
      ctx.font = `bold ${radius * .65}px system-ui, sans-serif`; ctx.fillStyle = '#20262a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(b.n), x, y + .3); ctx.textBaseline = 'alphabetic';
    } else circle(ctx, x - radius * .33, y - radius * .36, radius * .18, '#fff9');
  }
  function guide(ctx) {
    const dx = Math.cos(aim), dy = Math.sin(aim);
    let distance = 1100, target = null;
    for (const b of balls) {
      if (!b.active || !b.n) continue;
      const bx = b.x - cue.x, by = b.y - cue.y;
      const along = bx * dx + by * dy, lateral = bx * dy - by * dx;
      if (along < 0 || Math.abs(lateral) >= R * 2) continue;
      const hit = along - Math.sqrt(R * R * 4 - lateral * lateral);
      if (hit > 0 && hit < distance) { distance = hit; target = b; }
    }
    const wallX = dx > 0 ? (table.right - R - cue.x) / dx : dx < 0 ? (table.left + R - cue.x) / dx : Infinity;
    const wallY = dy > 0 ? (table.bottom - R - cue.y) / dy : dy < 0 ? (table.top + R - cue.y) / dy : Infinity;
    const firstHitDistance = distance;
    distance = Math.max(0, Math.min(distance, wallX, wallY, 600));
    const endX = cue.x + dx * distance, endY = cue.y + dy * distance;
    ctx.save(); ctx.setLineDash([5, 8]); ctx.lineWidth = 1; ctx.strokeStyle = '#d6e6d578';
    ctx.beginPath(); ctx.moveTo(cue.x + dx * 18, cue.y + dy * 18); ctx.lineTo(endX, endY); ctx.stroke(); ctx.setLineDash([]);
    circle(ctx, endX, endY, R, null, '#d5e4d565');
    if (target && Math.abs(distance - firstHitDistance) < .1) {
      const angle = Math.atan2(target.y - endY, target.x - endX);
      ctx.strokeStyle = '#f0db9b77'; ctx.beginPath(); ctx.moveTo(target.x, target.y); ctx.lineTo(target.x + Math.cos(angle) * 48, target.y + Math.sin(angle) * 48); ctx.stroke();
    }
    ctx.translate(cue.x, cue.y); ctx.rotate(aim);
    const pull = dragging ? power / 22 : 9;
    const wood = ctx.createLinearGradient(-135, 0, -24, 0); wood.addColorStop(0, '#986946'); wood.addColorStop(.8, '#e1c6a0'); wood.addColorStop(1, '#e9e0bf');
    ctx.strokeStyle = wood; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-142 - pull, 0); ctx.lineTo(-20 - pull, 0); ctx.stroke();
    ctx.strokeStyle = '#67a4a5'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-20 - pull, 0); ctx.lineTo(-17 - pull, 0); ctx.stroke(); ctx.restore();
  }
  function draw(ctx) {
    ctx.fillStyle = '#191c1d'; ctx.fillRect(0, 0, W, H);
    text(ctx, 'EIGHT BALL CLUB', 37, 35, 13, '#c8b89b');
    text(ctx, balls.some(b => b.n && b.n !== 8 && b.active) ? 'COLOURS FIRST. EIGHT LAST.' : 'THE EIGHT IS YOURS.', W - 37, 35, 11, '#8b9691', 'right');
    ctx.save(); ctx.shadowColor = '#0009'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 10;
    const wood = ctx.createLinearGradient(0, 60, 0, 540); wood.addColorStop(0, '#755541'); wood.addColorStop(.2, '#3d2d24'); wood.addColorStop(.8, '#503d2e'); wood.addColorStop(1, '#84634a');
    rect(ctx, 43, 66, 874, 468, 35, wood); ctx.restore();
    ctx.lineWidth = 1; ctx.strokeStyle = '#b68d5c40'; ctx.beginPath(); ctx.roundRect(49, 72, 862, 456, 30); ctx.stroke();
    rect(ctx, 66, 90, 828, 420, 20, '#1c3e34');
    const felt = ctx.createLinearGradient(0, 95, 0, 510); felt.addColorStop(0, '#285f4f'); felt.addColorStop(1, '#1d493d');
    rect(ctx, table.left, table.top, table.right - table.left, table.bottom - table.top, 14, felt);
    // Subtle weave, rather than an image texture, keeps the game crisp at any size.
    ctx.fillStyle = '#b3dcc305';
    for (let y = 105; y < 500; y += 4) ctx.fillRect(84, y, 792, 1);
    ctx.strokeStyle = '#0d3026'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(103, 99); ctx.lineTo(451, 99); ctx.moveTo(509, 99); ctx.lineTo(857, 99); ctx.moveTo(103, 501); ctx.lineTo(451, 501); ctx.moveTo(509, 501); ctx.lineTo(857, 501); ctx.moveTo(75, 127); ctx.lineTo(75, 473); ctx.moveTo(885, 127); ctx.lineTo(885, 473); ctx.stroke();
    for (const p of pockets) {circle(ctx,p[0],p[1],29,'#6e5845');circle(ctx,p[0],p[1],26,'#162d25');const depth=ctx.createRadialGradient(p[0]-4,p[1]-4,1,p[0],p[1],23);depth.addColorStop(0,'#040807');depth.addColorStop(1,'#101b16');circle(ctx,p[0],p[1]+1,23,depth);}
    for (const x of [174, 276, 378, 582, 684, 786]) {
      circle(ctx, x, 80, 2.2, '#cab99a'); circle(ctx, x, 520, 2.2, '#cab99a');
    }
    for (const y of [198, 300, 402]) { circle(ctx, 57, y, 2.2, '#cab99a'); circle(ctx, 903, y, 2.2, '#cab99a'); }
    ctx.save(); ctx.beginPath(); ctx.roundRect(table.left, table.top, 816, 408, 14); ctx.clip();
    ctx.strokeStyle = '#c0dbca16'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(276, 100); ctx.lineTo(276, 500); ctx.stroke();
    circle(ctx, 628, 300, 2, '#bcd6c126');
    if (mode === 'aim' && cue.active) guide(ctx);
    for (const b of balls) if (b.active) drawBall(ctx, b);
    ctx.restore();
    for(const b of sinking){const f=b.t/.32;ctx.globalAlpha=f;drawBall(ctx,b,b.px+(b.x-b.px)*f,b.py+(b.y-b.py)*f,R*f);ctx.globalAlpha=1;}
    const show = messageTime > 0 ? lastMessage : mode === 'moving' ? 'Let the table settle.' : dragging ? 'Release to shoot.' : 'Tap a target to aim. Set power, then Shoot. Or drag from the cue ball.';
    text(ctx, show, 37, 566, 13, messageTime > 0 ? '#d3d9cb' : '#95a19a');
    const powerWidth = 126;
    rect(ctx, W - 173, 552, powerWidth, 5, 2, '#373e38');
    rect(ctx, W - 173, 552, powerWidth * power / 1000, 5, 2, '#c1ad78');
    text(ctx, 'POWER', W - 173, 578, 10, '#7c8880');
    text(ctx, `${Math.round(power / 10)}%`, W - 47, 578, 10, '#b3b8a7', 'right');
    // A compact tray shows exactly which balls have been removed.
    for (let i = 0; i < pocketed.length; i++) drawBall(ctx, { n: pocketed[i] }, 485 + i * 15, 578, 6);
  }
  reset();
  return { reset, update, draw, pointerDown, pointerMove, pointerUp, pointerCancel, keyDown, setPower };
}

