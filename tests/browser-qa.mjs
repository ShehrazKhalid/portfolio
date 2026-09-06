import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPortfolioServer} from '../server.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require('../.work/browser/node_modules/playwright'));}
const root=fileURLToPath(new URL('..',import.meta.url)),out=path.join(root,'qa'),site=process.env.QA_ROOT||path.join(root,'dist');
await mkdir(out,{recursive:true});const data=JSON.parse(await readFile(path.join(site,'data/portfolio.json'),'utf8'));
const report={date:new Date().toISOString(),transport:'Real local HTTP navigation in installed Chrome; WebGL2 desktop and emulated mobile.',checks:[],errors:[],failedRequests:[]};
function check(name,pass,detail){report.checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});console.log((pass?'PASS':'FAIL')+' '+name);}
const server=createPortfolioServer({root:site});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const chrome=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
let browser;
try{
 browser=await chromium.launch({...(chrome?{executablePath:chrome}:{}),headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 function observe(page){page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)report.failedRequests.push({url:r.url(),status:r.status()});});}
 const page=await context.newPage();observe(page);
 await page.goto(origin);check('Homepage has exactly 3 featured games',await page.locator('[data-project-card]').count()===3);
 await page.screenshot({path:path.join(out,'v6-home-desktop.png'),fullPage:true});
 await page.goto(origin+'/projects.html');check('Catalog contains 26 unique project cards',await page.locator('[data-project-card]').count()===26);
 await page.locator('#project-search').fill('thief');check('Thief search retains two distinct games',await page.locator('[data-project-card]:visible').count()===2);
 await page.locator('#reset-filters').click();await page.locator('#project-platform').selectOption('iOS');check('iOS filter selects the separate Apple app',await page.locator('[data-project-card]:visible').count()===1);
 for(const p of data.projects){
  await page.goto(origin+'/'+p.detailPage);
  const loaded=await page.locator('.project-detail img').evaluateAll(async images=>{await Promise.all(images.map(async i=>{i.loading='eager';try{await i.decode();}catch{}}));return images.every(i=>i.naturalWidth>0);});
  check(p.id+': complete local gallery, icon and estimate',loaded&&(await page.locator('[data-lightbox]').count())===p.media.screenshots.length&&(await page.locator('.detail-meta').innerText()).includes('ESTIMATED DEVELOPMENT TIME'));
 }
 await page.goto(origin+'/project-ballblast.html');await page.locator('[data-lightbox]').first().click();await page.keyboard.press('ArrowLeft');
 check('Lightbox wraps through all six Cannon Blast screenshots',(await page.locator('.lightbox-count').innerText())==='6 / 6');
 await page.keyboard.press('Escape');check('Lightbox restores keyboard focus',await page.locator('[data-lightbox]').first().evaluate(e=>e===document.activeElement));
 await page.goto(origin+'/3d-view.html?debug');await page.waitForFunction(()=>window.portfolioDebug?.ready,null,{timeout:45000});
 check('3D intro waits for a visitor click',await page.locator('#intro').isVisible());
 await page.locator('#start-button').click();await page.waitForTimeout(500);
 report.renderer=await page.evaluate(()=>portfolioDebug.game.engine.software?'Canvas':'WebGL2');check('Primary WebGL2 renderer starts',report.renderer==='WebGL2');
 check('Sound starts on the drive gesture',await page.evaluate(()=>portfolioDebug.game.audio.enabled&&portfolioDebug.game.audio.context.state==='running'));
 await page.evaluate(()=>portfolioDebug.travel('projects'));await page.waitForTimeout(1100);
 await page.screenshot({path:path.join(out,'v6-gallery-desktop.png')});
 check('Screen-space project labels are readable and clickable',await page.locator('.scene-label').count()>0);
 await page.locator('.scene-label').filter({hasText:'BloxStrike'}).click();check('Scene label opens its own project',await page.locator('#panel-title').innerText()==='BloxStrike');await page.keyboard.press('Escape');
 await page.evaluate(()=>portfolioDebug.travel('career-0'));await page.waitForTimeout(700);check('Career road shows first chapter',(await page.locator('#career-company').innerText()).includes('Gaminators'));
 await page.screenshot({path:path.join(out,'v6-career-desktop.png')});
 await page.evaluate(()=>portfolioDebug.travel('career-3'));await page.waitForTimeout(500);check('Career road reaches final chapter',(await page.locator('#career-company').innerText()).includes('OZI Technology'));
 await page.evaluate(()=>portfolioDebug.travel('career-1'));await page.waitForTimeout(500);check('Career road rewinds when travelling backwards',(await page.locator('#career-company').innerText()).includes('Mania'));
 await page.evaluate(()=>{const g=portfolioDebug.game;g.travel('blast-yard');const a=g.audio.context.createAnalyser();g.audio.master.connect(a);window.qaAudio=a;});await page.waitForTimeout(1100);
 const baseFov=await page.evaluate(()=>portfolioDebug.game.camera.fov);await page.screenshot({path:path.join(out,'v6-tnt-before.png')});
 await page.keyboard.down('KeyW');await page.waitForFunction(()=>portfolioDebug.game.world.destruction.stats.explosions>0,null,{timeout:6000});await page.keyboard.up('KeyW');await page.waitForTimeout(100);
 const blast=await page.evaluate(()=>{const g=portfolioDebug.game,a=new Float32Array(qaAudio.fftSize);qaAudio.getFloatTimeDomainData(a);return {fov:g.camera.fov,audioPeak:Math.max(...a.map(Math.abs)),particles:g.world.destruction.particles.filter(p=>p.active).length,simTime:g.simTime};});
 check('Keyboard-driven TNT collision produces debris',blast.particles>20);check('TNT camera zoom narrows the view',blast.fov<baseFov*.98);check('Explosion produces an audible signal',blast.audioPeak>.001,blast.audioPeak);
 await page.screenshot({path:path.join(out,'v6-tnt-explosion.png')});await page.waitForTimeout(300);const sim=await page.evaluate(()=>portfolioDebug.game.simTime);check('Blast slows the fixed-step simulation',sim-blast.simTime<.25,sim-blast.simTime);
 await page.waitForFunction(()=>portfolioDebug.game.world.destruction.stats.explosions===3,null,{timeout:6000});check('Nearby TNT crates create a three-crate chain reaction',true);
 await page.waitForTimeout(2100);check('Blast camera returns to its normal field of view',Math.abs((await page.evaluate(()=>portfolioDebug.game.camera.fov))-baseFov)<.01);
 await page.evaluate(()=>portfolioDebug.game.action('reset-props'));check('Reset restores every TNT, tree and pole',await page.evaluate(()=>portfolioDebug.game.world.destruction.props.every(p=>!p.broken&&p.body.enabled)));
 await page.evaluate(()=>{const g=portfolioDebug.game,p=g.world.destruction.props.find(p=>p.kind==='tree'&&p.position[0]===-8);g.vehicle.reset([-8,3,44]);g.blastAge=99;});await page.waitForTimeout(500);
 await page.keyboard.down('KeyW');await page.waitForFunction(()=>portfolioDebug.game.world.destruction.stats.trees>0,null,{timeout:6000});await page.keyboard.up('KeyW');check('Real keyboard driving breaks a tree',true);
 await page.screenshot({path:path.join(out,'v6-tree-break.png')});
 await page.evaluate(()=>portfolioDebug.game.setting('audio',false));check('Mute disables explosion and break audio',await page.evaluate(()=>!portfolioDebug.game.audio.enabled));
 await page.evaluate(()=>{const g=portfolioDebug.game;g.setting('reducedMotion',true);g.blastAge=.2;g.updateCamera(.016);});check('Reduced-motion preference suppresses camera zoom',Math.abs((await page.evaluate(()=>portfolioDebug.game.camera.fov))-baseFov)<.01);
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const touch=await mobile.newPage();observe(touch);
 await touch.goto(origin);await touch.locator('.mobile-menu-toggle').tap();check('Mobile navigation opens with touch',await touch.locator('#site-nav').isVisible());check('Mobile homepage fits the viewport',await touch.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await touch.screenshot({path:path.join(out,'v6-home-mobile.png'),fullPage:true});
 await touch.goto(origin+'/3d-view.html?debug');await touch.waitForFunction(()=>window.portfolioDebug?.ready,null,{timeout:45000});await touch.locator('#start-button').tap();await touch.evaluate(()=>portfolioDebug.travel('projects'));await touch.waitForTimeout(1000);
 check('Mobile driving controls and TNT shortcut are visible',await touch.locator('#joystick').isVisible()&&await touch.locator('#explore-shortcuts [data-id="blast-yard"]').isVisible());
 check('Mobile shortcuts fit within the viewport',await touch.locator('#explore-shortcuts').evaluate(e=>{const b=e.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&e.scrollWidth<=e.clientWidth;}));
 await touch.screenshot({path:path.join(out,'v6-gallery-mobile.png')});
 await touch.evaluate(()=>portfolioDebug.travel('career-0'));await touch.waitForTimeout(650);check('Mobile career story remains readable',await touch.locator('#career-story').isVisible());
 await touch.screenshot({path:path.join(out,'v6-career-mobile.png')});await touch.locator('#career-dismiss').tap();check('Career story can collapse on mobile',await touch.locator('#career-overlay').evaluate(e=>e.classList.contains('compact')));
 await mobile.close();await context.close();
 // Also exercise the fallback path with WebGL explicitly unavailable.
 const fallback=await browser.newContext({viewport:{width:800,height:600}});await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};});
 const compat=await fallback.newPage();observe(compat);await compat.goto(origin+'/3d-view.html?debug');await compat.waitForFunction(()=>window.portfolioDebug?.ready,null,{timeout:45000});await compat.locator('#start-button').click();check('Canvas compatibility renderer still starts',await compat.evaluate(()=>portfolioDebug.game.engine.software));await fallback.close();
 check('No uncaught browser exceptions',report.errors.length===0,report.errors);check('No missing local HTTP resources',report.failedRequests.length===0,report.failedRequests);
}catch(error){report.errors.push(error.stack);check('Browser QA completed',false,error.message);}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));report.pass=report.checks.every(c=>c.pass)&&!report.errors.length;await writeFile(path.join(out,'v6-browser-tests.json'),JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;console.log(`${report.checks.filter(c=>c.pass).length}/${report.checks.length} checks passed.`);}
