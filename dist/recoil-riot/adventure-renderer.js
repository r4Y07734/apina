import {ACTIVITIES,activityProgress,isVentActive} from './activities.js';
export function drawAdventure(c,world,me){
 const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);};
 const text=(s,x,y,color='#dbd7df')=>{c.font='bold 9px monospace';c.textAlign='center';c.fillStyle=color;c.fillText(s,x,y);};
 const ring=(x,y,size,color)=>{c.strokeStyle=color;c.lineWidth=2;c.strokeRect(Math.round(x-size),Math.round(y-size),size*2,size*2);};
 for(const a of ACTIVITIES){
  const state=me?activityProgress(me,a.id):{stage:0,hold:0,found:[]},done=me?.badges.includes(a.id);
  if(a.kind==='maze'){
   text('MAZE IN ↓',a.start.x,a.start.y-20,a.color);
   rect(a.goal.x-12,a.goal.y-8,24,17,done?'#716754':'#d4aa58');rect(a.goal.x-12,a.goal.y-8,24,5,done?'#9c8c67':'#f8da80');rect(a.goal.x-3,a.goal.y-3,6,7,'#4c443b');
   text(done?'STASH CLAIMED':'GOLDEN STASH',a.goal.x,a.goal.y-15,a.color);
  }
  if(a.kind==='race')a.points.forEach((p,n)=>{
   const active=!done&&state.stage===n,color=active?a.color:'#6e7a84';ring(p.x,p.y,37,color);
   for(const dx of [-38,33]){rect(p.x+dx,p.y-39,5,14,'#eff0dc');rect(p.x+dx,p.y-39,5,4,'#343741');rect(p.x+dx,p.y-29,5,4,'#343741');}
   text('GATE '+(n+1)+(active?' →':''),p.x,p.y-46,color);text(String(n+1),p.x,p.y+4,color);
  });
  if(a.kind==='valves'){
   a.vents.forEach((p,n)=>{const active=isVentActive(world,n),off=world.time<world.activities.ventOffUntil[n];
    rect(p.x-26,p.y-22,52,44,'#253d37');ring(p.x,p.y,48,active?'#98c65f66':'#60745944');
    for(let y=-15;y<18;y+=7)rect(p.x-20,p.y+y,40,3,'#798b69');
    if(active)for(let k=0;k<8;k++){const phase=(world.time*15+k*13)%50;rect(p.x-40+k*11,p.y+20-phase,12,12,'#a2ce694d');}
    text(off?'VENT OFF':active?'TOXIC · AVOID':'VENT IDLE',p.x,p.y-55,active?'#c8eb85':'#8a9c85');
   });
   a.points.forEach((p,n)=>{rect(p.x-10,p.y-12,20,24,'#384b49');rect(p.x-7,p.y-10,14,7,world.time<world.activities.ventOffUntil[n]?'#b5f577':'#edac69');ring(p.x,p.y+5,5,'#9db8a7');text('G · VALVE '+(n+1),p.x,p.y-20,a.color);});
  }
  if(a.kind==='forage')a.points.forEach((p,n)=>{if(state.found.includes(n))return;rect(p.x-2,p.y-3,5,12,'#e5d7b6');rect(p.x-10,p.y-8,20,7,'#ed9fcf');rect(p.x-7,p.y-12,14,5,'#d788ca');rect(p.x-4,p.y-9,3,3,'#f9e4ec');rect(p.x+3,p.y-8,3,2,'#f9e4ec');text('SNACK '+(n+1),p.x,p.y-21,a.color);});
  if(a.kind==='garage'){
   const p=a.goal;rect(p.x-48,p.y-48,96,96,'#7ce4d311');ring(p.x,p.y,48,a.color);for(let n=-42;n<43;n+=12){rect(p.x+n,p.y-47,6,5,a.color);rect(p.x+n,p.y+42,6,5,a.color);}
   text('REPAIR BAY · PARK 2s',p.x,p.y-57,a.color);if(state.hold>0)text(Math.min(100,Math.round(state.hold/2*100))+'% REPAIRED',p.x,p.y+62,a.color);
  }
  if(a.kind==='beacon'){
   const p=a.goal;rect(p.x-38,p.y-38,76,76,'#bba0ff15');ring(p.x,p.y,40,done?'#7f7490':a.color);rect(p.x-3,p.y-20,6,39,'#777a94');rect(p.x+3,p.y-20,22,13,a.color);rect(p.x-12,p.y+18,24,6,'#454657');
   text(done?'BEACON CLAIMED':'HOLD THE BEACON · 3s',p.x,p.y-51,a.color);
   if(state.hold>0){rect(p.x-30,p.y+48,60,4,'#363545');rect(p.x-30,p.y+48,Math.min(60,state.hold/3*60),4,a.color);}
  }
 }
 for(const car of world.vehicles){
  if(car.hp<=0){rect(car.x-25,car.y-13,50,26,'#272b30');rect(car.x-18,car.y-9,35,18,'#464342');text('WRECK · '+Math.max(0,Math.ceil(car.respawnAt-world.time))+'s',car.x,car.y-25,'#8b8490');continue;}
  c.save();c.translate(Math.round(car.x),Math.round(car.y));c.rotate(car.angle);
  rect(-29,-13,64,36,'#141c28aa');
  for(const x of [-23,13]){rect(x,-21,12,8,'#151e29');rect(x,13,12,8,'#151e29');rect(x+2,-20,8,2,'#4d5360');}
  rect(-31,-15,62,30,car.color);rect(-25,-17,50,34,car.color);rect(-25,-15,50,3,'#ffffff33');
  rect(-13,-12,24,24,'#283d4b');rect(7,-10,5,20,'#9ac4ce');rect(-13,-10,3,20,'#829dba');
  rect(15,-12,10,24,car.color);rect(28,-12,4,7,'#fff2af');rect(28,5,4,7,'#fff2af');rect(-31,-12,3,6,'#f47c78');rect(-31,6,3,6,'#f47c78');
  if(car.driver){rect(-4,-5,9,10,'#ddb78e');rect(2,-3,2,2,'#252635');}
  if(Math.abs(car.speed)>100){rect(-38,-5,5,8,'#93909655');rect(-46,2,6,5,'#93909633');}
  c.restore();
  const driver=world.players.find(p=>p.id===car.driver);
  if(driver){text(driver.id===me?.id?'YOU / DRIVER':driver.name,car.x,car.y-34,driver.color);rect(car.x-24,car.y+29,48,3,'#202733');rect(car.x-24,car.y+29,48*car.hp/160,3,driver.color);}
  else if(me&&!me.vehicle&&Math.hypot(me.x-car.x,me.y-car.y)<85)text('G · DRIVE',car.x,car.y-33,'#b5f577');
 }
}
