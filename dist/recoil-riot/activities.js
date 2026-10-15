import {WEAPONS} from './weapons.js';
import {VEHICLE_RULES} from './vehicles.js';
export const ACTIVITIES=[
 {id:'maze',zone:'SALVAGE ROW',name:'Scrap maze',hint:'Enter the crate maze. Follow the switchbacks to the golden stash.',kind:'maze',start:{x:288,y:432},goal:{x:528,y:552},color:'#ffd77f'},
 {id:'race',zone:'LOADING BAY',name:'Junkyard rally',hint:'Drive a car through the numbered gates in order for a turbo reward.',kind:'race',points:[{x:768,y:256},{x:1168,y:256},{x:1168,y:480}],color:'#88d8ff'},
 {id:'valves',zone:'TANK FARM',name:'Turn off the stink',hint:'Avoid pulsing green vents. Press G at each of the three valve consoles.',kind:'valves',points:[{x:1360,y:256},{x:1600,y:256},{x:1792,y:416}],vents:[{x:1488,y:256},{x:1680,y:384},{x:1808,y:496}],color:'#a8e57c'},
 {id:'garden',zone:'SCRAP GARDEN',name:'Questionable snacks',hint:'Find all three glowing mushrooms. Each restores a little health.',kind:'forage',points:[{x:240,y:784},{x:528,y:976},{x:160,y:1136}],color:'#f4a4d2'},
 {id:'garage',zone:'THE WORKSHOP',name:'Pit stop',hint:'Park a car in the striped repair bay for two seconds to fix it.',kind:'garage',goal:{x:960,y:960},color:'#7ce4d3'},
 {id:'beacon',zone:'DEAD END DEPOT',name:'King of the junk',hint:'Hold the purple beacon on foot for three seconds. Rivals contest it.',kind:'beacon',goal:{x:1648,y:960},color:'#bba0ff'}
];
export function createActivities(){return {ventOffUntil:[0,0,0]};}
export function isVentActive(world,index){return world.time>=world.activities.ventOffUntil[index]&&Math.floor(world.time+index*2)%6<3;}
export function activityProgress(player,id){return player.jobs?.[id]||{stage:0,hold:0,found:[]};}
function complete(world,player,activity,event){
 if(player.hp<=0||player.badges.includes(activity.id))return;
 player.badges.push(activity.id);player.hp=Math.min(100,player.hp+25);player.ammo=WEAPONS.map(g=>g.magazine);player.reload=0;
 if(activity.id==='race')player.boostUntil=world.time+15;
 event(world,{type:'reward',player:player.id,x:player.x,y:player.y,color:activity.color,name:activity.name});
}
export function stepActivities(world,player,dt,interact,hit,event){
 const near=(p,r=25)=>Math.hypot(player.x-p.x,player.y-p.y)<r;
 for(const a of ACTIVITIES){
  const progress=player.jobs[a.id]||=( {stage:0,hold:0,found:[]} );
  if(a.kind==='valves'){
   a.points.forEach((point,n)=>{if(interact&&!player.vehicle&&near(point,45)){world.activities.ventOffUntil[n]=world.time+12;if(!progress.found.includes(n))progress.found.push(n);}});
   a.vents.forEach((point,n)=>{if(!player.vehicle&&near(point,48)&&isVentActive(world,n)&&world.time>=(player.hazardAt||0)){player.hazardAt=world.time+.5;hit(world,player,7,null,0,0);}});
   if(progress.found.length===3)complete(world,player,a,event);
  }
  if(a.kind==='garage'){
   const car=world.vehicles.find(v=>v.id===player.vehicle);
   if(car&&near(a.goal,48)&&Math.abs(car.speed)<18){progress.hold+=dt;if(progress.hold>=2){car.hp=VEHICLE_RULES.maxHealth;complete(world,player,a,event);}}
   else progress.hold=0;
  }
  if(player.badges.includes(a.id))continue;
  if(a.kind==='maze'&&!player.vehicle){if(near(a.start,28))progress.stage=1;if(progress.stage===1&&near(a.goal))complete(world,player,a,event);}
  if(a.kind==='race'&&player.vehicle&&near(a.points[progress.stage],42)){progress.stage++;if(progress.stage===a.points.length)complete(world,player,a,event);}
  if(a.kind==='forage'&&!player.vehicle){a.points.forEach((point,n)=>{if(near(point)&&!progress.found.includes(n)){progress.found.push(n);player.hp=Math.min(100,player.hp+12);event(world,{type:'heal',x:point.x,y:point.y,color:a.color});}});if(progress.found.length===3)complete(world,player,a,event);}
  if(a.kind==='beacon'){
   const contested=world.players.some(p=>p!==player&&p.hp>0&&Math.hypot(p.x-a.goal.x,p.y-a.goal.y)<64);
   progress.hold=!player.vehicle&&near(a.goal,40)&&!contested?progress.hold+dt:0;
   if(progress.hold>=3)complete(world,player,a,event);
  }
 }
}
export function districtHint(world,player){
 if(!player)return 'Six districts. Six challenges. Find a car and explore.';
 const a=ACTIVITIES.find(a=>a.zone===worldZone(player));if(!a)return 'Service road · G near a car to drive. Challenges are marked on the radar.';
 if(player.vehicle&&['maze','forage','beacon'].includes(a.kind))return 'G · Park and exit the car to try '+a.name+'.';
 if(player.badges.includes(a.id))return a.name+' complete · Supplies restored. Explore another district.';
 if(a.kind==='beacon'&&world.players.some(p=>p!==player&&p.hp>0&&Math.hypot(p.x-a.goal.x,p.y-a.goal.y)<64))return 'Beacon contested · Clear nearby rivals before capturing.';
 const state=activityProgress(player,a.id),count=a.kind==='race'?` Gate ${state.stage+1}/3.`:['valves','forage'].includes(a.kind)?` ${state.found.length}/3 found.`:['beacon','garage'].includes(a.kind)?` ${state.hold.toFixed(1)}s.`:'';
 return a.hint+count;
}
function worldZone(p){
 if(p.y<600)return p.x<624?'SALVAGE ROW':p.x<1232?'LOADING BAY':'TANK FARM';
 if(p.y>736)return p.x<624?'SCRAP GARDEN':p.x<1232?'THE WORKSHOP':'DEAD END DEPOT';return '';
}
