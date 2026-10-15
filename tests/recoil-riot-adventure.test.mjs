import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,addPlayer,step,collides,RULES,snapshot} from '../dist/recoil-riot/simulation.js';
import {ARENA} from '../dist/recoil-riot/maps.js';
import {VEHICLE_RULES,vehicleBlocks,damageVehicle,exitVehicle} from '../dist/recoil-riot/vehicles.js';
import {ACTIVITIES,isVentActive} from '../dist/recoil-riot/activities.js';
function setup(){const world=createWorld(),player=addPlayer(world,'driver','Driver');Object.assign(player,{x:352,y:272,invuln:0});return {world,player,car:world.vehicles[0]};}
function ticks(w,n){for(let i=0;i<n;i++)step(w);}
function enter(w,p){p.input={interact:true};step(w);p.input={};step(w);}
test('enter, accelerate, steer, brake, and safely exit a car',()=>{
 const {world:w,player:p,car}=setup();enter(w,p);assert.equal(p.vehicle,car.id);assert.equal(car.driver,p.id);
 const x=car.x;p.input={y:-1};ticks(w,20);assert.ok(car.x>x+30);assert.equal(p.x,car.x);
 p.input={y:-1,x:1};ticks(w,8);assert.ok(car.angle>.1);
 const speed=Math.abs(car.speed);p.input={dash:true};ticks(w,10);assert.ok(Math.abs(car.speed)<speed*.4);
 p.input={interact:true};step(w);assert.equal(p.vehicle,null);assert.equal(car.driver,null);assert.equal(collides(p.x,p.y),false);assert.equal(vehicleBlocks(w,p.x,p.y),false);
});
test('a held interaction key cannot toggle ownership; another player cannot steal an occupied car',()=>{
 const {world:w,player:p,car}=setup();p.input={interact:true};ticks(w,10);assert.equal(p.vehicle,car.id);
 const other=addPlayer(w,'other','Other');Object.assign(other,{x:car.x,y:car.y+48});other.input={interact:true};step(w);assert.equal(other.vehicle,null);assert.equal(car.driver,p.id);
 assert.equal('driveInput' in snapshot(w).players[0],false);
});
test('cars respect walls at speed and have one shared position with their driver',()=>{
 const {world:w,player:p,car}=setup();enter(w,p);Object.assign(car,{x:ARENA.width-45,y:640,angle:0,speed:350});p.input={y:-1};ticks(w,15);
 assert.ok(car.x<=ARENA.width-16-VEHICLE_RULES.radius);assert.equal(collides(car.x,car.y,VEHICLE_RULES.radius),false);assert.equal(p.x,car.x);
});
test('disconnect releases a car, wrecks respawn, and rounds reset vehicle and activity state',()=>{
 const {world:w,player:p,car}=setup();enter(w,p);w.players=[];step(w);assert.equal(car.driver,null);
 const events=[];damageVehicle(w,car,1000,collides,()=>{},(_,e)=>events.push(e));assert.equal(car.hp,0);assert.ok(events.some(e=>e.type==='boom'));
 ticks(w,Math.ceil(VEHICLE_RULES.respawnSeconds/RULES.tick)+2);assert.equal(car.hp,160);
 const q=addPlayer(w,'round','Round');q.score=15;q.badges=['maze'];step(w);ticks(w,245);assert.equal(q.badges.length,0);assert.ok(w.vehicles.every(v=>!v.driver&&v.hp===160));
});
test('wrecking a driven car safely ejects the driver',()=>{
 const {world:w,player:p,car}=setup();enter(w,p);let damage=0;damageVehicle(w,car,200,collides,(_w,who,amount)=>{assert.equal(who,p);damage+=amount;},()=>{});
 assert.equal(p.vehicle,null);assert.equal(car.driver,null);assert.equal(damage,35);assert.equal(collides(p.x,p.y),false);assert.equal(vehicleBlocks(w,p.x,p.y),false);
});
test('all district interactions and spawn locations are reachable on foot',()=>{
 const points=[...ARENA.spawns,...ARENA.health,...ACTIVITIES.flatMap(a=>[...(a.points||[]),...(a.goal?[a.goal]:[]),...(a.start?[a.start]:[])])];
 for(const p of points)assert.equal(collides(p.x,p.y),false,JSON.stringify(p));
 const cols=ARENA.width/16,rows=ARENA.height/16,seen=new Set(),queue=[],first=2*cols+2;seen.add(first);queue.push(first);
 for(let i=0;i<queue.length;i++)for(const offset of [-1,1,-cols,cols]){const id=queue[i]+offset,x=id%cols*16+8,y=Math.floor(id/cols)*16+8,px=queue[i]%cols*16+8;if(seen.has(id)||id<0||id>=cols*rows||Math.abs(px-x)>16||collides(x,y))continue;seen.add(id);queue.push(id);}
 for(const p of points){const near=[...seen].some(id=>Math.hypot(id%cols*16+8-p.x,Math.floor(id/cols)*16+8-p.y)<24);assert.ok(near,'unreachable activity '+JSON.stringify(p));}
 for(const car of createWorld().vehicles)assert.equal(collides(car.x,car.y,26),false,'car parking spot must be clear');
});
test('maze and mushrooms award supplies and badges once per round',()=>{
 const {world:w,player:p}=setup(),maze=ACTIVITIES[0],garden=ACTIVITIES[3];Object.assign(p,maze.start);step(w);Object.assign(p,maze.goal);step(w);assert.ok(p.badges.includes('maze'));
 p.hp=20;for(const point of garden.points){Object.assign(p,point);step(w);}assert.ok(p.badges.includes('garden'));assert.ok(p.hp>=81);
 const before=p.hp;Object.assign(p,garden.points[0]);step(w);assert.equal(p.hp,before);assert.equal(p.badges.filter(x=>x==='garden').length,1);
});
test('driving gates require order and a vehicle, then award turbo',()=>{
 const {world:w,player:p,car}=setup(),race=ACTIVITIES[1];Object.assign(p,race.points[0]);step(w);assert.equal(p.jobs.race.stage,0);
 Object.assign(p,{x:car.x-48,y:car.y});enter(w,p);
 Object.assign(car,race.points[1]);step(w);assert.equal(p.jobs.race.stage,0);
 for(const gate of race.points){Object.assign(car,gate);step(w);}assert.ok(p.badges.includes('race'));assert.ok(p.boostUntil>w.time);
});
test('valve consoles disable toxic vents for everyone and award a challenge badge',()=>{
 const {world:w,player:p}=setup(),a=ACTIVITIES[2];w.time=.1;Object.assign(p,a.vents[0]);step(w);assert.ok(p.hp<100);assert.ok(isVentActive(w,0));
 for(const point of a.points){Object.assign(p,point);p.input={};step(w);p.input={interact:true};step(w);}
 assert.ok(p.badges.includes('valves'));assert.ok(w.activities.ventOffUntil.every(t=>t>w.time));assert.equal(isVentActive(w,0),false);
});
test('garage requires parking; beacon cannot be captured while contested',()=>{
 const {world:w,player:p,car}=setup();enter(w,p);Object.assign(car,ACTIVITIES[4].goal,{hp:30,speed:0});ticks(w,62);assert.equal(car.hp,160);assert.ok(p.badges.includes('garage'));
 exitVehicle(w,p,collides);Object.assign(p,ACTIVITIES[5].goal);const rival=addPlayer(w,'rival','Rival');Object.assign(rival,{x:p.x+50,y:p.y});ticks(w,100);assert.ok(!p.badges.includes('beacon'));
 rival.x=1200;rival.y=640;ticks(w,92);assert.ok(p.badges.includes('beacon'));
});
test('projectiles damage cars and moving cars can ram an opponent',()=>{
 const {world:w,player:p,car}=setup();Object.assign(p,{x:320,y:272});p.input={weapon:1,fire:true,angle:0};ticks(w,30);assert.ok(car.hp<160,'bullets must hit the car hull');
 p.input={};Object.assign(p,{x:car.x-48,y:car.y});enter(w,p);const victim=addPlayer(w,'pedestrian','Pedestrian');Object.assign(victim,{x:car.x+105,y:car.y,invuln:0});p.input={y:-1};ticks(w,40);assert.ok(victim.hp<100||victim.deaths>0,'ramming must damage a pedestrian');
});
test('entry cannot pass through walls and exiting a blocked car retains ownership',()=>{
 const {world:w,player:p,car}=setup();car.x=624;car.y=440;p.x=560;p.y=440;p.input={interact:true};step(w);assert.equal(p.vehicle,null,'a solid container blocks entering');
 Object.assign(p,{x:352,y:272});Object.assign(car,{x:400,y:272});p.input={};step(w);enter(w,p);assert.equal(p.vehicle,car.id);
 assert.equal(exitVehicle(w,p,()=>true),false);assert.equal(p.vehicle,car.id);assert.equal(car.driver,p.id);
});
