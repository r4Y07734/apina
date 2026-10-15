import {ARENA} from './maps.js';
// Cached pixel scenery. Collision comes exclusively from ARENA.walls in maps.js.
export function createScenery(){
 const floor=document.createElement('canvas');floor.width=ARENA.width;floor.height=ARENA.height;
 const f=floor.getContext('2d');f.imageSmoothingEnabled=false;
 const rect=(x,y,w,h,color)=>{f.fillStyle=color;f.fillRect(x,y,w,h);};
 rect(0,0,ARENA.width,ARENA.height,'#252b36');
 for(let y=16;y<ARENA.height-16;y+=16)for(let x=16;x<ARENA.width-16;x+=16){
  const n=(x*13+y*31)%17;rect(x,y,15,15,n<5?'#2d3240':n<8?'#292e3b':'#282d39');
  if(n===3){rect(x+3,y+4,2,2,'#3e4150');rect(x+10,y+11,3,1,'#202530');}
 }
 for(const z of ARENA.zones){
  rect(z.x,z.y,z.w,z.h,z.color);
  for(let y=z.y+16;y<z.y+z.h;y+=32)for(let x=z.x+16;x<z.x+z.w;x+=32){rect(x,y,2,2,'#45444b');if((x+y)%96===0)rect(x+8,y+4,5,1,'#232a31');}
  f.strokeStyle='#575051';f.setLineDash([5,10]);f.strokeRect(z.x+8,z.y+8,z.w-16,z.h-16);f.setLineDash([]);
  f.font='bold 22px monospace';f.textAlign='center';f.fillStyle='#a39a92';f.globalAlpha=.32;f.fillText(z.name,z.x+z.w/2,z.y+z.h-28);f.globalAlpha=1;
 }
 for(const road of ARENA.roads){
  rect(road.x,road.y,road.w,road.h,'#292d36');f.strokeStyle='#746e51';f.lineWidth=2;f.setLineDash([16,20]);f.beginPath();
  if(road.w>road.h){f.moveTo(road.x,road.y+road.h/2);f.lineTo(road.x+road.w,road.y+road.h/2);}else{f.moveTo(road.x+road.w/2,road.y);f.lineTo(road.x+road.w/2,road.y+road.h);}f.stroke();f.setLineDash([]);
 }
 // Loading stencils and cracked concrete break up the open lanes.
 for(let x=752;x<1200;x+=80){rect(x,448,48,2,'#756c53');rect(x,448,2,32,'#756c53');}
 for(let n=0;n<90;n++){const x=32+(n*197)%(ARENA.width-64),y=32+(n*293)%(ARENA.height-64);rect(x,y,12,1,'#202832');rect(x+8,y+1,1,6,'#202832');rect(x+9,y+6,7,1,'#202832');}
 for(const d of ARENA.decals){
  const {x,y}=d;
  if(d.kind==='oil'||d.kind==='spill'){
   const col=d.kind==='spill'?'#486449':'#202831';rect(x-22,y-8,44,18,col);rect(x-12,y-14,25,32,col);rect(x+18,y+4,12,6,col);rect(x-14,y-4,20,2,d.kind==='spill'?'#72925a':'#373f4e');
  }else if(d.kind==='tires'){
   for(let n=0;n<3;n++){rect(x+n*9,y+(n%2)*9,14,12,'#181e28');rect(x+n*9+3,y+(n%2)*9+2,8,3,'#48505a');rect(x+n*9+5,y+(n%2)*9+4,5,5,'#272f3b');}
  }else if(d.kind==='weeds'){
   for(let n=0;n<8;n++){const dx=n*7%30,dy=n*11%22;rect(x+dx,y+dy,2,8,'#7d8c5f');rect(x+dx-3,y+dy+3,3,2,'#596c4c');}
  }else if(d.kind==='pipes'){
   for(let n=0;n<3;n++){rect(x,y+n*7,42,5,'#525f68');rect(x+2,y+n*7,36,2,'#859094');rect(x+39,y+n*7,3,5,'#272e38');}
  }else if(d.kind==='pallet'){
   rect(x,y,32,24,'#372d2c');for(let n=0;n<4;n++)rect(x+2,y+2+n*6,28,3,'#887155');
  }
 }
 for(const b of ARENA.walls){
  const {x,y,w,h,kind,color}=b;rect(x+6,y+9,w,h,'#171f2abb');
  rect(x,y,w,h,'#202632');rect(x+2,y+2,w-4,h-4,color);rect(x+2,y+2,w-4,4,'#ffffff25');rect(x,y+h-6,w,6,'#161d2a80');
  if(kind==='container'){
   for(let xx=x+9;xx<x+w-5;xx+=12){rect(xx,y+7,2,h-17,'#161f2b55');rect(xx+2,y+7,1,h-17,'#ffffff18');}
   rect(x+6,y+h-12,w-12,2,'#b5a98f');rect(x+w-16,y+11,7,11,'#b6b4a2');rect(x+w-14,y+13,3,4,'#363e48');
   for(let xx=x+8;xx<x+w-8;xx+=16)rect(xx,y+h-5,8,3,'#d2ad60');
  }else if(kind==='crate'){
   f.save();f.beginPath();f.rect(x,y,w,h);f.clip();
   for(let yy=y+3;yy<y+h-4;yy+=32)for(let xx=x+3;xx<x+w-4;xx+=32){rect(xx,yy,28,27,'#8a7355');rect(xx+3,yy+3,22,21,'#5e5345');rect(xx+5,yy+5,18,17,'#76634c');for(let n=0;n<18;n+=3)rect(xx+5+n,yy+5+n,3,3,'#b1976d');}
   f.restore();
  }else if(kind==='car'){
   rect(x+8,y+5,w-16,h-10,color);rect(x+Math.floor(w*.3),y+8,Math.floor(w*.3),h-16,'#293945');rect(x+Math.floor(w*.3)+3,y+10,4,h-20,'#779196');
   for(const xx of [x+12,x+w-27]){rect(xx,y-2,15,6,'#151e28');rect(xx,y+h-4,15,6,'#151e28');}
   rect(x+w-6,y+8,4,8,'#e8cf91');rect(x+w-6,y+h-16,4,8,'#e8cf91');rect(x+14,y+10,9,3,'#bd9678');
  }else if(kind==='barrels'){
   for(let yy=y+4;yy<y+h-12;yy+=28)for(let xx=x+4;xx<x+w-12;xx+=24){rect(xx,yy,19,22,'#3f655d');rect(xx+2,yy,15,4,'#83a091');rect(xx,yy+8,19,3,'#293a3b');rect(xx,yy+18,19,3,'#293a3b');rect(xx+7,yy+10,5,6,'#cdc06f');}
  }else if(kind==='tank'){
   rect(x+8,y+4,w-16,h-8,'#718078');rect(x+4,y+12,w-8,h-24,'#718078');rect(x+13,y+9,w-26,8,'#a5b1a0');rect(x+20,y+22,24,21,'#3b5552');rect(x+25,y+25,14,14,'#93a18d');rect(x+28,y+28,8,8,'#3a4947');rect(x+w-13,y+18,4,25,'#dfc87e');
  }else if(kind==='generator'){
   rect(x+6,y+7,w-12,h-15,'#555f69');for(let yy=y+16;yy<y+h-16;yy+=7)rect(x+12,yy,w-30,3,'#202d39');rect(x+w-14,y+14,5,5,'#bbef81');rect(x+w-14,y+25,5,5,'#e4bb73');
  }else if(kind==='planter'){
   rect(x+5,y+5,w-10,h-10,'#454336');for(let n=0;n<20;n++){const xx=x+8+n*17%(w-20),yy=y+8+n*13%(h-20);rect(xx,yy,12,10,n%2?'#78805a':'#556e50');rect(xx+2,yy+1,6,2,'#8a9367');}
  }
 }
 // Perimeter fence, warning strips and fence-post shadows.
 for(let x=16;x<ARENA.width-16;x+=32)for(const y of [16,ARENA.height-20]){rect(x,y,24,3,'#767581');rect(x,y,4,12,'#444e5b');rect(x+4,y+9,8,3,'#181f29');}
 for(let y=16;y<ARENA.height-16;y+=32)for(const x of [16,ARENA.width-20]){rect(x,y,3,24,'#767581');rect(x,y,12,4,'#444e5b');}
 return floor;
}
