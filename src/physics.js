/*
 * Original fixed-step rigid-body solver. Units are metres, seconds and kilograms.
 * Oriented-box SAT, spheres, terrain contacts, impulses, angular inertia, friction,
 * raycast springs and a constrained seesaw. No network-loaded physics dependency.
 */
import {add,sub,mul,dot,cross,length,norm,clamp,qIdentity,qRotate,qConj,qIntegrate,qAxis,qMul,compose} from './math.js';
import {heightAt,normalAt} from './terrain.js';
let nextId=1;
const EPS=1e-7;
export class Body{
 constructor({position=[0,0,0],quaternion=qIdentity(),half=[.5,.5,.5],radius=0,mass=0,friction=.65,restitution=.12,tag='',hinge=null}={}){
  this.id=nextId++;this.p=[...position];this.q=[...quaternion];this.v=[0,0,0];this.w=[0,0,0];this.force=[0,0,0];this.torque=[0,0,0];this.half=half;this.radius=radius;this.mass=mass;this.invMass=mass>0&&!hinge?1/mass:0;this.friction=friction;this.restitution=restitution;this.tag=tag;this.hinge=hinge;
  this.home={p:[...position],q:[...quaternion]};this.bound=radius||length(half);this.enabled=true;this.sleeping=false;this.sleepTime=0;this.neverSleep=false;this.contacts=0;
  this.inertia=radius?[.4*mass*radius*radius,.4*mass*radius*radius,.4*mass*radius*radius]:[mass/3*(half[1]**2+half[2]**2),mass/3*(half[0]**2+half[2]**2),mass/3*(half[0]**2+half[1]**2)];
  this.invInertia=this.inertia.map(v=>mass>0&&v>EPS?1/v:0);this.matrix=compose(this.p,this.q);this.axes=[];this.updateAxes();
 }
 updateAxes(){this.axes=[[1,0,0],[0,1,0],[0,0,1]].map(a=>qRotate(this.q,a));}
 wake(){this.sleeping=false;this.sleepTime=0;}
 forceAt(force,point=this.p){if(!this.mass)return;this.force=add(this.force,force);this.torque=add(this.torque,cross(sub(point,this.p),force));if(length(force)>2)this.wake();}
 inverseInertia(vector){if(!this.mass)return [0,0,0];const local=qRotate(qConj(this.q),vector);let result=qRotate(this.q,local.map((x,i)=>x*this.invInertia[i]));if(this.hinge)result=mul(this.hinge.axis,dot(result,this.hinge.axis));return result;}
 impulse(impulse,point=this.p){if(!this.mass)return;this.v=add(this.v,mul(impulse,this.invMass));this.w=add(this.w,this.inverseInertia(cross(sub(point,this.p),impulse)));if(this.sleeping&&length(impulse)>.12)this.wake();}
 velocityAt(point){return add(this.v,cross(this.w,sub(point,this.p)));}
 reset(position=this.home.p,quaternion=this.home.q){this.p=[...position];this.q=[...quaternion];this.v=[0,0,0];this.w=[0,0,0];this.force=[0,0,0];this.torque=[0,0,0];this.wake();this.updateAxes();this.sync();}
 sync(){compose(this.p,this.q,[1,1,1],this.matrix);}
}
function closest(body,p){const d=sub(p,body.p);return body.axes.reduce((out,axis,i)=>add(out,mul(axis,clamp(dot(d,axis),-body.half[i],body.half[i]))),[...body.p]);}
function sphereBox(a,b){const point=closest(b,a.p),delta=sub(point,a.p),d=length(delta);if(d>=a.radius)return null;if(d<EPS){const local=qRotate(qConj(b.q),sub(a.p,b.p));let axis=0,gap=Infinity;for(let i=0;i<3;i++){const g=b.half[i]-Math.abs(local[i]);if(g<gap){gap=g;axis=i;}}const normal=mul(b.axes[axis],local[axis]>=0?-1:1);return {n:normal,depth:a.radius+gap,point:sub(a.p,mul(normal,a.radius))};}return {n:mul(delta,1/d),depth:a.radius-d,point};}
export function collide(a,b){
 if(a.radius&&b.radius){const delta=sub(b.p,a.p),d=length(delta),r=a.radius+b.radius;if(d>=r)return null;const n=d>EPS?mul(delta,1/d):[1,0,0];return {n,depth:r-d,point:add(a.p,mul(n,a.radius))};}
 if(a.radius)return sphereBox(a,b);if(b.radius){const c=sphereBox(b,a);return c?{...c,n:mul(c.n,-1)}:null;}
 const delta=sub(b.p,a.p),axes=[...a.axes,...b.axes];for(const aa of a.axes)for(const bb of b.axes){const c=cross(aa,bb);if(dot(c,c)>.0001)axes.push(norm(c));}
 let depth=Infinity,normal;
 for(const axis of axes){const ra=a.half.reduce((sum,h,i)=>sum+h*Math.abs(dot(axis,a.axes[i])),0),rb=b.half.reduce((sum,h,i)=>sum+h*Math.abs(dot(axis,b.axes[i])),0),d=dot(delta,axis),overlap=ra+rb-Math.abs(d);if(overlap<=0)return null;if(overlap<depth){depth=overlap;normal=mul(axis,d<0?-1:1);}}
 const pa=closest(a,b.p),pb=closest(b,a.p);return {n:normal,depth,point:mul(add(pa,pb),.5)};
}
function impulseDenom(body,r,n){return body.invMass+dot(n,cross(body.inverseInertia(cross(r,n)),r));}
export function resolve(a,b,c,correction=.65){
 const n=c.n,inv=a.invMass+b.invMass;
 if(inv>0){const move=mul(n,Math.max(c.depth-.009,0)*correction/inv);if(a.invMass)a.p=sub(a.p,mul(move,a.invMass));if(b.invMass)b.p=add(b.p,mul(move,b.invMass));}
 const ra=sub(c.point,a.p),rb=sub(c.point,b.p),relative=sub(b.velocityAt(c.point),a.velocityAt(c.point)),vn=dot(relative,n);
 if(vn>0)return 0;const denom=impulseDenom(a,ra,n)+impulseDenom(b,rb,n);if(denom<EPS)return 0;
 const restitution=Math.abs(vn)>1?Math.min(a.restitution,b.restitution):0,j=-(1+restitution)*vn/denom,impulse=mul(n,j);a.impulse(mul(impulse,-1),c.point);b.impulse(impulse,c.point);
 const v2=sub(b.velocityAt(c.point),a.velocityAt(c.point)),t=norm(sub(v2,mul(n,dot(v2,n)))),td=impulseDenom(a,ra,t)+impulseDenom(b,rb,t);
 if(td>EPS){const friction=Math.sqrt(a.friction*b.friction),jt=clamp(-dot(v2,t)/td,-j*friction,j*friction),f=mul(t,jt);a.impulse(mul(f,-1),c.point);b.impulse(f,c.point);}
 a.contacts++;b.contacts++;return j;
}
function rayBox(body,origin,direction,max){
 const o=qRotate(qConj(body.q),sub(origin,body.p)),d=qRotate(qConj(body.q),direction);let near=0,far=max,axis=-1,sign=1;
 for(let i=0;i<3;i++){if(Math.abs(d[i])<EPS){if(o[i]<-body.half[i]||o[i]>body.half[i])return null;continue;}
  let t1=(-body.half[i]-o[i])/d[i],t2=(body.half[i]-o[i])/d[i],s=-1;if(t1>t2){[t1,t2]=[t2,t1];s=1;}if(t1>near){near=t1;axis=i;sign=s;}far=Math.min(far,t2);if(near>far)return null;}
 if(near<0||near>max)return null;return {distance:near,point:add(origin,mul(direction,near)),normal:axis<0?[0,1,0]:mul(body.axes[axis],sign),body};
}
export class PhysicsWorld{
 constructor(){this.bodies=[];this.staticBodies=[];this.dynamicBodies=[];this.gravity=[0,-18,0];this.ground=new Body({friction:.85,restitution:.08,tag:'terrain'});this.hash=new Map();this.cell=14;this.beforeStep=[];this.onImpact=null;this.time=0;}
 add(config){const body=config instanceof Body?config:new Body(config);this.bodies.push(body);if(body.mass){this.dynamicBodies.push(body);}else{this.staticBodies.push(body);const minX=Math.floor((body.p[0]-body.bound)/this.cell),maxX=Math.floor((body.p[0]+body.bound)/this.cell),minZ=Math.floor((body.p[2]-body.bound)/this.cell),maxZ=Math.floor((body.p[2]+body.bound)/this.cell);for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=`${x},${z}`;if(!this.hash.has(key))this.hash.set(key,[]);this.hash.get(key).push(body);}}return body;}
 nearby(p,r=3){const set=new Set();for(let x=Math.floor((p[0]-r)/this.cell);x<=Math.floor((p[0]+r)/this.cell);x++)for(let z=Math.floor((p[2]-r)/this.cell);z<=Math.floor((p[2]+r)/this.cell);z++)for(const b of this.hash.get(`${x},${z}`)||[])set.add(b);return [...set];}
 raycast(origin,direction,max,exclude=null){
  let hit=null;const terrainDiff=t=>{const p=add(origin,mul(direction,t));return p[1]-heightAt(p[0],p[2]);};
  let previous=0,prevDiff=terrainDiff(0);if(prevDiff<=0)hit={distance:0,point:[origin[0],heightAt(origin[0],origin[2]),origin[2]],normal:normalAt(origin[0],origin[2]),body:this.ground};
  else for(let i=1;i<=10;i++){const t=max*i/10,d=terrainDiff(t);if(d<=0){let low=previous,high=t;for(let k=0;k<9;k++){const mid=(low+high)/2;if(terrainDiff(mid)>0)low=mid;else high=mid;}const p=add(origin,mul(direction,high));hit={distance:high,point:p,normal:normalAt(p[0],p[2]),body:this.ground};break;}previous=t;prevDiff=d;}
  const candidates=[...this.nearby(origin,max),...this.dynamicBodies.filter(b=>b.hinge)];
  for(const b of candidates){if(b.enabled===false||b===exclude||b.radius)continue;const result=rayBox(b,origin,direction,hit?.distance??max);if(result&&(!hit||result.distance<hit.distance))hit=result;}
  return hit;
 }
 terrainContacts(b){
  if(b.hinge)return;
  if(b.radius){const h=heightAt(b.p[0],b.p[2]),depth=h-(b.p[1]-b.radius);if(depth>0)resolve(b,this.ground,{n:mul(normalAt(b.p[0],b.p[2]),-1),depth,point:[b.p[0],h,b.p[2]]},.85);return;}
  const corners=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const p=add(b.p,qRotate(b.q,[x*b.half[0],y*b.half[1],z*b.half[2]])),h=heightAt(p[0],p[2]);if(p[1]<h)corners.push({p,h});}
  corners.sort((a,b)=>a.p[1]-b.p[1]);for(const {p,h} of corners.slice(0,4))resolve(b,this.ground,{n:mul(normalAt(p[0],p[2]),-1),depth:h-p[1],point:[p[0],h,p[2]]},.55);
 }
 step(dt){
  this.time+=dt;
  for(const b of this.dynamicBodies){b.contacts=0;b.force=b.hinge?[0,0,0]:mul(this.gravity,b.mass);b.torque=[0,0,0];}
  for(const fn of this.beforeStep)fn(dt);
  for(const b of this.dynamicBodies){if(b.sleeping)continue;b.v=add(b.v,mul(b.force,b.invMass*dt));b.w=add(b.w,mul(b.inverseInertia(b.torque),dt));b.v=mul(b.v,Math.exp(-.035*dt));b.w=mul(b.w,Math.exp(-(b.tag==='vehicle'?1.8:.85)*dt));if(length(b.v)>65)b.v=mul(norm(b.v),65);if(length(b.w)>15)b.w=mul(norm(b.w),15);b.p=add(b.p,mul(b.v,dt));b.q=qIntegrate(b.q,b.w,dt);b.updateAxes();}
  for(let iteration=0;iteration<4;iteration++){
   for(const b of this.dynamicBodies){if(b.sleeping)continue;this.terrainContacts(b);for(const s of this.nearby(b.p,b.bound)){if(s.enabled===false||Math.hypot(b.p[0]-s.p[0],b.p[2]-s.p[2])>b.bound+s.bound)continue;const c=collide(b,s);if(c){const j=resolve(b,s,c);if(iteration===0&&j>60)this.onImpact?.(b,s,j);}}}
   for(let i=0;i<this.dynamicBodies.length;i++)for(let j=i+1;j<this.dynamicBodies.length;j++){const a=this.dynamicBodies[i],b=this.dynamicBodies[j];if(a.sleeping&&b.sleeping)continue;const d=sub(b.p,a.p);if(dot(d,d)>(a.bound+b.bound)**2)continue;const c=collide(a,b);if(c){const impulse=resolve(a,b,c);if(iteration===0&&impulse>30)this.onImpact?.(a,b,impulse);}}
   for(const b of this.dynamicBodies)if(b.hinge){const axis=b.hinge.axis;let angle=2*Math.atan2(dot(b.q,axis),b.q[3]);if(angle<b.hinge.min||angle>b.hinge.max){angle=clamp(angle,b.hinge.min,b.hinge.max);b.w=mul(b.w,.6);}b.p=[...b.hinge.anchor];b.v=[0,0,0];b.w=mul(axis,dot(b.w,axis));b.q=qAxis(axis,angle);b.updateAxes();}
  }
  for(const b of this.dynamicBodies){if(!b.neverSleep&&!b.hinge&&length(b.v)<.055&&length(b.w)<.09&&b.contacts){b.sleepTime+=dt;if(b.sleepTime>1.8){b.sleeping=true;b.v=[0,0,0];b.w=[0,0,0];}}else b.sleepTime=0;b.updateAxes();b.sync();}
 }
 resetProps(){for(const b of this.dynamicBodies)if(b.tag!=='vehicle')b.reset();}
}
export class Vehicle{
 constructor(world,position=[0,2.9,32]){
  this.world=world;this.body=world.add({position,half:[1.03,.34,1.93],mass:220,friction:.18,restitution:.04,tag:'vehicle'});this.body.neverSleep=true;this.body.inertia=[340,550,340];this.body.invInertia=this.body.inertia.map(v=>1/v);
  this.wheels=[[-1.13,.12,-1.35],[1.13,.12,-1.35],[-1.13,.12,1.35],[1.13,.12,1.35]].map((point,i)=>({point,front:i<2,length:.62,radius:.53,spin:0,hit:null,matrix:compose()}));
  this.controls={throttle:0,steer:0,brake:false,boost:false};this.steering=0;this.speed=0;this.grounded=0;this.battery=1;this.jumpCooldown=0;this.boosting=false;this.distance=0;this.lastPosition=[...position];world.beforeStep.push(dt=>this.preStep(dt));
 }
 preStep(dt){
  const b=this.body,up=qRotate(b.q,[0,1,0]),down=mul(up,-1),forward=qRotate(b.q,[0,0,-1]),c=this.controls;this.speed=dot(b.v,forward);this.grounded=0;this.jumpCooldown=Math.max(0,this.jumpCooldown-dt);
  const target=c.steer*(.55-Math.min(Math.abs(this.speed)/32,.24));this.steering+=(target-this.steering)*Math.min(1,dt*9);
  this.boosting=!!c.boost&&c.throttle>0&&this.battery>.02;this.battery=clamp(this.battery+dt*(this.boosting?-.20:.10),0,1);const top=this.boosting?27:19;
  for(const wheel of this.wheels){
   const connection=add(b.p,qRotate(b.q,wheel.point)),hit=this.world.raycast(connection,down,1.30,b);wheel.hit=hit;wheel.length=.72;
   const steer=wheel.front?this.steering:0,wheelForward=qRotate(qMul(b.q,qAxis([0,1,0],steer)),[0,0,-1]),side=norm(cross(wheelForward,up));
   if(hit&&dot(hit.normal,up)>.22){
    this.grounded++;wheel.length=clamp(hit.distance-wheel.radius,.08,.72);const relative=sub(b.velocityAt(connection),hit.body.velocityAt(hit.point));
    const compression=.62-wheel.length,spring=clamp(compression*23000-dot(relative,up)*1700,0,7200),springForce=mul(up,spring);
    b.forceAt(springForce,connection);if(hit.body.mass)hit.body.forceAt(mul(springForce,-1),hit.point);
    const contactVelocity=sub(b.velocityAt(hit.point),hit.body.velocityAt(hit.point));const lateral=dot(contactVelocity,side),longitudinal=dot(contactVelocity,wheelForward);
    const grip=c.brake && !wheel.front ? .42 : 1.6,lateralForce=clamp(-lateral*950,-spring*grip,spring*grip);
    let engine=0;if(c.throttle>0&&this.speed<top)engine=600*c.throttle*(this.boosting?1.7:1);if(c.throttle<0&&this.speed>-8)engine=530*c.throttle;
    if((c.throttle>0&&this.speed<-.6)||(c.throttle<0&&this.speed>.6))engine-=longitudinal*140;
    if(c.brake)engine=clamp(-longitudinal*440,-2600,2600);else if(!c.throttle)engine=-longitudinal*22;
    const tire=add(mul(side,lateralForce),mul(wheelForward,clamp(engine,-spring*2,spring*2)));
    // Reduced roll lever arm gives an accessible toy-car feel without locking pitch/roll.
    const leverage=add(connection,mul(down,.20));b.forceAt(tire,leverage);if(hit.body.mass)hit.body.forceAt(mul(tire,-1),hit.point);
   }
   wheel.spin+=this.speed/wheel.radius*dt;
  }
  b.forceAt(mul(b.v,-(1.6+Math.abs(this.speed)*.55)));
  // Gentle air control; ground steering remains tire-force driven.
  if(this.grounded===0){b.torque=add(b.torque,[c.throttle*35,c.steer*65,0]);}
  this.distance+=Math.hypot(b.p[0]-this.lastPosition[0],b.p[2]-this.lastPosition[2]);this.lastPosition=[...b.p];
 }
 updateVisuals(){const b=this.body;for(const wheel of this.wheels){const p=add(b.p,qRotate(b.q,add(wheel.point,[0,-wheel.length,0]))),q=qMul(qMul(b.q,qAxis([0,1,0],wheel.front?this.steering:0)),qAxis([1,0,0],wheel.spin));compose(p,q,[1,1,1],wheel.matrix);}}
 jump(){if(!this.grounded||this.jumpCooldown>0)return false;this.body.impulse([0,this.body.mass*6.6,0]);this.jumpCooldown=1;return true;}
 hydraulic(corner){if(!this.grounded)return false;const wheel=this.wheels[clamp(corner,0,3)],p=add(this.body.p,qRotate(this.body.q,wheel.point));this.body.impulse([0,240,0],p);return true;}
 reset(position=[0,2.9,32],yaw=0){this.body.reset(position,qAxis([0,1,0],yaw));this.lastPosition=[...position];this.steering=0;this.controls={throttle:0,steer:0,brake:false,boost:false};this.speed=0;this.jumpCooldown=.5;}
}
