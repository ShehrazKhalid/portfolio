import test from 'node:test';
import assert from 'node:assert/strict';
import {PhysicsWorld,Vehicle} from '../src/physics.js';
import {PortfolioWorld} from '../src/world.js';
import {blastEnvelope} from '../src/destruction.js';
import {hex,qIdentity,compose} from '../src/math.js';
import {heightAt} from '../src/terrain.js';
const step=1/60;
function setup(){
 const engine={mesh(shape,position,scale,color,options={}){return {position:[...position],scale:[...scale],quaternion:qIdentity(),color:hex(color),visible:true,matrix:compose(),...options};},textTexture(){return {};}};
 const physics=new PhysicsWorld(),world=new PortfolioWorld(engine,physics),vehicle=new Vehicle(physics);
 physics.onImpact=(a,b,j)=>world.destruction.impact(a,b,j);return {physics,world,vehicle,d:world.destruction};
}
test('driving into a tree breaks its visible pieces and removes its collider',()=>{
 const {physics,vehicle,d}=setup(),tree=d.props.find(p=>p.kind==='tree'&&p.position[0]===-8);
 vehicle.reset([-8,heightAt(-8,44)+1.8,44]);for(let i=0;i<90;i++)physics.step(step);vehicle.controls.throttle=1;
 for(let i=0;i<220;i++){physics.step(step);d.update(step);}
 assert.equal(tree.broken,true);assert.equal(tree.body.enabled,false);assert.ok(tree.meshes.every(m=>!m.visible));assert.ok(vehicle.body.p[2]<tree.position[2]-2);
});
test('lamp collision fires a metal break effect only once, and reset restores it',()=>{
 const {vehicle,d}=setup(),pole=d.props.find(p=>p.kind==='pole');let sounds=0;d.onBreak=kind=>{assert.equal(kind,'pole');sounds++;};
 assert.equal(d.impact(vehicle.body,pole.body,20),false);assert.equal(d.impact(vehicle.body,pole.body,350),true);assert.equal(d.impact(vehicle.body,pole.body,350),false);assert.equal(sounds,1);
 d.reset();assert.equal(pole.body.enabled,true);assert.ok(pole.meshes.every(m=>m.visible));assert.equal(d.pending.length,0);
});
test('TNT contact triggers nearby crates, imparts an impulse and respects distant props',()=>{
 const {vehicle,d}=setup(),tnt=d.props.find(p=>p.kind==='tnt');vehicle.reset([tnt.position[0],tnt.position[1]+1,tnt.position[2]+2]);
 let explosions=0;d.onExplosion=()=>explosions++;assert.equal(d.impact(vehicle.body,tnt.body,200),true);
 assert.ok(vehicle.body.v.some(v=>Math.abs(v)>0));for(let i=0;i<60;i++)d.update(step);
 assert.equal(explosions,3);assert.equal(d.stats.explosions,3);assert.ok(d.props.filter(p=>p.kind==='tnt'&&!p.broken).length>=5);
 for(let i=0;i<250;i++)d.update(step);assert.ok(d.particles.every(p=>!p.active));assert.ok(d.rings.every(r=>!r.active));
});
test('debris pool stays bounded through repeated destruction and resets',()=>{
 const {d}=setup();for(let cycle=0;cycle<5;cycle++){for(const p of d.props)d.break(p,[3,0,0]);d.reset();}
 assert.ok(d.particles.length<=220);assert.ok(d.rings.length<=6);assert.equal(d.pending.length,0);assert.ok(d.props.every(p=>!p.broken&&p.body.enabled));
});
test('blast slowdown and zoom recover in real time; reduced motion disables them',()=>{
 assert.ok(blastEnvelope(.3).timeScale<.3);assert.ok(blastEnvelope(.3).zoom>0);assert.deepEqual(blastEnvelope(2),{timeScale:1,zoom:0,shake:0,flash:0});
 assert.deepEqual(blastEnvelope(.2,true),{timeScale:1,zoom:0,shake:0,flash:0});
});
