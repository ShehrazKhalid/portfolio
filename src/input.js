import {clamp} from './math.js';
const ACTIONS={Space:'jump',KeyE:'interact',Enter:'interact',KeyR:'reset',KeyM:'map',KeyH:'horn',KeyN:'night',KeyL:'audio',KeyC:'camera',KeyG:'garage',KeyP:'photo',Escape:'escape',Digit1:'hydraulic0',Digit2:'hydraulic1',Digit3:'hydraulic2',Digit4:'hydraulic3'};
export class Input{
 constructor(canvas){
  this.keys=new Set();this.actions=[];this.touch={throttle:0,steer:0,boost:false,brake:false};this.camera={yaw:0,pitch:0,zoom:0};this.lastButtons=[];this.drag=null;
  this.typing=()=>/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');
  addEventListener('keydown',e=>{if(window.__portfolioLightboxOpen)return;if(this.typing()&&e.code!=='Escape')return;if(/^(BUTTON|A)$/.test(document.activeElement?.tagName||'')&&['Enter','Space'].includes(e.code))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();this.keys.add(e.code);if(ACTIONS[e.code]&&!e.repeat)this.actions.push(ACTIONS[e.code]);});
  addEventListener('keyup',e=>this.keys.delete(e.code));addEventListener('blur',()=>this.clear());document.addEventListener('visibilitychange',()=>this.clear());
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(this.drag?.id!==e.pointerId)return;this.camera.yaw-=(e.clientX-this.drag.x)*.006;this.camera.pitch+=(e.clientY-this.drag.y)*.004;this.drag.x=e.clientX;this.drag.y=e.clientY;});
  const release=()=>this.drag=null;canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('wheel',e=>{e.preventDefault();this.camera.zoom+=e.deltaY*.025;},{passive:false});
  this.setupTouch();
 }
 clear(){this.actions=[];this.keys.clear();this.touch.throttle=0;this.touch.steer=0;this.touch.boost=false;this.touch.brake=false;this.drag=null;const stick=document.querySelector('#stick');if(stick)stick.style.transform='translate(0,0)';}
 setupTouch(){const joy=document.querySelector('#joystick'),stick=document.querySelector('#stick');if(joy){let id=null;const move=e=>{if(e.pointerId!==id)return;const r=joy.getBoundingClientRect(),dx=clamp((e.clientX-r.left-r.width/2)/(r.width*.35),-1,1),dy=clamp((e.clientY-r.top-r.height/2)/(r.height*.35),-1,1);this.touch.steer=Math.abs(dx)>.12?-dx:0;this.touch.throttle=Math.abs(dy)>.12?-dy:0;stick.style.transform=`translate(${dx*32}px,${dy*32}px)`;};joy.addEventListener('pointerdown',e=>{id=e.pointerId;joy.setPointerCapture(id);move(e);});joy.addEventListener('pointermove',move);const end=()=>{id=null;this.touch.steer=0;this.touch.throttle=0;stick.style.transform='translate(0,0)';};joy.addEventListener('pointerup',end);joy.addEventListener('pointercancel',end);}
  for(const button of document.querySelectorAll('[data-hold]')){const key=button.dataset.hold;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);this.touch[key]=true;button.classList.add('pressed');});const end=()=>{this.touch[key]=false;button.classList.remove('pressed');};button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);}
 }
 read(){const k=this.keys;let throttle=(k.has('KeyW')||k.has('ArrowUp')?1:0)-(k.has('KeyS')||k.has('ArrowDown')?1:0),steer=(k.has('KeyA')||k.has('ArrowLeft')?1:0)-(k.has('KeyD')||k.has('ArrowRight')?1:0),brake=k.has('ControlLeft')||k.has('KeyB')||this.touch.brake,boost=k.has('ShiftLeft')||k.has('ShiftRight')||this.touch.boost;
  if(Math.abs(this.touch.throttle)>Math.abs(throttle))throttle=this.touch.throttle;if(Math.abs(this.touch.steer)>Math.abs(steer))steer=this.touch.steer;
  const pad=navigator.getGamepads?.().find(p=>p?.connected);if(pad){const axis=pad.axes[0]||0;if(Math.abs(axis)>.15)steer=-axis;const gas=(pad.buttons[7]?.value||0)-(pad.buttons[6]?.value||0);if(Math.abs(gas)>.1)throttle=gas;boost=boost||pad.buttons[1]?.pressed;brake=brake||pad.buttons[2]?.pressed;for(const [i,action] of [[0,'interact'],[3,'jump'],[8,'reset'],[9,'escape'],[10,'horn']])if(pad.buttons[i]?.pressed&&!this.lastButtons[i])this.actions.push(action);this.lastButtons=pad.buttons.map(b=>b.pressed);}
  return {throttle,steer,brake:!!brake,boost:!!boost};
 }
 consume(){const out=this.actions;this.actions=[];return out;}
}
