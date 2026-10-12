// Original rooftop runner. World-space collision and bounded patterns keep speed fair.
export default function createGame(api) {
  const W = 960, H = 600, ground = 462, px = 215, gravity = 1650;
  let platforms, obstacles, coins, particles, player, distance, speed, time, count, ended;
  let jumpBuffer, coyote, lastHUD, shake, nextId,lives,invincible,district,banner,endless;
  const names=['Old Quarter','Skyline Heights','The Neon Mile'];
  const rand = (a, b) => a + Math.random() * (b - a);
  function hud() { api.hud({District:endless?'Endless':`${Math.min(3,district+1)} / 3`,Lives:lives?'● '.repeat(lives).trim():'None',Distance: `${Math.floor(distance / 10)} m`, Coins: count, Score: Math.floor(distance / 10) + count * 25}); }
  function addPlatform(start, length, first = false) {
    platforms.push({x: start, w: length, id: nextId++});
    // Never put obstacles beside a gap, nor close enough to require instant re-jumping.
    const positions = first ? [650] : [start + rand(365, 415)];
    if (!first && length > 1100) positions.push(start + 805);
    for (const x of positions) {
      if (x < start + length - 190) obstacles.push({x, w: rand(33, 47), h: rand(43, 64), passed: false, type: Math.random() < .5 ? 0 : 1});
    }
    for (let x = start + 110; x < start + length - 100; x += 105) {
      const near = positions.some(p => Math.abs(p - x) < 85);
      coins.push({x, y: ground - (near ? 133 : 91), r: 11, collected: false});
    }
    if (!first) {
      // An elevated coin arc previews each gap before the leading edge arrives.
      for (let i = 1; i < 4; i++) coins.push({x: start - 125 + i * 32, y: ground - 113 - Math.sin(i / 4 * Math.PI) * 32, r: 11, collected: false});
    }
  }
  function fillWorld() {
    let edge = platforms[platforms.length - 1].x + platforms[platforms.length - 1].w;
    while (edge < distance + W + 1400) {
      const gap = rand(90, 125), len = rand(800, 1180);
      addPlatform(edge + gap, len); edge += gap + len;
    }
  }
  function reset() {
    platforms = []; obstacles = []; coins = []; particles = []; nextId = 0;
    distance = time = count = lastHUD = shake = jumpBuffer = 0; speed = 300; ended = false;lives=3;invincible=0;district=0;banner=2.5;endless=api.options?.mode==='endless'; coyote = .1;
    player = {y: ground - 54, vy: 0, w: 30, h: 54, grounded: true, jumps: 0};
    addPlatform(-300, 1600, true); fillWorld(); hud();
    api.setHint('Double-jump across three districts. Three lives, coins and a finish line. Or choose Endless before starting.');
  }
  function dust(x, y, color, n = 9) {
    for (let i = 0; i < n; i++) particles.push({x, y, vx: rand(-135, 40), vy: rand(-100, -15), life: rand(.22, .5), color});
  }
  function jump() {
    if (ended) return;
    if (player.grounded || coyote > 0) {
      player.vy = -650; player.grounded = false; player.jumps = 1; coyote = 0; jumpBuffer = 0;
      dust(distance + px, ground, '#6beadf'); api.sound('tap');
    } else if (player.jumps < 2) {
      player.vy = -590; player.jumps = 2; jumpBuffer = 0;
      dust(distance + px, player.y + player.h, '#e785f0', 13); api.sound('tap');
    } else jumpBuffer = .11;
  }
  function finish(reason) {
    if (ended) return;
    ended = true; shake = .25; api.sound('hit'); hud();
    api.end(Math.floor(distance / 10) + count * 25, 'Out of lives', `${Math.floor(distance / 10)} m · ${count} coins. ${reason}`);
  }
  function damage(reason){if(invincible>0)return;lives--;if(lives<=0){finish(reason);return;}invincible=2;shake=.3;api.sound('hit');hud();}
  function complete(){ended=true;hud();api.sound('win');api.end(Math.floor(distance/10)+count*25+lives*1000,'City run complete',`Three districts cleared · ${count} coins · ${lives} lives remaining.`);}
  function update(dt) {
    dt = Math.min(dt, .035); time += dt; shake = Math.max(0, shake - dt);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 350 * dt; p.life -= dt; }
    particles = particles.filter(p => p.life > 0);
    if (ended) return;invincible=Math.max(0,invincible-dt);banner=Math.max(0,banner-dt);const nextDistrict=Math.min(2,Math.floor(distance/8000));if(nextDistrict!==district){district=nextDistrict;banner=2.4;api.sound('win');}if(!endless&&distance>=24000){complete();return;}
    speed = Math.min(490, 300 + time * 2.4); distance += speed * dt;
    fillWorld();
    const worldX = distance + px, oldBottom = player.y + player.h;
    jumpBuffer = Math.max(0, jumpBuffer - dt); coyote = Math.max(0, coyote - dt);
    player.vy += gravity * dt; player.y += player.vy * dt;
    const underfoot = platforms.some(p => worldX + player.w - 5 > p.x && worldX + 5 < p.x + p.w);
    if (underfoot && player.vy >= 0 && oldBottom <= ground + 2 && player.y + player.h >= ground) {
      const landing = !player.grounded;
      player.y = ground - player.h; player.vy = 0; player.grounded = true; player.jumps = 0; coyote = .1;
      if (landing) dust(worldX, ground, '#76ded7', 6);
      if (jumpBuffer > 0) jump();
    } else {
      if (player.grounded) { player.grounded = false; coyote = .1; }
    }
    for (const o of obstacles) {
      // Insets soften corner collisions without hiding actual barrier hits.
      if (!o.passed && invincible<=0 && worldX + player.w - 6 > o.x + 3 && worldX + 6 < o.x + o.w - 3 && player.y + player.h - 5 > ground - o.h + 3 && player.y + 5 < ground) {
        o.passed=true;damage('Jump a little earlier to clear the barriers.');if(ended)return;
      }
      if (o.x + o.w < worldX) o.passed = true;
    }
    for (const coin of coins) {
      if (coin.collected) continue;
      const closestX = Math.max(worldX, Math.min(coin.x, worldX + player.w));
      const closestY = Math.max(player.y, Math.min(coin.y, player.y + player.h));
      if ((coin.x - closestX) ** 2 + (coin.y - closestY) ** 2 < (coin.r + 3) ** 2) {
        coin.collected = true; count++; dust(coin.x, coin.y, '#ffd26c', 7); api.sound('win'); hud();
      }
    }
    if (player.y > H + 30) { damage('Use your second jump to cross the gaps.');if(ended)return;const nextPlatform=platforms.find(p=>p.x+p.w>worldX+60);if(nextPlatform){distance=Math.max(distance,nextPlatform.x-px+55);player.y=ground-player.h;player.vy=0;player.grounded=true;player.jumps=0;invincible=2;} }
    platforms = platforms.filter(p => p.x + p.w > distance - 350);
    obstacles = obstacles.filter(o => o.x + o.w > distance - 100);
    coins = coins.filter(c => c.x > distance - 100);
    if (time - lastHUD > .15) { hud(); lastHUD = time; }
  }
  function skyline(ctx, layer, factor, baseline, color) {
    const shift = distance * factor, unit = layer === 0 ? 120 : 95;
    const start = Math.floor(shift / unit) - 1;
    ctx.fillStyle = color;
    for (let i = start; i < start + 13; i++) {
      const hash = Math.abs(Math.sin(i * 71.37 + layer * 8.3));
      const bw = unit * (.62 + hash * .28), bh = 65 + hash * (layer === 0 ? 150 : 175), x = i * unit - shift;
      ctx.fillRect(x, baseline - bh, bw, bh + 30);
      if (layer === 1) {
        ctx.fillStyle = '#253748';
        for (let row = 0; row < bh / 23 - 1; row++) for (let col = 0; col < bw / 19 - 1; col++) {
          if (Math.sin(i * 11 + row * 23 + col * 7) > .3) ctx.fillRect(x + 10 + col * 19, baseline - bh + 14 + row * 23, 4, 7);
        }
        if (hash > .66) { ctx.fillStyle = '#c75b98'; ctx.fillRect(x + bw - 8, baseline - bh + 18, 3, 31); }
        ctx.fillStyle = color;
      }
    }
  }
  function drawPlayer(ctx) {
    const y = player.y, running = player.grounded, stride = running ? Math.sin(time * 21) * 12 : 9;
    ctx.save(); ctx.translate(px + 15, y + 27);
    ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.strokeStyle = '#618daa';
    ctx.beginPath(); ctx.moveTo(-3, 11); ctx.lineTo(-7 + stride, 23); ctx.lineTo(-11 + stride, 26); ctx.stroke();
    ctx.strokeStyle = '#b5dae5'; ctx.beginPath(); ctx.moveTo(4, 10); ctx.lineTo(9 - stride, 24); ctx.lineTo(15 - stride, 26); ctx.stroke();
    ctx.fillStyle = '#628eab'; ctx.fillRect(-10, -8, 18, 22);
    ctx.fillStyle = '#e4eff0'; ctx.fillRect(-6, -7, 15, 13);
    ctx.fillStyle = '#f19f9b'; ctx.fillRect(-5, -25, 18, 17);
    ctx.fillStyle = '#dae9ef'; ctx.fillRect(-8, -27, 23, 11);
    ctx.fillStyle = '#68f1de'; ctx.shadowColor = '#6fffe2'; ctx.shadowBlur = 10; ctx.fillRect(5, -21, 11, 5); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#adcbd6'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(3, -2); ctx.lineTo(10 + stride * .5, 6); ctx.lineTo(15 + stride * .4, 0); ctx.stroke();
    // A small trailing scarf sells speed without distracting from the collision silhouette.
    ctx.fillStyle = '#ed70a1'; ctx.beginPath(); ctx.moveTo(-6, -9); ctx.lineTo(-32, -10 + Math.sin(time * 13) * 5); ctx.lineTo(-20, -4); ctx.lineTo(-5, -4); ctx.fill();
    ctx.restore();
  }
  function draw(ctx) {
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0,['#0c1226','#182b39','#25142e'][district]); bg.addColorStop(.68,['#332441','#3a4a57','#543049'][district]); bg.addColorStop(1, '#0c1727');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (shake) ctx.translate(Math.sin(time * 85) * shake * 12, 0);
    ctx.fillStyle = '#edb0aa'; ctx.beginPath(); ctx.arc(764 - (distance * .014 % 180), 137, 43, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(15,19,39,.23)';
    for (let y = 116; y < 185; y += 11) ctx.fillRect(695 - (distance * .014 % 180), y, 130, 3);
    ctx.fillStyle = 'rgba(214,203,244,.55)';
    for (let i = 0; i < 30; i++) ctx.fillRect((i * 131 + 39) % W, 62 + (i * 43) % 181, i % 4 === 0 ? 2 : 1, 1);
    skyline(ctx, 0, .14, 390, '#24243b'); skyline(ctx, 1, .34, 440, '#152334');
    ctx.fillStyle = '#335e64'; ctx.fillRect(0, 437, W, 1);
    for (const p of platforms) {
      const x = p.x - distance;
      ctx.fillStyle = '#101e2b'; ctx.fillRect(x, ground, p.w, H - ground + 10);
      ctx.fillStyle = '#263c4a'; ctx.fillRect(x, ground, p.w, 17);
      ctx.fillStyle = '#72e2d1'; ctx.shadowColor = '#51d8c5'; ctx.shadowBlur = 9; ctx.fillRect(x, ground, p.w, 3); ctx.shadowBlur = 0;
      ctx.fillStyle = '#192c3a';
      for (let sx = x + 15; sx < Math.min(x + p.w, W + 30); sx += 70) {
        if (sx < -70) continue;
        ctx.fillRect(sx, ground + 36, 52, 34); ctx.fillRect(sx + 8, ground + 89, 44, 25);
        ctx.fillStyle = '#2c4350'; ctx.fillRect(sx + 8, ground + 42, 4, 17); ctx.fillStyle = '#192c3a';
      }
      // Mark gap edges with a warm hazard stripe, visible before reaching the gap.
      ctx.fillStyle = '#f3b96c'; ctx.fillRect(x + p.w - 17, ground + 2, 11, 5); ctx.fillRect(x + 6, ground + 2, 11, 5);
    }
    for (const o of obstacles) {
      const x = o.x - distance;
      if (x < -70 || x > W + 70) continue;
      const y = ground - o.h;
      ctx.fillStyle = '#4e3449'; ctx.fillRect(x, y + 5, o.w, o.h - 5);
      ctx.fillStyle = o.type ? '#f5b278' : '#f37cad'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
      ctx.fillRect(x, y, o.w, 5); ctx.fillRect(x, y, 4, o.h); ctx.fillRect(x + o.w - 4, y, 4, o.h); ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(239,157,178,.46)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 6, y + 13); ctx.lineTo(x + o.w - 6, ground - 10); ctx.moveTo(x + o.w - 6, y + 13); ctx.lineTo(x + 6, ground - 10); ctx.stroke();
    }
    for (const c of coins) {
      const x = c.x - distance; if (c.collected || x < -20 || x > W + 20) continue;
      const squeeze = .65 + Math.abs(Math.sin(time * 3 + c.x)) * .35;
      ctx.save(); ctx.translate(x, c.y); ctx.scale(squeeze, 1);
      ctx.fillStyle = '#ffc966'; ctx.shadowColor = '#edaa51'; ctx.shadowBlur = 9; ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#805c33'; ctx.lineWidth = 2; ctx.strokeRect(-3, -5, 6, 10); ctx.restore();
    }
    if(!endless){const fx=24215-distance;if(fx>-50&&fx<W+50){ctx.fillStyle='#bde6df';ctx.fillRect(fx,ground-140,5,140);ctx.fillRect(fx+82,ground-140,5,140);for(let r=0;r<3;r++)for(let col=0;col<8;col++){ctx.fillStyle=(r+col)%2?'#122d35':'#e9e7d3';ctx.fillRect(fx+5+col*9.5,ground-140+r*10,9.5,10);}ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.fillStyle='#d0efe7';ctx.fillText('FINISH',fx+44,ground-154);}}
    if (player.grounded) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(px + 13, ground - 1, 25, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.save();if(invincible>0&&Math.floor(time*12)%2)ctx.globalAlpha=.45;drawPlayer(ctx);ctx.restore();
    for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 3); ctx.fillStyle = p.color; ctx.fillRect(p.x - distance, p.y, 3, 3); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d8e7ee'; ctx.textAlign = 'left'; ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(endless?'ENDLESS RUN':`DISTRICT ${String(district+1).padStart(2,'0')} / 03`, 35, 43);
    ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = '#90a4b7'; ctx.fillText(endless?'HOW FAR CAN YOU GO?':names[district].toUpperCase(),35,65);if(!endless){ctx.fillStyle='#294150';ctx.fillRect(35,77,260,4);ctx.fillStyle='#73e0cf';ctx.fillRect(35,77,260*Math.min(1,distance/24000),4);}
    ctx.textAlign = 'right'; ctx.fillStyle = '#6adfce'; ctx.fillText(player.jumps === 0 ? '● ●  JUMPS' : player.jumps === 1 ? '● ○  JUMPS' : '○ ○  JUMPS', W - 35, 43);
    if (distance < 420) {
      ctx.textAlign = 'center'; ctx.font = '600 15px system-ui, sans-serif'; ctx.fillStyle = '#b9c9d9';
      ctx.fillText('TAP TO JUMP · TAP AGAIN TO DOUBLE JUMP', W / 2, 95);
    }
    if(banner>0&&!endless){ctx.textAlign='center';ctx.font='600 22px system-ui';ctx.fillStyle='#dcf0ef';ctx.fillText(names[district],480,128);ctx.font='12px system-ui';ctx.fillStyle='#91beb9';ctx.fillText(`DISTRICT ${district+1} OF 3`,480,153);}
    ctx.restore();
  }
  return {reset, update, draw, pointerDown: jump, keyDown(key) { if (key === 'Space' || key === ' ' || key === 'ArrowUp' || key === 'w') jump(); }};
}


