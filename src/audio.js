import {clamp} from './math.js';
export class AudioSystem{
 constructor(){this.context=null;this.enabled=false;}
 async enable(on){
  this.enabled=on;
  if(on&&!this.context){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){this.enabled=false;return false;}this.context=new Audio();this.master=this.context.createGain();this.master.gain.value=.24;this.master.connect(this.context.destination);
   this.motor=this.context.createOscillator();this.motor.type='triangle';this.motorGain=this.context.createGain();this.motorGain.gain.value=0;this.motor.connect(this.motorGain);this.motorGain.connect(this.master);this.motor.start();
   this.lowMotor=this.context.createOscillator();this.lowMotor.type='sine';this.lowGain=this.context.createGain();this.lowGain.gain.value=0;this.lowMotor.connect(this.lowGain);this.lowGain.connect(this.master);this.lowMotor.start();
  }
  if(this.context){if(on){try{await this.context.resume();}catch{this.enabled=false;}}this.master.gain.setTargetAtTime(this.enabled ? .24 : 0,this.context.currentTime,.06);}return this.enabled;
 }
 update(speed,throttle,active=true){if(!this.context)return;const t=this.context.currentTime,amount=this.enabled&&active?clamp(Math.abs(speed)/23,0,1):0;this.motor.frequency.setTargetAtTime(48+amount*92+Math.abs(throttle)*17,t,.07);this.lowMotor.frequency.setTargetAtTime(35+amount*47,t,.08);this.motorGain.gain.setTargetAtTime(amount*.085,t,.08);this.lowGain.gain.setTargetAtTime(amount*.06,t,.08);}
 tone(freq=600,duration=.1,type='sine',volume=.13,delay=0){if(!this.enabled||!this.context)return;const ctx=this.context,t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.02);}
 collect(){this.tone(660,.14);this.tone(990,.2,'sine',.13,.08);}
 achievement(){[440,554,660,880].forEach((f,i)=>this.tone(f,.3,'sine',.11,i*.075));}
 horn(){this.tone(277,.35,'triangle',.25);this.tone(349,.35,'triangle',.14);}
 impact(strength){if(strength<90)return;this.tone(58,.08,'triangle',Math.min(strength/4000,.14));}
 noise(duration,frequency,volume,filter='lowpass'){
  if(!this.enabled||!this.context)return;const ctx=this.context,t=ctx.currentTime;
  const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),samples=buffer.getChannelData(0);
  for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.exp(-i/samples.length*3);
  const source=ctx.createBufferSource(),eq=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;eq.type=filter;eq.frequency.value=frequency;
  gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.001,t+duration);source.connect(eq);eq.connect(gain);gain.connect(this.master);
  source.onended=()=>{source.disconnect();eq.disconnect();gain.disconnect();};source.start(t);source.stop(t+duration);
 }
 breakProp(kind){
  if(kind==='tree'){this.noise(.38,1450,.62);this.tone(105,.2,'triangle',.22);this.tone(72,.28,'sawtooth',.08,.055);}
  else{this.noise(.23,3300,.32,'highpass');this.tone(580,.5,'triangle',.2);this.tone(860,.34,'sine',.12,.04);}
 }
 explosion(){
  this.noise(1.05,780,.95);this.noise(.22,2900,.65);this.tone(46,.95,'sine',.85);this.tone(85,.4,'triangle',.33);
  if(this.enabled&&this.context){const ctx=this.context,t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(26,t+.6);g.gain.setValueAtTime(.65,t);g.gain.exponentialRampToValueAtTime(.001,t+.8);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+.85);}
 }
}
