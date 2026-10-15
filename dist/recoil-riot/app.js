import {WEAPONS} from './weapons.js';
import {createWorld,addPlayer,step,RULES} from './simulation.js';
import {createRenderer} from './renderer.js';
import {vehicleHint} from './vehicles.js';
import {ACTIVITIES,districtHint,activityProgress} from './activities.js';
import {MULTIPLAYER_SERVER} from './config.js';
const $=s=>document.querySelector(s),canvas=$('#arena'),renderer=createRenderer(canvas);
const params=new URLSearchParams(location.search),keys=new Set(),pendingActions=new Set();
let world=createWorld(),myId='you',selected=0,playing=false,online=false,paused=false,ws=null,room='',last=0,acc=0,lastSend=0,pointer={x:700,y:320,down:false},audio=null,sound=false,lastSound=0;
let server=MULTIPLAYER_SERVER;
if(params.has('server')&&['localhost','127.0.0.1'].includes(location.hostname)){try{const u=new URL(params.get('server'));if(['http:','https:'].includes(u.protocol))server=u.origin;}catch{}}
const buttons=[];
for(const [index,g] of WEAPONS.entries()){
 const b=document.createElement('button');b.className='weapon';b.title=g.flavor;b.setAttribute('aria-label',`${index+1}: ${g.name}. ${g.flavor}`);
 const num=document.createElement('span');num.className='number';num.textContent=index+1;
 const art=document.createElement('canvas');art.width=40;art.height=28;art.className='weapon-art';const c=art.getContext('2d');c.fillStyle='#171b29';c.fillRect(3,8,30,9);c.fillStyle=g.color;c.fillRect(6,9,28,6);c.fillRect(12,15,6,7);if(index===3){c.fillRect(24,4,8,9);c.fillStyle='#ff965a';c.fillRect(31,7,6,3);}if(index===5){c.fillRect(23,5,13,15);}if(index===1)c.fillRect(8,5,8,5);
 const copy=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=g.name;small.textContent=['EXTREME RECOIL','RAPID-FIRE SQUIRT','EXPLOSIVE SAUCE','BOUNCING DUCKS','CONFETTI CARNAGE','KEEP YOUR DISTANCE'][index];copy.append(strong,small);b.append(num,art,copy);b.onclick=()=>{select(index);if(playing)canvas.focus();};$('#weapons').append(b);buttons.push(b);
}
for(const a of ACTIVITIES){const row=document.createElement('li');row.id='job-'+a.id;const mark=document.createElement('b'),copy=document.createElement('span');mark.textContent='○';copy.textContent=a.name;row.title=a.zone+' · '+a.hint;row.append(mark,copy);$('#district-progress').append(row);}
function select(i){selected=(i+WEAPONS.length)%WEAPONS.length;buttons.forEach((b,n)=>{b.classList.toggle('active',n===selected);b.setAttribute('aria-pressed',String(n===selected));});}select(0);
function demo(){lastSound=0;world=createWorld();for(let n=0;n<4;n++){const p=addPlayer(world,'demo'+n,['Lil Bananas','Tax Evasion','Soup Enjoyer','Sir Quacks'][n],true);p.weapon=n;}myId='you';}
demo();
function message(text){$('#notice').textContent=text;}
function setPlaying(value){playing=value;$('#lobby').hidden=value;$('#online-panel').hidden=true;$('#leave').hidden=!value;$('#copy-invite').hidden=!value||!online;keys.clear();pendingActions.clear();pointer.down=false;paused=false;$('#paused').hidden=true;if(value)canvas.focus();}
$('#practice').onclick=()=>{disconnect();lastSound=0;world=createWorld();myId='you';addPlayer(world,myId,$('#nickname').value||'You');for(let n=0;n<3;n++){const p=addPlayer(world,'bot'+n,['Tax Evasion','Soup Enjoyer','Sir Quacks'][n],true);p.weapon=[1,3,4][n];}online=false;setPlaying(true);$('#mode').textContent='PRACTICE / 3 BOTS';$('#session-label').textContent='◈ Offline practice · Same rules. Very artificial intelligence.';message('You’re in. Click the arena, use WASD to move, and hold the mouse button to shoot.');};
$('#online-toggle').onclick=()=>{$('#online-panel').hidden=false;$('#nickname').focus();};
$('#close-online').onclick=()=>{$('#online-panel').hidden=true;};
function disconnect(){if(ws){ws.onclose=null;ws.close();ws=null;}online=false;room='';}
$('#leave').onclick=()=>{disconnect();setPlaying(false);demo();$('#mode').textContent='THE JUNKYARD';$('#session-label').textContent='◈ A little recoil builds character.';message('Back in the lobby. Another round?');const url=new URL(location);url.searchParams.delete('room');history.replaceState(null,'',url);};
function setBusy(b){$('#create').disabled=b;$('#room-form button[type=submit]').disabled=b;}
function connect(code){
 disconnect();setBusy(true);$('#connect-status').textContent='Finding your corner of the junkyard…';
 const url=new URL(server);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/room/'+code;url.searchParams.set('name',$('#nickname').value||'Monkey');
 const socket=new WebSocket(url);ws=socket;
 const timeout=setTimeout(()=>{if(ws===socket&&socket.readyState!==1){socket.close();$('#connect-status').textContent='Connection timed out. Try joining again.';setBusy(false);}},12000);
 socket.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
  if(m.type==='welcome'){clearTimeout(timeout);myId=m.id;room=code;online=true;setPlaying(true);setBusy(false);$('#mode').textContent='ONLINE / ROOM '+code;$('#session-label').textContent='◈ ROOM '+code+' · Friends replace bots automatically.';const u=new URL(location);u.searchParams.set('room',code);history.replaceState(null,'',u);message('Room '+code+' is live. Copy the invite to bring your friends.');}
  if(m.type==='state'){world=m.world;}
  if(m.type==='error'){$('#connect-status').textContent=m.message;message(m.message);}
 };
 socket.onerror=()=>{$('#connect-status').textContent='Could not connect. Check the room code or try again.';};
 socket.onclose=()=>{clearTimeout(timeout);setBusy(false);if(ws!==socket)return;ws=null;if(playing&&online){setPlaying(false);online=false;demo();$('#online-panel').hidden=false;$('#connect-status').textContent='Disconnected. Rejoin the room to keep playing.';message('The room connection ended. Rejoin using the same code.');}else if(!playing){$('#connect-status').textContent='Could not join. The room may be full. Try another code.';}};
}
$('#create').onclick=()=>{const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',r=crypto.getRandomValues(new Uint8Array(6));connect([...r].map(x=>chars[x%chars.length]).join(''));};
$('#room-form').onsubmit=e=>{e.preventDefault();const code=$('#room-code').value.trim().toUpperCase();if(/^[A-Z0-9]{6}$/.test(code))connect(code);else $('#connect-status').textContent='Enter a six-character room code.';};
$('#copy-invite').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);message('Invite copied. Send it to your favorite bad influence.');}catch{message('Your invite: '+location.href);}};
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('.arena-panel').requestFullscreen();}catch{message('Fullscreen is unavailable in this browser.');}};
$('#sound').onclick=()=>{sound=!sound;$('#sound').textContent=sound?'Sound on':'Sound off';$('#sound').setAttribute('aria-pressed',String(sound));if(sound){audio??=new AudioContext();audio.resume();}};
function beep(index){if(!audio||!sound)return;const osc=audio.createOscillator(),gain=audio.createGain();osc.type=index===1?'sine':'square';osc.frequency.setValueAtTime([95,370,70,550,220,130][index],audio.currentTime);osc.frequency.exponentialRampToValueAtTime(40,audio.currentTime+.09);gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.10);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+.11);}
function clearInput(){keys.clear();pendingActions.clear();pointer.down=false;}
function pause(value){paused=value;clearInput();$('#paused').hidden=!value;}
window.addEventListener('keydown',e=>{
 if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
 if(!playing)return;
 const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();
 if(key==='escape'){pause(!paused);return;}if(e.repeat)return;
 keys.add(key);if(['r','f',' ','g'].includes(key))pendingActions.add(key);if(/^[1-6]$/.test(key))select(Number(key)-1);if(key==='q')select(selected-1);if(key==='e')select(selected+1);
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{clearInput();if(playing)pause(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(playing)pause(true);}});
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();pointer.x=(e.clientX-r.left)*960/r.width;pointer.y=(e.clientY-r.top)*640/r.height;});
canvas.addEventListener('pointerdown',e=>{if(!playing)return;e.preventDefault();canvas.focus();if(paused){pause(false);return;}if(e.button===0)pointer.down=true;});window.addEventListener('pointerup',()=>pointer.down=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{if(!playing)return;e.preventDefault();select(selected+(e.deltaY>0?1:-1));},{passive:false});
function input(){
 const p=world.players.find(p=>p.id===myId),active=playing&&!paused,target=renderer.screenToWorld(pointer.x,pointer.y);
 const command={
  x:active?(+(keys.has('d')||keys.has('arrowright'))-+(keys.has('a')||keys.has('arrowleft'))):0,
  y:active?(+(keys.has('s')||keys.has('arrowdown'))-+(keys.has('w')||keys.has('arrowup'))):0,
  angle:p?Math.atan2(target.y-p.y,target.x-p.x):0,fire:active&&pointer.down,
  dash:active&&(keys.has(' ')||pendingActions.has(' ')),
  melee:active&&(keys.has('f')||pendingActions.has('f')),
  reload:active&&(keys.has('r')||pendingActions.has('r')),interact:active&&(keys.has('g')||pendingActions.has('g')),weapon:selected
 };
 // Keep quick key taps until a local tick or online input packet consumes them.
 pendingActions.clear();return command;
}
const renderPositions=new Map();
function displayWorld(dt){
 const players=world.players.map(p=>{
  const old=renderPositions.get(p.id)||{x:p.x,y:p.y};
  const amount=Math.hypot(old.x-p.x,old.y-p.y)>120?1:1-Math.exp(-26*dt);
  const point={x:old.x+(p.x-old.x)*amount,y:old.y+(p.y-old.y)*amount};renderPositions.set(p.id,point);
  const target=renderer.screenToWorld(pointer.x,pointer.y);
  return {...p,...point,angle:p.id===myId?Math.atan2(target.y-point.y,target.x-point.x):p.angle};
 });
 for(const id of renderPositions.keys())if(!world.players.some(p=>p.id===id))renderPositions.delete(id);
 const vehicles=world.vehicles.map(v=>{const driver=players.find(p=>p.id===v.driver);return driver?{...v,x:driver.x,y:driver.y}:v;});
 return {...world,players,vehicles};
}
let uiAt=0;
function ui(now){if(now-uiAt<80)return;uiAt=now;const p=world.players.find(p=>p.id===myId);const g=WEAPONS[selected];$('#gun-name').textContent=g.name.toUpperCase();$('#ammo').textContent=p?.reload>0?'RELOADING…':`${p?.ammo[selected]??g.magazine} / ${g.magazine}`;$('#hp-text').textContent=Math.ceil(p?.hp??100)+' HP';$('#hp-bar').style.width=(p?.hp??100)+'%';$('#dash-status').textContent=p?.dash>0?`DASH / ${p.dash.toFixed(1)}s`:'SPACE / DASH READY';const sec=Math.ceil(world.remaining);$('#round-clock').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
 const board=$('#scoreboard');board.replaceChildren();[...world.players].sort((a,b)=>b.score-a.score||a.deaths-b.deaths).forEach((p,i)=>{const li=document.createElement('li'),rank=document.createElement('span'),swatch=document.createElement('span'),name=document.createElement('span'),score=document.createElement('b');rank.className='rank';rank.textContent=String(i+1).padStart(2,'0');swatch.className='swatch';swatch.style.background=p.color;name.className='name';name.textContent=p.id===myId?'You':p.name+(p.bot?' [BOT]':'');score.textContent=p.score;li.append(rank,swatch,name,score);board.append(li);});
 const car=world.vehicles.find(v=>v.id===p?.vehicle);if(car){$('#gun-name').textContent='JUNKYARD MOTOR';$('#ammo').textContent=Math.ceil(car.hp)+' / 160 CAR HP';$('#dash-status').textContent='SPACE / BRAKE';}
 $('#vehicle-status').textContent=vehicleHint(world,p)||'G · Use nearby cars or valve consoles';
 $('#district-hint').textContent=districtHint(world,p);
 $('#district-count').textContent=(p?.badges.length||0)+'/6';
 for(const a of ACTIVITIES){const item=document.getElementById('job-'+a.id),done=p?.badges.includes(a.id);item.classList.toggle('complete',!!done);item.querySelector('b').textContent=done?'✓':'○';}
 const kills=world.events.filter(e=>e.type==='kill');if(kills.length&&playing){const e=kills.at(-1);$('#score-note').textContent=e.killer+' → '+e.victim;}
 for(const e of world.events)if(e.id>lastSound){lastSound=e.id;if(e.type==='shot'&&e.player===myId)beep(e.weapon);}
}
function frame(now){const dt=Math.min((now-last)/1000||.016,.05);last=now;
 if(!online){if(!playing||!paused){acc+=dt;while(acc>=RULES.tick){const p=world.players.find(p=>p.id===myId);if(p)p.input=input();step(world);acc-=RULES.tick;}}}else if(ws?.readyState===1&&now-lastSend>33){ws.send(JSON.stringify({type:'input',input:input()}));lastSend=now;}
 renderer.draw(online?displayWorld(dt):world,myId,dt);ui(now);requestAnimationFrame(frame);
}requestAnimationFrame(frame);
if(params.has('room')){const code=params.get('room').toUpperCase();if(/^[A-Z0-9]{6}$/.test(code)){$('#room-code').value=code;$('#online-panel').hidden=false;$('#connect-status').textContent='You’re invited. Choose a name and press Join.';}}
