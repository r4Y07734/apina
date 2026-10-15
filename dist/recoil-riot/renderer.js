import {ARENA} from './maps.js';
import {WEAPONS} from './weapons.js';
import {createCamera,followCamera,screenToWorld,VIEW} from './camera.js';
import {createScenery} from './scenery.js';
import {drawAdventure} from './adventure-renderer.js';
import {ACTIVITIES} from './activities.js';
const sprites={
 monkey:['..bbbbbb..','.bbbbbbbb.','bbttbbttbb','bttttttttb','btwttwtwtb','.tttttttt.','..tddddt..','..bttttb..','...bbbb...'],
 duck:['...yyyy...','..yyyyyy..','..ykyyyo..','..yyyyoooo','....yy....','.yyyyyyy..','yyyyyyyyy.','.yyyyyyy..','..yyyyy...']
};
export function createRenderer(canvas){
 const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
 const floor=createScenery(),camera=createCamera();let followedId=null;
 const particles=[];let lastEvent=0,shake=0;
 function rect(x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);}
 function sprite(rows,x,y,scale,palette){for(let yy=0;yy<rows.length;yy++)for(let xx=0;xx<rows[yy].length;xx++){const col=palette[rows[yy][xx]];if(col)rect(x+xx*scale,y+yy*scale,scale,scale,col);}}
 function gun(index,x,y,a,scale=1){const g=WEAPONS[index];c.save();c.translate(Math.round(x),Math.round(y));c.rotate(a);c.scale(scale,scale);rect(0,-3,22,7,'#171b29');rect(3,-2,17,5,g.color);rect(7,3,5,4,'#646078');if(index===0){rect(10,-4,12,3,'#ddd3be');rect(10,1,12,3,'#a49c99');}if(index===1){rect(7,-4,5,3,g.color);rect(15,-1,6,7,g.color);}if(index===3){rect(15,-5,7,8,'#ffdf65');rect(21,-2,4,3,'#ff905a');rect(19,-4,1,1,'#232433');}if(index===5){rect(15,-5,11,10,g.color);rect(16,-7,7,3,g.color);}c.restore();}
 function draw(world,myId,dt=.016){
  if(world.serial<lastEvent){lastEvent=0;particles.length=0;}
  const me=world.players.find(p=>p.id===myId),target=me||world.players[0];
  if(target){if(followedId!==target.id){camera.initialized=false;followedId=target.id;}followCamera(camera,target,dt);}

  for(const e of world.events){if(e.id<=lastEvent)continue;lastEvent=Math.max(lastEvent,e.id);
   if(e.type==='win')continue;const count=e.type==='kill'||e.type==='boom'?24:e.type==='shot'?4:8;
   if(e.player===myId&&e.type==='shot')shake=WEAPONS[e.weapon].recoil/95;
   if(e.type==='boom')shake=Math.max(shake,5);
   for(let n=0;n<count;n++){const a=Math.random()*Math.PI*2,s=Math.random()*(e.type==='boom'?200:85);particles.push({x:e.x,y:e.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.2+Math.random()*.35,max:.55,color:e.color||'#fff0a8',size:e.type==='boom'?4:2});}
   if(e.type==='hit')particles.push({x:e.x,y:e.y-20,vx:0,vy:-30,life:.65,color:'#fff',text:Math.ceil(e.damage)});
  }
  c.clearRect(0,0,VIEW.width,VIEW.height);c.save();shake*=.85;c.translate(Math.round((Math.random()-.5)*shake),Math.round((Math.random()-.5)*shake));c.translate(-Math.round(camera.x),-Math.round(camera.y));c.drawImage(floor,0,0);
  for(const pack of world.health)if(world.time>=pack.ready){rect(pack.x-10,pack.y-6,20,15,'#171d2b');rect(pack.x-8,pack.y-8,16,14,'#eee9dd');rect(pack.x-2,pack.y-6,4,10,'#90ca81');rect(pack.x-5,pack.y-3,10,4,'#90ca81');}
  drawAdventure(c,world,me);
  for(const p of world.players){if(p.hp<=0||p.vehicle)continue;c.save();if(p.invuln>0)c.globalAlpha=.55+Math.sin(world.time*20)*.2;
   const moving=Math.hypot(p.vx,p.vy)>15||p.bot||Math.abs(p.input?.x||0)+Math.abs(p.input?.y||0)>0;
   const stride=moving?Math.sin(world.time*16)*2:0;
   rect(p.x-12,p.y+9,24,7,'#1a1d2c');
   rect(p.x-8,p.y+5+stride,6,8,'#161b29');rect(p.x+2,p.y+5-stride,6,8,'#161b29');
   rect(p.x-10,p.y-7,20,16,'#171b29');rect(p.x-8,p.y-5,16,13,p.color);rect(p.x-7,p.y+3,14,4,'#5b5966');
   sprite(sprites.monkey,p.x-10,p.y-23,2,{b:'#69504c',t:'#e3b788',w:'#fbf1d1',d:'#8b6657'});
   rect(p.x+(Math.cos(p.angle)>0?2:-5),p.y-15,3,3,'#191e2b');
   gun(p.weapon,p.x,p.y,p.angle);
   if(p.id===myId){c.strokeStyle=p.color;c.lineWidth=1;c.strokeRect(Math.round(p.x-15),Math.round(p.y-27),30,44);rect(p.x-2,p.y-34,5,3,p.color);}
   c.globalAlpha=1;c.font='bold 10px monospace';c.textAlign='center';c.fillStyle=p.id===myId?'#d3f7b3':'#dedbeb';c.fillText(p.id===myId?'YOU':p.name,p.x,p.y-33);
   rect(p.x-14,p.y+20,28,3,'#191c29');rect(p.x-14,p.y+20,Math.max(0,28*p.hp/100),3,p.color);c.restore();
  }
  for(const b of world.bullets){const g=WEAPONS[b.weapon];if(g.kind==='duck'){sprite(sprites.duck,b.x-5,b.y-5,1,{y:g.color,k:'#171b29',o:'#ff8c56'});}else if(g.kind==='glove'){rect(b.x-5,b.y-5,11,10,g.color);rect(b.x-7,b.y-2,3,5,'#eee4de');}else{rect(b.x-1,b.y-1,g.radius*2,g.radius*2,g.color);rect(b.x-b.vx*.014,b.y-b.vy*.014,2,2,g.color);}}
  for(let n=particles.length-1;n>=0;n--){const p=particles[n];p.life-=dt;if(p.life<=0){particles.splice(n,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;c.globalAlpha=Math.min(1,p.life*4);if(p.text){c.font='bold 12px monospace';c.fillStyle=p.color;c.fillText(p.text,p.x,p.y);}else rect(p.x,p.y,p.size||2,p.size||2,p.color);}c.globalAlpha=1;c.restore();
  drawMinimap(world,me);
  if(me?.dead>0){c.fillStyle='#151725aa';c.fillRect(0,0,960,640);c.fillStyle='#eee9df';c.font='bold 28px monospace';c.textAlign='center';c.fillText('BACK IN '+Math.ceil(me.dead),480,310);c.font='13px monospace';c.fillText('A minor setback. A major skill issue.',480,340);}
  if(world.winner){c.fillStyle='#161929dd';c.fillRect(220,230,520,160);c.fillStyle='#b5f577';c.font='bold 30px monospace';c.textAlign='center';c.fillText(world.winner+' wins!',480,290);c.fillStyle='#e2dcea';c.font='14px monospace';c.fillText('Next round in '+Math.ceil(world.restartAt-world.time)+' · Go again.',480,330);}
 }
 function drawMinimap(world,me){
  const width=156,height=width*ARENA.height/ARENA.width,x=VIEW.width-width-18,y=VIEW.height-height-18,scale=width/ARENA.width;
  rect(x-7,y-24,width+14,height+31,'#151e2aee');
  c.font='bold 9px monospace';c.textAlign='left';c.fillStyle='#afa9bd';c.fillText('JUNKYARD / RADAR',x,y-10);
  for(const z of ARENA.zones)rect(x+z.x*scale,y+z.y*scale,z.w*scale,z.h*scale,z.color);
  for(const b of ARENA.walls)rect(x+b.x*scale,y+b.y*scale,Math.max(2,b.w*scale),Math.max(2,b.h*scale),'#777486');
  for(const a of ACTIVITIES){for(const p of a.points||[a.goal])if(p)rect(x+p.x*scale-1,y+p.y*scale-1,3,3,a.color);}
  for(const car of world.vehicles)if(car.hp>0)rect(x+car.x*scale-2,y+car.y*scale-1,5,3,'#ffda7b');
  c.strokeStyle='#b5f57766';c.lineWidth=1;c.strokeRect(Math.round(x+camera.x*scale),Math.round(y+camera.y*scale),VIEW.width*scale,VIEW.height*scale);
  for(const p of world.players)if(p.hp>0){rect(x+p.x*scale-1,y+p.y*scale-1,p.id===me?.id?4:2,p.id===me?.id?'#c5ff8a':p.color);}
  const zone=me&&ARENA.zones.find(z=>me.x>=z.x&&me.x<=z.x+z.w&&me.y>=z.y&&me.y<=z.y+z.h);
  rect(17,17,zone?204:224,27,'#171e2ad9');c.fillStyle='#b5f577';c.font='bold 10px monospace';c.textAlign='left';c.fillText('◈ '+(zone?.name||'JUNKYARD / SERVICE ROAD'),27,35);
 }
 return {draw,gun,screenToWorld:(x,y)=>screenToWorld(camera,x,y)};
}
