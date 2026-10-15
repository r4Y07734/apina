const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({...(process.env.RIOT_PROXY?{proxy:{server:process.env.HTTPS_PROXY||process.env.HTTP_PROXY}}:{}),executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:1060}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.RIOT_BASE_URL||'http://127.0.0.1:8000';
 await page.goto(base+'/play/recoil-riot.html'+(base.includes('127.0.0.1')?'?server=http://127.0.0.1:8788':''),{waitUntil:'networkidle'});await page.screenshot({path:'/tmp/recoil-riot-lobby.png',fullPage:true});
 assert.equal(await page.locator('.weapon').count(),6);await page.click('#practice');await page.waitForTimeout(200);assert.ok(await page.locator('#lobby').isHidden());assert.equal(await page.locator('#scoreboard li').count(),4);
 await page.keyboard.press('2');assert.equal(await page.locator('.weapon.active strong').textContent(),'Banana Blaster');
 const box=await page.locator('#arena').boundingBox();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.5);await page.mouse.down();await page.waitForTimeout(300);await page.mouse.up();assert.ok(!((await page.locator('#ammo').textContent()).startsWith('36 /')));
 await page.keyboard.press('Escape');assert.ok(await page.locator('#paused').isVisible());await page.keyboard.press('Escape');assert.ok(await page.locator('#paused').isHidden());
 await page.keyboard.press('1');await page.keyboard.down('d');await page.waitForTimeout(400);await page.keyboard.up('d');await page.screenshot({path:'/tmp/recoil-riot-playing.png',fullPage:true});
 await page.click('#leave');await page.click('#online-toggle');await page.fill('#nickname','Browser QA');await page.click('#create');await page.waitForFunction(()=>document.querySelector('#mode').textContent.includes('ONLINE'),{timeout:15000});
 const invite=page.url(),other=await context.newPage();await other.goto(invite,{waitUntil:'domcontentloaded'});await other.fill('#nickname','Second browser');await other.locator('#room-form button[type=submit]').click();await other.waitForFunction(()=>document.querySelector('#mode').textContent.includes('ONLINE'),{timeout:15000});await page.waitForTimeout(500);assert.ok((await page.locator('#scoreboard').textContent()).includes('Second browser'));
 await page.screenshot({path:'/tmp/recoil-riot-online.png',fullPage:true});await other.close();await page.click('#leave');
 for(const width of [1280,1024,700]){await page.setViewportSize({width,height:900});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow at '+width);}
 await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});await page.locator('#search').fill('Recoil Riot');assert.equal(await page.locator('.game-card').count(),1);await page.locator('.card-title').click();await page.waitForURL(/\/play\/recoil-riot(?:\.html)?$/);
 assert.deepEqual(errors,[]);console.log('PASS: lobby, six weapons, firing, pause, movement, online invite/two browsers, laptop layouts, catalog navigation; no browser exceptions.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
