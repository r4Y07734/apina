// Original object art for cards 51–75. Names and descriptions never drive rendering.
export const EXPANSION_SCENES = Object.freeze([
  'coinflip','paperplane','depletion','precision','blessing','computer','bad-aim','stew',
  'anthem','impact','illness','donation','sacrifice','wedding','snack','feast','curry',
  'droplet','curse','breakup','surprise','roulette','pressure','snake','mystery-shot',
]);
const TAU=Math.PI*2;
const path=(ctx,points,fill)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.stroke();};
const ring=(ctx,x,y,r)=>{ctx.beginPath();ctx.arc(x,y,Math.max(.01,r),0,TAU);ctx.stroke();};
const line=(ctx,a,b)=>{ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();};

function paint(ctx,scene,t){
  ctx.strokeStyle='#edf5fb';ctx.lineWidth=2;ctx.lineJoin='round';ctx.lineCap='round';
  switch(scene){
    case 'coinflip':
      ctx.scale(Math.max(.12,Math.abs(Math.cos(t*TAU*3))),1);ctx.fillStyle='#dba63e';ctx.beginPath();ctx.arc(0,0,21,0,TAU);ctx.fill();ctx.stroke();ring(ctx,0,0,15);line(ctx,[-6,-7],[6,-7]);line(ctx,[0,-11],[0,11]);line(ctx,[-6,7],[6,7]);break;
    case 'paperplane':
      path(ctx,[[-25,-15],[27,0],[-25,17],[-12,1]],'#adcce6');path(ctx,[[-12,1],[27,0],[-6,23]],'#f0f5fa');line(ctx,[-12,1],[14,-2]);break;
    case 'bad-aim':
      path(ctx,[[-18,-6],[12,-6],[27,0],[12,6],[-18,6]],'#dce7ed');path(ctx,[[12,-6],[27,0],[12,6]],'#ef9a7d');path(ctx,[[-12,-6],[-23,-17],[-20,0],[-23,17],[-12,6]],'#748ca5');path(ctx,[[-19,-4],[-32-Math.sin(t*36)*4,0],[-19,4]],'#f2cb82');break;
    case 'computer':
      ctx.fillStyle='#263e56';ctx.fillRect(-22,-19,44,34);ctx.strokeRect(-22,-19,44,34);line(ctx,[0,15],[0,23]);line(ctx,[-12,23],[12,23]);ctx.fillStyle='#83e1d8';ctx.font='bold 15px monospace';ctx.textAlign='center';ctx.fillText('AI',0,4);for(let i=0;i<3;i++)line(ctx,[-15,-11+i*7],[-10,-11+i*7]);break;
    case 'stew':case 'curry':case 'feast':
      ctx.fillStyle=scene==='curry'?'#d6a148':'#78975b';ctx.beginPath();ctx.ellipse(0,-4,23,8,0,0,TAU);ctx.fill();ctx.stroke();path(ctx,[[-23,-4],[-15,18],[15,18],[23,-4]],'#42566b');for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-12+i*12,-13);ctx.quadraticCurveTo(-17+i*12,-20,-10+i*12,-28-Math.sin(t*10+i)*3);ctx.stroke();}break;
    case 'wedding':case 'breakup':
      ctx.strokeStyle='#f2d078';ctx.lineWidth=4;ring(ctx,-9,2,15);ring(ctx,9,2,15);if(scene==='breakup'){ctx.strokeStyle='#ff9b91';line(ctx,[-3,-22],[5,-9]);line(ctx,[5,-9],[-4,4]);line(ctx,[-4,4],[5,21]);}else path(ctx,[[6,-16],[9,-23],[13,-16]],'#c7ecff');break;
    case 'snack':
      path(ctx,[[-23,17],[23,17],[23,-14],[-23,0]],'#e5c867');path(ctx,[[-23,0],[8,-20],[23,-14]],'#fff0a3');ctx.strokeStyle='#a08039';ring(ctx,4,5,4);ring(ctx,-13,9,3);ring(ctx,15,10,3);break;
    case 'snake':
      ctx.strokeStyle='#b6dbe4';path(ctx,[[-7,-29],[7,-29],[7,-11],[24,19],[20,26],[-20,26],[-24,19],[-7,-11]],'#263e4b');
      ctx.strokeStyle='#99d77e';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-18,20);ctx.bezierCurveTo(35,24,-35,-5,8,-7);ctx.bezierCurveTo(24,-8,23,-22,12,-22);ctx.stroke();ctx.fillStyle='#e7f8be';ctx.beginPath();ctx.ellipse(10,-22,10,7,0,0,TAU);ctx.fill();ctx.fillStyle='#172d25';ctx.fillRect(13,-25,2,2);ctx.strokeStyle='#f29b90';ctx.lineWidth=1.5;line(ctx,[1,-22],[-8,-22]);break;
    case 'roulette':
      for(let i=0;i<6;i++){const a=i*TAU/6;ctx.fillStyle=i===Math.floor(t*18)%6?'#f39c78':'#354960';ctx.beginPath();ctx.arc(Math.cos(a)*14,Math.sin(a)*14,7,0,TAU);ctx.fill();ctx.stroke();}ring(ctx,0,0,25);break;
    case 'droplet':
      ctx.beginPath();ctx.moveTo(0,-25);ctx.bezierCurveTo(-30,7,-16,25,0,25);ctx.bezierCurveTo(16,25,30,7,0,-25);ctx.fillStyle='#88d4ee';ctx.fill();ctx.stroke();break;
    case 'donation':
      ctx.fillStyle='#b788d8';ctx.fillRect(-21,-10,42,31);ctx.strokeRect(-21,-10,42,31);ctx.fillStyle='#f3d284';ctx.fillRect(-3,-10,6,31);line(ctx,[-23,-11],[23,-11]);ctx.beginPath();ctx.moveTo(0,-11);ctx.bezierCurveTo(-32,-36,-23,-2,0,-11);ctx.bezierCurveTo(32,-36,23,-2,0,-11);ctx.stroke();break;
    case 'anthem':
      line(ctx,[-10,10],[-10,-20]);line(ctx,[-10,-20],[14,-25]);line(ctx,[14,-25],[14,5]);ctx.fillStyle='#c6a8ec';ctx.beginPath();ctx.ellipse(-16,13,8,5,-.3,0,TAU);ctx.ellipse(8,8,8,5,-.3,0,TAU);ctx.fill();break;
    case 'depletion':
      ctx.strokeRect(-15,-23,30,46);ctx.fillStyle='#758595';ctx.fillRect(-7,-27,14,4);ctx.strokeStyle='#f3a186';line(ctx,[-21,24],[21,-24]);break;
    case 'illness':case 'curse':case 'sacrifice':
      ring(ctx,0,0,16);for(let i=0;i<8;i++){const a=i*TAU/8;line(ctx,[Math.cos(a)*16,Math.sin(a)*16],[Math.cos(a)*26,Math.sin(a)*26]);}ctx.fillStyle='#abc974';for(const [x,y] of [[-5,-4],[6,-2],[0,7]]){ctx.beginPath();ctx.arc(x,y,3,0,TAU);ctx.fill();}break;
    case 'blessing':
      ctx.strokeStyle='#f5db98';ring(ctx,0,-10,18);for(let i=0;i<8;i++){const a=i*TAU/8;line(ctx,[Math.cos(a)*23,-10+Math.sin(a)*23],[Math.cos(a)*31,-10+Math.sin(a)*31]);}line(ctx,[-8,20],[8,20]);line(ctx,[0,12],[0,28]);break;
    case 'pressure':
      ctx.fillStyle='#7a96ad';ctx.fillRect(-19,-5,32,23);ctx.strokeRect(-19,-5,32,23);for(let i=0;i<4;i++){ctx.fillRect(-20+i*9,-17,8,13);ctx.strokeRect(-20+i*9,-17,8,13);}path(ctx,[[13,0],[25,4],[25,17],[13,18]],'#9ab6c9');break;
    case 'surprise':
      path(ctx,[[0,-27],[7,-8],[27,0],[7,8],[0,27],[-7,8],[-27,0],[-7,-8]],'#f5d68d');break;
    case 'impact':
      path(ctx,[[0,-25],[6,-10],[20,-19],[13,-4],[27,3],[11,8],[19,24],[3,15],[-9,27],[-10,10],[-27,7],[-13,-3],[-21,-18],[-5,-11]],'#eeae87');break;
    case 'mystery-shot':
      path(ctx,[[-18,-10],[14,-10],[24,0],[14,10],[-18,10]],'#b9a3e7');ring(ctx,0,0,6);line(ctx,[-29,-7],[-21,-7]);line(ctx,[-32,1],[-21,1]);line(ctx,[-28,9],[-21,9]);break;
    default:
      // Clear impact / aiming symbols for combat cards, independent of identity.
      ring(ctx,0,0,19);ring(ctx,0,0,7);for(let i=0;i<4;i++){const a=i*TAU/4;line(ctx,[Math.cos(a)*14,Math.sin(a)*14],[Math.cos(a)*28,Math.sin(a)*28]);}
  }
}

export function drawExpansionScene(ctx,frame){
  if(!EXPANSION_SCENES.includes(frame.scene))return false;
  const p=Math.max(0,Math.min(1,frame.progress)),from=frame.from,to=frame.to;
  const size=Math.max(30,Math.min(58,(to.size||80)*.6));
  const stationary=new Set(['coinflip','computer','stew','curry','feast','wedding','breakup','snack','roulette','snake','blessing','depletion','illness','curse','donation','anthem','sacrifice','surprise']);
  const travel=Math.min(1,p/.62),smooth=travel*travel*(3-2*travel);
  const x=stationary.has(frame.scene)?to.x:from.x+(to.x-from.x)*smooth;
  const y=stationary.has(frame.scene)?to.y-size*.3-Math.sin(p*Math.PI)*size*.6:from.y+(to.y-from.y)*smooth-Math.sin(travel*Math.PI)*size;
  ctx.save();ctx.globalAlpha*=Math.sin(p*Math.PI);ctx.translate(x,y);ctx.scale(size/48,size/48);
  if(frame.scene==='paperplane')ctx.scale(to.x<from.x?-1:1,1);
  if(frame.scene==='bad-aim')ctx.rotate(Math.sin(p*16)*.22);
  paint(ctx,frame.scene,p);ctx.restore();
  if(p>.48){const t=(p-.48)/.52;ctx.save();ctx.strokeStyle=frame.color;ctx.lineWidth=2;ctx.globalAlpha*=(1-t)*.7;ring(ctx,to.x,to.y,size*(.4+t*1.5));
    for(let i=0;i<8;i++){const a=i*TAU/8+p;line(ctx,[to.x+Math.cos(a)*size*t,to.y+Math.sin(a)*size*t],[to.x+Math.cos(a)*size*(t+.18),to.y+Math.sin(a)*size*(t+.18)]);}ctx.restore();}
  return true;
}
