/* Small allocation-friendly math toolkit. Column-major matrices; right-handed world. */
export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a,b,t) => a+(b-a)*t;
export const smooth = (a,b,x) => { const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
export const v3 = (x=0,y=0,z=0) => [x,y,z];
export const add = (a,b) => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub = (a,b) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const mul = (a,s) => [a[0]*s,a[1]*s,a[2]*s];
export const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const length = a => Math.hypot(...a);
export const norm = a => mul(a,1/(length(a)||1));
export const distance = (a,b) => length(sub(a,b));
export const distanceXZ = (a,b) => Math.hypot(a[0]-b[0],a[2]-b[2]);
export const mix3 = (a,b,t) => a.map((v,i)=>lerp(v,b[i],t));
export const qIdentity = () => [0,0,0,1];
export const qNorm = q => {const l=Math.hypot(...q)||1;return q.map(v=>v/l);};
export const qConj = q => [-q[0],-q[1],-q[2],q[3]];
export function qMul(a,b){
 const [x,y,z,w]=a,[X,Y,Z,W]=b;
 return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];
}
export const qAxis = (axis,angle) => {const s=Math.sin(angle/2);return [...mul(norm(axis),s),Math.cos(angle/2)];};
export const qEuler = (x=0,y=0,z=0) => qMul(qMul(qAxis([0,1,0],y),qAxis([1,0,0],x)),qAxis([0,0,1],z));
export function qRotate(q,v){const t=mul(cross(q,v),2);return add(v,add(mul(t,q[3]),cross(q,t)));}
export function qIntegrate(q,w,dt){const d=qMul([...w,0],q);return qNorm(q.map((x,i)=>x+d[i]*dt*.5));}
export function compose(p=[0,0,0],q=[0,0,0,1],s=[1,1,1],out=new Float32Array(16)){
 const [x,y,z,w]=q,xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z;
 out.set([(1-2*(yy+zz))*s[0],2*(xy+wz)*s[0],2*(xz-wy)*s[0],0,
  2*(xy-wz)*s[1],(1-2*(xx+zz))*s[1],2*(yz+wx)*s[1],0,
  2*(xz+wy)*s[2],2*(yz-wx)*s[2],(1-2*(xx+yy))*s[2],0,...p,1]);return out;
}
export function mMul(a,b,out=new Float32Array(16)){
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return out;
}
export function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
export function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
export function lookAt(eye,target,up=[0,1,0]){
 const z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x);
 return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
}
export function transformPoint(m,p){const [x,y,z]=p,w=m[3]*x+m[7]*y+m[11]*z+m[15];return [(m[0]*x+m[4]*y+m[8]*z+m[12])/w,(m[1]*x+m[5]*y+m[9]*z+m[13])/w,(m[2]*x+m[6]*y+m[10]*z+m[14])/w];}
export function hex(c){if(Array.isArray(c))return c;const n=typeof c==='number'?c:parseInt(c.replace('#',''),16);return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];}
export function seeded(seed=17){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
