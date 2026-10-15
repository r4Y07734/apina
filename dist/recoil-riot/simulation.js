import {WEAPONS} from './weapons.js';
import {ARENA,COLORS} from './maps.js';
import {botInput} from './navigation.js';
export const RULES={tick:1/30,roundSeconds:180,scoreLimit:15,maxPlayers:8,playerRadius:11,speed:170,respawnSeconds:2};
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function createWorld(){return {players:[],bullets:[],events:[],health:ARENA.health.map(p=>({...p,ready:0})),time:0,remaining:RULES.roundSeconds,winner:null,restartAt:0,serial:0};}
export function addPlayer(w,id,name,bot=false){
 const index=w.players.findIndex(p=>p.id===id);if(index>=0)return w.players[index];
 const p={id,name:String(name||'Player').replace(/[\x00-\x1f]/g,'').slice(0,18),bot,color:COLORS.find(color=>!w.players.some(p=>p.color===color))||COLORS[0],x:0,y:0,vx:0,vy:0,hp:100,score:0,deaths:0,angle:0,weapon:0,ammo:WEAPONS.map(v=>v.magazine),reload:0,cooldown:0,dash:0,melee:0,invuln:1.5,dead:0,input:{}};
 w.players.push(p);respawn(w,p);return p;
}
function respawn(w,p){
 const spots=[...ARENA.spawns].sort((a,b)=>Math.min(...w.players.filter(q=>q!==p&&q.hp>0).map(q=>dist(q,b)),1000)-Math.min(...w.players.filter(q=>q!==p&&q.hp>0).map(q=>dist(q,a)),1000));
 Object.assign(p,spots[Math.floor(Math.random()*Math.min(2,spots.length))],{hp:100,vx:0,vy:0,dead:0,invuln:1.5,reload:0,cooldown:0});p.ammo=WEAPONS.map(v=>v.magazine);
}
export function cleanInput(i={}){return {x:clamp(Number(i.x)||0,-1,1),y:clamp(Number(i.y)||0,-1,1),angle:Number.isFinite(i.angle)?i.angle:0,fire:i.fire===true,dash:i.dash===true,melee:i.melee===true,reload:i.reload===true,weapon:Number.isInteger(i.weapon)?clamp(i.weapon,0,WEAPONS.length-1):0};}
export function collides(x,y,r=RULES.playerRadius){return x<r+16||y<r+16||x>ARENA.width-r-16||y>ARENA.height-r-16||ARENA.walls.some(b=>x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h);}
function move(p,dx,dy){if(!collides(p.x+dx,p.y))p.x+=dx;else p.vx=0;if(!collides(p.x,p.y+dy))p.y+=dy;else p.vy=0;}
function event(w,e){w.events.push({...e,id:++w.serial});if(w.events.length>70)w.events.shift();}
function hit(w,p,damage,owner,angle,knockback){
 if(p.hp<=0||p.invuln>0||w.winner)return;
 p.hp=Math.max(0,p.hp-damage);p.vx+=Math.cos(angle)*knockback;p.vy+=Math.sin(angle)*knockback;
 event(w,{type:'hit',x:p.x,y:p.y,color:p.color,damage});
 if(!p.hp){p.dead=RULES.respawnSeconds;p.deaths++;const killer=w.players.find(q=>q.id===owner);if(killer&&killer!==p)killer.score++;event(w,{type:'kill',x:p.x,y:p.y,color:p.color,killer:killer?.name||'Chaos',victim:p.name});}
}
function explode(w,b){event(w,{type:'boom',x:b.x,y:b.y,color:WEAPONS[b.weapon].color});for(const p of w.players)if(p.id!==b.owner&&dist(p,b)<64+RULES.playerRadius)hit(w,p,b.damage*(1-dist(p,b)/90),b.owner,Math.atan2(p.y-b.y,p.x-b.x),b.knockback);}
export function step(w,dt=RULES.tick){
 dt=clamp(dt,0,.05);w.time+=dt;
 if(w.winner){if(w.time>=w.restartAt){w.winner=null;w.remaining=RULES.roundSeconds;w.bullets=[];for(const p of w.players){p.score=0;p.deaths=0;respawn(w,p);}}return;}
 w.remaining=Math.max(0,w.remaining-dt);
 for(const p of w.players){
  if(p.dead>0){p.dead-=dt;if(p.dead<=0)respawn(w,p);continue;}
  const i=cleanInput(p.bot?botInput(w,p,collides):p.input);
  for(const k of ['cooldown','dash','melee','invuln'])p[k]=Math.max(0,p[k]-dt);
  if(i.weapon!==p.weapon){p.weapon=i.weapon;p.reload=0;}
  const gun=WEAPONS[p.weapon];p.angle=i.angle;
  if(p.reload>0){p.reload=Math.max(0,p.reload-dt);if(p.reload===0)p.ammo[p.weapon]=gun.magazine;}
  if(i.reload&&p.ammo[p.weapon]<gun.magazine&&!p.reload)p.reload=gun.reload;
  const len=Math.hypot(i.x,i.y)||1,nx=i.x/Math.max(1,len),ny=i.y/Math.max(1,len);
  if(i.dash&&!p.dash){p.dash=1.3;const a=(nx||ny)?Math.atan2(ny,nx):p.angle;p.vx+=Math.cos(a)*480;p.vy+=Math.sin(a)*480;event(w,{type:'dash',x:p.x,y:p.y,color:p.color});}
  const dx=(nx*RULES.speed+p.vx)*dt,dy=(ny*RULES.speed+p.vy)*dt;
  // Substeps stop high-recoil movement from tunnelling through cover.
  const parts=Math.max(1,Math.ceil(Math.hypot(dx,dy)/7));for(let n=0;n<parts;n++)move(p,dx/parts,dy/parts);
  p.vx*=Math.exp(-7*dt);p.vy*=Math.exp(-7*dt);
  if(i.melee&&!p.melee){p.melee=.65;event(w,{type:'punch',x:p.x+Math.cos(p.angle)*20,y:p.y+Math.sin(p.angle)*20,color:p.color});for(const q of w.players)if(q!==p&&dist(q,p)<49&&Math.cos(Math.atan2(q.y-p.y,q.x-p.x)-p.angle)>.25)hit(w,q,25,p.id,p.angle,350);}
  if(i.fire&&!p.cooldown&&!p.reload){
   if(p.ammo[p.weapon]<=0){p.reload=gun.reload;continue;}
   p.ammo[p.weapon]--;p.cooldown=gun.cooldown;p.invuln=0;
   p.vx-=Math.cos(p.angle)*gun.recoil;p.vy-=Math.sin(p.angle)*gun.recoil;
   event(w,{type:'shot',player:p.id,x:p.x+Math.cos(p.angle)*19,y:p.y+Math.sin(p.angle)*19,color:gun.color,weapon:p.weapon});
   for(let n=0;n<gun.pellets;n++){const a=p.angle+(Math.random()-.5)*2*gun.spread;w.bullets.push({id:++w.serial,owner:p.id,weapon:p.weapon,x:p.x+Math.cos(a)*20,y:p.y+Math.sin(a)*20,vx:Math.cos(a)*gun.speed,vy:Math.sin(a)*gun.speed,life:gun.life,damage:gun.damage,knockback:gun.knockback,bounces:gun.bounces||0});}
  }
  for(const pack of w.health)if(w.time>=pack.ready&&p.hp<100&&dist(p,pack)<25){p.hp=Math.min(100,p.hp+35);pack.ready=w.time+12;event(w,{type:'heal',x:p.x,y:p.y,color:'#b5f577'});}
 }
 w.bullets=w.bullets.filter(b=>{
  const gun=WEAPONS[b.weapon];b.life-=dt;
  if(b.life<=0){if(gun.splash)explode(w,b);return false;}
  const parts=Math.ceil(Math.hypot(b.vx,b.vy)*dt/5);
  for(let n=0;n<parts;n++){
   const nx=b.x+b.vx*dt/parts,ny=b.y+b.vy*dt/parts;
   if(collides(nx,ny,gun.radius)){
    if(b.bounces>0){if(collides(nx,b.y,gun.radius))b.vx*=-1;else b.vy*=-1;b.bounces--;break;}
    if(gun.splash)explode(w,b);else event(w,{type:'spark',x:b.x,y:b.y,color:gun.color});return false;
   }
   b.x=nx;b.y=ny;
   const p=w.players.find(p=>p.id!==b.owner&&p.hp>0&&dist(p,b)<RULES.playerRadius+gun.radius);
   if(p){if(gun.splash)explode(w,b);else hit(w,p,b.damage,b.owner,Math.atan2(b.vy,b.vx),b.knockback);return false;}
  }return true;
 });
 const leader=[...w.players].sort((a,b)=>b.score-a.score)[0];
 if(leader&&(leader.score>=RULES.scoreLimit||w.remaining<=0)){w.winner=leader.name;w.restartAt=w.time+8;event(w,{type:'win',name:leader.name});}
}
export function snapshot(w){return {...w,players:w.players.map(({input,...p})=>p)};}
