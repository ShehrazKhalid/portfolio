from pathlib import Path
from urllib.parse import urlparse,unquote
from playwright.sync_api import sync_playwright
import mimetypes,json,time
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'qa';OUT.mkdir(exist_ok=True);report={'transport':'In-page local fixtures; browser URL navigation is administrator-blocked. HTML/JS/assets served via Playwright route fixtures, not a live deployment.','checks':[],'errors':[],'missing':[],'externalRequests':[]}
def check(name,value,detail=None):
 report['checks'].append({'name':name,'pass':bool(value),'detail':detail});print(('PASS' if value else 'FAIL'),name,detail or '',flush=True);(OUT/'browser-tests.json').write_text(json.dumps(report,indent=2))
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 def page_for(name,mobile=False):
  page=browser.new_page(viewport={'width':390,'height':844} if mobile else {'width':1440,'height':1000},is_mobile=mobile,has_touch=mobile,device_scale_factor=1)
  page.set_default_timeout(6000)
  page.on('pageerror',lambda e:report['errors'].append(str(e)))
  def route(r):
   u=urlparse(r.request.url)
   if u.hostname!='portfolio.test':report['externalRequests'].append(r.request.url);r.abort();return
   f=ROOT/(unquote(u.path).lstrip('/') or 'index.html')
   if f.is_file():r.fulfill(status=200,body=f.read_bytes(),headers={'Content-Type':mimetypes.guess_type(str(f))[0] or 'application/octet-stream','Access-Control-Allow-Origin':'*'})
   else:report['missing'].append(str(f));r.fulfill(status=404,body='Not found',headers={'Access-Control-Allow-Origin':'*'})
  page.route('**/*',route);page.evaluate('window.__PORTFOLIO_TEST__=true')
  html=(ROOT/name).read_text().replace('<head>','<head><base href="https://portfolio.test/">',1)
  page.set_content(html,wait_until='networkidle');page.wait_for_timeout(300)
  return page
 home=page_for('index.html');check('Home has exactly the first three projects',home.locator('[data-project-card]').count()==3)
 home.locator('img[src]').evaluate_all('(xs)=>xs.forEach(x=>x.loading="eager")');home.wait_for_function('Array.from(document.querySelectorAll("img[src]")).every(x=>x.complete&&x.naturalWidth>0)');check('Home contains local first-three images',home.locator('img[src]').evaluate_all('(xs)=>xs.every(x=>x.complete&&x.naturalWidth>0)'))
 check('Homepage has no horizontal overflow',home.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 home.screenshot(path=str(OUT/'01-home-desktop.png'),full_page=True);home.close()
 projects=page_for('projects.html');check('Project page contains all 26 unique projects',projects.locator('[data-project-card]').count()==26)
 projects.locator('#project-search').fill('thief');check('Thief search keeps two distinct game packages',projects.locator('[data-project-card]:visible').count()==2)
 projects.locator('#reset-filters').click();projects.locator('#project-platform').select_option('iOS');check('Platform filter selects one iOS listing',projects.locator('[data-project-card]:visible').count()==1)
 projects.locator('#project-platform').select_option('');projects.locator('#project-category').select_option('Puzzle');check('Genre filter selects three puzzle games',projects.locator('[data-project-card]:visible').count()==3)
 projects.locator('#project-search').fill('not-a-project-123');check('No results has a visible helpful state',projects.locator('#empty-projects').is_visible());projects.close()
 for slug,expected in [('ballblast','5 working days'),('thief','About 1 month')]:
  page=page_for('project-'+slug+'.html');check(slug+' has the correct duration',expected in page.locator('.detail-meta').inner_text());check(slug+' no copied 5v5 description','5v5' not in page.locator('.project-detail').inner_text());page.close()
 detail=page_for('project-cubeshooter.html');detail.locator('[data-lightbox]').first.click();check('Detail gallery opens a real image viewer',detail.locator('.media-lightbox').is_visible());detail.keyboard.press('ArrowRight');check('Image viewer next key updates count',detail.locator('.lightbox-count').inner_text()=='2 / 4');detail.keyboard.press('Escape');check('Escape closes image viewer and restores focus',not detail.locator('.media-lightbox').is_visible() and detail.locator('[data-lightbox]').first.evaluate('(x)=>x===document.activeElement'));detail.close()
 profile=page_for('profile.html');check('Profile includes full contact information',all(v.lower() in profile.locator('main').inner_text().lower() for v in ['+923044744082','shehrazkhalid786@gmail.com','LinkedIn','Shehraz Khalid']));profile.close()
 world=page_for('3d-view.html');world.wait_for_function('window.portfolioDebug?.ready',timeout=30000)
 check('Onboarding is visible until user starts',world.locator('#intro').is_visible() and not world.evaluate('portfolioDebug.game.started'))
 world.locator('#start-button').click();world.wait_for_timeout(1500);check('Start reveals the driving world',not world.locator('#intro').is_visible() and world.locator('#hud').evaluate('(el)=>!el.hidden'))
 report['renderer']=world.evaluate('portfolioDebug.game.engine.software ? "Canvas compatibility renderer" : "WebGL2"')
 check('All scene project textures loaded',world.evaluate('portfolioDebug.game.world.projectExhibits.every(e=>e.screen.texture && e.icon.texture && e.screen.emissive===.32)'))
 world.evaluate("portfolioDebug.travel('about')");world.wait_for_timeout(1000)
 start=world.evaluate('portfolioDebug.snapshot().position');world.keyboard.down('KeyW');world.wait_for_timeout(650);world.keyboard.up('KeyW');end=world.evaluate('portfolioDebug.snapshot().position');check('Actual keyboard input moves the car',sum((a-b)**2 for a,b in zip(start,end))>0.05,{'before':start,'after':end})
 # Click the actual projected name sign, not a direct call to UI.show.
 world.evaluate("portfolioDebug.travel('about')");world.wait_for_timeout(1800)
 name=world.evaluate("(()=>{const g=portfolioDebug.game,t=g.world.hotspots.find(t=>t.id==='about'&&t.mesh.scale[0]>2);return {screen:g.engine.project(t.mesh.position),pick:g.experience.pick(...Object.values(g.engine.project(t.mesh.position)))?.id};})()")
 if name['screen']:
  world.mouse.click(name['screen']['x'],name['screen']['y']);world.wait_for_timeout(250)
 check('Clicking the 3D name board opens the basic profile',world.evaluate('portfolioDebug.game.ui.kind')=='about',name)
 if world.locator('#panel').is_visible():world.locator('#close-panel').click()
 world.evaluate("portfolioDebug.travel('projects')");world.wait_for_timeout(2300)
 world.screenshot(path=str(OUT/'04-project-exhibition.png'))
 target=world.evaluate("(()=>{const g=portfolioDebug.game,e=g.world.projectExhibits[0];const p=g.engine.project(e.screen.position);return {screen:p,pick:g.experience.pick(p.x,p.y)?.id};})()")
 world.mouse.click(target['screen']['x'],target['screen']['y']);world.wait_for_timeout(250)
 check('Clicking a physical project screenshot opens its full story',world.evaluate('portfolioDebug.game.ui.kind')=='project' and world.locator('#panel-title').inner_text()=='BloxStrike',target)
 if world.locator('#panel').is_visible():
  check('World project panel contains local gallery images',world.locator('#panel [data-lightbox]').count()==4)
  world.locator('#panel [data-lightbox]').first.click();check('World gallery enlarges screenshots',world.locator('.media-lightbox').is_visible());world.keyboard.press('Escape');check('Lightbox closes without closing the project panel',world.locator('#panel').is_visible());world.keyboard.press('Escape')
 # Single continuous physics drive; log chapters at actual changing vehicle positions.
 world.evaluate("portfolioDebug.travel('career-road')");world.wait_for_timeout(1400)
 world.screenshot(path=str(OUT/'05-career-start.png'))
 drive=world.evaluate("""(()=>{const g=portfolioDebug.game,seen=[];g.vehicle.controls={throttle:1,steer:0,boost:false,brake:false};for(let i=0;i<1800;i++){g.step();if(g.activeCareer>=0&&!seen.includes(g.activeCareer))seen.push(g.activeCareer);if(g.vehicle.body.p[0]>48)break;}g.vehicle.controls={throttle:0,steer:0,boost:false,brake:true};g.vehicle.body.v=[0,0,0];g.vehicle.body.w=[0,0,0];g.experience.update();g.camera.position=[g.vehicle.body.p[0]+6,20,-46];g.camera.target=[g.vehicle.body.p[0]+3,3,-60];return {seen,position:[...g.vehicle.body.p]};})()""")
 check('A continuous physics drive crosses all four career chapters',drive['seen']==[0,1,2,3],drive)
 world.wait_for_timeout(700);check('Career HUD reflects final company',world.locator('#career-company').inner_text()=='OZI Technology')
 world.screenshot(path=str(OUT/'06-career-ozi.png'))
 world.locator('#career-read').click();world.wait_for_timeout(150);check('Career read button opens full experience with selected chapter',world.locator('.career-entry.is-selected h3').inner_text()=='OZI Technology');world.keyboard.press('Escape')
 # Actual reverse gear over the same unobstructed lane.
 reverse=world.evaluate("""(()=>{const g=portfolioDebug.game,seen=[];g.vehicle.reset([48,3,-58],-Math.PI/2);g.vehicle.controls={throttle:-1,steer:0,boost:false,brake:false};for(let i=0;i<2000;i++){g.step();if(g.activeCareer>=0&&!seen.includes(g.activeCareer))seen.push(g.activeCareer);if(g.vehicle.body.p[0]<-42)break;}g.vehicle.controls={throttle:0,steer:0,boost:false,brake:true};g.vehicle.body.v=[0,0,0];g.vehicle.body.w=[0,0,0];g.experience.update();g.camera.position=[g.vehicle.body.p[0]+6,20,-46];g.camera.target=[g.vehicle.body.p[0]+3,3,-60];return {seen,position:[...g.vehicle.body.p]};})()""")
 check('Reversing through the lane rewinds all career chapters',reverse['seen']==[3,2,1,0],reverse)
 world.wait_for_timeout(500);check('Reverse HUD returns to first employer','Gaminators' in world.locator('#career-company').inner_text())
 world.evaluate("portfolioDebug.travel('skills')");world.wait_for_timeout(200);check('Leaving career lane hides career overlay',not world.locator('#career-overlay').is_visible())
 world.evaluate("portfolioDebug.game.ui.show('map')");check('Map contains a working career-road destination',world.locator('#panel .career-map-stop').is_visible());world.locator('#panel .career-map-stop').click();world.wait_for_timeout(200);check('Map travel enters career lane',world.evaluate('portfolioDebug.game.activeCareer')==0)
 world.close()
 mobile=page_for('index.html',True);check('Mobile homepage has no horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'));mobile.locator('.mobile-menu-toggle').click();check('Mobile navigation opens',mobile.locator('.site-nav').is_visible());mobile.locator('.mobile-menu-toggle').click();mobile.screenshot(path=str(OUT/'07-home-mobile.png'),full_page=True);mobile.close()
 mobileproj=page_for('project-thief.html',True);check('Mobile project details fit width',mobileproj.evaluate('document.documentElement.scrollWidth<=innerWidth'));mobileproj.screenshot(path=str(OUT/'08-thief-mobile.png'),full_page=True);mobileproj.close()
 mobileworld=page_for('3d-view.html',True);mobileworld.wait_for_function('window.portfolioDebug?.ready',timeout=30000);mobileworld.locator('#start-button').click();mobileworld.wait_for_timeout(700);mobileworld.evaluate("portfolioDebug.travel('projects')");mobileworld.wait_for_timeout(1300)
 check('Mobile touch controls appear',mobileworld.locator('#joystick').is_visible())
 # Center icon is tappable in portrait; a separate test checks screens on desktop.
 xy=mobileworld.evaluate("(()=>{const g=portfolioDebug.game,e=g.world.projectExhibits[1];const p=g.engine.project(e.icon.position);return {x:p.x,y:p.y,pick:g.experience.pick(p.x,p.y)?.id};})()")
 mobileworld.screenshot(path=str(OUT/'09-projects-world-mobile.png'))
 mobileworld.touchscreen.tap(xy['x'],xy['y']);mobileworld.wait_for_timeout(300)
 check('Mobile tap on physical project icon opens Cannon Blast details',mobileworld.evaluate('portfolioDebug.game.ui.kind')=='project' and 'Cannon' in mobileworld.locator('#panel-title').inner_text(),xy)
 if mobileworld.locator('#panel').is_visible():mobileworld.locator('#close-panel').click()
 mobileworld.evaluate("portfolioDebug.travel('career-road')");mobileworld.wait_for_timeout(1300)
 check('Mobile career narrative visible',mobileworld.locator('#career-overlay').is_visible())
 mobileworld.screenshot(path=str(OUT/'10-career-mobile.png'));mobileworld.close()
 browser.close()
check('No uncaught browser exceptions',not report['errors'],report['errors'])
check('No missing local runtime assets',not report['missing'],report['missing'])
check('No external runtime font/image/CDN requests',not report['externalRequests'],report['externalRequests'])
report['passed']=sum(c['pass'] for c in report['checks']);report['total']=len(report['checks']);(OUT/'browser-tests.json').write_text(json.dumps(report,indent=2))
print('RESULT',report['passed'],'/',report['total'])
