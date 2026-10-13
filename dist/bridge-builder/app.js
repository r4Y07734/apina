import { LEVELS } from './levels.js';
import { MATERIALS, createDesign, getDesignCost, validateDesign, createSimulation, stepSimulation } from './physics.js';
import { createBridgeRenderer } from './renderer.js';

const $ = id => document.getElementById(id);
const canvas = $('bridge-canvas'), renderer = createBridgeRenderer(canvas);
const clone = value => structuredClone(value);
const storageKey = 'apina-bridge-progress';
const money = value => '$' + Math.round(value).toLocaleString();
let level = LEVELS[0], design = createDesign(level), simulation = null, mode = 'build', tool = 'road';
let from = null, hover = null, preview = null, pointer = null, dragging = null, nextId = 1;
let history = [], historyIndex = 0, paused = false, speed = 1, lastTime = 0, elapsed = 0, resultShown = false;
let remember = false, progress = {}, savedDesigns = {}, stressView = false, gridOn = true;
let pendingStatus = '', pendingError = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function note(text, error = false) {
  pendingStatus = text; pendingError = error;
  $('status-message').textContent = text; $('status-message').classList.toggle('error', error);
}
function updateStorageStatus() { $('storage-status').textContent = remember ? 'Progress and designs saved on this device.' : 'Progress stays in this visit unless you choose to save it.'; }
function persist() {
  savedDesigns[level.id] = clone(design);
  if (!remember) return;
  try { localStorage.setItem(storageKey, JSON.stringify({ version:1, lastLevel:level.id, progress, designs:savedDesigns })); }
  catch { remember = false; $('remember-progress').checked = false; updateStorageStatus(); note('Browser storage is unavailable. Your bridges remain available for this visit.', true); }
}
function safeStoredDesign(value, target) {
  if (!value || !Array.isArray(value.nodes) || !Array.isArray(value.members) || value.nodes.length > 100 || value.members.length > 180) return null;
  const ids = new Set();
  for (const node of value.nodes) {
    if (!node || typeof node.id !== 'string' || node.id.length > 64 || ids.has(node.id) || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return null;
    ids.add(node.id);
  }
  if (value.members.some(member => !member || typeof member.id !== 'string' || !ids.has(member.a) || !ids.has(member.b) || !MATERIALS[member.material])) return null;
  const anchors = createDesign(target).nodes;
  if (anchors.some(anchor => !value.nodes.some(node => node.id === anchor.id && node.x === anchor.x && node.y === anchor.y && node.fixed))) return null;
  return clone(value);
}
function readStorage() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!value || value.version !== 1) return;
    remember = true;
    for (const target of LEVELS) {
      const record = value.progress?.[target.id];
      if (record && Number.isFinite(record.cost) && Number.isInteger(record.stars) && record.stars >= 1 && record.stars <= 3) progress[target.id] = { cost:record.cost, stars:record.stars };
      const saved = safeStoredDesign(value.designs?.[target.id], target);
      if (saved) savedDesigns[target.id] = saved;
    }
    const savedLevel = LEVELS.find(target => target.id === value.lastLevel);
    if (savedLevel) level = savedLevel;
  } catch { /* A malformed storage entry does not block the game. */ }
}
function resetHistory() { history = [clone(design)]; historyIndex = 0; }
function commit() {
  history.splice(historyIndex + 1); history.push(clone(design));
  if (history.length > 100) history.shift();
  historyIndex = history.length - 1; from = null; preview = null; persist(); updateUI();
}
function undo() { if (mode !== 'build' || historyIndex < 1) return; design = clone(history[--historyIndex]); from = preview = null; persist(); updateUI(); note('Last change undone.'); }
function redo() { if (mode !== 'build' || historyIndex >= history.length - 1) return; design = clone(history[++historyIndex]); from = preview = null; persist(); updateUI(); note('Change restored.'); }
function loadLevel(target) {
  persist(); level = target; design = safeStoredDesign(savedDesigns[level.id], level) || createDesign(level);
  mode = 'build'; simulation = null; paused = false; resultShown = false; from = hover = preview = null;
  nextId = 1; resetHistory(); persist(); $('result-dialog').close(); $('levels-dialog').close();
  document.body.classList.remove('testing'); chooseTool('road'); updateUI(); renderer.resize();
  note(level.description || 'Build a road across the gap, then strengthen it with triangles.');
}
function chooseTool(value) {
  if (mode !== 'build' || (value !== 'erase' && !level.materials.includes(value))) return;
  tool = value; from = null; preview = null;
  for (const button of document.querySelectorAll('[data-tool]')) { const active = button.dataset.tool === tool; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); }
  $('canvas-tip').textContent = tool === 'erase' ? 'Click a member to remove it. Undo restores it.' : `Click a joint, then a grid point to place ${MATERIALS[tool].name.toLowerCase()}. Drag a free joint to move it.`;
}
function updateUI() {
  const cost = getDesignCost(design), available = level.budget - cost;
  $('level-name').textContent = level.name; $('level-subtitle').textContent = level.region;
  $('level-count').textContent = `${LEVELS.indexOf(level) + 1} / ${LEVELS.length}`;
  $('budget-value').textContent = money(cost); $('budget-limit').textContent = money(level.budget);
  $('budget-bar').style.width = `${Math.min(100,cost/level.budget*100)}%`;
  $('budget-value').classList.toggle('over-budget', available < -.01);
  $('vehicle-label').textContent = level.vehicles.map(v => `${v.kind === 'truck' ? 'Truck' : 'Car'} · ${Math.round(v.mass)} kg`).join(' + ');
  const building = mode === 'build';
  for (const button of document.querySelectorAll('[data-tool]')) {
    const enabled = building && (button.dataset.tool === 'erase' || level.materials.includes(button.dataset.tool));
    button.disabled = !enabled;
    const material = MATERIALS[button.dataset.tool];
    if (material) {
      button.title = `${material.name}: ${money(material.costPerMeter)} / m · max ${material.maxLength} m`;
      button.querySelector('small').textContent = level.materials.includes(button.dataset.tool) ? `${money(material.costPerMeter)}/m · ${material.maxLength} m max` : `From level ${button.dataset.tool==='steel'?6:11}`;
    }
  }
  $('undo-button').disabled = !building || historyIndex === 0;
  $('redo-button').disabled = !building || historyIndex >= history.length - 1;
  $('clear-button').disabled = !building || !design.members.length;
  $('test-button').hidden = !building; $('test-button').disabled = cost > level.budget + .01 || !design.members.length;
  $('edit-button').hidden = building; $('pause-button').hidden = building; $('speed-button').hidden = building;
  $('pause-button').textContent = paused ? 'Resume' : 'Pause'; $('speed-button').textContent = `${speed}×`;
  $('pause-button').disabled = $('speed-button').disabled = simulation?.status !== 'running';
  $('stress-legend').hidden = !stressView || building;
  $('simulation-progress').style.width = simulation ? `${Math.min(100,simulation.crossed/simulation.total*100)}%` : '0%';
}
function toGrid(point) {
  const step = level.grid || 1;
  const projected = renderer.worldToScreen(point);
  const gridPixel = Math.abs(renderer.worldToScreen({x:point.x+step,y:point.y}).x-projected.x);
  let nearest = null, distance = Math.min(18,gridPixel*.42);
  for (const node of design.nodes) {
    const screen = renderer.worldToScreen(node), d = Math.hypot(screen.x-projected.x, screen.y-projected.y);
    if (d < distance) { nearest = node; distance = d; }
  }
  return nearest ? {x:nearest.x,y:nearest.y,id:nearest.id} : {x:Math.round(point.x/step)*step,y:Math.round(point.y/step)*step};
}
function inBounds(point) {
  const b = level.bounds;
  return point.x >= b.minX && point.x <= b.maxX && point.y >= b.minY && point.y <= b.maxY;
}
function hitsClearance(a, b) {
  for (const rect of level.clearances || []) {
    let lo = 0, hi = 1;
    const dx = b.x-a.x, dy = b.y-a.y;
    const constraints = [[-dx,a.x-rect.x1],[dx,rect.x2-a.x],[-dy,a.y-rect.minY],[dy,rect.maxY-a.y]];
    let intersects = true;
    for (const [p,q] of constraints) {
      if (Math.abs(p) < 1e-9) { if (q < 0) {intersects=false;break;} }
      else {const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi){intersects=false;break;}}
    }
    if (intersects) return true;
  }
  return false;
}
function memberError(a,b,material) {
  if (!inBounds(b)) return 'Build within the visible construction area.';
  const length = Math.hypot(a.x-b.x,a.y-b.y);
  if (length < .05) return 'Choose a different joint.';
  if (length > MATERIALS[material].maxLength + .001) return `${MATERIALS[material].name} can span up to ${MATERIALS[material].maxLength} m. Add another joint.`;
  if (material === 'road' && Math.abs(b.y-a.y)/length > .45) return 'Road is too steep. Keep the roadway close to level.';
  if (hitsClearance(a,b)) return 'Leave the marked clearance open.';
  return '';
}
function getNode(point) { return design.nodes.find(node => Math.abs(node.x-point.x)<.01 && Math.abs(node.y-point.y)<.01); }
function newId(prefix) { let id; do {id=prefix+(nextId++);} while(design.nodes.some(n=>n.id===id)||design.members.some(m=>m.id===id));return id; }
function pointSegmentDistance(p,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
function closestMember(point) {
  let best=null,distance=10;
  const screen=renderer.worldToScreen(point);
  for(const member of design.members){const a=design.nodes.find(n=>n.id===member.a),b=design.nodes.find(n=>n.id===member.b);const d=pointSegmentDistance(screen,renderer.worldToScreen(a),renderer.worldToScreen(b));if(d<distance){best=member;distance=d;}}
  return best;
}
function buildAt(point) {
  if(mode!=='build')return;
  if(tool==='erase'){
    const member=closestMember(point);if(!member){note('Click directly on a member to erase it.');return;}
    design.members=design.members.filter(m=>m.id!==member.id);
    const used=new Set(design.members.flatMap(m=>[m.a,m.b]));design.nodes=design.nodes.filter(n=>n.fixed||used.has(n.id));
    commit();note('Member removed.');return;
  }
  const snapped=toGrid(point),node=getNode(snapped);
  if(!from){if(!node){note('Start from an existing joint or a yellow anchor.');return;}from=node.id;hover=snapped;note('Choose the next joint. Escape cancels.');return;}
  const start=design.nodes.find(n=>n.id===from);
  if(node?.id===from){from=preview=null;note('Connection cancelled.');return;}
  const error=memberError(start,snapped,tool);if(error){note(error,true);return;}
  if(node&&design.members.some(m=>m.material===tool&&((m.a===from&&m.b===node.id)||(m.b===from&&m.a===node.id)))){note('Those joints already have that material. Choose another joint or a different material.');return;}
  const cost=getDesignCost(design)+Math.hypot(start.x-snapped.x,start.y-snapped.y)*MATERIALS[tool].costPerMeter;
  if(cost>level.budget+.01){note('That member would exceed the budget. Remove or shorten another member.',true);return;}
  if(design.nodes.length>=100||design.members.length>=180){note('This design has reached the construction limit.',true);return;}
  const target=node||{id:newId('n'),x:snapped.x,y:snapped.y,fixed:false};
  if(!node)design.nodes.push(target);
  design.members.push({id:newId('m'),a:start.id,b:target.id,material:tool});
  commit();from=target.id;note(`${MATERIALS[tool].name} placed. Continue from this joint or choose another tool.`);
}
function editMode() {
  mode='build';simulation=null;paused=false;resultShown=false;from=preview=null;
  document.body.classList.remove('testing');$('result-dialog').close();updateUI();chooseTool(tool);note('Your original design is restored. Add bracing or try a different material.');
}
function startTest() {
  if(mode!=='build')return;
  from=preview=null;
  const validation=validateDesign(level,design);
  if(!validation.ok){note(validation.errors[0]||'This bridge needs a continuous road before testing.',true);return;}
  try{simulation=createSimulation(level,design);}catch(error){note(error.message||'This bridge could not be tested.',true);return;}
  mode='test';paused=false;speed=1;resultShown=false;document.body.classList.add('testing');
  updateUI();note('Testing the bridge under moving vehicle loads. Watch the deck and member stress.');
}
function finishTest() {
  if(resultShown)return;resultShown=true;
  const won=simulation.status==='success';
  const stars=won?(simulation.cost<=level.budget*.72&&simulation.maxStress<=.8?3:simulation.cost<=level.budget*.9?2:1):0;
  $('result-title').textContent=won?'Bridge holds.':'Bridge failed.';
  $('result-description').textContent=won?`${simulation.total} ${simulation.total===1?'vehicle crossed':'vehicles crossed'} safely. ${Math.round(simulation.maxStress*100)}% peak member stress.`:simulation.failureReason||'The vehicle could not cross. Strengthen the deck and supports.';
  $('result-cost').textContent=`${money(simulation.cost)} / ${money(level.budget)} budget`;
  $('result-dialog').classList.toggle('failed',!won);
  $('result-stars').replaceChildren(...Array.from({length:3},(_,i)=>{const star=document.createElement('span');star.textContent='★';star.className=i<stars?'earned':'empty';return star;}));
  $('result-stars').setAttribute('aria-label',`${stars} of 3 stars`);
  $('next-level-button').hidden=!won||LEVELS.indexOf(level)===LEVELS.length-1;
  $('retry-button').textContent=won?'Refine bridge':'Back to building';
  if(won){const old=progress[level.id];if(!old||stars>old.stars||(stars===old.stars&&simulation.cost<old.cost))progress[level.id]={stars,cost:simulation.cost};persist();}
  $('result-dialog').showModal();updateUI();
}
function populateLevels() {
  $('level-grid').replaceChildren(...LEVELS.map(target=>{
    const button=document.createElement('button');button.type='button';button.className='level-card';button.classList.toggle('complete',Boolean(progress[target.id]));button.classList.toggle('current',target.id===level.id);
    const number=document.createElement('small');number.className='level-number';number.textContent=String(target.id).padStart(2,'0');
    const title=document.createElement('strong');title.textContent=target.name;
    const detail=document.createElement('small');detail.textContent=`${target.span} m · ${money(target.budget)}`;
    const result=document.createElement('span');result.className='level-stars';result.textContent=progress[target.id]?'★'.repeat(progress[target.id].stars):target.region;
    button.append(number,title,detail,result);button.addEventListener('click',()=>loadLevel(target));return button;
  }));
}

canvas.addEventListener('pointerdown',event=>{
  if(mode!=='build')return;event.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);
  const point=toGrid(renderer.screenToWorld(event.clientX,event.clientY));
  pointer={x:event.clientX,y:event.clientY,point,node:getNode(point),before:clone(design)};dragging=null;
});
canvas.addEventListener('pointermove',event=>{
  if(mode!=='build')return;
  const point=toGrid(renderer.screenToWorld(event.clientX,event.clientY));hover=point;
  if(pointer&&pointer.node&&!pointer.node.fixed&&tool!=='erase'&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>7)dragging=pointer.node.id;
  if(dragging){const node=design.nodes.find(n=>n.id===dragging);if(inBounds(point)){node.x=point.x;node.y=point.y;}updateUI();}
  if(from&&!dragging){const start=design.nodes.find(n=>n.id===from);preview={from:start,to:point,valid:!memberError(start,point,tool)};}
});
canvas.addEventListener('pointerup',event=>{
  if(!pointer)return;
  if(dragging){
    const node=design.nodes.find(n=>n.id===dragging);
    const invalid=design.members.some(m=>{if(m.a!==node.id&&m.b!==node.id)return false;const other=design.nodes.find(n=>n.id===(m.a===node.id?m.b:m.a));return Boolean(memberError(other,node,m.material));});
    const occupied=design.nodes.some(other=>other.id!==node.id&&Math.hypot(other.x-node.x,other.y-node.y)<.01);
    if(occupied||invalid||getDesignCost(design)>level.budget+.01){design=pointer.before;note(occupied?'That position already has a joint.':'That joint position violates a member limit or the budget.',true);updateUI();}
    else{commit();note('Joint moved.');}
  }else buildAt(renderer.screenToWorld(event.clientX,event.clientY));
  pointer=dragging=null;
});
canvas.addEventListener('pointercancel',()=>{if(pointer&&dragging){design=pointer.before;updateUI();}pointer=dragging=null;});
canvas.addEventListener('pointerleave',()=>{if(!pointer){hover=null;preview=null;}});
canvas.addEventListener('contextmenu',event=>{event.preventDefault();from=preview=null;note('Connection cancelled.');});
for(const button of document.querySelectorAll('[data-tool]'))button.addEventListener('click',()=>chooseTool(button.dataset.tool));
$('undo-button').addEventListener('click',undo);$('redo-button').addEventListener('click',redo);
$('clear-button').addEventListener('click',()=>{design=createDesign(level);commit();note('Bridge cleared. Undo restores it.');});
$('test-button').addEventListener('click',startTest);$('edit-button').addEventListener('click',editMode);
$('pause-button').addEventListener('click',()=>{if(simulation?.status!=='running')return;paused=!paused;updateUI();});
$('speed-button').addEventListener('click',()=>{speed=speed===1?2:1;updateUI();});
$('stress-toggle').addEventListener('change',event=>{stressView=event.target.checked;updateUI();});
$('grid-toggle').addEventListener('change',event=>{gridOn=event.target.checked;});
$('levels-button').addEventListener('click',()=>{populateLevels();$('levels-dialog').showModal();});
$('levels-close').addEventListener('click',()=>$('levels-dialog').close());
$('help-button').addEventListener('click',()=>$('help-dialog').showModal());$('help-close').addEventListener('click',()=>$('help-dialog').close());
$('retry-button').addEventListener('click',editMode);
$('next-level-button').addEventListener('click',()=>{const next=LEVELS[LEVELS.indexOf(level)+1];if(next)loadLevel(next);});
$('result-close')?.addEventListener('click',()=>$('result-dialog').close());
$('fullscreen-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{note('Fullscreen is unavailable in this browser.',true);}});
$('remember-progress').addEventListener('change',event=>{
  remember=event.target.checked;if(remember)persist();else try{localStorage.removeItem(storageKey);}catch{note('Use browser site-data settings to clear stored progress.',true);}updateStorageStatus();
});
window.addEventListener('keydown',event=>{
  if(event.target.closest('input,textarea,select')||document.querySelector('dialog[open]'))return;
  const key=event.key.toLowerCase();
  if((event.ctrlKey||event.metaKey)&&key==='z'){event.preventDefault();event.shiftKey?redo():undo();return;}
  if(['1','2','3','4','e'].includes(key)){event.preventDefault();chooseTool({'1':'road','2':'wood','3':'steel','4':'cable',e:'erase'}[key]);return;}
  if(event.key==='Escape'){from=preview=null;return;}
  if(event.target.closest('button,a')&&[' ','Enter'].includes(event.key))return;
  if(event.key===' '){event.preventDefault();if(mode==='build')startTest();else if(simulation?.status==='running'){paused=!paused;updateUI();}return;}
  if(mode==='build'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'].includes(event.key)){
    event.preventDefault();const point=hover?{...hover}:{x:level.anchors[0].x,y:level.anchors[0].y};const step=level.grid||1;
    if(event.key==='Enter')buildAt(point);else{if(event.key==='ArrowLeft')point.x-=step;if(event.key==='ArrowRight')point.x+=step;if(event.key==='ArrowUp')point.y+=step;if(event.key==='ArrowDown')point.y-=step;hover=inBounds(point)?point:hover;if(from)preview={from:design.nodes.find(n=>n.id===from),to:hover,valid:hover&&!memberError(design.nodes.find(n=>n.id===from),hover,tool)};}
  }
});
new ResizeObserver(()=>renderer.resize()).observe(canvas.parentElement);
function frame(now){
  const dt=Math.min(.05,(now-lastTime)/1000||0);lastTime=now;elapsed+=dt;
  if(mode==='test'&&simulation&&simulation.status==='running'&&!paused&&!document.hidden&&!document.querySelector('dialog[open]')){stepSimulation(simulation,dt*speed);if(simulation.status!=='running')finishTest();updateUI();}
  renderer.draw({level,design,simulation,mode,tool,preview,hover,stressView,gridOn,time:elapsed,reducedMotion:reducedMotion.matches});
  requestAnimationFrame(frame);
}
readStorage();$('remember-progress').checked=remember;updateStorageStatus();
design=safeStoredDesign(savedDesigns[level.id],level)||createDesign(level);resetHistory();chooseTool('road');updateUI();renderer.resize();
note(level.description||'Build a road, then brace it with triangles. Test when you are ready.');requestAnimationFrame(frame);
