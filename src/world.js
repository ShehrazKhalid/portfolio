import {hex,qEuler,qAxis,qMul,compose,TAU,seeded,add,sub,mul,length,norm,lerp} from './math.js';
import {geometry,primitives,loadGLB} from './geometry.js';
import {terrainGeometry,heightAt} from './terrain.js';
import {Destruction} from './destruction.js';

export const PALETTE={ground:'#93a982',cream:'#eee6ce',dark:'#283d3b',glass:'#406967',lime:'#c2df74',coral:'#d68361',wood:'#aa825d',road:'#717d70',line:'#e3dfc6',stone:'#b5b3a0',teal:'#508c82'};
export const STATIONS=[
 {id:'about',number:'01',name:'The Garage',type:'Meet Shehraz',x:0,z:23,color:'#c2df74',building:[0,8]},
 {id:'experience',number:'02',name:'Career Studio',type:'The journey so far',x:-30,z:3,color:'#d89b6c',building:[-30,-9]},
 {id:'skills',number:'03',name:'Physics Lab',type:'Skills, put into motion',x:-45,z:35,color:'#88bab0',building:[-45,24]},
 {id:'mobile',number:'04',name:'Mobile Works',type:'Games beyond the screen',x:33,z:-10,color:'#b2bd88',building:[33,-23]},
 {id:'education',number:'05',name:'Learning Garden',type:'Where it started',x:36,z:44,color:'#d1b998',building:[36,33]},
 {id:'contact',number:'06',name:'Signal Tower',type:'Start a conversation',x:0,z:-33,color:'#dba087',building:[0,-45]},
 {id:'projects',number:'07',name:'Project Gallery',type:'Games, artwork & development stories',x:-27,z:-33,color:'#a8bbb9',building:[-27,-44]}
];
export const RACE_POINTS=Array.from({length:12},(_,i)=>[Math.sin(i/12*TAU)*76,Math.cos(i/12*TAU)*69]);
export const COLLECTIBLE_POINTS=[[9,27],[-13,1],[-41,-22],[-62,12],[24,-39],[50,-37],[54,39],[14,52],[-39,50],[-65,49],[0,-69],[70,0]];
const signGeometry=geometry([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],[0,0,1,0,0,1,0,0,1,0,0,1],[0,0,1,0,1,1,0,1],[],[0,1,2,0,2,3]);

export class PortfolioWorld{
 constructor(engine,physics,data={projects:[],careerJourney:[]}){this.data=data;this.hotspots=[];this.mediaJobs=[];this.projectExhibits=[];this.e=engine;this.p=physics;this.objects=[];this.stationMeshes=[];this.collectibles=[];this.animations=[];this.pins=[];this.crates=[];this.buildings=[];this.raceGate=null;this.ball=null;this.originalModels={};this.nightLights=[];this.rng=seeded(431);this.destruction=new Destruction(engine,physics,{random:this.rng});this.create();}
 ground(x,z){return heightAt(x,z);}
 box(pos,scale,color=PALETTE.cream,{solid=false,rounded=false,quaternion=qEuler(),parent=null,tag='',mass=0,...options}={}){
  let body=null;if(solid||mass){body=this.p.add({position:pos,quaternion,half:scale.map(v=>v/2),mass,tag,...options.physics});if(mass)parent=body;}
  const mesh=this.e.mesh(rounded?'rounded':'box',mass?[0,0,0]:pos,scale,color,{quaternion:mass?qEuler():quaternion,parent,...options});return {mesh,body};
 }
 cyl(pos,scale,color=PALETTE.dark,options={}){return this.e.mesh('cylinder',pos,scale,color,options);}
 sign(text,pos,w=9,h=2,options={}){
  const texture=this.e.textTexture(text,{...options,width:options.width||2048,height:Math.max(128,Math.round((options.width||2048)*h/w))}),{yaw=0}=options;
  const backing=this.e.mesh('rounded',pos,[w+.2,h+.2,.18],PALETTE.dark,{quaternion:qEuler(0,yaw,0)});
  const mesh=this.e.mesh(signGeometry,add(pos,[Math.sin(yaw)*.105,0,Math.cos(yaw)*.105]),[w,h,1],'#ffffff',{texture,quaternion:qEuler(0,yaw,0),castsShadow:false,emissive:-1});
  mesh.backing=backing;
  const first=Array.isArray(text)?text[0]:text;
  const route={'SHEHRAZ KHALID':'about','CAREER STUDIO':'experience','PHYSICS LAB':'skills','MOBILE WORKS':'mobile','LEARNING GARDEN':'education','SIGNAL TOWER':'contact','PROJECT GALLERY':'projects'}[first];
  if(route)this.hotspot(mesh,{kind:'section',id:route,label:route==='about'?'Meet Shehraz Khalid':first});
  return mesh;
 }
 hotspot(mesh,route){const target={...route,mesh,key:`${route.kind}-${route.id}-${this.hotspots.length}`};this.hotspots.push(target);return target;}
 imageBoard(src,pos,w,h,route){
  const m=this.sign(['PROJECT ARTWORK','TAP TO EXPLORE'],pos,w,h,{width:1024,height:Math.max(256,Math.round(1024*h/w))});
  this.hotspot(m,route);
  const job=new Promise(resolve=>{
   const image=new Image();image.crossOrigin='anonymous';image.decoding='async';
   image.onload=()=>{try{const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*h/w);const ctx=c.getContext('2d');ctx.fillStyle='#10211f';ctx.fillRect(0,0,c.width,c.height);const ratio=Math.min(c.width/image.naturalWidth,c.height/image.naturalHeight);const iw=image.naturalWidth*ratio,ih=image.naturalHeight*ratio;ctx.drawImage(image,(c.width-iw)/2,(c.height-ih)/2,iw,ih);m.texture=this.e.texture(c);m.emissive=.32;resolve(true);}catch(error){console.warn('Could not prepare local exhibit image',src,error.message);resolve(false);}};
   image.onerror=()=>resolve(false);image.src=new URL('../'+src,import.meta.url).href;
  });this.mediaJobs.push(job);return m;
 }
 async loadExhibitMedia(){return Promise.all(this.mediaJobs);}

 stripe(pos,scale,color=PALETTE.lime,options={}){return this.e.mesh('box',pos,scale,color,{castsShadow:false,...options});}
 road(a,b,width=7,color=PALETTE.road,dashed=false){
  const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2,y=this.ground(mx,mz)+.025,yaw=Math.atan2(dx,dz);this.stripe([mx,y,mz],[width,.065,L+.15],color,{quaternion:qEuler(0,yaw,0)});
  if(dashed)for(let t=2;t<L;t+=5){const x=lerp(a[0],b[0],t/L),z=lerp(a[1],b[1],t/L);this.stripe([x,this.ground(x,z)+.072,z],[.12,.025,1.8],PALETTE.line,{quaternion:qEuler(0,yaw,0)});}
 }
 pad(x,z,w,d){this.box([x,this.ground(x,z)+.055,z],[w,.11,d],PALETTE.stone,{rounded:true,castsShadow:false});}
 lamp(x,z){const y=this.ground(x,z),meshes=[];meshes.push(this.box([x,y+2.5,z],[.17,5,.17],PALETTE.dark).mesh,this.box([x+.55,y+5,z],[1.25,.15,.28],PALETTE.dark).mesh);const light=this.box([x+.9,y+4.91,z],[.6,.1,.22],'#ffe4a2',{emissive:.35}).mesh;meshes.push(light);this.nightLights.push(light);const body=this.p.add({position:[x,y+2,z],half:[.22,2,.22],tag:'lamp'});this.destruction.register('pole',body,meshes,[x,y,z]);}
 planter(x,z,w=2.5){const y=this.ground(x,z);this.box([x,y+.35,z],[w,.65,1.1],PALETTE.cream,{rounded:true,solid:true});this.box([x,y+.7,z],[w-.2,.12,.9],PALETTE.dark);for(let i=0;i<3;i++)this.e.mesh('rock',[x+(i-1)*w*.27,y+1,z],[.65,.65,.52],i%2?'#597b58':'#71905e');}
 tree(x,z,scale=1,variant=0){
  const y=this.ground(x,z),meshes=[this.cyl([x,y+1.25*scale,z],[.25*scale,2.5*scale,.25*scale],PALETTE.wood)],c=['#567760','#739075','#789164'][variant%3];
  if(variant%3===1){for(let i=0;i<3;i++)meshes.push(this.e.mesh('cone',[x,y+(2.1+i*1.05)*scale,z],[(1.8-i*.4)*scale,2.5*scale,(1.8-i*.4)*scale],c));}
  else {meshes.push(this.e.mesh('rock',[x,y+3.5*scale,z],[1.85*scale,2.05*scale,1.6*scale],c,{quaternion:qEuler(0,this.rng()*6,0)}),this.e.mesh('rock',[x+scale*.8,y+3*scale,z+.3*scale],[1.2*scale,1.5*scale,1.25*scale],variant%2?'#789567':'#68876d'));}
  const body=this.p.add({position:[x,y+1.6*scale,z],half:[.3*scale,1.6*scale,.3*scale],tag:'tree'});this.destruction.register('tree',body,meshes,[x,y,z]);
 }
 create(){
  const e=this.e,p=this.p;this.terrain=e.mesh(terrainGeometry(),[0,0,0],[1,1,1],'#ffffff',{castsShadow:false});
  e.mesh('plane',[0,-1.05,0],[800,1,800],'#669e9a',{water:true,castsShadow:false});
  // Main promenade and the perimeter circuit are deliberately kept free of random props.
  this.road([-59,7],[58,7],8);this.road([0,-61],[0,57],8);this.road([-46,45],[45,45],7);this.road([-45,-31],[44,-31],6.5);this.road([-45,-30],[-45,48],6);this.road([34,-30],[34,46],6);
  for(let i=0;i<72;i++){const a=i/72*TAU,b=(i+1)/72*TAU;const A=[Math.sin(a)*76,Math.cos(a)*69],B=[Math.sin(b)*76,Math.cos(b)*69];this.road(A,B,6.8,'#78816d',i%2===0);}
  this.road([0,45],[0,68],7);this.road([-45,7],[-75,7],7);this.road([34,7],[75,7],7);this.road([0,-60],[0,-69],7);
  this.garage();this.career();this.skills();this.mobile();this.education();this.contact();this.pavilion();
  this.playground();this.bridge();this.bowling();this.soccer();this.circuit();
  for(const s of STATIONS)this.station(s);
  this.landscape();this.tokens();this.careerRoad();this.explosiveYards();
 }
 garage(){
  const x=0,z=8,y=this.ground(x,z);this.pad(x,z,17,14);
  // Open garage: individual wall colliders, not one invisible solid block.
  for(const side of [-1,1])this.box([x+side*7,y+2.4,z],[.6,4.8,10],PALETTE.cream,{solid:true,rounded:true});
  this.box([x,y+2.4,z-4.8],[14,4.8,.5],PALETTE.teal,{solid:true});
  this.box([x,y+5,z],[15.2,.7,11.2],PALETTE.cream,{solid:true,rounded:true});
  this.box([x,y+4.55,z+4.8],[14,.75,.55],PALETTE.lime,{rounded:true});
  this.sign(['SHEHRAZ KHALID','SOFTWARE ENGINEER / UNITY DEVELOPER'],[0,y+6.05,z+4.55],13,2.0);
  for(const i of [-1,0,1])this.box([i*3.8,y+5.43,z-1.0],[3.2,.16,5.6],'#3e5c58',{quaternion:qEuler(.08,0,0)});
  for(let i=0;i<3;i++)this.box([-5+i*2.2,y+.65,z-3],[1.8,1.3,1.0],i===1?PALETTE.coral:PALETTE.cream,{rounded:true,solid:true});
  this.sign('BUILD. PLAY. REPEAT.',[0,y+2.8,z-4.48],8.5,1.0,{bg:'#4c716b',accent:'#c2df74'});
  this.box([5.3,y+1.15,z-2],[1.2,2.3,1.2],PALETTE.coral,{solid:true,rounded:true});
  this.box([5.3,y+1.7,z-1.35],[.72,.8,.07],PALETTE.dark);this.planter(-9,14);this.planter(9,14);
  for(const side of [-1,1]){this.stripe([side*4.4,y+.12,18],[.12,.05,7],PALETTE.line);this.stripe([side*4.4,y+.12,24],[.12,.05,3],PALETTE.line);}
 }
 career(){
  const x=-30,z=-9,y=this.ground(x,z);this.pad(x,z,21,16);
  this.box([x,y+3.7,z],[16,7.4,12],PALETTE.cream,{solid:true,rounded:true,tag:'career-building'});
  this.box([x+5.2,y+5.7,z-1],[5,11.4,10],PALETTE.coral,{solid:true,rounded:true});
  this.box([x-3,y+4,z+6.05],[8.8,4.8,.15],PALETTE.glass);
  for(const dx of [-6.7,-3.6,-.5])this.box([x+dx,y+4,z+6.2],[.18,5.1,.22],PALETTE.cream);
  this.box([x-3.5,y+2.7,z+6.45],[6.5,.35,2.6],PALETTE.dark,{solid:true});
  this.sign(['CAREER STUDIO','OZI / SURVIVAL TECH VALLEY / MORE'],[x-2,y+7.5,z+6.25],12.5,1.9);
  for(let i=0;i<4;i++)this.box([x+5.2,y+2+i*2.3,z+4.1],[3.1,1.05,.12],PALETTE.glass);
  this.box([x+5.2,y+11.7,z-1],[5.6,.55,10.5],PALETTE.dark,{rounded:true});
  this.planter(x-8,z+8);this.planter(x+8,z+8);this.lamp(x-11,z+6);
 }
 skills(){
  const x=-45,z=24,y=this.ground(x,z);this.pad(x,z,16,14);
  this.box([x,y+2.5,z],[11,5,9],PALETTE.teal,{solid:true,rounded:true});
  this.box([x,y+5.2,z],[12,.6,10],PALETTE.cream,{rounded:true,solid:true});
  this.box([x,y+3.4,z+4.55],[8.5,2.8,.15],PALETTE.glass);
  for(let i=-1;i<=1;i++)this.box([x+i*3,y+3.4,z+4.65],[.16,3,.16],PALETTE.cream);
  this.sign(['PHYSICS LAB','A LITTLE CONTROLLED CHAOS'],[x,y+5.85,z+4.7],10.4,1.5);
  this.cyl([x,y+5.65,z],[3.0,.36,3.0],PALETTE.dark);
  const orbit={matrix:compose([x,y+7.8,z]),visible:true};this.e.mesh('ring',[0,0,0],[2,2,2],PALETTE.lime,{parent:orbit,quaternion:qEuler(.65,0,.4),emissive:.1});this.e.mesh('sphere',[0,0,0],[.65,.65,.65],PALETTE.coral,{parent:orbit});this.animations.push(t=>compose([x,y+7.8,z],qEuler(0,t*.3,0),[1,1,1],orbit.matrix));
  this.planter(x-7,z+5);this.planter(x+7,z+5);
 }
 mobile(){
  const x=33,z=-23,y=this.ground(x,z);this.pad(x,z,20,17);
  this.box([x,y+3.2,z],[15,6.4,12],PALETTE.cream,{solid:true,rounded:true});
  this.box([x,y+2.6,z+6.05],[12,4.3,.1],PALETTE.glass);
  for(let i=-2;i<=2;i++)this.box([x+i*2.6,y+2.6,z+6.15],[.18,4.5,.18],PALETTE.cream);
  this.box([x,y+6.7,z],[16,.7,13],PALETTE.lime,{rounded:true});
  this.sign(['MOBILE WORKS','MECHANICS / ANALYTICS / MONETIZATION'],[x,y+6.8,z+6.7],13.6,1.5);
  // Oversized original phone monument, not a borrowed product or brand asset.
  const q=qEuler(-.12,.2,0);this.box([x+4.5,y+10.2,z-2.5],[3.5,6.2,.8],PALETTE.dark,{rounded:true,quaternion:q});this.box([x+4.5,y+10.2,z-2.01],[2.8,5.25,.1],PALETTE.teal,{rounded:true,quaternion:q});
  this.e.mesh('ring',[x+4.5,y+10.1,z-1.82],[1.0,1.0,1.0],PALETTE.lime,{quaternion:q,emissive:.15});
  this.planter(x-9,z+7);this.planter(x+9,z+7);
 }
 education(){
  const x=36,z=33,y=this.ground(x,z);this.pad(x,z,21,15);
  this.box([x,y+2.4,z],[16,4.8,10],PALETTE.cream,{solid:true,rounded:true});
  this.box([x,y+4.9,z],[18,.55,12],PALETTE.wood,{solid:true,rounded:true});
  for(let i=-3;i<=3;i++)this.box([x+i*2.25,y+2.8,z+5.05],[1.45,3,.12],PALETTE.glass);
  this.box([x,y+2.3,z+5.18],[2.0,4.5,.22],PALETTE.teal);
  this.sign(['LEARNING GARDEN','CURIOSITY IS A GOOD ENGINE'],[x,y+5.55,z+5.8],14,1.55);
  // Three sculptural books on the roof.
  for(let i=0;i<3;i++){const bx=x-3+i*2.9;this.box([bx,y+6.4,z],[2.6,2.4,3.5],[PALETTE.coral,PALETTE.teal,PALETTE.lime][i],{quaternion:qEuler(0,.2,.12*(i-1)),rounded:true});this.box([bx,y+6.4,z+1.78],[2.15,1.85,.1],PALETTE.cream,{quaternion:qEuler(0,.2,.12*(i-1))});}
  this.tree(x-12,z-2,1.1,2);this.tree(x+12,z-2,.9,2);this.planter(x-9,z+7);this.planter(x+9,z+7);
 }
 contact(){
  const x=0,z=-45,y=this.ground(x,z);this.pad(x,z,16,16);
  this.box([x,y+2.4,z],[10,4.8,10],PALETTE.coral,{solid:true,rounded:true});
  this.box([x,y+6.3,z-1],[6,7.8,6],PALETTE.cream,{solid:true,rounded:true});
  for(let h=5;h<9;h+=1.8)this.box([x,y+h,z+2.05],[4.4,.85,.1],PALETTE.glass);
  this.sign(['SIGNAL TOWER','GOOD IDEAS START WITH HELLO'],[x,y+4.5,z+5.25],10.8,1.65);
  this.cyl([x,y+11.9,z-1],[.13,4,.13],PALETTE.dark);
  for(let i=0;i<3;i++)this.e.mesh('ring',[x,y+11.5+i*.9,z-1],[1.7-i*.4,1.7-i*.4,1.7-i*.4],PALETTE.lime,{quaternion:qEuler(Math.PI/2,0,0),emissive:.2});
  const beacon=this.e.mesh('sphere',[x,y+14,z-1],[.38,.38,.38],'#dfe9a0',{emissive:.6});this.animations.push(t=>beacon.emissive=.6+Math.sin(t*2)*.4);this.planter(x-7,z+6);this.planter(x+7,z+6);
 }
 pavilion(){
  const x=-27,z=-44,y=this.ground(x,z);this.pad(x,z,42,15);
  // Open exhibition structure: the car can enter; only posts/back wall collide.
  this.box([x,y+10.2,z-2.8],[42,.55,5.5],PALETTE.teal,{solid:true,rounded:true,tag:'gallery-roof'});
  for(const dx of [-20,20])this.box([x+dx,y+5,z-2.6],[.5,10,.5],PALETTE.cream,{solid:true,tag:'gallery-post'});
  this.box([x,y+5.0,z-5.4],[41,10,.35],PALETTE.cream,{solid:true,tag:'gallery-back'});
  this.sign(['PROJECT GALLERY','REAL GAMES / TAP AN ICON OR SCREEN'],[x,y+11.2,z-.1],24,2.3);
  const projects=this.data.projects.filter(p=>p.featured).slice(0,3);
  projects.forEach((p,i)=>{
   const px=x+(i-1)*13.0,route={kind:'project',id:p.id,label:p.title};
   this.box([px,y+.6,z-1.2],[11,1.1,1.6],i===1?PALETTE.coral:PALETTE.teal,{solid:true,rounded:true,tag:'project-plinth'});
   const screen=this.imageBoard(p.media.coverPreview||p.media.cover,[px,y+3.8,z-1.14],11,5.2,route);
   const icon=this.imageBoard(p.media.iconPreview||p.media.icon,[px,y+8.05,z-1.12],2.8,2.8,route);
   const label=this.sign([p.title.toUpperCase(),p.duration?`${p.durationEstimated?'EST. ':''}${p.duration.toUpperCase()} / FROM SCRATCH`:'OPEN PROJECT'],[px,y+1.02,z+.1],11,1.65,{width:2048});this.hotspot(label,route);
   this.projectExhibits.push({project:p,x:px,z:z+5,screen,icon,label});
   this.e.mesh('ring',[px,y+.16,z+5],[2.2,2.2,2.2],PALETTE.lime,{quaternion:qEuler(Math.PI/2,0,0),castsShadow:false,emissive:.2});
  });
  this.road([-45,-31],[-45,-39],6);
 }
 careerRoad(){
  const z=-58;
  // Short segments follow the same sampled terrain as the vehicle's collider.
  for(let x=-54;x<56;x+=4)this.road([x,z],[x+4,z],8.8,PALETTE.road,true);
  this.road([-52,-32],[-52,-58],6.5);this.road([54,-31],[54,-58],6.5);
  this.data.careerJourney.forEach((chapter,i)=>{
   const x=chapter.x,y=this.ground(x,z-6),accent=[PALETTE.lime,PALETTE.coral,'#87cfc0','#d6be78'][i];
   this.box([x,y+.4,z-6.1],[19,.8,1.3],PALETTE.cream,{rounded:true,solid:true,tag:'career-plinth'});
   for(const side of [-1,1])this.box([x+side*7.8,y+3.4,z-6.1],[.3,6.5,.3],PALETTE.dark,{solid:true,tag:'career-post'});
   const board=this.sign([chapter.company.toUpperCase(),chapter.role.toUpperCase()],[x,y+3.15,z-5.9],18,2.9,{accent,width:2048});
   const year=this.sign([chapter.year.toUpperCase(),`CHAPTER 0${i+1} / ${chapter.period.toUpperCase()}`],[x,y+6.1,z-5.85],12.5,2.3,{bg:PALETTE.teal,accent,width:2048});
   this.hotspot(board,{kind:'career',id:chapter.id,label:chapter.company,index:i});this.hotspot(year,{kind:'career',id:chapter.id,label:chapter.year,index:i});
   this.stripe([x,this.ground(x,z)+.12,z],[.18,.03,8],accent);this.lamp(x-11,z-7.2);
   for(const side of [-1,1])this.e.mesh('rock',[x+side*10,y+.8,z-7.5],[.8,1.1,.8],accent);
  });
  this.sign(['THE CAREER ROAD','2018 TO TODAY / DRIVE LEFT TO RIGHT'],[-51,5.2,-51.0],14,1.9,{yaw:.35});
  const all=this.sign(['ALL PROJECTS','OPEN THE COMPLETE ARCHIVE'],[-42,4,-32.7],10,1.6);this.hotspot(all,{kind:'section',id:'projects',label:'All projects'});
 }

 station(s){
  const y=this.ground(s.x,s.z)+.1;const pad=this.e.mesh('cylinder',[s.x,y,s.z],[3.2,.11,3.2],s.color,{castsShadow:false});
  const ring=this.e.mesh('ring',[s.x,y+.08,s.z],[3.45,3.45,3.45],s.color,{quaternion:qEuler(Math.PI/2,0,0),castsShadow:false,emissive:.25});
  const marker=this.e.mesh('hex',[s.x,y+2.9,s.z],[.28,.55,.28],s.color,{quaternion:qEuler(0,0,Math.PI/4),emissive:.15});
  this.stationMeshes.push({station:s,pad,ring,marker});
  // Short directional totems keep the driving space uncluttered.
  this.box([s.x+4.6,y+.7,s.z],[.2,1.4,.2],PALETTE.dark);
  const board=this.sign(s.number,[s.x+4.6,y+1.6,s.z],.9,.9,{bg:PALETTE.dark,accent:s.color});this.hotspot(board,{kind:'section',id:s.id,label:s.name});
 }
 playground(){
  this.pad(-25,25,21,22);
  this.sign(['TEST YARD','NUDGE / BALANCE / JUMP'],[-25,4.9,13.5],13,1.7);
  for(let row=0;row<3;row++)for(let col=0;col<3-row;col++){
   const pos=[-31+col*1.5+row*.75,1.2+.65+row*1.3,19],item=this.box(pos,[1.25,1.25,1.25],row===1?PALETTE.coral:PALETTE.wood,{mass:10,rounded:true,tag:'crate'});this.crates.push(item.body);
   for(const axis of [0,2]){const scale=axis===0?[1.28,.16,1.29]:[.16,1.28,1.29];this.e.mesh('box',[0,0,0],scale,PALETTE.dark,{parent:item.body});}
  }
  // A torque-driven plank with a fixed hinge; wheel loads move the seesaw.
  const anchor=[-23,2.45,28],body=this.p.add({position:anchor,quaternion:qEuler(0,0,.18),half:[6,.18,2.2],mass:100,friction:.9,tag:'seesaw',hinge:{axis:[0,0,1],anchor,min:-.23,max:.23}});
  this.e.mesh('rounded',[0,0,0],[12,.36,4.4],PALETTE.coral,{parent:body});this.e.mesh('box',[0,.2,0],[.25,.02,4.1],PALETTE.cream,{parent:body});
  this.box([-23,1.65,28],[1,1,3.2],PALETTE.dark,{solid:true});
  this.ramp(-12,48,7,10,2.6,0);
  this.sign(['TAKE THE LEAP','SHIFT = BOOST / SPACE = JUMP'],[-12,4.8,41],9,1.4);
  for(const x of [-17,-7]){this.pole(x,52,PALETTE.coral);}
  // Small, free-standing objects are genuine rigid bodies, not static decorations.
  for(let i=0;i<4;i++){const x=-16+i*1.5,z=17;const b=this.p.add({position:[x,1.8,z],half:[.32,.6,.32],mass:3,tag:'cone'});this.e.mesh('cone',[0,0,0],[.4,1.2,.4],PALETTE.coral,{parent:b});this.e.mesh('box',[0,-.55,0],[.8,.1,.8],PALETTE.dark,{parent:b});}
 }
 ramp(x,z,width,L,rise,yaw){const angle=Math.atan2(rise,L),q=qEuler(angle,yaw,0);this.box([x,this.ground(x,z)+rise/2+.05,z],[width,.4,L],PALETTE.coral,{solid:true,quaternion:q,tag:'ramp'});for(let i=-1;i<=1;i++)this.e.mesh('box',[x+i*1.3,this.ground(x,z)+rise/2+.28,z],[.16,.02,L*.8],PALETTE.cream,{quaternion:q});}
 pole(x,z,color){const y=this.ground(x,z),meshes=[this.box([x,y+1.5,z],[.13,3,.13],PALETTE.dark).mesh,this.box([x+.5,y+2.4,z],[1,.6,.055],color).mesh],body=this.p.add({position:[x,y+1.4,z],half:[.2,1.4,.2],tag:'pole'});this.destruction.register('pole',body,meshes,[x,y,z]);}
 explosiveYards(){
  this.sign(['BLAST YARD','BUMP THE RED CRATES'],[12,5.6,32],10,2.1);
  for(const [x,z] of [[10,39],[13,40],[12,36],[-62,5],[-64,8],[58,-4],[61,-3],[-20,-23],[22,-49]]){
   const y=this.ground(x,z),meshes=[];
   meshes.push(this.box([x,y+.85,z],[1.65,1.7,1.65],'#b9422d',{rounded:true}).mesh);
   for(const dy of [.24,1.48])meshes.push(this.box([x,y+dy,z],[1.72,.16,1.72],'#e0b675').mesh);
   for(const side of [-1,1]){
    const label=this.sign('TNT',[x,y+.88,z+side*.85],1.43,.81,{bg:'#8f261e',fg:'#fff5d4',accent:'#ffd978',width:512,height:256,yaw:side===1?0:Math.PI});meshes.push(label,label.backing);
   }
   const body=this.p.add({position:[x,y+.85,z],half:[.84,.85,.84],tag:'tnt'});this.destruction.register('tnt',body,meshes,[x,y,z]);
  }
 }
 bridge(){
  const x=17,z=20;this.e.mesh('cylinder',[x,1.29,z],[8,.12,7.5],'#679f9b',{water:true,castsShadow:false});
  this.box([x,2.2,z],[19,.4,4.6],PALETTE.wood,{solid:true,rounded:true,tag:'bridge'});
  for(let i=-8;i<=8;i++)this.box([x+i,2.45,z],[.08,.06,4.4],PALETTE.cream);
  for(const dz of [-2.4,2.4]){this.box([x,3.15,z+dz],[19,.16,.15],PALETTE.cream,{solid:true});for(const dx of [-8,-4,0,4,8])this.box([x+dx,2.85,z+dz],[.15,1.2,.15],PALETTE.dark,{solid:true});}
  const a=Math.atan2(.98,5);this.box([x-11.8,1.75,z],[5.2,.3,4.6],PALETTE.wood,{solid:true,quaternion:qEuler(0,0,a)});this.box([x+11.8,1.75,z],[5.2,.3,4.6],PALETTE.wood,{solid:true,quaternion:qEuler(0,0,-a)});
  for(let i=0;i<9;i++){const angle=i/9*TAU;this.e.mesh('rock',[x+Math.cos(angle)*8.2,1.47,z+Math.sin(angle)*7.6],[.7,.35,.55],PALETTE.stone);}
 }
 bowling(){
  const x=-56,z=-33;this.pad(x,z,10,23);this.box([x,1.32,z],[6,.12,20],PALETTE.wood,{castsShadow:false});
  for(const dx of [-3.3,3.3])this.box([x+dx,1.46,z],[.2,.45,20],PALETTE.dark,{solid:true});
  let number=0;for(let row=0;row<4;row++)for(let i=0;i<=row;i++){
   const px=x+(i-row/2)*1.15,pz=z-4-row*1.25,b=this.p.add({position:[px,1.2+.84,pz],half:[.29,.78,.29],mass:3.5,friction:.5,tag:'pin'});this.pins.push(b);
   this.e.mesh('cylinder',[0,-.12,0],[.32,.95,.32],PALETTE.cream,{parent:b});this.e.mesh('sphere',[0,.52,0],[.22,.25,.22],PALETTE.cream,{parent:b});this.e.mesh('cylinder',[0,.29,0],[.16,.18,.16],PALETTE.coral,{parent:b});number++;
  }
  this.sign(['TEN-PIN DETOUR','THE CAR IS YOUR BOWLING BALL'],[x,4.9,z-11],9,1.5);this.pole(x-4,z+8,PALETTE.coral);this.pole(x+4,z+8,PALETTE.coral);
 }
 soccer(){
  const x=55,z=21;this.pad(x,z,19,25);this.box([x,1.35,z],[18,.08,24],'#7d9b71',{castsShadow:false});
  for(const dx of [-8.5,8.5])this.stripe([x+dx,1.42,z],[.12,.03,23],PALETTE.cream);for(const dz of [-11.5,11.5])this.stripe([x,1.42,z+dz],[17,.03,.12],PALETTE.cream);
  this.stripe([x,1.42,z],[17,.025,.1],PALETTE.cream);this.e.mesh('ring',[x,1.43,z],[3,3,3],PALETTE.cream,{quaternion:qEuler(Math.PI/2,0,0),castsShadow:false});
  const gz=z-11.8;for(const dx of [-3.5,3.5])this.box([x+dx,2.8,gz],[.18,3.1,.18],PALETTE.cream,{solid:true});this.box([x,4.25,gz],[7.2,.18,.18],PALETTE.cream,{solid:true});
  for(let i=-3;i<=3;i++)this.box([x+i,2.7,gz-1.5],[.03,2.9,.03],PALETTE.cream);for(let i=0;i<5;i++)this.box([x,1.4+i*.55,gz-1.5],[7,.025,.025],PALETTE.cream);
  this.box([x,2.65,gz-1.7],[7,2.8,.12],PALETTE.teal,{solid:true});
  const b=this.p.add({position:[x,2.4,z+4],radius:.77,mass:4,restitution:.55,friction:.42,tag:'football'});this.ball=b;this.e.mesh('sphere',[0,0,0],[.77,.77,.77],PALETTE.cream,{parent:b});
  for(const p of [[0,.75,0],[0,-.75,0],[.75,0,0],[-.75,0,0],[0,0,.75],[0,0,-.75]])this.e.mesh('rock',p,[.19,.19,.19],PALETTE.dark,{parent:b});this.sign('ONE MORE GOAL',[x,4.0,z+14],10,1.4,{yaw:Math.PI});
 }
 circuit(){
  const x=0,z=69,y=this.ground(x,z);this.road([-5,z],[7,z],6.8,PALETTE.road);
  for(let i=0;i<6;i++)for(let j=0;j<2;j++)this.stripe([x-1+j*.8,y+.12,z-2.5+i],[.8,.03,1],(i+j)%2?PALETTE.dark:PALETTE.cream);
  for(const dz of [-4.5,4.5])this.box([x,y+3.1,z+dz],[.4,6.2,.4],PALETTE.dark,{solid:true});
  this.box([x,y+6.15,z],[.55,.8,9.5],PALETTE.lime);this.sign(['GROVE CIRCUIT','12 CHECKPOINTS / ONE CLEAN LAP'],[x+.32,y+6.15,z],9,1.1,{yaw:Math.PI/2});
  this.raceGate={root:{matrix:compose(),visible:false},pieces:[]};for(const side of [-1,1])this.raceGate.pieces.push(this.e.mesh('cylinder',[side*3.7,1.5,0],[.15,3,.15],PALETTE.lime,{parent:this.raceGate.root,emissive:.3}));this.raceGate.pieces.push(this.e.mesh('box',[0,3,0],[7.6,.25,.25],PALETTE.lime,{parent:this.raceGate.root,emissive:.4}));
 }
 setRaceGate(index){if(index===null){this.raceGate.root.visible=false;return;}const [x,z]=RACE_POINTS[index%12],angle=index/12*TAU;compose([x,this.ground(x,z),z],qEuler(0,angle+Math.PI/2,0),[1,1,1],this.raceGate.root.matrix);this.raceGate.root.visible=true;}
 landscape(){
  for(const [x,z,s,v] of [[-14,-15,1,0],[15,-16,.85,2],[18,37,1.0,1],[-8,36,.9,2],[-48,-5,1.1,0],[50,-13,1,1],[48,48,1.15,0],[-60,-53,1.1,1],[-13,-25,1.2,2],[13,-51,1.1,0],[-61,28,.9,2],[-57,49,1.1,0],[58,-47,1.3,1]])this.tree(x,z,s,v);
  for(let i=0;i<88;i++){const a=this.rng()*TAU,r=85+this.rng()*15,x=Math.cos(a)*r,z=Math.sin(a)*r;if(this.ground(x,z)<.4)continue;this.tree(x,z,.65+this.rng()*.8,i%3);}
  for(let i=0;i<65;i++){const a=this.rng()*TAU,r=89+this.rng()*17,x=Math.cos(a)*r,z=Math.sin(a)*r,s=.5+this.rng()*1.8;this.e.mesh('rock',[x,this.ground(x,z)+s*.25,z],[s,s*.6,s*.7],PALETTE.stone,{quaternion:qEuler(0,this.rng()*TAU,0)});}
  for(const [x,z] of [[-12,7],[14,7],[0,-24],[-45,11],[-44,44],[34,6],[34,46],[-27,-31],[7,34]])this.lamp(x,z);
  // Seating, paths and a wind-powered sculpture give the campus a lived-in identity.
  for(const [x,z] of [[14,-3],[-9,-24],[24,42],[-35,43]]){this.box([x,1.9,z],[3,.25,1],PALETTE.wood,{solid:true});this.box([x,2.4,z-.4],[3,.8,.16],PALETTE.wood,{solid:true});for(const dx of [-1.1,1.1])this.box([x+dx,1.5,z],[.15,.75,.7],PALETTE.dark);}
  const x=-71,z=53,y=this.ground(x,z);this.cyl([x,y+5,z],[.28,10,.28],PALETTE.cream);this.p.add({position:[x,y+4,z],half:[.4,4,.4]});const hub={matrix:compose([x,y+10,z]),visible:true};this.e.mesh('sphere',[0,0,0],[.55,.55,.55],PALETTE.dark,{parent:hub});for(let i=0;i<3;i++){const angle=i/3*TAU;this.e.mesh('rounded',[Math.sin(angle)*2.0,Math.cos(angle)*2.0,0],[.4,4.2,.16],PALETTE.cream,{parent:hub,quaternion:qEuler(0,0,-angle)});}this.animations.push(t=>compose([x,y+10,z],qEuler(0,0,t*.6),[1,1,1],hub.matrix));
  // Cloud clusters stay beyond the town so they never cover the camera.
  for(let i=0;i<7;i++){const base=[(i-3)*30,25+(i%3)*3,-94];const group={matrix:compose(base),visible:true};for(let j=0;j<4;j++)this.e.mesh('rock',[(j-1.5)*3.2,j%2*.8,0],[3.5,1.8,2.2],'#e5eadd',{parent:group,castsShadow:false});this.animations.push(t=>compose([base[0]+Math.sin(t*.015+i)*8,base[1],base[2]],qEuler(),[1,1,1],group.matrix));}
 }
 tokens(){COLLECTIBLE_POINTS.forEach(([x,z],i)=>{const root={matrix:compose([x,this.ground(x,z)+1.4,z]),visible:true};this.e.mesh('hex',[0,0,0],[.52,.15,.52],PALETTE.lime,{parent:root,quaternion:qEuler(Math.PI/2,0,0),emissive:.5});this.e.mesh('ring',[0,0,0],[.6,.6,.6],PALETTE.cream,{parent:root,emissive:.2});this.collectibles.push({id:i,x,z,root});});}
 async loadOriginalAssets(onProgress=()=>{}){
  const names=['buggy','tower','crystal_tree'];let complete=0;
  await Promise.all(names.map(async name=>{try{this.originalModels[name]=await loadGLB(new URL(`../assets/models/${name}.glb`,import.meta.url));}catch(err){console.warn('Optional original GLB could not load:',name,err.message);}onProgress(++complete/names.length);}));
  // Preserve the supplied assets as a little prototype garden. Original vehicle is also drivable.
  for(const [name,pos,scale] of [['tower',[20,53],.48],['crystal_tree',[14,54],.7],['crystal_tree',[26,54],.7]]){const position=[pos[0],this.ground(...pos),pos[1]],root={matrix:compose(position,qEuler(),[scale,scale,scale]),visible:true},meshes=[];for(const part of this.originalModels[name]||[])meshes.push(this.e.mesh(part.geometry,[0,0,0],[1,1,1],part.color,{parent:root}));if(name==='crystal_tree'&&meshes.length){const body=this.p.add({position:add(position,[0,1.2,0]),half:[.3,1.2,.3],tag:'tree'});this.destruction.register('tree',body,meshes,position);}}
 }
 update(time,dt,{reducedMotion=false,night=0}={}){
  if(!reducedMotion)for(const animate of this.animations)animate(time);
  for(const {station,marker,ring} of this.stationMeshes){marker.position[1]=this.ground(station.x,station.z)+3.0+(reducedMotion?0:Math.sin(time*1.6+station.x)*.18);marker.quaternion=qEuler(0,time*.4,Math.PI/4);ring.emissive=.12+night*.4;}
  for(const t of this.collectibles){const y=this.ground(t.x,t.z)+1.4+(reducedMotion?0:Math.sin(time*2+t.id)*.2);compose([t.x,y,t.z],qEuler(0,reducedMotion?0:time*.8,0),[1,1,1],t.root.matrix);}
  for(const light of this.nightLights)light.emissive=.1+night*2;
 }
}

export function createRover(engine,vehicle,originalModels={}){
 const body=vehicle.body,paint=[];const mesh=(shape,pos,size,color,options={})=>engine.mesh(shape,pos,size,color,{parent:body,...options});
 const main=[];const addPart=(...args)=>{const m=mesh(...args);main.push(m);return m;};
 function painted(shape,pos,size){const m=addPart(shape,pos,size,PALETTE.lime);paint.push(m);return m;}
 painted('rounded',[0,.12,0],[2.14,.7,4.0]);painted('rounded',[0,.34,-1.36],[2.05,.28,1.2]);
 addPart('rounded',[0,.55,.05],[1.88,1.04,2.1],PALETTE.dark);
 addPart('rounded',[0,.71,-.90],[1.72,.65,.075],PALETTE.glass,{quaternion:qEuler(-.15,0,0)});
 addPart('rounded',[0,.68,1.03],[1.72,.64,.075],PALETTE.glass);
 for(const side of [-1,1]){addPart('rounded',[side*.955,.7,.05],[.065,.65,1.8],PALETTE.glass);addPart('box',[side*.99,.7,.2],[.07,.7,.1],PALETTE.dark);painted('rounded',[side*1.05,.06,.2],[.2,.48,1.7]);}
 painted('rounded',[0,1.17,.07],[2.1,.21,2.35]);
 addPart('box',[0,1.33,.32],[1.75,.13,1.5],PALETTE.dark);
 for(const x of [-.77,.77])addPart('box',[x,1.43,.32],[.09,.17,1.65],PALETTE.dark);
 addPart('rounded',[0,1.5,.52],[1.35,.3,.85],PALETTE.wood);
 for(const z of [-2.03,2.03])addPart('rounded',[0,-.05,z],[2.26,.25,.23],PALETTE.dark);
 for(const x of [-.73,.73]){addPart('rounded',[x,.31,-2.015],[.43,.24,.09],'#fff0b9',{emissive:.6});addPart('rounded',[x,.27,2.015],[.32,.17,.08],'#d77955',{emissive:.35});}
 addPart('box',[0,.32,-2.02],[.75,.16,.07],PALETTE.dark);
 for(const x of [-.26,0,.26])addPart('box',[x,.32,-2.06],[.075,.15,.06],PALETTE.cream);
 const decal=engine.textTexture('SK / 01',{width:512,height:160,bg:PALETTE.dark,fg:PALETTE.cream});addPart(signGeometry,[0,.39,-1.97],[.82,.23,1],'#ffffff',{texture:decal,quaternion:qEuler(0,Math.PI,0)});
 // Fender lips are separate so suspension travel is clearly readable.
 for(const x of [-1.03,1.03])for(const z of [-1.35,1.35])addPart('rounded',[x,.05,z],[.36,.23,1.36],PALETTE.dark);
 const wheelMeshes=[];
 for(const wheel of vehicle.wheels){
  const root=wheel;root.visible=true;
  wheelMeshes.push(engine.mesh('cylinder',[0,0,0],[.54,.37,.54],PALETTE.dark,{parent:root,quaternion:qEuler(0,0,Math.PI/2)}));
  for(const x of [-.195,.195]){engine.mesh('cylinder',[x,0,0],[.32,.045,.32],PALETTE.cream,{parent:root,quaternion:qEuler(0,0,Math.PI/2)});engine.mesh('cylinder',[x*1.12,0,0],[.14,.05,.14],PALETTE.teal,{parent:root,quaternion:qEuler(0,0,Math.PI/2)});}
  for(let j=0;j<10;j++){const a=j/10*TAU;engine.mesh('box',[0,Math.cos(a)*.51,Math.sin(a)*.51],[.4,.10,.15],'#394441',{parent:root,quaternion:qEuler(a,0,0)});}
 }
 const classic=[];for(const [i,part] of (originalModels.buggy||[]).slice(0,2).entries()){const geo=i===0?geometry(part.geometry.positions,part.geometry.normals,part.geometry.uvs,[],part.geometry.indices):part.geometry;const m=mesh(geo,[0,-.75,0],[.77,.9,.81],i===0?PALETTE.lime:part.color,{visible:false});classic.push(m);if(i===0)paint.push(m);}
 return {
  paint(color){for(const m of paint)m.color=hex(color);},
  model(id){if(id==='classic'&&!classic.length)return false;for(const m of main)m.visible=id!=='classic';for(const m of classic)m.visible=id==='classic';return true;},
  originalAvailable:classic.length>0,
  meshes:main
 };
}
