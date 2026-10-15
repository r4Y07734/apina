import {ARENA} from './maps.js';
export const VEHICLE_RULES={radius:26,maxHealth:160,maxSpeed:350,reverseSpeed:140,acceleration:460,turnRate:2.6,enterRange:70,respawnSeconds:18};
export function createVehicles(){return ARENA.vehicles.map(v=>({...v,homeX:v.x,homeY:v.y,homeAngle:v.angle||0,angle:v.angle||0,speed:0,hp:VEHICLE_RULES.maxHealth,driver:null,respawnAt:0,ramUntil:0}));}
export function vehicleAt(world,id){return world.vehicles.find(v=>v.id===id);}
export function vehicleBlocks(world,x,y,r=11,ignore=null){return world.vehicles.some(v=>v.id!==ignore&&v.hp>0&&Math.hypot(v.x-x,v.y-y)<VEHICLE_RULES.radius+r);}
function clearPath(a,b,blocked,radius=4){
 const count=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/8));
 for(let n=0;n<=count;n++)if(blocked(a.x+(b.x-a.x)*n/count,a.y+(b.y-a.y)*n/count,radius))return false;
 return true;
}
export function exitVehicle(world,player,blocked,force=false){
 const car=vehicleAt(world,player.vehicle);if(!car){player.vehicle=null;return true;}
 const spots=Array.from({length:16},(_,n)=>{const a=car.angle+Math.PI/2+n*Math.PI/4,d=n<8?48:68;return {x:car.x+Math.cos(a)*d,y:car.y+Math.sin(a)*d};});
 const safe=spots.find(p=>!blocked(p.x,p.y,11)&&clearPath(car,p,blocked,11)&&!vehicleBlocks(world,p.x,p.y)&&!world.players.some(q=>q!==player&&q.hp>0&&Math.hypot(q.x-p.x,q.y-p.y)<22))||(force?ARENA.spawns.find(p=>!blocked(p.x,p.y)&&!vehicleBlocks(world,p.x,p.y)):null);
 if(!safe)return false;
 Object.assign(player,safe,{vehicle:null,vx:0,vy:0});car.driver=null;car.speed=0;return true;
}
export function interactVehicle(world,player,blocked){
 if(player.vehicle){exitVehicle(world,player,blocked);return true;}
 const car=world.vehicles.filter(v=>v.hp>0&&!v.driver&&Math.abs(v.speed)<50&&Math.hypot(v.x-player.x,v.y-player.y)<=VEHICLE_RULES.enterRange&&clearPath(player,v,blocked)).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0];
 if(!car)return false;
 car.driver=player.id;player.vehicle=car.id;player.x=car.x;player.y=car.y;player.vx=0;player.vy=0;player.invuln=0;return true;
}
export function damageVehicle(world,car,damage,blocked,hit,event){
 if(car.hp<=0)return;
 car.hp=Math.max(0,car.hp-damage);
 if(car.hp>0)return;
 const driver=world.players.find(p=>p.id===car.driver);car.speed=0;car.respawnAt=world.time+VEHICLE_RULES.respawnSeconds;
 if(driver){exitVehicle(world,driver,blocked,true);hit(world,driver,35,null,car.angle,120);}
 car.driver=null;event(world,{type:'boom',x:car.x,y:car.y,color:'#ffb86b'});
}
export function stepVehicles(world,dt,blocked,hit,event){
 for(const car of world.vehicles){
  if(car.hp<=0){
   if(world.time>=car.respawnAt&&!world.players.some(p=>p.hp>0&&Math.hypot(p.x-car.homeX,p.y-car.homeY)<65)&&!vehicleBlocks(world,car.homeX,car.homeY,VEHICLE_RULES.radius,car.id))Object.assign(car,{x:car.homeX,y:car.homeY,angle:car.homeAngle,speed:0,hp:VEHICLE_RULES.maxHealth,driver:null});
   continue;
  }
  const driver=world.players.find(p=>p.id===car.driver&&p.hp>0);
  if(!driver){car.driver=null;car.speed*=Math.exp(-5*dt);continue;}
  const i=driver.driveInput||{},throttle=-(i.y||0),boost=driver.boostUntil>world.time?1.35:1;
  car.speed+=(throttle*VEHICLE_RULES.acceleration*boost-car.speed*(throttle?1.15:2.5))*dt;
  car.speed=Math.max(-VEHICLE_RULES.reverseSpeed,Math.min(VEHICLE_RULES.maxSpeed*boost,car.speed));
  if(i.dash)car.speed*=Math.exp(-9*dt);
  car.angle+=(i.x||0)*VEHICLE_RULES.turnRate*Math.min(1,Math.abs(car.speed)/100)*Math.sign(car.speed)*dt;
  const dx=Math.cos(car.angle)*car.speed*dt,dy=Math.sin(car.angle)*car.speed*dt,parts=Math.max(1,Math.ceil(Math.hypot(dx,dy)/5));
  for(let n=0;n<parts;n++){
   const x=car.x+dx/parts,y=car.y+dy/parts;
   if(blocked(x,y,VEHICLE_RULES.radius)||vehicleBlocks(world,x,y,VEHICLE_RULES.radius,car.id)){car.speed=0;break;}
   car.x=x;car.y=y;
  }
  driver.x=car.x;driver.y=car.y;driver.vx=0;driver.vy=0;
  if(Math.abs(car.speed)>100&&world.time>=car.ramUntil){
   const victim=world.players.find(p=>p!==driver&&!p.vehicle&&p.hp>0&&Math.hypot(p.x-car.x,p.y-car.y)<39);
   if(victim){hit(world,victim,Math.min(50,Math.abs(car.speed)*.16),driver.id,car.angle,300);car.ramUntil=world.time+.7;car.speed*=.6;event(world,{type:'spark',x:car.x,y:car.y,color:'#ffd580'});}
  }
 }
}
export function vehicleHint(world,player){
 if(!player)return '';
 const car=vehicleAt(world,player.vehicle);
 if(car)return `DRIVING${player.boostUntil>world.time?' / TURBO':''} · ${Math.round(Math.abs(car.speed)*.22)} km/h · ${Math.ceil(car.hp)} CAR HP · G exit · Space brake`;
 return world.vehicles.some(v=>v.hp>0&&!v.driver&&Math.hypot(v.x-player.x,v.y-player.y)<=VEHICLE_RULES.enterRange)?'G · Get in the car':'';
}
