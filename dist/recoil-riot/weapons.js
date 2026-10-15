// Weapon balance lives here. The simulation and server use the same definitions.
export const WEAPONS = [
  {id:'kickback', name:'Kickback 9000', short:'KICKBACK', flavor:'The shotgun that shoots you, too.', color:'#ffb86b', kind:'shotgun', damage:13, pellets:7, spread:.25, speed:570, life:.50, cooldown:.8, recoil:540, knockback:90, magazine:5, reload:1.4, radius:2},
  {id:'banana', name:'Banana Blaster', short:'BANANA', flavor:'Freshly squeezed chaos. High rate of squirt.', color:'#f3ec86', kind:'squirt', damage:7, pellets:1, spread:.065, speed:480, life:.95, cooldown:.085, recoil:16, knockback:20, magazine:36, reload:1.3, radius:2},
  {id:'ketchup', name:'Ketchup Catapult', short:'KETCHUP', flavor:'An explosive serving of questionable sauce.', color:'#ff6d79', kind:'blob', damage:34, pellets:1, spread:.025, speed:285, life:1.05, cooldown:.72, recoil:105, knockback:230, magazine:4, reload:1.6, radius:5, splash:64},
  {id:'duck', name:'Quack Attack', short:'QUACK', flavor:'Rubber ducks. Real ricochets. Zero dignity.', color:'#ffda62', kind:'duck', damage:17, pellets:1, spread:.035, speed:370, life:2.0, cooldown:.31, recoil:45, knockback:90, magazine:9, reload:1.25, radius:4, bounces:3},
  {id:'party', name:'Party Pooper', short:'PARTY', flavor:'Everybody gets confetti. Nobody gets a refund.', color:'#bc9cff', kind:'confetti', damage:6, pellets:4, spread:.31, speed:440, life:.72, cooldown:.22, recoil:40, knockback:25, magazine:14, reload:1.4, radius:2},
  {id:'glove', name:'Personal Space', short:'BOXING', flavor:'A boxing glove on a very bad idea.', color:'#8ae5d8', kind:'glove', damage:38, pellets:1, spread:0, speed:600, life:.25, cooldown:.65, recoil:80, knockback:520, magazine:6, reload:1.4, radius:6}
];
