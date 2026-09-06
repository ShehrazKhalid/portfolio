const KEY='shehraz-grove-v2';
const defaults=()=>({version:2,visited:[],collected:[],achievements:[],bestLap:null,distance:0,paint:'#c2df74',model:'rover',night:false,quality:'high',reducedMotion:false,camera:'diorama',notes:[],scores:[]});
export class SaveStore{
 constructor(){this.available=true;this.data=defaults();try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw&&raw.version===2){for(const key of ['visited','collected','achievements','notes','scores'])if(Array.isArray(raw[key]))this.data[key]=raw[key].slice(0,100);for(const key of ['paint','model','quality','camera'])if(typeof raw[key]==='string')this.data[key]=raw[key];for(const key of ['night','reducedMotion'])if(typeof raw[key]==='boolean')this.data[key]=raw[key];if(Number.isFinite(raw.bestLap)&&raw.bestLap>0)this.data.bestLap=raw.bestLap;if(Number.isFinite(raw.distance)&&raw.distance>=0)this.data.distance=raw.distance;}}catch{this.available=false;}}
 save(){try{localStorage.setItem(KEY,JSON.stringify(this.data));return true;}catch{this.available=false;return false;}}
 reset(){this.data=defaults();this.save();}
}
export class CommunityService{
 constructor(store){this.store=store;this.online=false;this.base=new URL('../api/',import.meta.url);}
 async init(){try{const controller=new AbortController();const id=setTimeout(()=>controller.abort(),1800);const r=await fetch(new URL('status',this.base),{signal:controller.signal});clearTimeout(id);if(r.ok&&r.headers.get('content-type')?.includes('json')){const json=await r.json();this.online=json.service==='shehraz-grove';}}catch{}return this.online;}
 async get(kind){if(!this.online)return [...this.store.data[kind==='notes'?'notes':'scores']];const r=await fetch(new URL(kind,this.base));if(!r.ok)throw new Error('The community service could not be reached.');return r.json();}
 async post(kind,data){if(!this.online){const key=kind==='notes'?'notes':'scores',item={...data,id:Date.now().toString(36),createdAt:new Date().toISOString()};this.store.data[key].unshift(item);this.store.data[key]=this.store.data[key].slice(0,30);this.store.save();return item;}const r=await fetch(new URL(kind,this.base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw new Error(result.error||'Could not save. Please try again.');return result;}
}
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const safeURL=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
export const formatTime=seconds=>{if(seconds===null||!Number.isFinite(seconds))return '--:--.---';const m=Math.floor(seconds/60),s=Math.floor(seconds%60),ms=Math.floor((seconds%1)*1000);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;};
