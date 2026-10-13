const games = [
  {id:'cards',name:'Card PVP',category:'Strategy',mood:'Multiplayer',scene:'cards',badge:'NEW',order:9,description:"A turn-based card duel. Spend energy, combine effects and outplay a friend or the practice bot."},
  {id:'drift',name:'Sunset Drift',category:'Racing',mood:'Arcade',scene:'drift',badge:'',order:4,description:"Drive three routes with moving traffic, nitro, drift combos and timed checkpoints. Reach the 6 km finish with your car intact."},
  {id:'orbit',name:'Orbit',category:'Puzzle',mood:'Relaxing',scene:'orbit',badge:'',order:3,description:"Launch a probe through planetary gravity. Collect the beacons and reach the portal across five hand-built levels."},
  {id:'stack',name:'Stack Theory',category:'Puzzle',mood:'Quick play',scene:'stack',badge:'NEW',order:8,description:"Drop moving blocks onto the tower. Overhangs are cut away, and perfect placements build a streak."},
  {id:'neon',name:'Neon Run',category:'Action',mood:'Arcade',scene:'neon',badge:'',order:2,description:"Clear three city districts with three lives, double jumps and coins. Reach the finish at 2,400 m, or switch to Endless."},
  {id:'garden',name:'Pocket Garden',category:'Relaxing',mood:'Creative',scene:'garden',badge:'',order:5,description:"Grow through four seasons with changing harvest goals and watering needs. Planted beds carry over, and bulk watering helps manage a larger garden."},
  {id:'rally',name:'Dust Rally',category:'Racing',mood:'Arcade',scene:'rally',badge:'NEW',order:7,description:"Choose from four circuits with different layouts and road widths. Pass every checkpoint in order and complete two laps as quickly as possible."},
  {id:'pool',name:'Eight Ball Club',category:'Sports',mood:'Skill',scene:'pool',badge:'',order:1,description:"Clear the colored balls before the eight ball. Aim carefully and avoid pocketing the eight too early."},
  {id:'island',name:'Little Islands',category:'Adventure',mood:'Creative',scene:'island',badge:'NEW',order:6,description:"Explore three archipelagos with different bridge networks. Return five relics to each lighthouse to unlock the next chapter."}
];
const categories = [{name:'Strategy',symbol:'♠'},{name:'Action',symbol:'ϟ'},{name:'Adventure',symbol:'♧'},{name:'Racing',symbol:'↗'},{name:'Puzzle',symbol:'◇'},{name:'Sports',symbol:'◎'},{name:'Relaxing',symbol:'❋'}];
let saved;
try {saved = new Set(JSON.parse(localStorage.getItem('apina-favorites') || '[]'));} catch {saved = new Set();}
let view = 'discover', category = 'All games', search = '', sorting = 'featured', openedGame = null;
const $ = selector => document.querySelector(selector);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
let artNumber=0;
function art(scene) {
  const n = ++artNumber;
  let body = '';
  const stars = Array.from({length:32},(_,i)=>`<circle cx="${(i*97+43)%600}" cy="${(i*53+19)%360}" r="${i%3===0?1.5:.7}" fill="#faf4e2" opacity="${.2+(i%5)/10}"/>`).join('');
  const defs = `<defs><linearGradient id="bg${n}" x2=".8" y2="1"><stop stop-color="#354563"/><stop offset="1" stop-color="#131e38"/></linearGradient><radialGradient id="planet${n}" cx=".3" cy=".25" r=".8"><stop stop-color="#f7edc4"/><stop offset=".45" stop-color="#dcb796"/><stop offset="1" stop-color="#63667b"/></radialGradient><linearGradient id="sand${n}" x2=".8" y2="1"><stop stop-color="#e8b47c"/><stop offset="1" stop-color="#8d4b3b"/></linearGradient><linearGradient id="green${n}" x2=".8" y2="1"><stop stop-color="#c4d6a7"/><stop offset="1" stop-color="#667b54"/></linearGradient></defs>`;
  if(scene==='cards') body=`<rect width="600" height="380" fill="#192320"/><path d="M0 300h600M300 0v380" stroke="#b6c5b3" opacity=".07"/><g transform="translate(185 77) rotate(-14 70 115)"><rect width="140" height="218" rx="12" fill="#e3e6da"/><rect x="12" y="12" width="116" height="155" rx="7" fill="#33443b"/><path d="m69 45 6 33 33 6-33 6-6 33-6-33-33-6 33-6Z" fill="#b5e2c0"/><path d="M26 186h86m-86 11h48" stroke="#647265" stroke-width="4"/></g><g transform="translate(305 87) rotate(12 70 110)"><rect width="140" height="218" rx="12" fill="#dae1d8"/><rect x="12" y="12" width="116" height="155" rx="7" fill="#342d29"/><path d="m43 121 51-65 2-14-15 5-51 64m-1-16 28 22m-35 15 20-23" stroke="#dfa98a" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M26 186h86m-86 11h48" stroke="#647265" stroke-width="4"/></g><circle cx="102" cy="105" r="4" fill="#b5e2c0"/><circle cx="495" cy="274" r="4" fill="#dfa98a"/>`;
  if(scene==='orbit') body=`<rect width="600" height="380" fill="url(#bg${n})"/>${stars}<circle cx="410" cy="121" r="105" fill="url(#planet${n})"/><path d="M313 82q85 12 188-34M309 120q95 23 206-41M311 150q105 35 207-27M330 188q90 19 174-16" stroke="#858593" opacity=".32" stroke-width="8" fill="none"/><ellipse cx="409" cy="128" rx="172" ry="31" transform="rotate(-27 409 128)" fill="none" stroke="#f6dbba" stroke-width="13" opacity=".55"/><circle cx="129" cy="94" r="16" fill="#e6aa85"/><circle cx="540" cy="272" r="6" fill="#d1fa72"/><path d="M240 220q210-85 355 82" fill="none" stroke="#c4d1ed" stroke-width=".7" opacity=".25"/>`;
  if(scene==='drift') body=`<image href="assets/sunset-drift.png" width="600" height="380" preserveAspectRatio="xMidYMid slice"/>`;
  if(scene==='stack') {
    body='<rect width="600" height="380" fill="#d4cbc0"/><ellipse cx="318" cy="337" rx="170" ry="20" fill="#6e6459" opacity=".15"/>';
    for(let i=0;i<6;i++){let x=170+(i%2)*22,y=300-i*38;let colors=['#7186a0','#d2a288','#e4d592','#a3b898','#b4a0b7','#e6c1a3'];body+=`<path d="M${x} ${y}l155 12 100-44-155-12Z" fill="${colors[i]}"/><path d="M${x} ${y}v26l155 12v-26Z" fill="${colors[i]}"/><path d="M${x+155} ${y+12}l100-44v26l-100 44Z" fill="#222d37" opacity=".25"/><path d="M${x} ${y}l155 12 100-44" stroke="#fff" stroke-opacity=".4" fill="none"/>`;}
  }
  if(scene==='neon'){body=`<rect width="600" height="380" fill="#231b39"/><circle cx="380" cy="110" r="75" fill="#d8859f"/>`;for(let i=0;i<14;i++)body+=`<rect x="${i*50-20}" y="${100+(i*41)%115}" width="${30+i%3*8}" height="280" fill="${i%2?'#342443':'#191a33'}"/><path d="M${i*50-10} ${130+(i*41)%115}v80" stroke="#de7dc8" stroke-width="2" opacity=".45"/>`;body+=`<path d="M240 190 80 380h475L375 190Z" fill="#172c39"/><path d="m285 190-35 190m78-190 35 190" stroke="#58dacd" stroke-width="3"/><path d="M295 265v-33h20v33l19 26-11 10-20-25-13 25-10-6Z" fill="#eee9df"/><path d="m287 315-17 43m54-42 18 42" stroke="#d788d0" stroke-width="3" opacity=".5"/>`;}
  if(scene==='garden'){body=`<rect width="600" height="380" fill="#c6d1bd"/><circle cx="490" cy="77" r="47" fill="#efe5bf"/><ellipse cx="299" cy="321" rx="206" ry="31" fill="#758664" opacity=".17"/><path d="M112 283 300 192l189 91-188 76Z" fill="#b3c59b"/>`;[[180,215,1],[305,225,1.2],[405,260,.8]].forEach(([x,y,s],i)=>{body+=`<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="54" rx="46" ry="13" fill="#83996a" opacity=".4"/><path d="M-28 9h56l-8 45q-20 10-40 0Z" fill="${i%2?'#b68e78':'#dfb090'}"/><ellipse cy="9" rx="28" ry="9" fill="#6e7051"/><path d="M0 8v-63" stroke="#5e7951" stroke-width="5"/><ellipse cx="-15" cy="-31" rx="12" ry="28" transform="rotate(-40 -15 -31)" fill="#709069"/><ellipse cx="17" cy="-44" rx="13" ry="29" transform="rotate(38 17 -44)" fill="#91a675"/>${i===1?'<circle cy="-63" r="15" fill="#ece5b5"/><circle cy="-63" r="7" fill="#ca9d55"/>':''}</g>`;});}
  if(scene==='rally'){body=`<rect width="600" height="380" fill="url(#sand${n})"/><circle cx="446" cy="69" r="45" fill="#f0d1a1"/><path d="M0 202 72 124l100 41 90-58 95 83 93-44 150 68v166H0Z" fill="#b66e4c"/><path d="M0 313Q173 70 336 278T600 234" stroke="#dbb28c" stroke-width="96" fill="none"/><path d="M0 313Q173 70 336 278T600 234" stroke="#926745" stroke-width="2" stroke-dasharray="14 12" fill="none"/><g transform="translate(288 239) rotate(31)"><ellipse cy="14" rx="49" ry="15" fill="#664331" opacity=".3"/><rect x="-27" y="-24" width="54" height="65" rx="9" fill="#e9e1c8"/><rect x="-19" y="-5" width="38" height="29" rx="4" fill="#425551"/><path d="M-33-14v23m66-23v23m-66 15v18m66-18v18" stroke="#362f2b" stroke-width="9"/></g>`;}
  if(scene==='pool')body='<rect width="600" height="380" fill="#163e37"/><path d="M0 26h600M0 354h600" stroke="#c59469" stroke-width="28"/><path d="M0 45h600M0 335h600" stroke="#1d2d21" stroke-width="12"/><circle cx="420" cy="230" r="60" fill="#0c2722" opacity=".5"/><circle cx="410" cy="216" r="57" fill="#192626"/><circle cx="395" cy="200" r="23" fill="#ece9da"/><text x="395" y="209" text-anchor="middle" font-size="27" font-family="Arial" fill="#20302c">8</text><ellipse cx="390" cy="178" rx="20" ry="8" fill="#fff" opacity=".15"/><circle cx="195" cy="111" r="40" fill="#e9e6d2"/><ellipse cx="184" cy="98" rx="12" ry="6" fill="#fff" opacity=".6"/><path d="m-10 311 196-169" stroke="#dcbf8f" stroke-width="9"/><path d="m175 152 11-10" stroke="#d5e5df" stroke-width="7"/>';
  if(scene==='island'){body=`<rect width="600" height="380" fill="#b5c7cc"/><circle cx="474" cy="75" r="41" fill="#f5e2c1"/><path d="M0 311q85-60 191 0t196-1 213 0v70H0Z" fill="#dbe2db"/><ellipse cx="300" cy="311" rx="138" ry="15" fill="#8ca5a7" opacity=".35"/><path d="M135 204 286 127l164 83-158 76Z" fill="#b4c79b"/><path d="m135 204 157 82v55l-73-24-41-45Z" fill="#a29b84"/><path d="m292 286 158-76-59 89-99 42Z" fill="#758f78"/><path d="m276 204 53-28 58 31-54 26Z" fill="#ead6b0"/><path d="m329 176 58 31v-57l-58-30Z" fill="#d1b492"/><path d="m329 120-53 28v56l53-28Z" fill="#eee0c2"/><path d="m261 152 61-62 78 57-71 27Z" fill="#788786"/><rect x="287" y="168" width="15" height="26" fill="#6f7265"/><path d="m186 218 27-13v-48l-27 14Z" fill="#8fa478"/><circle cx="201" cy="146" r="31" fill="#8ea77b"/><circle cx="207" cy="132" r="24" fill="#a8bd8e"/>`;}
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${defs}${body}</svg>`;
}
function persist(){try{localStorage.setItem('apina-favorites',JSON.stringify([...saved]));}catch{toast('Collection saved for this visit.');}$('.saved-count').textContent=saved.size;}
function toast(message){const el=$('.toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),2200);}
function toggleSave(id){saved.has(id)?saved.delete(id):saved.add(id);persist();render();updateDialog();toast(saved.has(id)?'Added to favorites':'Removed from favorites');}
function render(){
  const list=games.filter(g=>(view!=='saved'||saved.has(g.id))&&(view!=='new'||g.badge==='NEW')&&(category==='All games'||g.category===category||g.mood===category)&&`${g.name} ${g.category} ${g.mood}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sorting==='name'?a.name.localeCompare(b.name):sorting==='new'||view==='new'?b.order-a.order:0);
  $('#game-grid').innerHTML=list.map(g=>`<article class="game-card"><button class="card-art-button" data-game="${g.id}" aria-label="Play ${g.name}">${art(g.scene)}${g.badge?`<span class="card-badge ${g.badge==='NEW'?'new':''}">${g.badge==='NEW'?'New':g.badge}</span>`:''}</button><button class="save-button ${saved.has(g.id)?'saved':''}" data-save="${g.id}" aria-label="${saved.has(g.id)?'Remove':'Save'} ${g.name}${saved.has(g.id)?' from':' to'} favorites" aria-pressed="${saved.has(g.id)}">${icon('heart')}</button><div class="card-info"><button class="card-title" data-game="${g.id}">${g.name}</button><div class="card-meta"><span class="category-name">${g.category}</span><span>${g.mood}</span><span class="card-index">${String(games.indexOf(g)+1).padStart(2,'0')}</span></div></div></article>`).join('');
  $('#catalog-counter').textContent=String(list.length).padStart(2,'0');$('#empty').hidden=list.length>0; if(!list.length){$('#empty h3').textContent=view==='saved'&&!search?'No favorites yet':'No matching games';$('#empty p').textContent=view==='saved'&&!search?'Use the heart on a game to save it here.':'Try a different search or category.';}$('#result-count').textContent=`${list.length} ${list.length===1?'game':'games'}`;
  $('#catalog-title').textContent=view==='saved'?'Favorites':view==='new'?'New games':category!=='All games'?`${category} games`:'All games';
  $('#catalog-eyebrow').textContent=view==='saved'?'KEEP THE GOOD ONES CLOSE':view==='new'?'SOMETHING NEW TO LOVE':'PICK UP & PLAY';
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  document.querySelectorAll('[data-category]').forEach(b=>{b.classList.toggle('active',b.dataset.category===category);b.setAttribute('aria-pressed',String(b.dataset.category===category));});
  $('.saved-count').textContent=saved.size;$('.featured').hidden=view!=='discover'||search!==''||category!=='All games';$('.intro').hidden=$('.featured').hidden;
}
function changeView(next){view=next;category='All games';search='';$('#search').value='';render();$('#catalog').scrollIntoView({behavior:'smooth'});closeMenu();}
function updateDialog(){if(!openedGame)return;$('#dialog-save span').textContent=saved.has(openedGame.id)?'Saved to favorites':'Save to favorites';$('#dialog-save').setAttribute('aria-pressed',String(saved.has(openedGame.id)));}
function openGame(id){const slugs={"cards":"card-pvp","drift": "sunset-drift", "orbit": "orbit", "stack": "stack-theory", "neon": "neon-run", "garden": "pocket-garden", "rally": "dust-rally", "pool": "eight-ball-club", "island": "little-islands"};if(slugs[id])location.href=`play/${slugs[id]}.html`;}
function closeMenu(){$('.sidebar').classList.remove('open');$('.mobile-menu').setAttribute('aria-expanded','false');}
$('#filters').innerHTML=['All games',...categories.map(c=>c.name)].map(c=>`<button class="filter ${c==='All games'?'active':''}" data-category="${c}">${c==='All games'?'All':c}</button>`).join('');
$('#side-categories').innerHTML=categories.map(c=>`<button class="side-category" data-category="${c.name}"><span class="category-symbol" aria-hidden="true">${c.symbol}</span>${c.name}</button>`).join('');
$('#orbit-art').innerHTML=art('orbit');$('#year').textContent=new Date().getFullYear();
document.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target)return;
  if(target.dataset.game)openGame(target.dataset.game);
  if(target.dataset.random)openGame(games[Math.floor(Math.random()*games.length)].id);
  if(target.dataset.save)toggleSave(target.dataset.save);
  if(target.dataset.view)changeView(target.dataset.view);
  if(target.dataset.category){category=target.dataset.category;render();$('#catalog').scrollIntoView({behavior:'smooth'});closeMenu();}
});
$('#search').addEventListener('input',event=>{search=event.target.value;render();if(search.length===1)$('#catalog').scrollIntoView({behavior:'smooth'});});
$('#sort').addEventListener('change',event=>{sorting=event.target.value;render();});
$('#surprise').addEventListener('click',()=>openGame(games[Math.floor(Math.random()*games.length)].id));
$('#reset').addEventListener('click',()=>changeView('discover'));$('#all-games').addEventListener('click',()=>changeView('discover'));
$('.mobile-menu').addEventListener('click',()=>{const opened=$('.sidebar').classList.toggle('open');$('.mobile-menu').setAttribute('aria-expanded',String(opened));});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();$('#search').focus();}if(event.key==='Escape')closeMenu();});
render();
window.addEventListener('storage', event => {
  if (event.key !== 'apina-favorites' && event.key !== null) return;
  try {
    const value = JSON.parse(localStorage.getItem('apina-favorites') || '[]');
    saved = new Set(Array.isArray(value) ? value : []);
  } catch {
    saved = new Set();
  }
  render();
  updateDialog();
});

