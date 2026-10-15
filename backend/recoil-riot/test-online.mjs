import WebSocket from 'ws';
import assert from 'node:assert/strict';
const base=process.env.RIOT_SERVER||'ws://127.0.0.1:8788',origin=process.env.RIOT_ORIGIN||'http://localhost:8000';
const room='T'+Math.random().toString(36).slice(2,7).toUpperCase(),clients=[];
async function join(name){const ws=new WebSocket(`${base}/room/${room}?name=${encodeURIComponent(name)}`,{origin});clients.push(ws);const state={ws,id:null,world:null};await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Room timeout')),15000);ws.on('error',reject);ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='welcome')state.id=m.id;if(m.type==='state'){state.world=m.world;if(state.id){clearTimeout(timer);resolve();}}});});return state;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
 const a=await join('Alice'),b=await join('Bob');await delay(250);
 assert.ok(a.world.players.some(p=>p.id===b.id));assert.equal(a.world.players.length,4);assert.equal(a.world.players.filter(p=>p.bot).length,2);
 const before=a.world.players.find(p=>p.id===a.id);
 a.ws.send(JSON.stringify({type:'input',input:{x:1,y:0,angle:0,fire:true,weapon:1,hp:9999}}));await delay(220);
 const after=b.world.players.find(p=>p.id===a.id);assert.ok(after.x>before.x);assert.ok(after.ammo[1]<36);assert.ok(after.hp<=100);
 await delay(500);const stopped=a.world.players.find(p=>p.id===a.id).x;await delay(250);assert.ok(Math.abs(a.world.players.find(p=>p.id===a.id).x-stopped)<5,'stale input must stop movement');
 // Keep the selected weapon alive while the server processes the reload timer.
 a.ws.send(JSON.stringify({type:'input',input:{weapon:1,reload:true}}));await delay(60);
 for(let n=0;n<32;n++){a.ws.send(JSON.stringify({type:'input',input:{weapon:1}}));await delay(50);}
 const reloaded=b.world.players.find(p=>p.id===a.id);assert.equal(reloaded.reload,0);assert.equal(reloaded.ammo[1],36);
 a.ws.send(JSON.stringify({type:'input',input:{weapon:1,fire:true,angle:0}}));await delay(180);
 assert.ok(b.world.players.find(p=>p.id===a.id).ammo[1]<36,'online firing must resume after reload');
 b.ws.close();await delay(200);assert.equal(a.world.players.filter(p=>p.bot).length,3);
 const humans=[a];for(let n=0;n<7;n++)humans.push(await join('Player '+n));await delay(200);assert.equal(a.world.players.length,8);assert.equal(a.world.players.filter(p=>p.bot).length,0);
 await new Promise((resolve,reject)=>{const ws=new WebSocket(`${base}/room/${room}`,{origin});ws.on('unexpected-response',(_,r)=>{assert.equal(r.statusCode,409);r.resume();resolve();});ws.on('open',()=>{ws.close();reject(new Error('Full room accepted ninth player'));});ws.on('error',()=>{});});
 console.log('PASS: two-client state, authoritative input, shots/ammo, reload then fire, idle movement, bot replacement, eight-player capacity.');
}finally{for(const ws of clients)ws.close();}
