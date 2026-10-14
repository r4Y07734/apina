import { animationFor, resolveAnimationTargets } from './animation-profiles.js';
import { drawCardScene } from './animation-renderer.js';

const damageScenes = new Set(['missile','sniper','slash','car','traffic','projectile','cannon','balloon','sand','gust','sonic','barrel','collapse','fracture','numbers','paperplane','precision','bad-aim','impact','droplet','surprise','pressure','mystery-shot']);
const positiveScenes = new Set(['charge','drink','apple','battery','vitality','charity','gift','investment','jackpot','music','dance','blessing','donation','snack','feast','curry','snake']);
const effectActor = (effect, actor) => effect.target === 'self' ? actor : 1 - actor;

/** Presentation targets are derived from effects, never from a card's text. */
export function planCardAnimation(entry) {
  const card = entry.card, actor = entry.actor, profile = animationFor(card);
  const effects = (Array.isArray(card.effects) ? card.effects : []).filter(effect => effect && ['self','opponent'].includes(effect.target));
  const allTargets = resolveAnimationTargets(card, actor);
  let primary = effects;
  if (damageScenes.has(profile.scene)) primary = effects.filter(effect => effect.type === 'damage');
  if (positiveScenes.has(profile.scene)) primary = effects.filter(effect => (effect.type === 'heal' || effect.type === 'energy') && Number(effect.amount) > 0);
  const targets = [...new Set((primary.length ? primary : effects).map(effect => effectActor(effect, actor)))];
  const steal = effects.find(effect => effect.type === 'steal');
  const scenes = steal && ['transfer','scam'].includes(profile.scene)
    ? [{ from: effectActor(steal,actor), to: 1-effectActor(steal,actor) }]
    : (targets.length ? targets : [actor]).map(to => ({ from:actor, to }));
  const cues = [];
  for (const effect of effects) {
    const target = effectActor(effect,actor);
    if (effect.type === 'steal') {
      cues.push({ type:'drain', target }, { type:'energy', target:1-target });
    } else cues.push({ type:effect.type === 'energy' && Number(effect.amount) < 0 ? 'drain' : effect.type, target });
  }
  const transfers = effects.filter(effect=>effect.type==='steal').map(effect=>({from:effectActor(effect,actor),to:1-effectActor(effect,actor)}));
  return { profile, scenes, targets:allTargets, transfers, cues: cues.filter((cue,i) => cues.findIndex(c => c.type===cue.type && c.target===cue.target)===i) };
}

function drawCues(ctx, cues, anchor, progress) {
  const t = Math.max(0,Math.min(1,(progress-.54)/.46));
  if (!t) return;
  const opacity = Math.sin(t*Math.PI);
  const colors = { damage:'#ffac91', heal:'#b7f3b1', energy:'#91ddff', drain:'#d5b782', poison:'#bddf70' };
  for (const cue of cues) {
    const point = anchor(cue.target), r = point.size*(.22+t*.16);
    ctx.save(); ctx.globalAlpha = opacity*.82; ctx.strokeStyle = colors[cue.type] || '#d9e1c9'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 2;
    if (cue.type === 'damage') {
      for(let i=0;i<7;i++){const a=i*Math.PI*2/7;ctx.beginPath();ctx.moveTo(point.x+Math.cos(a)*r,point.y+Math.sin(a)*r);ctx.lineTo(point.x+Math.cos(a)*(r+7),point.y+Math.sin(a)*(r+7));ctx.stroke();}
    } else {
      ctx.beginPath();ctx.arc(point.x,point.y,r,0,Math.PI*2);ctx.stroke();
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2+t, x=point.x+Math.cos(a)*r, y=point.y+Math.sin(a)*r-t*12;
        if(cue.type==='heal'){ctx.fillRect(x-4,y-1,8,2);ctx.fillRect(x-1,y-4,2,8);}
        else if(cue.type==='poison'){ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();}
        else {ctx.beginPath();ctx.moveTo(x+2,y-5);ctx.lineTo(x-3,y+1);ctx.lineTo(x+1,y+1);ctx.lineTo(x-1,y+5);ctx.stroke();}
      }
    }
    ctx.restore();
  }
}

/** One reusable, non-interactive canvas. Rules and turn clocks continue normally. */
export function createCardAnimations(arena) {
  const canvas = document.createElement('canvas');
  canvas.className = 'card-action-canvas'; canvas.hidden = true; canvas.setAttribute('aria-hidden','true');
  arena.append(canvas);
  const ctx = canvas.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const seen = new Set(), waiters = new Set();
  let queue = [], current = null, viewer = 0, raf = 0, width = 1, height = 1, ratio = 1;

  function resize() {
    const rect = arena.getBoundingClientRect(); width = Math.max(1,arena.clientWidth); height = Math.max(1,arena.clientHeight);
    ratio = Math.min(2,devicePixelRatio || 1);
    if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}
    return rect;
  }
  function anchor(actor) {
    const bounds = canvas.getBoundingClientRect();
    const display = actor === viewer ? 0 : 1;
    const portrait = arena.querySelector(`#fighter-${display} .fighter-avatar`).getBoundingClientRect();
    const anchorY = .55;
    return { x:portrait.left+portrait.width*.5-bounds.left, y:portrait.top+portrait.height*anchorY-bounds.top, size:Math.max(45,Math.min(180,portrait.height)) };
  }
  function idle() {
    current = null; canvas.hidden = true; ctx.clearRect(0,0,canvas.width,canvas.height);
    arena.classList.remove('card-animation-active','card-animation-opponent');
    for(const key of Object.keys(canvas.dataset))delete canvas.dataset[key];
    const callbacks=[...waiters];waiters.clear();for(const callback of callbacks)callback();
  }
  function begin(now) {
    if (!queue.length) { idle(); return; }
    const entry=queue.shift(), plan=planCardAnimation(entry);
    const duration = reducedMotion.matches ? 380 : Math.max(650,plan.profile.duration/(1+queue.length*.24));
    current={entry,plan,start:now,duration}; canvas.hidden=false; resize();
    arena.classList.add('card-animation-active');
    arena.classList.toggle('card-animation-opponent',plan.targets.includes(1-viewer));
    canvas.dataset.cardId=entry.card.id;canvas.dataset.scene=plan.profile.scene;
    canvas.dataset.actor=String(entry.actor);canvas.dataset.targets=plan.targets.join(',');
    canvas.dataset.targetDisplays=plan.targets.map(target=>target===viewer?0:1).join(',');
  }
  function frame(now) {
    raf=0;
    if(!current)begin(now);
    if(!current)return;
    const progress=Math.min(1,(now-current.start)/current.duration);
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
    ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
    const displayProgress=reducedMotion.matches ? .72 : progress;
    for(const scene of current.plan.scenes)drawCardScene(ctx,{width,height,progress:displayProgress,scene:current.plan.profile.scene,from:anchor(scene.from),to:anchor(scene.to),color:current.plan.profile.color,seed:current.entry.id});
    if(!['transfer','scam'].includes(current.plan.profile.scene))for(const transfer of current.plan.transfers)drawCardScene(ctx,{width,height,progress:displayProgress,scene:'transfer',from:anchor(transfer.from),to:anchor(transfer.to),color:'#ffd16a',seed:current.entry.id});
    drawCues(ctx,current.plan.cues,anchor,displayProgress);
    ctx.restore();
    if(progress>=1){current=null;if(queue.length)begin(now);else idle();}
    if(current || queue.length)raf=requestAnimationFrame(frame);
  }
  function receive(previous,next) {
    viewer=next.you;
    const plays=next.playedCards || [];
    // Joining/resuming hydrates history. Only newly received plays are animated.
    if(!previous){for(const entry of plays)seen.add(entry.id);return;}
    const prior=new Set((previous.playedCards || []).map(entry=>entry.id));
    for(const entry of plays){
      if(seen.has(entry.id)||prior.has(entry.id))continue;
      seen.add(entry.id);
      if(entry.card && (entry.actor===0||entry.actor===1)){
        const effects=entry.card.effects.filter((effect,index)=>!Array.isArray(entry.effectResults)||entry.effectResults[index]!==false);
        if(effects.length)queue.push({...entry,card:{...entry.card,effects}});
      }
    }
    // At most five cards can be played from a hand; bound delayed reconnect bursts.
    if(queue.length>8)queue=queue.slice(-8);
    if(seen.size>200){const recent=[...seen].slice(-100);seen.clear();recent.forEach(id=>seen.add(id));}
    if(queue.length && !raf)raf=requestAnimationFrame(frame);
  }
  function reset() {
    cancelAnimationFrame(raf);raf=0;queue=[];current=null;seen.clear();waiters.clear();idle();
  }
  const observer=new ResizeObserver(resize);observer.observe(arena);
  return {
    receive,reset,
    whenIdle(callback){if(!current&&!queue.length){callback();return()=>{};}waiters.add(callback);return()=>waiters.delete(callback);},
    get busy(){return Boolean(current||queue.length);},
    destroy(){reset();observer.disconnect();canvas.remove();},
  };
}
