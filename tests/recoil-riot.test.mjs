import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,addPlayer,step,cleanInput,collides,RULES,snapshot} from '../dist/recoil-riot/simulation.js';
import {WEAPONS} from '../dist/recoil-riot/weapons.js';
import {ARENA} from '../dist/recoil-riot/maps.js';
import {createCamera,followCamera,screenToWorld,VIEW} from '../dist/recoil-riot/camera.js';
import worker from '../backend/recoil-riot/worker.js';
function solo(){const w=createWorld(),p=addPlayer(w,'a','Alice');Object.assign(p,{x:350,y:190,invuln:0});return {w,p};}
test('input cannot assign health, damage, or unbounded movement',()=>{assert.deepEqual(cleanInput({x:999,y:-999,angle:Infinity,weapon:999,fire:'yes',hp:999}),{x:1,y:-1,angle:0,weapon:5,fire:false,dash:false,melee:false,reload:false});});
test('shotgun recoils backwards and cannot tunnel through arena walls',()=>{const {w,p}=solo();p.input={angle:0,weapon:0,fire:true};step(w);assert.equal(p.ammo[0],4);assert.equal(w.bullets.length,7);assert.ok(p.vx<-400);p.input={weapon:0};for(let n=0;n<20;n++)step(w);assert.ok(p.x<320);assert.equal(collides(p.x,p.y),false);});
test('shots damage enemies, score a knockout, and respawn the victim',()=>{const {w,p}=solo(),q=addPlayer(w,'b','Bob');Object.assign(q,{x:390,y:190,hp:1,invuln:0});p.weapon=5;p.input={angle:0,weapon:5,fire:true};for(let n=0;n<4;n++)step(w);assert.equal(p.score,1);assert.equal(q.hp,0);assert.equal(q.deaths,1);p.input={weapon:5};for(let n=0;n<70;n++)step(w);assert.equal(q.hp,100);assert.ok(q.invuln>0);});
test('switching weapons preserves ammo and reloading takes time',()=>{const {w,p}=solo();p.input={weapon:0,fire:true};step(w);p.input={weapon:1};step(w);p.input={weapon:0};step(w);assert.equal(p.ammo[0],4);p.input={weapon:0,reload:true};step(w);assert.ok(p.reload>0);assert.equal(p.ammo[0],4);p.input={weapon:0};for(let n=0;n<45;n++)step(w);assert.equal(p.ammo[0],5);});
test('diagonal movement has the same speed as horizontal movement',()=>{const a=solo(),b=solo();a.p.input={x:1};b.p.input={x:1,y:1};const x=a.p.x,y=a.p.y;step(a.w);step(b.w);assert.ok(Math.abs(Math.hypot(a.p.x-x,a.p.y-y)-Math.hypot(b.p.x-x,b.p.y-y))<.001);});
test('round finishes at score limit and resets after result screen',()=>{const {w,p}=solo();p.score=RULES.scoreLimit;step(w);assert.equal(w.winner,'Alice');for(let n=0;n<250;n++)step(w);assert.equal(w.winner,null);assert.equal(p.score,0);assert.ok(w.remaining>175);});
test('all six weapons can fire and snapshots exclude raw client input',()=>{for(let i=0;i<WEAPONS.length;i++){const {w,p}=solo();p.input={weapon:i,angle:0,fire:true};step(w);assert.equal(p.ammo[i],WEAPONS[i].magazine-1);assert.ok(w.bullets.length>0);assert.equal('input' in snapshot(w).players[0],false);}});
test('server health and room validation',async()=>{assert.equal((await worker.fetch(new Request('https://server/health'),{})).status,200);assert.equal((await worker.fetch(new Request('https://server/room/ABC123',{headers:{Origin:'https://evil.example',Upgrade:'websocket'}}),{})).status,403);assert.equal((await worker.fetch(new Request('https://server/room/ABC123',{headers:{Origin:'https://apina.app'}}),{})).status,426);});

test('bots navigate cover and make progress in a full practice match',()=>{
 const w=createWorld();for(let n=0;n<4;n++){const p=addPlayer(w,'nav-bot'+n,'Bot '+n,true);p.weapon=[1,3,4,5][n];}
 let knockouts=0;for(let n=0;n<1800;n++){step(w);knockouts=Math.max(knockouts,w.players.reduce((sum,p)=>sum+p.score,0));}
 assert.ok(knockouts>=2,'bots must navigate cover and score knockouts within 60 seconds');
 assert.equal(new Set(w.players.map(p=>p.color)).size,4);
});

test('every weapon can shoot after a manual reload finishes',()=>{
 for(const [index,gun] of WEAPONS.entries()){
  const {w,p}=solo();p.input={weapon:index,fire:true};step(w);
  p.input={weapon:index,reload:true};step(w);p.input={weapon:index};
  for(let n=0;n<Math.ceil(gun.reload/RULES.tick)+2;n++)step(w);
  assert.equal(p.reload,0,gun.name+' reload must finish at exactly zero');
  assert.equal(p.ammo[index],gun.magazine);
  p.input={weapon:index,fire:true};step(w);
  assert.equal(p.ammo[index],gun.magazine-1,gun.name+' must fire after reloading');
 }
});
test('holding fire keeps shooting after an empty magazine automatically reloads',()=>{
 for(const [index,gun] of WEAPONS.entries()){
  const {w,p}=solo();p.input={weapon:index,fire:true};
  let shots=0;for(let n=0;n<270;n++){const before=p.ammo[index];step(w);if(p.ammo[index]<before)shots++;}
  assert.ok(shots>gun.magazine,gun.name+' must shoot beyond the first magazine');
  assert.ok(p.reload>=0);
 }
});

test('expanded junkyard spawns and pickups stay clear and share a connected navigation grid',()=>{
 for(const p of [...ARENA.spawns,...ARENA.health])assert.equal(collides(p.x,p.y),false,JSON.stringify(p));
 const seen=new Set(),queue=[],size=32,columns=ARENA.width/size;
 const start=ARENA.spawns[0],first=Math.floor(start.y/size)*columns+Math.floor(start.x/size);queue.push(first);seen.add(first);
 for(let i=0;i<queue.length;i++)for(const offset of [-1,1,-columns,columns]){
  const id=queue[i]+offset,x=(id%columns)*size+16,y=Math.floor(id/columns)*size+16;
  const px=(queue[i]%columns)*size+16,py=Math.floor(queue[i]/columns)*size+16;
  if(seen.has(id)||Math.abs(px-x)>size||collides(x,y)||collides((x+px)/2,(y+py)/2))continue;
  seen.add(id);queue.push(id);
 }
 for(const p of [...ARENA.spawns,...ARENA.health])assert.ok(seen.has(Math.floor(p.y/size)*columns+Math.floor(p.x/size)),JSON.stringify(p)+' must be reachable');
 assert.ok(ARENA.width>=1920&&ARENA.height>=1280);
});
test('camera follows, clamps at map edges, and translates mouse aim into world coordinates',()=>{
 const camera=createCamera();followCamera(camera,{x:960,y:640});
 assert.equal(camera.x,480);assert.equal(camera.y,320);
 assert.deepEqual(screenToWorld(camera,600,320),{x:1080,y:640});
 const before=camera.x;followCamera(camera,{x:1100,y:640},1/30);assert.ok(camera.x>before&&camera.x<1100-VIEW.width/2);
 followCamera(camera,{x:ARENA.width,y:ARENA.height});assert.ok(camera.x<=ARENA.width-VIEW.width&&camera.y<=ARENA.height-VIEW.height);
 camera.initialized=false;followCamera(camera,{x:0,y:0});assert.equal(camera.x,0);assert.equal(camera.y,0);
 camera.initialized=false;followCamera(camera,{x:ARENA.width,y:ARENA.height});assert.equal(camera.x,ARENA.width-VIEW.width);assert.equal(camera.y,ARENA.height-VIEW.height);
});
