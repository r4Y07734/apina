import {createWorld,addPlayer,step,cleanInput,snapshot,RULES} from '../../dist/recoil-riot/simulation.js';
export function allowedOrigin(request,env){const origin=request.headers.get('Origin');return origin&&(env.ALLOWED_ORIGINS||'https://apina.app').split(',').includes(origin);}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/health')return Response.json({ok:true,game:'recoil-riot',protocol:1});
  if(!/^\/room\/[A-Z0-9]{6}$/.test(url.pathname))return new Response('Not found',{status:404});
  if(!allowedOrigin(request,env))return new Response('Origin not allowed',{status:403});
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  return env.ROOMS.get(env.ROOMS.idFromName(url.pathname.slice(6))).fetch(request);
 }
};
// Rooms are intentionally ephemeral: active matches live while their sockets are connected.
// The server owns positions, shots, health, reloads, cooldowns, scores, and round results.
export class RiotRoom {
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.world=createWorld();this.clients=new Map();this.timer=null;this.ticks=0;}
 fillBots(){
  const count=Math.max(0,4-this.clients.size),bots=this.world.players.filter(p=>p.bot);
  while(bots.length>count){const p=bots.pop();this.world.players=this.world.players.filter(q=>q.id!==p.id);}
  for(let n=bots.length;n<count;n++){const id='bot-'+crypto.randomUUID(),p=addPlayer(this.world,id,['Sir Quacks','Soup Enjoyer','Tax Evasion'][n%3],true);p.weapon=[3,1,4][n%3];}
 }
 async fetch(request){
  if(this.clients.size>=RULES.maxPlayers)return new Response('Room is full',{status:409});
  const pair=new WebSocketPair(),client=pair[0],socket=pair[1];socket.accept();
  const id=crypto.randomUUID(),name=new URL(request.url).searchParams.get('name')||'Monkey';
  // Remove one bot before adding a human so their color and spawn are distinct.
  const bot=this.world.players.find(p=>p.bot);if(bot)this.world.players=this.world.players.filter(p=>p!==bot);
  const p=addPlayer(this.world,id,name);this.clients.set(socket,{id,lastInput:Date.now(),rateAt:Date.now(),rate:0});this.fillBots();
  socket.send(JSON.stringify({type:'welcome',id}));socket.send(JSON.stringify({type:'state',world:snapshot(this.world)}));
  socket.addEventListener('message',e=>{
   const connection=this.clients.get(socket);if(!connection)return;
   const now=Date.now();if(now-connection.rateAt>1000){connection.rateAt=now;connection.rate=0;}
   if(++connection.rate>90||typeof e.data!=='string'||e.data.length>1024){socket.close(1008,'Input limit');return;}
   try{const m=JSON.parse(e.data);if(m.type==='input'){p.input=cleanInput(m.input);connection.lastInput=now;}}catch{socket.close(1003,'Invalid input');}
  });
  const close=()=>{if(!this.clients.delete(socket))return;this.world.players=this.world.players.filter(q=>q.id!==id);this.fillBots();if(!this.clients.size){clearInterval(this.timer);this.timer=null;this.world=createWorld();}};
  socket.addEventListener('close',close);socket.addEventListener('error',close);
  if(!this.timer)this.timer=setInterval(()=>this.tick(),1000/30);
  return new Response(null,{status:101,webSocket:client});
 }
 tick(){
  for(const [socket,c] of this.clients){const idle=Date.now()-c.lastInput;if(idle>120000){socket.close(1000,'Idle');continue;}if(idle>300){const p=this.world.players.find(p=>p.id===c.id);if(p)p.input={};}}
  step(this.world);if(++this.ticks%2)return;
  const payload=JSON.stringify({type:'state',world:snapshot(this.world)});
  for(const [socket] of this.clients)try{socket.send(payload);}catch{socket.close();}
 }
}
