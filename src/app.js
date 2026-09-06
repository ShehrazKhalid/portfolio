import {WorldExperience} from './world-experience.js';
import {blastEnvelope} from './destruction.js';
import {careerIndexAt} from './career.js';
import {Engine} from './engine.js';
import {CanvasEngine} from './canvas-engine.js';
import {PhysicsWorld,Vehicle} from './physics.js';
import {PortfolioWorld,createRover,STATIONS,RACE_POINTS} from './world.js';
import {Input} from './input.js';
import {AudioSystem} from './audio.js';
import {SaveStore,CommunityService} from './storage.js';
import {UI,ACHIEVEMENTS} from './ui.js';
import {heightAt} from './terrain.js';
import {add,mul,mix3,qRotate,clamp,distanceXZ,length,hex} from './math.js';

const STEP=1/60;
const PAINTS=['#c2df74','#609b90','#d88766','#eee5ce','#d9b663'];
const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(resolve));

/** The application owns time: the simulation never uses a variable physics step. */
export class PortfolioGame {
 constructor(data,ui,store,service,engine,world,physics,vehicle,rover){
  Object.assign(this,{data,ui,store,service,engine,world,physics,vehicle,rover});
  this.input=new Input(engine.canvas);this.audio=new AudioSystem();this.started=false;this.photo=false;this.race=null;this.nearby=null;this.blastAge=99;this.realTime=0;this.audioChosen=false;
  this.simTime=0;this.sceneTime=0;this.accumulator=0;this.previous=0;this.lastRender=0;this.lastUI=0;this.lastSave=0;
  this.lastSafe=[0,32];this.flippedTime=0;this.goalReset=0;this.distanceBase=store.data.distance;this.lastImpact=0;this.goalCount=0;
  this.orbit={yaw:.48,pitch:.72,distance:39};this.camera={position:[55,60,88],target:[7,0,5],fov:Math.PI/4};
  this.ui.onAction=(name,values={})=>this.action(name,values);
  document.querySelector('#start-button').addEventListener('click',()=>this.start());
  this.experience=new WorldExperience(this);this.activeCareer=-1;
  this.applyPreferences();this.world.collectibles.forEach(t=>t.root.visible=!store.data.collected.includes(t.id));
  physics.onImpact=(a,b,strength)=>{if(world.destruction.impact(a,b,strength))return;if(a.tag==='vehicle'||b.tag==='vehicle'){if(this.simTime-this.lastImpact>.14){this.audio.impact(strength);this.lastImpact=this.simTime;}}};
  world.destruction.onBreak=kind=>this.audio.breakProp(kind);
  world.destruction.onExplosion=position=>{this.blastAge=0;this.blastPosition=position;this.audio.explosion();};
  addEventListener('resize',()=>engine.resize());
  addEventListener('beforeunload',()=>this.save());
  document.addEventListener('visibilitychange',()=>{this.accumulator=0;this.input.clear();this.save();});
  engine.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.contextLost=true;this.input.clear();const n=document.querySelector('#connection-notice');n.hidden=false;n.innerHTML='The graphics connection was lost. Reload this page to restart, or <a href="profile.html">read the text portfolio</a>.';});
  for(let i=0;i<90;i++)physics.step(STEP);vehicle.updateVisuals();
  this.frame=this.frame.bind(this);requestAnimationFrame(this.frame);
 }
 get paused(){return !this.started||this.ui.open||this.photo||document.hidden||this.contextLost;}
 applyPreferences(){const s=this.store.data;if(!PAINTS.includes(s.paint))s.paint=PAINTS[0];if(!['rover','classic'].includes(s.model))s.model='rover';if(s.paint===PAINTS[4]&&s.collected.length<6)s.paint=PAINTS[0];this.rover.paint(s.paint);if(!this.rover.model(s.model))s.model='rover';this.engine.setQuality(s.quality);this.engine.night=s.night?1:0;document.body.classList.toggle('is-night',s.night);document.body.classList.toggle('reduced-motion',s.reducedMotion);this.updateVehicleLabel();}
 updateVehicleLabel(){document.querySelector('#vehicle-name').textContent=this.store.data.model==='classic'?'CLASSIC BUGGY / 01':'SK ROVER / 01';}
 start(){if(this.started)return;this.started=true;if(!this.audioChosen)this.setting('audio',true);document.body.classList.remove('is-intro');document.querySelector('#intro').hidden=true;document.querySelector('#hud').hidden=false;document.querySelector('#touch-controls').hidden=false;this.input.clear();this.engine.canvas.focus({preventScroll:true});this.ui.toast('Welcome to my world.','Tap a name sign or project screen. Drive the Career Road for my story.','SK');const entry=new URLSearchParams(location.search).get('stop');if(entry&&!this.entryUsed){this.entryUsed=true;queueMicrotask(()=>this.travel(entry));}if(this.engine.software)this.ui.toast('Compatibility graphics','WebGL is unavailable here. The same world runs with simpler graphics.','i');}
 save(){this.store.data.distance=this.distanceBase+this.vehicle.distance;this.store.save();}
 snapshot(){return {position:[...this.vehicle.body.p],forward:qRotate(this.vehicle.body.q,[0,0,-1]),speed:this.vehicle.speed,battery:this.vehicle.battery,nearby:this.nearby,career:this.activeCareer,race:this.race,countdown:this.race?.countdown>0?Math.ceil(this.race.countdown):this.race?.go>0?'GO':null};}
 unlock(id){if(this.store.data.achievements.includes(id))return;const a=ACHIEVEMENTS.find(a=>a.id===id);if(!a)return;this.store.data.achievements.push(id);this.store.save();this.ui.toast(a.title,a.description,'✓');this.audio.achievement();}
 discover(station){if(this.store.data.visited.includes(station.id))return;this.store.data.visited.push(station.id);this.lastSafe=[station.x,station.z+3];this.store.save();this.unlock('first-stop');if(this.store.data.visited.length===STATIONS.length)this.unlock('explorer');}
 travel(id){
  const station=STATIONS.find(s=>s.id===id),chapter=this.data.careerJourney.find(c=>c.id===id),locations={'test-yard':[-25,38],bowling:[-56,-20],football:[55,36],jump:[-12,57],'career-road':[-48,-58],'blast-yard':[10,45]};
  const p=chapter?[chapter.x-4,-58]:station?[station.x,station.z]:locations[id];if(!p)return;
  this.blastAge=99;document.querySelector('#toast-stack').replaceChildren();this.endRace(false);this.exitPhoto();this.ui.close();this.start();this.input.clear();const career=!!chapter||id==='career-road';this.vehicle.reset([p[0],heightAt(...p)+1.8,p[1]],career?-Math.PI/2:0);this.lastSafe=p;this.flippedTime=0;
  if(career){this.orbit.yaw=.10;this.orbit.pitch=.43;this.orbit.distance=34;}else if(id==='projects'){this.orbit.yaw=.10;this.orbit.pitch=.43;this.orbit.distance=35;}else{this.orbit.yaw=.35;this.orbit.pitch=.65;this.orbit.distance=34;}
  this.updateInteractions(0);this.experience.update();this.engine.canvas.focus({preventScroll:true});
  if(station)this.discover(station);
  this.ui.toast(career?'The Career Road':station?.name||'A little detour',career?'Drive forward along the road. The story changes as you move.':'Tap a sign or press Enter to open the details.',career?'18':'SK');
 }

 recover(){this.blastAge=99;this.endRace();const p=this.lastSafe;this.vehicle.reset([p[0],heightAt(...p)+1.8,p[1]]);this.flippedTime=0;this.input.clear();this.ui.toast('Back on your wheels.','Your progress is safe.','↺');}
 startRace(){this.start();this.ui.close();this.exitPhoto();this.vehicle.reset([-4,heightAt(0,69)+1.8,69],-Math.PI/2);this.race={countdown:3,go:0,elapsed:0,passed:0,next:1};this.world.setRaceGate(1);this.input.clear();this.ui.toast('One lap. Twelve checkpoints.','Follow the glowing gates. Recovering or travelling ends the lap.','F');}
 endRace(notify=true){if(!this.race)return;this.race=null;this.world.setRaceGate(null);if(notify)this.ui.toast('Lap ended.','Your previous personal best is unchanged.','F');}
 advanceRace(dt){const r=this.race;if(!r)return;if(r.countdown>0){const before=Math.ceil(r.countdown);r.countdown=Math.max(0,r.countdown-dt);if(Math.ceil(r.countdown)!==before)this.audio.tone(r.countdown?440:880,.16);if(!r.countdown)r.go=.8;return;}r.elapsed+=dt;r.go=Math.max(0,r.go-dt);const checkpoint=RACE_POINTS[r.next%12];if(distanceXZ(this.vehicle.body.p,[checkpoint[0],0,checkpoint[1]])<6.7&&this.vehicle.body.p[1]<heightAt(...checkpoint)+5){r.passed++;this.audio.collect();if(r.passed===12){const time=r.elapsed,best=this.store.data.bestLap===null||time<this.store.data.bestLap;if(best)this.store.data.bestLap=time;this.store.save();this.endRace(false);this.unlock('lap');this.ui.show('results',{time,best});}else{r.next=(r.next+1)%12;this.world.setRaceGate(r.next);}}}
 updateInteractions(dt){const p=this.vehicle.body.p;this.nearby=null;this.activeCareer=careerIndexAt(p,this.data.careerJourney,this.activeCareer);
  for(const s of STATIONS)if(distanceXZ(p,[s.x,0,s.z])<5.4&&p[1]<heightAt(s.x,s.z)+4.5){this.nearby={id:s.id,name:s.name,category:s.type,kind:'station'};this.discover(s);break;}
  for(const e of this.world.projectExhibits)if(distanceXZ(p,[e.x,0,e.z])<5.7&&p[1]<7&&p[2]>-46){this.nearby={id:e.project.id,name:e.project.title,category:'PROJECT GALLERY',kind:'project'};break;}
  if(this.activeCareer>=0){const c=this.data.careerJourney[this.activeCareer];this.nearby={id:c.id,name:c.company,category:c.year,kind:'career',index:this.activeCareer};}
  if(!this.nearby&&distanceXZ(p,[0,0,69])<9)this.nearby={name:'Take a timed lap',category:'GROVE CIRCUIT',kind:'race'};
  if(!this.nearby&&distanceXZ(p,[-56,0,-20])<7)this.nearby={name:'Reset the ten pins',category:'BOWLING LANE',kind:'bowling'};
  if(!this.nearby&&distanceXZ(p,[55,0,36])<7)this.nearby={name:'Reset the football',category:'A LITTLE SIDE QUEST',kind:'football'};
  for(const t of this.world.collectibles){if(t.root.visible&&distanceXZ(p,[t.x,0,t.z])<2.05&&Math.abs(p[1]-heightAt(t.x,t.z)-1.2)<3){t.root.visible=false;this.store.data.collected.push(t.id);this.store.save();this.audio.collect();this.unlock('first-spark');this.ui.toast('A bright idea.',`${this.store.data.collected.length} of 12 sparks collected.`,'+');if(this.store.data.collected.length===6)this.ui.toast('Golden hour, unlocked.','A new rover paint is waiting in the garage.','G');if(this.store.data.collected.length===12)this.unlock('collector');}}
  const down=this.world.pins.filter(pin=>qRotate(pin.q,[0,1,0])[1]<.65||distanceXZ(pin.p,pin.home.p)>.9).length;if(down===10)this.unlock('bowling');
  const ball=this.world.ball;if(ball){if(this.goalReset>0){this.goalReset-=dt;if(this.goalReset<=0)ball.reset();}else if(Math.abs(ball.p[0]-55)<3.2&&ball.p[2]<9.25&&ball.p[2]>6.2&&ball.p[1]<4.5){this.goalCount++;this.goalReset=2;this.ui.toast('Goal!','Nice touch. The ball resets in a moment.','O');this.unlock('goal');this.audio.achievement();}if(ball.p[1]<-3||Math.hypot(ball.p[0],ball.p[2])>112)ball.reset();}
  if(this.distanceBase+this.vehicle.distance>=1000)this.unlock('distance');
  const up=qRotate(this.vehicle.body.q,[0,1,0]);this.flippedTime=up[1]<.05&&length(this.vehicle.body.v)<1?this.flippedTime+dt:0;
  if(p[1]<-1.5||Math.hypot(p[0],p[2])>113||this.flippedTime>3.2)this.recover();
 }
 interact(){if(this.ui.open)return;const n=this.nearby;if(!n){this.ui.toast('Follow a numbered pad.','The world map shows all seven portfolio stops.','M');return;}if(n.kind==='project'){this.input.clear();this.ui.show('project',{id:n.id});}else if(n.kind==='career'){this.input.clear();this.ui.show('career-detail',{index:n.index});}else if(n.kind==='station'){this.input.clear();this.ui.show(n.id);}else if(n.kind==='race')this.startRace();else if(n.kind==='bowling'){this.world.pins.forEach(p=>p.reset());this.ui.toast('All ten are ready.','Line up and give them a nudge.','X');}else if(n.kind==='football'){this.world.ball.reset();this.goalReset=0;this.ui.toast('Ball reset.','Push it towards the goal.','O');}}
 exitPhoto(){this.photo=false;document.body.classList.remove('is-photo');document.querySelector('#photo-toolbar').hidden=true;}
 async setting(key,value){if(key==='audio'){this.audioChosen=true;const on=await this.audio.enable(!!value),b=document.querySelector('#audio-toggle');b.setAttribute('aria-label',on?'Mute sound':'Enable sound');b.classList.toggle('active',on);b.title=on?'Mute sound (L)':'Enable sound (L)';return;}const s=this.store.data;if(key==='night'){s.night=!!value;document.body.classList.toggle('is-night',s.night);if(s.night)this.unlock('night');}else if(key==='reducedMotion'){s.reducedMotion=!!value;document.body.classList.toggle('reduced-motion',s.reducedMotion);}else if(key==='quality'&&['low','high'].includes(value)){s.quality=value;this.engine.setQuality(value);}else if(key==='camera'&&['chase','diorama'].includes(value)){s.camera=value;this.orbit.yaw=.48;}this.store.save();}
 async action(name,v={}){
  if(name==='panel-closed'){this.input.clear();if(this.started)this.engine.canvas.focus({preventScroll:true});return;}
  if(name==='portfolio'||name==='section'){this.ui.show(name==='portfolio'?'about':v.id);this.input.clear();return;}
  if(['map','guide','challenges','community','scores'].includes(name)){this.ui.show(name);this.input.clear();return;}
  if(name==='settings'){this.ui.show('settings',{audio:this.audio.enabled});this.input.clear();return;}
  if(name==='garage'){this.ui.show('garage',{originalAvailable:this.rover.originalAvailable});this.input.clear();return;}
  if(name==='setting'){await this.setting(v.key,v.value);return;}
  if(name==='audio'){await this.setting('audio',!this.audio.enabled);return;}
  if(name==='night'){await this.setting('night',!this.store.data.night);return;}
  if(name==='camera'){await this.setting('camera',this.store.data.camera==='diorama'?'chase':'diorama');this.ui.toast('A new perspective.',this.store.data.camera==='chase'?'Chase camera. Drag to look around.':'Diorama camera. Drag to orbit.','C');return;}
  if(name==='resume'){this.ui.close();this.start();return;}
  if(name==='escape'){if(this.photo)this.exitPhoto();else if(this.ui.open)this.ui.close();else if(this.started)this.ui.show('pause');return;}
  if(name==='travel'){this.travel(v.id);return;}
  if(name==='race'){this.startRace();return;}if(name==='end-race'){this.endRace();return;}
  if(name==='reset'){this.ui.close();this.recover();return;}
  if(name==='reset-props'){this.physics.resetProps();this.world.destruction.reset();this.blastAge=99;this.goalReset=0;this.ui.toast('A fresh playground.','Crates, pins, cones, seesaw and ball are back in place.','↺');return;}
  if(name==='interact'){this.interact();return;}
  if(name==='jump'){if(!this.paused&&this.vehicle.jump())this.unlock('airtime');return;}
  if(name.startsWith('hydraulic')){if(!this.paused)this.vehicle.hydraulic(Number(name.slice(-1)));return;}
  if(name==='horn'){if(this.started){this.audio.horn();this.unlock('horn');this.ui.toast('Beep, beep.','A friendly hello from the little rover.','H');}return;}
  if(name==='paint'){if(!PAINTS.includes(v.color)||v.color===PAINTS[4]&&this.store.data.collected.length<6)return;this.store.data.paint=v.color;this.rover.paint(v.color);this.store.save();this.unlock('paint');this.ui.show('garage',{originalAvailable:this.rover.originalAvailable});return;}
  if(name==='model'){if(!['rover','classic'].includes(v.model)||!this.rover.model(v.model))return;this.store.data.model=v.model;this.store.save();this.updateVehicleLabel();this.ui.show('garage',{originalAvailable:this.rover.originalAvailable});return;}
  if(name==='photo'){this.ui.close();this.start();this.photo=!this.photo;document.body.classList.toggle('is-photo',this.photo);document.querySelector('#photo-toolbar').hidden=!this.photo;this.input.clear();return;}
  if(name==='capture'){try{this.engine.render(this.camera,this.sceneTime);const blob=await new Promise(resolve=>this.engine.canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Could not create the image.');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Shehraz-The-Grove.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);this.ui.toast('A little moment, captured.','The scene image is ready.','P');}catch(e){this.ui.toast('Capture unavailable',e.message,'!');}return;}
  if(name==='copy-email'){try{await navigator.clipboard.writeText(this.data.email);this.ui.toast('Email copied.',this.data.email,'✓');}catch{this.ui.toast('Here is the email address.',this.data.email,'@');}return;}
  if(name==='clear-progress'&&confirm('Clear this browser\'s discoveries, paint, records and local notes? Shared server entries are not deleted.')){this.endRace(false);this.store.reset();this.vehicle.distance=0;this.distanceBase=0;this.goalCount=0;this.world.collectibles.forEach(t=>t.root.visible=true);this.physics.resetProps();this.world.destruction.reset();this.blastAge=99;this.applyPreferences();this.ui.show('settings',{audio:this.audio.enabled});this.ui.toast('A new beginning.','Saved progress in this browser has been cleared.','↺');}
 }
 updateCamera(dt){const c=this.input.camera,s=this.store.data;this.orbit.yaw+=c.yaw;this.orbit.pitch=clamp(this.orbit.pitch+c.pitch,.30,1.22);this.orbit.distance=clamp(this.orbit.distance+c.zoom,20,74);c.yaw=0;c.pitch=0;c.zoom=0;
  let target,position;if(!this.started){target=[9,1,5];position=[57,60,91];}else{target=add(this.vehicle.body.p,[0,.5,0]);let yaw=this.orbit.yaw;if(this.activeCareer>=0)yaw=.08;if(s.camera==='chase'&&this.activeCareer<0){const f=qRotate(this.vehicle.body.q,[0,0,-1]);yaw+=Math.atan2(-f[0],-f[2]);}const d=this.orbit.distance,p=this.orbit.pitch;position=add(target,[Math.sin(yaw)*Math.cos(p)*d,Math.sin(p)*d,Math.cos(yaw)*Math.cos(p)*d]);}
  // Reading cameras stay above intervening buildings instead of looking through roofs.
  const p=this.vehicle.body.p,atGallery=this.started&&p[0]>-51&&p[0]<-4&&p[2]>-49&&p[2]<-27;
  if(this.started&&!this.photo&&this.activeCareer>=0){target=[p[0]+3,3,-60];position=[p[0]+6+Math.sin(this.orbit.yaw-.10)*3,20+clamp((this.orbit.pitch-.43)*8,-2,5),-46];this.camera.fov=.82;}
  else if(atGallery&&!this.photo){const x=innerWidth<760?p[0]:p[0]*.35-27*.65;target=[x,5,-43];position=[x+2+Math.sin(this.orbit.yaw-.10)*3,16,-17.2];this.camera.fov=.89;}
  else this.camera.fov=Math.PI/4;
  const blast=blastEnvelope(this.blastAge,s.reducedMotion||this.photo||this.ui.open);this.camera.fov*=1-blast.zoom;if(blast.shake){position=add(position,[Math.sin(this.realTime*49)*blast.shake,Math.cos(this.realTime*61)*blast.shake*.7,0]);}
  const t=s.reducedMotion?1:1-Math.exp(-dt*(this.photo?10:5));this.camera.target=mix3(this.camera.target,target,t);this.camera.position=mix3(this.camera.position,position,t);
 }
 step(dt=STEP){this.physics.step(dt);this.world.destruction.update(dt);this.simTime+=dt;this.advanceRace(dt);this.updateInteractions(dt);}
 frame(now){requestAnimationFrame(this.frame);const dt=this.previous?Math.min((now-this.previous)/1000,.1):STEP;this.previous=now;this.realTime+=dt;if(!this.paused)this.blastAge+=dt;
  const flash=document.querySelector('#blast-flash');if(flash)flash.style.opacity=this.paused?'0':String(blastEnvelope(this.blastAge,this.store.data.reducedMotion).flash);
  const controls=this.input.read();for(const action of this.input.consume())this.action(action);
  if(!this.paused){this.vehicle.controls=this.race?.countdown>0?{throttle:0,steer:0,brake:true,boost:false}:controls;this.accumulator+=dt*blastEnvelope(this.blastAge,this.store.data.reducedMotion).timeScale;let steps=0;while(this.accumulator>=STEP&&steps++<6){this.step();this.accumulator-=STEP;if(this.paused){this.accumulator=0;break;}}}else{this.accumulator=0;this.vehicle.controls={throttle:0,steer:0,brake:false,boost:false};}
  if(!document.hidden&&!this.photo&&!this.ui.open)this.sceneTime+=dt*blastEnvelope(this.blastAge,this.store.data.reducedMotion).timeScale;
  this.vehicle.updateVisuals();this.world.update(this.sceneTime,dt,{reducedMotion:this.store.data.reducedMotion,night:this.engine.night});this.engine.night+=(Number(this.store.data.night)-this.engine.night)*Math.min(1,dt*2.5);this.updateCamera(dt);
  this.audio.update(this.vehicle.speed,controls.throttle,!this.paused);
  if(!document.hidden&&!this.contextLost&&now-this.lastRender>(this.engine.software?65:0)){this.engine.render(this.camera,this.sceneTime);this.lastRender=now;}
  if(now-this.lastUI>90){this.ui.update(this.snapshot());this.experience.update();this.lastUI=now;}
  if(now-this.lastSave>5000){this.save();this.lastSave=now;}
 }
}

async function boot(){
 const store=new SaveStore(),service=new CommunityService(store);
 const response=await fetch(new URL('../data/portfolio.json',import.meta.url));if(!response.ok)throw new Error('Portfolio data did not load. Run the included local server instead of opening the HTML file directly.');
 const data=await response.json(),ui=new UI(data,store,service);ui.setLoading(.08,'Laying the foundations');await nextPaint();
 let canvas=document.querySelector('#world'),engine;
 try{engine=new Engine(canvas);}catch(error){console.info('Using compatibility renderer:',error.message);if(canvas.getContext('2d')===null){const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);canvas=replacement;}engine=new CanvasEngine(canvas);}
 ui.setLoading(.18,'Planting a little island');await nextPaint();const physics=new PhysicsWorld(),world=new PortfolioWorld(engine,physics,data);ui.setLoading(.46,'Bringing the playground to life');await nextPaint();
 const vehicle=new Vehicle(physics);await world.loadOriginalAssets(progress=>ui.setLoading(.46+progress*.4,'Preparing your original models'));
 await world.loadExhibitMedia();
 const rover=createRover(engine,vehicle,world.originalModels);ui.setLoading(.92,'Getting the keys ready');await nextPaint();
 const game=new PortfolioGame(data,ui,store,service,engine,world,physics,vehicle,rover);ui.ready();if(new URLSearchParams(location.search).has('community'))service.init();
 // This diagnostic API is opt-in; ordinary visitors never receive debug controls.
 if(new URLSearchParams(location.search).has('debug')||window.__PORTFOLIO_TEST__)window.portfolioDebug={game,snapshot:()=>game.snapshot(),travel:id=>game.travel(id),step:n=>{for(let i=0;i<n;i++)game.step();},ready:true};
}
boot().catch(error=>{window.dispatchEvent(new CustomEvent('portfolio-startup-error',{detail:error}));console.error('Portfolio startup failed:',error);const el=document.querySelector('#load-error');el.hidden=false;el.textContent=`The driving world could not start: ${error.message} The text portfolio and CV links above still work.`;document.querySelector('#load-label').textContent='The text portfolio is available.';document.querySelector('#start-label').textContent='Please use the portfolio shortcut';});
