import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(await readFile(file));}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/play/apex-drift.html`);
 assert.equal(await page.locator('#sT button').count(),3);assert.equal(await page.locator('#sC button').count(),4);
 await page.click('#favorite-game');assert.equal(await page.locator('#favorite-game').getAttribute('aria-pressed'),'true');
 await page.click('#sT button:nth-child(2)');await page.click('#sL button:nth-child(2)');await page.click('#sD button:nth-child(3)');await page.click('#sC button:nth-child(3)');await page.click('#go');
 await page.waitForFunction(()=>st==='race');
 assert.deepEqual(await page.evaluate(()=>({cars:cars.length,laps:LAPS,track:opt.t,color:cars[pi].col})),{cars:8,laps:5,track:1,color:'#ffbe0b'});
 const before=await page.evaluate(()=>({x:cars[pi].x,y:cars[pi].y}));
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(800);await page.keyboard.down('ArrowRight');await page.keyboard.down('Space');await page.waitForTimeout(400);await page.keyboard.up('Space');await page.keyboard.up('ArrowRight');await page.keyboard.up('ArrowUp');
 const after=await page.evaluate(()=>({x:cars[pi].x,y:cars[pi].y}));assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>20);
 await page.keyboard.press('p');assert.equal(await page.evaluate(()=>paused),true);await page.click('#race-pause');assert.equal(await page.evaluate(()=>paused),false);
 await page.keyboard.press('m');assert.equal(await page.locator('#race-sound').getAttribute('aria-pressed'),'true');
 await page.keyboard.press('r');assert.ok(await page.evaluate(()=>Math.hypot(cars[pi].vx,cars[pi].vy)<30));
 await page.screenshot({path:'/tmp/apex-drift-desktop.png'});
 if(process.env.APEX_CAPTURE_ART==='1'){
  const png=await page.evaluate(()=>{const original=hud;hud=()=>{};render(0);const preview=document.createElement('canvas');preview.width=600;preview.height=380;preview.getContext('2d').drawImage(cv,0,0,600,380);hud=original;return preview.toDataURL('image/png').split(',')[1];});
  await writeFile(path.join(root,'assets/apex-drift.png'),Buffer.from(png,'base64'));
 }
 await page.evaluate(()=>{const p=cars[pi];p.lap=1;p.mx=0;p.lt=0;tm=75.5;lapCheck(p);});
 assert.equal(await page.evaluate(()=>localStorage.getItem('apina-apex-records')),null);
 await page.click('#race-menu');await page.check('#remember-records');
 await page.click('#go');await page.evaluate(()=>saveRecord(1,74.25));
 await page.reload();assert.equal(await page.locator('#remember-records').isChecked(),true);await page.click('#sT button:nth-child(2)');await page.click('#go');assert.equal(await page.evaluate(()=>rec),74.25);
 await page.goto(`${base}/gdpr.html`);await page.click('#clear-records');assert.equal(await page.evaluate(()=>localStorage.getItem('apina-apex-records')),null);
 await page.goto(`${base}/index.html`);await page.fill('#search','Apex Drift');assert.equal(await page.locator('.game-card').count(),1);await page.locator('.card-title').click();await page.waitForURL(/apex-drift\.html$/);
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));
 await phone.goto(`${base}/play/apex-drift.html`);assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await phone.click('#go');await phone.waitForFunction(()=>st==='race');
 const accelerate=phone.locator('[data-key="ArrowUp"]');await accelerate.dispatchEvent('pointerdown',{pointerId:1});await phone.waitForTimeout(500);assert.ok(await phone.evaluate(()=>Math.hypot(cars[pi].vx,cars[pi].vy)>30));await accelerate.dispatchEvent('pointercancel',{pointerId:1});assert.equal(await phone.evaluate(()=>keys.ArrowUp),0);
 await phone.click('#race-pause');assert.equal(await phone.evaluate(()=>paused),true);await phone.click('#race-pause');assert.equal(await phone.evaluate(()=>paused),false);
 await phone.screenshot({path:'/tmp/apex-drift-mobile.png'});assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('PASS: race setup, 8 cars, keyboard driving/drifting, recovery, pause/mute, mobile controls, favorites, optional records, storage deletion and homepage launch.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
