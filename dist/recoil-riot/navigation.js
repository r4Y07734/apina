import {ARENA} from './maps.js';
// Coarse navigation grid with line-of-sight smoothing. Cached per bot, never sent over the wire.
const brains=new WeakMap();
const spacing=32,columns=Math.ceil(ARENA.width/spacing),rows=Math.ceil(ARENA.height/spacing);
let nodes;
function clearLine(a,b,blocked,radius=11){
 const length=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(length/8));
 for(let n=0;n<=steps;n++)if(blocked(a.x+(b.x-a.x)*n/steps,a.y+(b.y-a.y)*n/steps,radius))return false;
 return true;
}
function grid(blocked){
 if(nodes)return nodes;
 nodes=Array.from({length:columns*rows},(_,id)=>{const x=(id%columns)*spacing+16,y=Math.floor(id/columns)*spacing+16;return {id,x,y,open:!blocked(x,y),neighbors:[]};});
 for(const node of nodes)if(node.open)for(const offset of [-1,1,-columns,columns]){
  const next=nodes[node.id+offset];if(next?.open&&Math.abs(next.x-node.x)<=spacing&&clearLine(node,next,blocked))node.neighbors.push(next.id);
 }
 return nodes;
}
function findRoute(start,end,blocked){
 const map=grid(blocked);
 const nearest=point=>map.filter(n=>n.open).reduce((best,n)=>Math.hypot(n.x-point.x,n.y-point.y)<Math.hypot(best.x-point.x,best.y-point.y)?n:best);
 const first=nearest(start),last=nearest(end),queue=[first.id],parents=new Map([[first.id,null]]);
 for(let i=0;i<queue.length&&!parents.has(last.id);i++)for(const next of map[queue[i]].neighbors)if(!parents.has(next)){parents.set(next,queue[i]);queue.push(next);}
 if(!parents.has(last.id))return [];
 const route=[];for(let id=last.id;id!==null;id=parents.get(id))route.unshift(map[id]);return route;
}
export function botInput(world,player,blocked){
 const targets=world.players.filter(q=>q!==player&&q.hp>0).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
 const target=targets[0];if(!target)return {};
 let brain=brains.get(player);if(!brain){brain={next:0,route:[],phase:[...player.id].reduce((n,c)=>n+c.charCodeAt(0),0)*.71};brains.set(player,brain);}
 const angle=Math.atan2(target.y-player.y,target.x-player.x),distance=Math.hypot(target.x-player.x,target.y-player.y);
 const sight=clearLine(player,target,blocked,3),walk=clearLine(player,target,blocked,12);
 let x=0,y=0;
 if(!walk){
  if(world.time>=brain.next){brain.route=findRoute(player,target,blocked);brain.next=world.time+.65;}
  while(brain.route.length&&Math.hypot(brain.route[0].x-player.x,brain.route[0].y-player.y)<22)brain.route.shift();
  let waypoint=brain.route[0];
  for(const next of brain.route.slice(0,5))if(clearLine(player,next,blocked,12))waypoint=next;
  if(waypoint){const a=Math.atan2(waypoint.y-player.y,waypoint.x-player.x);x=Math.cos(a);y=Math.sin(a);}
 }else{
  const forward=distance>270?1:distance<145?-1:0,strafe=Math.sin(world.time*1.5+brain.phase)*.8;
  x=Math.cos(angle)*forward-Math.sin(angle)*strafe;y=Math.sin(angle)*forward+Math.cos(angle)*strafe;
  if(blocked(player.x+x*30,player.y+y*30)){x=Math.cos(angle)*forward;y=Math.sin(angle)*forward;}
 }
 return {x,y,angle:angle+Math.sin(world.time*3+brain.phase)*.09,fire:sight&&distance<540,dash:!walk&&distance>300,melee:distance<48,weapon:player.weapon};
}
