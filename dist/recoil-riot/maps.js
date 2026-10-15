// Geometry is shared with the server. Every wall is solid; zones/decals are cosmetic.
const cover=(x,y,w,h,kind='container',color='#5b566e')=>({x,y,w,h,kind,color});
export const ARENA = {
 name:'The junkyard',width:1920,height:1280,
 zones:[
  {x:48,y:48,w:560,h:544,name:'SALVAGE ROW',color:'#35333e'},
  {x:736,y:64,w:480,h:448,name:'LOADING BAY',color:'#303748'},
  {x:1312,y:48,w:560,h:544,name:'TANK FARM',color:'#2d3b39'},
  {x:48,y:736,w:560,h:496,name:'SCRAP GARDEN',color:'#343a36'},
  {x:736,y:768,w:480,h:448,name:'THE WORKSHOP',color:'#3d343b'},
  {x:1312,y:736,w:560,h:496,name:'DEAD END DEPOT',color:'#38353f'}
 ],
 roads:[{x:624,y:24,w:80,h:1232},{x:1232,y:24,w:64,h:1232},{x:24,y:624,w:1872,h:80}],
 walls:[
  cover(160,128,144,56,'container','#71604f'),cover(448,128,64,96,'generator'),
  cover(128,320,80,48,'car','#8a6655'),cover(320,400,128,48,'container','#655575'),
  cover(96,496,48,48,'crate'),cover(512,336,48,112,'barrels'),
  cover(800,128,192,64,'container','#586e7b'),cover(1056,128,80,64,'crate'),
  cover(768,352,80,64,'crate'),cover(944,336,192,56,'container','#80624f'),
  cover(1408,112,64,64,'tank'),cover(1600,112,64,64,'tank'),cover(1760,272,64,64,'tank'),
  cover(1408,368,144,56,'container','#627266'),cover(1664,432,64,64,'barrels'),
  cover(832,576,64,96,'barrels'),cover(1008,576,112,48,'car','#a57c58'),
  cover(736,672,80,48,'crate'),cover(1088,688,80,48,'crate'),
  cover(96,816,128,48,'car','#76836c'),cover(352,784,80,80,'planter'),
  cover(160,1008,160,48,'container','#695f7d'),cover(480,1072,64,80,'crate'),
  cover(448,912,48,64,'barrels'),cover(64,1152,80,48,'planter'),
  cover(784,816,144,64,'container','#796051'),cover(1056,848,64,96,'generator'),
  cover(768,1056,80,64,'crate'),cover(944,1072,192,56,'container','#526d78'),
  cover(1376,800,80,48,'car','#89748b'),cover(1568,784,144,56,'container','#7b6951'),
  cover(1760,928,64,80,'crate'),cover(1376,1024,64,64,'tank'),
  cover(1536,1088,128,48,'container','#586b62'),cover(1760,1168,64,48,'barrels')
 ],
 spawns:[{x:352,y:272},{x:1728,y:624},{x:1728,y:208},{x:256,y:912},
  {x:960,y:256},{x:960,y:976},{x:576,y:656},{x:1360,y:656},
  {x:1120,y:480},{x:400,y:1136},{x:1504,y:944},{x:672,y:160}],
 health:[{x:352,y:320},{x:960,y:224},{x:1664,y:336},{x:320,y:944},
  {x:960,y:976},{x:1664,y:1024},{x:672,y:640},{x:1264,y:640}],
 decals:[
  {x:256,y:528,kind:'oil'},{x:1168,y:432,kind:'oil'},{x:1600,y:256,kind:'spill'},
  {x:1472,y:1168,kind:'spill'},{x:224,y:1120,kind:'weeds'},{x:528,y:816,kind:'weeds'},
  {x:112,y:240,kind:'tires'},{x:528,y:528,kind:'tires'},{x:1168,y:1040,kind:'tires'},
  {x:1440,y:496,kind:'pipes'},{x:1568,y:912,kind:'pipes'},{x:912,y:464,kind:'pallet'},
  {x:336,y:784,kind:'weeds'},{x:1552,y:176,kind:'spill'},{x:864,y:944,kind:'pallet'}
 ]
};
export const COLORS=['#b5f577','#b69bff','#ff998c','#74d5f4','#ffd76c','#f29bd4','#7ae2c7','#e2d4ad'];
