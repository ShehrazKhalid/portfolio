import {transformPoint,sub,length,norm,dot,qRotate,distanceXZ} from './math.js';
import {pointInPolygon,careerIndexAt,careerProgress} from './career.js';
import {installLightbox} from '../js/lightbox.js';

/** Real scene picking + position-driven career narrative; no scroll animation stand-in. */
export class WorldExperience{
 constructor(game){
  this.g=game;this.down=null;this.hover=null;this.active=-1;this.lastStatus='';this.lastHover=0;this.lastContext='';
  installLightbox();const canvas=game.engine.canvas;
  this.labels=document.createElement('div');this.labels.id='scene-labels';this.labels.setAttribute('aria-label','Nearby places');document.body.append(this.labels);this.labelKey='';
  canvas.addEventListener('pointerdown',e=>{if(e.button===0)this.down={x:e.clientX,y:e.clientY,t:performance.now(),id:e.pointerId};});
  canvas.addEventListener('pointermove',e=>{
   if(this.down&&Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>8)this.down.moved=true;
   if(e.pointerType==='touch'||this.down||performance.now()-this.lastHover<80)return;
   this.lastHover=performance.now();this.hover=this.pick(e.clientX,e.clientY);canvas.style.cursor=this.hover?'pointer':'grab';const tip=document.querySelector('#world-tooltip');tip.hidden=!this.hover;if(this.hover){tip.textContent='Open '+this.hover.label;tip.style.left=Math.min(e.clientX+14,innerWidth-220)+'px';tip.style.top=Math.min(e.clientY+16,innerHeight-55)+'px';}
  });
  canvas.addEventListener('pointerup',e=>{const d=this.down;this.down=null;if(!d||d.id!==e.pointerId||d.moved||performance.now()-d.t>700)return;const target=this.pick(e.clientX,e.clientY);if(target)this.open(target);});
  canvas.addEventListener('pointercancel',()=>this.down=null);canvas.addEventListener('pointerleave',()=>{document.querySelector('#world-tooltip').hidden=true;});
  document.addEventListener('click',e=>{const el=e.target.closest('[data-open-project]');if(!el)return;e.preventDefault();this.open({kind:'project',id:el.dataset.openProject});});
  document.querySelector('#career-read').addEventListener('click',()=>{if(this.active>=0)this.open({kind:'career',index:this.active,id:game.data.careerJourney[this.active].id});});
  document.querySelector('#career-dismiss').addEventListener('click',()=>{document.querySelector('#career-overlay').classList.toggle('compact');});
  document.querySelector('#nearby-open').addEventListener('click',()=>game.interact());
 }
 open(target){
  const g=this.g;if(!g.started)g.start();g.input.clear();document.querySelector('#world-tooltip').hidden=true;
  if(target.kind==='project')g.ui.show('project',{id:target.id});
  else if(target.kind==='career')g.ui.show('career-detail',{index:target.index});
  else if(target.kind==='section')g.ui.show(target.id);
 }
 polygon(target){const mesh=target.mesh;if(!mesh.visible||!mesh.matrix)return null;const pts=[[-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0]].map(p=>this.g.engine.project(transformPoint(mesh.matrix,p)));return pts.every(Boolean)?pts:null;}
 pick(x,y){
  const g=this.g;if(!g.started||g.ui.open||g.photo)return null;const candidates=[];
  for(const target of g.world.hotspots){const p=target.mesh.position,v=sub(g.camera.position,p);if(length(v)>100||dot(v,qRotate(target.mesh.quaternion,[0,0,1]))<0)continue;const poly=this.polygon(target);if(poly&&pointInPolygon(x,y,poly))candidates.push({target,distance:length(v)});}
  candidates.sort((a,b)=>a.distance-b.distance);
  for(const {target,distance} of candidates){const ray=norm(sub(target.mesh.position,g.camera.position));const hit=g.physics.raycast(g.camera.position,ray,distance-.18,g.vehicle.body);if(!hit||hit.distance>distance-.45)return target;}
  return null;
 }
 update(){
  const g=this.g,chapters=g.data.careerJourney;this.active=careerIndexAt(g.vehicle.body.p,chapters,this.active);g.activeCareer=this.active;
  const active=this.active>=0&&g.started&&!g.photo&&!g.ui.open;const overlay=document.querySelector('#career-overlay');overlay.hidden=!active;document.body.classList.toggle('on-career-road',active);
  if(active){const c=chapters[this.active];if(this.lastStatus!==c.id){this.lastStatus=c.id;overlay.dataset.chapter=c.id;document.querySelector('#career-year').textContent=c.year;document.querySelector('#career-company').textContent=c.company;document.querySelector('#career-role').textContent=c.role;document.querySelector('#career-story').textContent=c.story;document.querySelector('#career-period').textContent=c.period;document.querySelector('#career-chapter').textContent=`CHAPTER 0${this.active+1} / 04`;document.querySelectorAll('[data-career-step]').forEach((el,i)=>{el.classList.toggle('active',i===this.active);el.setAttribute('aria-current',i===this.active?'step':'false');});}document.querySelector('#career-meter').style.width=(careerProgress(g.vehicle.body.p[0])*100)+'%';}
  const n=g.nearby,context=document.querySelector('#world-context');context.hidden=!g.started||g.ui.open||g.photo||active||!n;document.body.classList.toggle('has-nearby',!context.hidden);const p=g.vehicle.body.p;document.body.classList.toggle('in-project-gallery',g.started&&p[0]>-51&&p[0]<-4&&p[2]>-49&&p[2]<-27);
  if(n){const id=n.id||n.kind;if(this.lastContext!==id){this.lastContext=id;document.querySelector('#nearby-title').textContent=n.name;document.querySelector('#nearby-type').textContent=n.kind==='project'?'PROJECT EXHIBITION':'YOU ARE EXPLORING';document.querySelector('#nearby-open').textContent=n.kind==='project'?'Open project details':'Open this section';}}
  this.updateLabels();
 }
 updateLabels(){
  const g=this.g,small=innerWidth<760;this.labels.hidden=!g.started||g.ui.open||g.photo;
  if(this.labels.hidden)return;
  const candidates=[],seen=new Set();
  for(const target of g.world.hotspots){
   const mesh=target.mesh;if(mesh.visible===false||mesh.scale[0]<3||target.kind==='career'&&this.active<0)continue;
   const distance=distanceXZ(g.vehicle.body.p,mesh.position);if(distance>32)continue;
   const v=sub(g.camera.position,mesh.position);if(dot(v,qRotate(mesh.quaternion,[0,0,1]))<=0)continue;
   const poly=this.polygon(target);if(!poly)continue;
   const x=poly.reduce((n,p)=>n+p.x,0)/4,y=Math.min(...poly.map(p=>p.y))-10;
   const margin=small?108:145;if(x<margin||x>innerWidth-margin||y<(small?177:165)||y>innerHeight-(small?250:180))continue;
   const ray=norm(sub(mesh.position,g.camera.position)),d=length(v),hit=g.physics.raycast(g.camera.position,ray,d-.3,g.vehicle.body);if(hit&&hit.distance<d-.5)continue;
   candidates.push({target,x,y,distance});
  }
  candidates.sort((a,b)=>a.distance-b.distance);const selected=[];
  for(const c of candidates){const key=c.target.kind+'-'+c.target.id;if(seen.has(key)||selected.some(s=>Math.abs(s.x-c.x)<(small?210:265)&&Math.abs(s.y-c.y)<65))continue;seen.add(key);selected.push(c);if(selected.length===(small?1:3))break;}
  const key=selected.map(c=>c.target.key).join('|');if(key!==this.labelKey){this.labelKey=key;this.labels.replaceChildren();for(const c of selected){const b=document.createElement('button');b.className='scene-label';b.textContent=c.target.label;const hint=document.createElement('small');hint.textContent=c.target.kind==='project'?'Explore project ↗':'Read more ↗';b.append(hint);b.onclick=()=>this.open(c.target);this.labels.append(b);}}
  selected.forEach((c,i)=>{const b=this.labels.children[i];if(b){b.style.left=c.x+'px';b.style.top=c.y+'px';}});
 }
}
