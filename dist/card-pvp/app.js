import { createGame, applyAction, viewFor, pickBotAction, validateCards, normalizeCards } from './rules.js';
import { multiplayerServer } from './config.js';

const $ = id => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
const iconPaths = {
  sword: ['M6 18 18 6l1-3-3 1L5 15', 'm4 13 7 7', 'm3 21 4-4'],
  heart: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z'],
  bolt: ['m13 2-9 12h7l-1 8 10-12h-7l1-8Z'],
  flask: ['M9 3h6', 'M10 3v6L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3', 'M7 15h10'],
  arrows: ['M4 7h16', 'm16 3 4 4-4 4', 'M20 17H4', 'm8 13-4 4 4 4'],
  spark: ['m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z'],
  shield: ['M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z', 'M12 8v7', 'M9 12h6'],
};
const fallbackIcons = {damage:'sword',heal:'heart',energy:'bolt',poison:'flask',mixed:'spark'};
let cards = [], cardMap, state, view, selected = null, mode = null, botTimer;
let socket, server = '', room = '', token = '', connected = false, pending = false;
let reconnectTimer, reconnectAttempt = 0, intentionalClose = false, turnDeadline = null, roomRequestVersion = 0;
const sessionKey = 'apina-card-pvp-session';

function message(text, isError = false) {
  const element = mode && view ? $('battle-message') : $('lobby-message');
  element.textContent = text; element.classList.toggle('error', isError);
}
function normalizeServer(value) {
  const url = new URL(value.trim());
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw Error('Use an HTTPS server URL, or HTTP for localhost.');
  url.hash = ''; url.search = ''; return url.href.replace(/\/+$/, '');
}
function rememberSession() {
  try { sessionStorage.setItem(sessionKey, JSON.stringify({server,room,token})); } catch {}
}
function clearSession() { try { sessionStorage.removeItem(sessionKey); } catch {} }
function closeConnection() {
  intentionalClose = true; clearTimeout(reconnectTimer); clearTimeout(botTimer);
  if (socket) { socket.onclose = socket.onmessage = socket.onerror = socket.onopen = null; socket.close(); socket = null; }
  connected = false; pending = false;
}
function showLobby() {
  roomRequestVersion++; closeConnection(); clearSession(); mode = null; state = view = null; selected = null;
  $('battle').hidden = true; $('lobby').hidden = false; $('waiting-panel').hidden = true;
  $('friend-panel').hidden = true; $('friend-toggle').setAttribute('aria-expanded','false');
  $('lobby-message').textContent = ''; $('connection-status').textContent = 'Bot is ready · no account needed';
  $('result-dialog').close();
  $('play-bot').focus({preventScroll:true});
}
function iconFor(card) {
  if (typeof card.icon === 'string' && /\.(svg|png|webp|jpg)$/i.test(card.icon)) {
    try {
      const url = new URL(card.icon, new URL('./cards.json', import.meta.url));
      if (url.origin === location.origin) {
        const img = document.createElement('img'); img.src = url.href; img.alt = ''; img.loading = 'lazy';
        img.addEventListener('error',()=>img.replaceWith(builtInIcon(fallbackIcons[card.accent] || 'spark')),{once:true});
        return img;
      }
    } catch {}
  }
  return builtInIcon(iconPaths[card.icon] ? card.icon : fallbackIcons[card.accent] || 'spark');
}
function builtInIcon(name) {
  const svg = document.createElementNS(svgNS,'svg'); svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('fill','none'); svg.setAttribute('stroke','currentColor'); svg.setAttribute('stroke-width','1.5');
  svg.setAttribute('stroke-linecap','round'); svg.setAttribute('stroke-linejoin','round'); svg.setAttribute('aria-hidden','true');
  for (const d of iconPaths[name]) {const p = document.createElementNS(svgNS,'path'); p.setAttribute('d',d); svg.append(p);} return svg;
}
function effectText(effect, ownerIsYou = true) {
  const target = effect.target === 'self' ? (ownerIsYou ? 'you' : 'opponent') : (ownerIsYou ? 'opponent' : 'you');
  if (effect.type === 'damage') return `${effect.amount} damage to ${target}`;
  if (effect.type === 'heal') return `Heal ${target} for ${effect.amount}`;
  if (effect.type === 'energy') return `${effect.amount} energy to ${target}`;
  if (effect.type === 'steal') return `Steal ${effect.amount} energy from ${target}`;
  return `Poison ${target}: ${effect.amount} × ${effect.rounds} turns`;
}
function makeCard(card, index) {
  const button = document.createElement('button'); button.type = 'button';
  button.className = `battle-card accent-${card.accent || 'mixed'}`;
  button.dataset.cardId = card.id; button.setAttribute('aria-pressed', String(selected === card.id));
  button.classList.toggle('selected',selected === card.id);
  button.classList.toggle('unaffordable',card.cost > view.players[view.you].energy);
  button.style.setProperty('--card-index',index);
  const label = document.createElement('span'); label.className = 'card-slot'; label.textContent = `SLOT ${String(cards.indexOf(card)+1).padStart(2,'0')}`;
  const cost = document.createElement('span'); cost.className = 'card-cost'; cost.textContent = card.cost; cost.title = `${card.cost} energy`;
  const icon = document.createElement('span'); icon.className = 'card-icon'; icon.append(iconFor(card));
  const name = document.createElement('span'); name.className = 'card-name'; name.textContent = card.name;
  const description = document.createElement('span'); description.className = 'card-description'; description.textContent = card.description;
  const effects = document.createElement('span'); effects.className = 'card-effects';
  for (const effect of card.effects) {const line = document.createElement('span'); line.textContent = effectText(effect); effects.append(line);}
  button.append(label,cost,icon,name,description,effects);
  button.setAttribute('aria-label',`${card.name}, ${card.cost} energy. ${card.effects.map(effect => effectText(effect)).join('. ')}`);
  button.addEventListener('click',()=>{selected = selected === card.id ? null : card.id; renderHand(); updateControls();});
  return button;
}
function renderHand(previousHand = view.hand) {
  const focused = document.activeElement?.dataset?.cardId;
  const hand = $('hand'); const scroll = hand.scrollLeft;
  hand.replaceChildren(...view.hand.map((id,i)=>{const button=makeCard(cardMap.get(id),i);if(!previousHand.includes(id)){button.classList.add('card-enter');button.addEventListener('animationend',()=>button.classList.remove('card-enter'),{once:true});}return button;}));
  if(focused)hand.querySelector(`[data-card-id="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  hand.scrollLeft = scroll;
  $('hand-count').textContent = `${view.hand.length} cards`;
  $('deck-count').textContent = `${view.players[view.you].deckCount} in deck`;
}
function updateControls() {
  const ownTurn = view?.status === 'playing' && view.turn === view.you;
  const ready = ownTurn && (mode === 'bot' || connected) && !pending;
  const card = cardMap?.get(selected);
  $('play-card').disabled = !ready || !card || card.cost > view.players[view.you].energy;
  $('end-turn').disabled = !ready;
  $('play-card').textContent = card ? `Play card · ${card.cost} energy` : 'Play selected card';
  $('selection-hint').textContent = !connected && mode === 'online' ? 'Reconnecting to your match…' : pending ? 'Sending your move…' : view?.status === 'finished' ? 'Match complete' : !ownTurn ? (mode === 'bot' ? 'Bot is choosing a card…' : 'Waiting for your opponent') : card ? card.cost > view.players[view.you].energy ? `You need ${card.cost - view.players[view.you].energy} more energy` : card.effects.map(effect => effectText(effect)).join(' · ') : 'Select a card to inspect it, then play';
}
function animateChange(oldView, newView) {
  if (!oldView || oldView.revision === newView.revision) return;
  if(newView.lastEvent?.kind==='play'){const display=newView.lastEvent.actor===newView.you?0:1;const caster=$(`fighter-${display}`);caster.classList.remove('casting');void caster.offsetWidth;caster.classList.add('casting');setTimeout(()=>caster.classList.remove('casting'),600);}
  for(let display=0;display<2;display++) {
    const actor = display === 0 ? newView.you : 1-newView.you;
    const before = oldView.players[actor], after = newView.players[actor];
    const hpDelta = after.health-before.health, energyDelta = after.energy-before.energy;
    const fighter = $(`fighter-${display}`);
    const kind = hpDelta < 0 ? 'hit' : hpDelta > 0 ? 'healed' : energyDelta ? 'energized' : null;
    if (kind) {
      fighter.classList.remove('hit','healed','energized'); void fighter.offsetWidth; fighter.classList.add(kind);
      const float = document.createElement('span'); float.className = `combat-float ${kind}`;
      float.textContent = hpDelta ? `${hpDelta>0?'+':''}${hpDelta} HP` : `${energyDelta>0?'+':''}${energyDelta} energy`;
      fighter.append(float); setTimeout(()=>{float.remove();fighter.classList.remove(kind);},1100);
    }
  }
}
function renderOpponentPlays(previous) {
  const plays = (view.playedCards || []).filter(entry => entry.actor !== view.you);
  const latest = plays.at(-1);
  const empty = $('opponent-play-empty'), display = $('opponent-play-card');
  empty.hidden = Boolean(latest); display.hidden = !latest;
  $('opponent-play-history').hidden = plays.length < 2;
  if (!latest) { display.replaceChildren(); $('opponent-play-list').replaceChildren(); return; }
  const card = latest.card;
  const icon = document.createElement('span'); icon.className = 'played-icon'; icon.append(iconFor(card));
  const copy = document.createElement('div'); copy.className = 'played-copy';
  const title = document.createElement('strong'); title.textContent = card.name;
  const description = document.createElement('p'); description.textContent = card.description;
  const effects = document.createElement('p'); effects.className = 'played-effects'; effects.textContent = card.effects.map(effect => effectText(effect, false)).join(' · ');
  copy.append(title, description, effects);
  const cost = document.createElement('span'); cost.className = 'played-cost'; cost.textContent = `${card.cost} energy · round ${latest.round}`;
  display.className = `played-card accent-${card.accent}`; display.replaceChildren(icon, copy, cost);
  const oldLatest = (previous?.playedCards || []).filter(entry => entry.actor !== view.you).at(-1);
  if (oldLatest?.id !== latest.id) { display.classList.add('revealed'); display.addEventListener('animationend',()=>display.classList.remove('revealed'),{once:true}); }
  $('opponent-play-list').replaceChildren(...plays.slice(0,-1).reverse().map(entry => {
    const li = document.createElement('li'); const label = document.createElement('strong'); label.textContent = entry.card.name;
    const detail = document.createElement('span'); detail.textContent = `Round ${entry.round} · ${entry.card.effects.map(effect => effectText(effect, false)).join(' · ')}`;
    li.append(label, detail); return li;
  }));
}

function render(next) {
  const previous = view; view = next;
  if (selected && !view.hand.includes(selected)) selected = null;
  $('lobby').hidden = true; $('battle').hidden = false;
  const ownTurn = view.turn === view.you;
  $('turn-label').textContent = view.status === 'finished' ? 'Match complete' : ownTurn ? 'Your turn' : 'Opponent’s turn';
  $('turn-label').classList.toggle('your-turn',ownTurn && view.status === 'playing');
  $('round-label').textContent = `ROUND ${String(view.round).padStart(2,'0')}`;
  for(let display=0;display<2;display++) {
    const actor = display === 0 ? view.you : 1-view.you, p = view.players[actor];
    $(`player-name-${display}`).textContent = p.name;
    $(`player-hp-${display}`).textContent = `${p.health} / ${p.maxHealth}`;
    $(`hp-fill-${display}`).style.width = `${p.health/p.maxHealth*100}%`;
    $(`player-energy-${display}`).textContent = `${p.energy} / ${p.maxEnergy}`;
    const pips = Array.from({length:p.maxEnergy},(_,i)=>{const pip=document.createElement('span');pip.className=i<p.energy?'filled':'';return pip;});
    $(`energy-pips-${display}`).replaceChildren(...pips);
    const poison = $(`poison-${display}`); poison.hidden = !p.poison.length;
    poison.textContent = p.poison.length ? `Poison · ${p.poison.reduce((n,e)=>n+e.amount,0)} damage · ${Math.max(...p.poison.map(e=>e.remaining))} turns` : '';
    $(`fighter-${display}`).classList.toggle('poisoned',p.poison.length>0);
    $(`fighter-${display}`).classList.toggle('active-turn',view.status==='playing' && view.turn===actor);
  }
  const opponent = view.players[1-view.you];
  $('opponent-hand').replaceChildren(...Array.from({length:opponent.handCount},()=>{const back=document.createElement('span');back.className='card-back';back.setAttribute('aria-hidden','true');return back;}));
  $('opponent-hand').setAttribute('aria-label',`Opponent has ${opponent.handCount} hidden cards`);
  renderOpponentPlays(previous); renderHand(previous?.hand || []); updateControls(); animateChange(previous,view);
  $('activity-log').replaceChildren(...view.log.slice(-7).reverse().map(entry=>{const line=document.createElement('li');line.textContent=entry.text;line.className=`log-${entry.kind}`;return line;}));
  if (view.status==='finished' && previous?.status!=='finished') {
    const won=view.winner===view.you, draw=view.winner==='draw';
    $('result-title').textContent=draw?'A draw':won?'You win':'Match lost';
    $('result-description').textContent=draw?'Both fighters fell in the same exchange.':won?'The arena is yours. Ready for another round?':'A good duel. Try a different hand next time.';
    $('rematch').textContent=mode==='bot'?'Play bot again':'New online match';
    $('result-dialog').showModal(); clearTimeout(botTimer); if(mode==='online')clearSession();
  }
}
function act(action) {
  if(!view || view.status!=='playing')return;
  if(mode==='bot') {
    const result = applyAction(state,0,action,cards);
    if(!result.ok){message(result.error,true);return;}
    message('');render(viewFor(state,0)); scheduleBot();
  } else if(connected && socket?.readyState===WebSocket.OPEN && !pending) {
    pending=true; socket.send(JSON.stringify(action)); updateControls();
  }
}
function scheduleBot() {
  clearTimeout(botTimer);
  if(mode!=='bot'||state.status!=='playing'||state.turn!==1)return;
  botTimer=setTimeout(()=>{
    const result=applyAction(state,1,pickBotAction(state,1,cards),cards);
    if(!result.ok){message('Bot could not move. Start a new match.',true);return;}
    render(viewFor(state,0));scheduleBot();
  },850);
}
function startBot() {
  roomRequestVersion++; closeConnection();clearSession();mode='bot';selected=null;pending=false;connected=true;turnDeadline=null;
  const name=$('player-name').value.trim().slice(0,24)||'You';
  state=createGame(cards,{names:[name,'Practice bot']});view=null;
  $('battle-message').textContent='';render(viewFor(state,0));scheduleBot();
}
async function roomRequest(join) {
  const requestVersion=++roomRequestVersion;
  try {
    server=normalizeServer($('server-url').value || multiplayerServer);
  }catch {message('Enter your multiplayer server URL to play with a friend. Bot matches are available now.',true);$('server-url').closest('details').open=true;$('server-url').focus();return;}
  const code=$('room-code').value.trim().toUpperCase();
  if(join && !/^[A-Z0-9]{6}$/.test(code)){message('Enter the six-character room code.',true);$('room-code').focus();return;}
  $('create-room').disabled=$('join-room').disabled=true;
  message(join?'Joining room…':'Creating room…');
  try {
    const response=await fetch(`${server}/rooms${join?`/${code}/join`:''}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('player-name').value.trim().slice(0,24)||'Player'}),signal:AbortSignal.timeout(15000)});
    const data=await response.json();if(requestVersion!==roomRequestVersion)return;if(!response.ok)throw Error(data.error||'Could not open this room.');
    room=data.room||code;token=data.token;
    if(!/^[A-Z0-9]{6}$/.test(room)||typeof token!=='string'||!token)throw Error('The server returned an invalid room.');
    closeConnection();mode='online';view=null;selected=null;reconnectAttempt=0;
    rememberSession();connectRoom();
  }catch(error){if(requestVersion!==roomRequestVersion)return;message(error instanceof TypeError?'Could not reach the server. Check its URL and allowed website origins.':error.message,true);}
  finally{$('create-room').disabled=$('join-room').disabled=false;}
}
function waiting() {
  $('lobby').hidden=false;$('battle').hidden=true;$('friend-panel').hidden=true;$('waiting-panel').hidden=false;
  $('waiting-code').textContent=room;
  $('connection-status').textContent=connected?'Room connected · waiting for a friend':'Connecting to room…';
  $('lobby-message').textContent='Share the room code or invite link. Your match starts when your friend joins.';
}
function connectRoom() {
  intentionalClose=false;connected=false;pending=false;
  if(!view)waiting();else updateControls();
  const url=new URL(`${server}/rooms/${room}/socket`);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('token',token);
  socket=new WebSocket(url);
  socket.onopen=()=>{connected=true;reconnectAttempt=0;$('connection-status').textContent='Connected';if(view){message('Connected to room '+room);updateControls();}};
  socket.onmessage=event=>{
    let data;try{data=JSON.parse(event.data);}catch{return;}
    pending=false;
    if(data.type==='waiting'){waiting();}
    else if(data.type==='state'){
      turnDeadline = Number.isFinite(data.deadline) ? data.deadline : null;
      const otherConnected=data.connected?.[1-data.state.you];
      message(otherConnected===false?'Opponent disconnected. Waiting for them to return…':`Room ${room} · hands are private`);
      render(data.state);
      if(data.notice && data.state.status==='finished')$('result-description').textContent=data.notice;
      // render sets the battle visible; route the connection message to its status.
      $('battle-message').textContent=data.notice || (otherConnected===false?'Opponent disconnected. Waiting for them to return…':`Room ${room} · hands are private`);
      $('battle-message').classList.remove('error');
    }else if(data.type==='error'){message(data.error||'This move could not be played.',true);updateControls();}
  };
  socket.onclose=event=>{
    connected=false;pending=false;if(intentionalClose)return;
    updateControls();
    if(event.code===4002){showLobby();$('lobby-message').textContent='This match has expired or the game was updated. Create a new room.';return;}
    if(event.code===4001){message('This match was opened in another tab. Reload to reconnect here.',true);return;}
    if(view?.status==='finished')return;
    if(reconnectAttempt>=6){message('Connection lost. Reload this page to retry your saved match.',true);return;}
    message('Connection lost. Reconnecting…',true);
    reconnectTimer=setTimeout(connectRoom,Math.min(1000*2**reconnectAttempt++,10000));
  };
  socket.onerror=()=>message('Connection interrupted. Checking the room…',true);
}
async function copyInvite() {
  const url=new URL(location.href);url.hash='';url.search='';url.searchParams.set('room',room);
  if(server!==multiplayerServer.replace(/\/+$/,''))url.searchParams.set('server',server);
  try{await navigator.clipboard.writeText(url.href);$('lobby-message').textContent='Invite link copied. Send it to your friend.';}
  catch{$('lobby-message').textContent='Copy this invite link:';const input=document.createElement('input');input.value=url.href;input.readOnly=true;input.setAttribute('aria-label','Invite link');$('lobby-message').append(input);input.focus();input.select();}
}

$('play-bot').addEventListener('click',startBot);
$('friend-toggle').addEventListener('click',()=>{const open=$('friend-panel').hidden;$('friend-panel').hidden=!open;$('friend-toggle').setAttribute('aria-expanded',String(open));if(open)$('player-name').focus();});
$('create-room').addEventListener('click',()=>roomRequest(false));
$('join-room').addEventListener('click',()=>roomRequest(true));
$('room-code').addEventListener('input',()=>{$('room-code').value=$('room-code').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);});
$('copy-invite').addEventListener('click',copyInvite);$('cancel-room').addEventListener('click',showLobby);
$('play-card').addEventListener('click',()=>{if(selected)act({type:'play',cardId:selected});});
$('end-turn').addEventListener('click',()=>act({type:'end'}));
$('new-match').addEventListener('click',()=>{
  if(view?.status==='playing'&&!confirm('Leave this match? In an online duel, this concedes the game.'))return;
  if(mode==='online'&&view?.status==='playing'&&socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'concede'}));
  showLobby();
});
$('rules-button').addEventListener('click',()=>$('rules-dialog').showModal());
$('rules-close').addEventListener('click',()=>$('rules-dialog').close());
$('result-close').addEventListener('click',()=>$('result-dialog').close());
$('rematch').addEventListener('click',()=>{$('result-dialog').close();mode==='bot'?startBot():showLobby();});
$('log-toggle').addEventListener('click',()=>{const open=$('activity-log').hidden;$('activity-log').hidden=!open;$('log-toggle').setAttribute('aria-expanded',String(open));});

try {
  const response=await fetch(new URL('./cards.json',import.meta.url));if(!response.ok)throw Error('Card file could not be loaded.');
  cards=normalizeCards(await response.json());validateCards(cards);cardMap=new Map(cards.map(card=>[card.id,card]));
  $('play-bot').disabled=false;$('friend-toggle').disabled=false;
  $('server-url').value=multiplayerServer;
  const params=new URLSearchParams(location.search);
  if(params.has('room')) {
    $('room-code').value=(params.get('room')||'').toUpperCase().slice(0,6);$('friend-panel').hidden=false;$('friend-toggle').setAttribute('aria-expanded','true');
    if(params.has('server'))try{$('server-url').value=normalizeServer(params.get('server'));}catch{}
  } else {
    let saved;try{saved=JSON.parse(sessionStorage.getItem(sessionKey)||'null');}catch{}
    if(saved&&/^[A-Z0-9]{6}$/.test(saved.room)&&typeof saved.token==='string')try{server=normalizeServer(saved.server);room=saved.room;token=saved.token;mode='online';connectRoom();}catch{clearSession();}
  }
} catch(error) {message(`Game unavailable: ${error.message} Check the card definitions and reload.`,true);$('play-bot').disabled=$('friend-toggle').disabled=true;}

setInterval(()=>{
  if(!view || mode!=='online' || view.status!=='playing' || !turnDeadline)return;
  const seconds=Math.max(0,Math.ceil((turnDeadline-Date.now())/1000));
  $('round-label').textContent=`ROUND ${String(view.round).padStart(2,'0')} · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} left`;
},1000);
