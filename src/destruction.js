import {add,sub,mul,norm,length,clamp,hex,qEuler,qIntegrate,transformPoint} from './math.js';
import {heightAt} from './terrain.js';

// One bounded pool for debris, sparks, fire and smoke. Broken colliders stay disabled
// until Reset props; distant scenery never silently reappears in front of the car.
export class Destruction {
 constructor(engine,physics,{random=Math.random}={}){
  this.engine=engine;this.physics=physics;this.random=random;this.props=[];this.byBody=new Map();
  this.particles=[];this.rings=[];this.pending=[];this.time=0;this.onBreak=null;this.onExplosion=null;
  this.stats={trees:0,poles:0,explosions:0};
 }
 register(kind,body,meshes,position){
  const prop={kind,body,meshes,position:[...position],broken:false};
  this.props.push(prop);this.byBody.set(body.id,prop);return prop;
 }
 impact(a,b,strength){
  const car=a.tag==='vehicle'?a:b.tag==='vehicle'?b:null;if(!car)return false;
  const prop=this.byBody.get((car===a?b:a).id);
  if(!prop||prop.broken||strength<(prop.kind==='tnt'?65:prop.kind==='tree'?135:90))return false;
  return this.break(prop,car.v,car);
 }
 particle(position,velocity,size,color,life=1.7,{gravity=12,emissive=0,smoke=false,geometry=null,quaternion=null,delay=0}={}){
  let p=this.particles.find(p=>!p.active);
  if(!p){if(this.particles.length>=220)return;const mesh=this.engine.mesh('rock',[0,0,0],[1,1,1],color,{visible:false,castsShadow:false});p={mesh,baseGeometry:mesh.geometry};this.particles.push(p);}
  const s=Array.isArray(size)?[...size]:[size,size,size];
  Object.assign(p,{active:true,age:-delay,life,velocity:[...velocity],size:s,gravity,smoke,spin:[this.random()*5-2.5,this.random()*5-2.5,this.random()*5-2.5]});
  Object.assign(p.mesh,{visible:delay===0,position:[...position],scale:s,color:hex(color),emissive,quaternion:quaternion?[...quaternion]:qEuler(this.random()*3,this.random()*3,0),geometry:geometry||p.baseGeometry});return p;
 }
 burst(position,count,colors,{power=5,smoke=false,emissive=0,delay=0}={}){
  for(let i=0;i<count;i++){const a=this.random()*Math.PI*2,v=power*(.4+this.random()*.6),s=smoke?.7+this.random()*.7:.09+this.random()*.24;
   this.particle(add(position,[(this.random()-.5)*.9,this.random()*.7,(this.random()-.5)*.9]),[Math.cos(a)*v,smoke?1+this.random()*2:2+this.random()*power,Math.sin(a)*v],s,colors[i%colors.length],smoke?2+this.random():1.1+this.random()*1.5,{gravity:smoke?-.5:12,emissive,smoke,delay});
  }
 }
 break(prop,direction=[0,0,0],car=null){
  if(prop.broken)return false;prop.broken=true;prop.body.enabled=false;
  for(const mesh of prop.meshes)mesh.visible=false;
  if(prop.kind==='tnt'){
   this.stats.explosions++;this.explode(add(prop.position,[0,1,0]),car);
  }else{
   this.stats[prop.kind==='tree'?'trees':'poles']++;
   const v=mul(norm([direction[0],.25,direction[2]]),3.4);
   for(const mesh of prop.meshes){const parent=mesh.parent?.matrix,position=parent?transformPoint(parent,mesh.position):mesh.position,scale=parent?mesh.scale.map((s,i)=>s*Math.hypot(parent[i*4],parent[i*4+1],parent[i*4+2])):mesh.scale;const particle=this.particle(position,add(v,[this.random()*2-1,1.5,this.random()*2-1]),scale,'#ffffff',3.5,{geometry:mesh.geometry,quaternion:mesh.quaternion});if(particle)particle.mesh.color=[...mesh.color];}
   this.burst(add(prop.position,[0,1.3,0]),prop.kind==='tree'?23:19,prop.kind==='tree'?['#bf9461','#718c50','#d9ba83']:['#ffe395','#ffc15a','#879b97'],{power:4,emissive:prop.kind==='tree'?0:.7});
   this.burst(add(prop.position,[0,.2,0]),5,['#acb294','#c6bda1'],{power:1,smoke:true});
   this.onBreak?.(prop.kind,prop.position);
  }
  return true;
 }
 explode(position,car){
  for(let i=0;i<5;i++)this.particle(add(position,[(this.random()-.5)*1.3,.2+this.random()*.8,(this.random()-.5)*1.3]),[(this.random()-.5)*2,1.5+this.random(),(this.random()-.5)*2],1.2+this.random()*.6,['#f04b16','#ff8626','#ffbd44'][i%3],.65+this.random()*.25,{gravity:-1,emissive:.22,smoke:true});
  this.burst(position,34,['#ffad29','#ed541d','#ffdc63'],{power:9,emissive:.6});
  this.burst(position,12,['#343c39','#535950','#767769'],{power:2.6,smoke:true,delay:.22});
  this.burst(position,16,['#b96238','#623e2c','#ead19c'],{power:8});
  // Short, expanding ground ring gives the blast a readable silhouette.
  let ring=this.rings.find(r=>!r.active);
  if(!ring&&this.rings.length<6){ring={mesh:this.engine.mesh('ring',position,[1,1,1],'#ffe49d',{visible:false,castsShadow:false,emissive:1,quaternion:qEuler(Math.PI/2,0,0)})};this.rings.push(ring);}
  if(ring){ring.active=true;ring.age=0;ring.mesh.visible=true;ring.mesh.position=[position[0],heightAt(position[0],position[2])+.18,position[2]];}
  for(const body of this.physics.dynamicBodies){const d=sub(body.p,position),distance=length(d);if(distance>10||body.hinge)continue;const force=(1-distance/10)*(body.tag==='vehicle'?4.6:8);body.impulse(mul(norm([d[0],Math.max(1.7,d[1]),d[2]]),body.mass*force));}
  for(const prop of this.props)if(!prop.broken&&length(sub(prop.position,position))<6.2&&!this.pending.some(p=>p.prop===prop))this.pending.push({prop,at:this.time+.14+this.random()*.15,car});
  this.onExplosion?.(position);
 }
 update(dt){
  this.time+=dt;const due=this.pending.filter(p=>p.at<=this.time);this.pending=this.pending.filter(p=>p.at>this.time);
  for(const p of due)this.break(p.prop,[1,1,0],p.car);
  for(const p of this.particles){if(!p.active)continue;p.age+=dt;if(p.age<0)continue;if(p.age>=p.life){p.active=false;p.mesh.visible=false;continue;}p.mesh.visible=true;
   p.velocity[1]-=p.gravity*dt;p.mesh.position=add(p.mesh.position,mul(p.velocity,dt));
   const floor=heightAt(p.mesh.position[0],p.mesh.position[2])+p.size[1]*.22;
   if(!p.smoke&&p.mesh.position[1]<floor){p.mesh.position[1]=floor;p.velocity[1]=Math.abs(p.velocity[1])*.24;p.velocity[0]*=.74;p.velocity[2]*=.74;p.spin=mul(p.spin,.7);}
   p.mesh.quaternion=qIntegrate(p.mesh.quaternion,p.spin,dt);
   const fade=clamp((p.life-p.age)/.65,0,1),growth=p.smoke?1+p.age*.75:1;p.mesh.scale=p.size.map(s=>Math.max(.001,s*growth*fade));
  }
  for(const r of this.rings){if(!r.active)continue;r.age+=dt;if(r.age>.65){r.active=false;r.mesh.visible=false;continue;}const s=.5+r.age*13;r.mesh.scale=[s,s,Math.max(.025,1-r.age/.65)];}
 }
 reset(){
  for(const p of this.props){p.broken=false;p.body.enabled=true;for(const mesh of p.meshes)mesh.visible=true;}
  for(const p of [...this.particles,...this.rings]){p.active=false;p.mesh.visible=false;}this.pending=[];this.stats={trees:0,poles:0,explosions:0};
 }
}

export function blastEnvelope(age,reducedMotion=false){
 if(reducedMotion||age<0||age>=1.65)return {timeScale:1,zoom:0,shake:0,flash:0};
 const strength=Math.exp(-age*2.4);
 return {timeScale:age<.13?.32:age<.65?.22:clamp(.22+(age-.65)/.85,0,1),zoom:strength*.22,shake:strength*.26,flash:Math.max(0,1-age/.24)*.18};
}
