import {norm,cross,sub,TAU,transformPoint} from './math.js';
let counter=0;
export function geometry(positions,normals=[],uvs=[],colors=[],indices=null){
 const n=positions.length/3;
 if(!normals.length){normals=new Array(positions.length).fill(0);for(let t=0;t<(indices?.length??n);t+=3){const a=indices?indices[t]:t,b=indices?indices[t+1]:t+1,c=indices?indices[t+2]:t+2;const N=norm(cross(sub(positions.slice(b*3,b*3+3),positions.slice(a*3,a*3+3)),sub(positions.slice(c*3,c*3+3),positions.slice(a*3,a*3+3))));for(const i of [a,b,c])for(let k=0;k<3;k++)normals[i*3+k]+=N[k];}for(let i=0;i<n;i++)normals.splice(i*3,3,...norm(normals.slice(i*3,i*3+3)));}
 if(!uvs.length)uvs=new Array(n*2).fill(0);if(!colors.length)colors=new Array(n*3).fill(1);
 return {id:++counter,positions:new Float32Array(positions),normals:new Float32Array(normals),uvs:new Float32Array(uvs),colors:new Float32Array(colors),indices:indices?new Uint32Array(indices):null};
}
export function box(rounded=false){
 const p=[],n=[],u=[],idx=[];const faces=[[[1,0,0],[0,0,-1],[0,1,0]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]]];
 const seg=rounded?6:1;
 for(const [normal,right,up] of faces){const base=p.length/3;for(let y=0;y<=seg;y++)for(let x=0;x<=seg;x++){
   let v=normal.map((k,i)=>k*.5+right[i]*(x/seg-.5)+up[i]*(y/seg-.5)),N=normal;
   if(rounded){const core=v.map(c=>Math.max(-.39,Math.min(.39,c)));N=norm(sub(v,core));v=core.map((c,i)=>c+N[i]*.11);}
   p.push(...v);n.push(...N);u.push(x/seg,y/seg);
  }for(let y=0;y<seg;y++)for(let x=0;x<seg;x++){const a=base+y*(seg+1)+x,b=a+1,c=a+seg+1,d=c+1;idx.push(a,b,c,b,d,c);}}
 return geometry(p,n,u,[],idx);
}
export function cylinder(sides=16,top=1,bottom=1){
 const p=[],n=[],u=[],ind=[];
 for(let i=0;i<=sides;i++){const a=i/sides*TAU,x=Math.cos(a),z=Math.sin(a),N=norm([x,bottom-top,z]);p.push(x*bottom,-.5,z*bottom,x*top,.5,z*top);n.push(...N,...N);u.push(i/sides,0,i/sides,1);if(i<sides){let b=i*2;ind.push(b,b+1,b+2,b+1,b+3,b+2);}}
 for(const sign of [-1,1]){const base=p.length/3,r=sign>0?top:bottom;p.push(0,sign*.5,0);n.push(0,sign,0);u.push(.5,.5);for(let i=0;i<=sides;i++){const a=i/sides*TAU;p.push(Math.cos(a)*r,sign*.5,Math.sin(a)*r);n.push(0,sign,0);u.push(.5+Math.cos(a)*.5,.5+Math.sin(a)*.5);if(i<sides){if(sign>0)ind.push(base,base+i+2,base+i+1);else ind.push(base,base+i+1,base+i+2);}}}
 return geometry(p,n,u,[],ind);
}
export function sphere(segments=12,rings=8,flat=false){
 const p=[],n=[],u=[],idx=[];
 for(let y=0;y<=rings;y++)for(let x=0;x<=segments;x++){const a=x/segments*TAU,b=y/rings*Math.PI;const v=[Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a)];p.push(...v);n.push(...v);u.push(x/segments,1-y/rings);}
 for(let y=0;y<rings;y++)for(let x=0;x<segments;x++){const a=y*(segments+1)+x,b=a+segments+1;idx.push(a,a+1,b,a+1,b+1,b);}
 if(flat){const P=[],U=[];for(const i of idx){P.push(...p.slice(i*3,i*3+3));U.push(...u.slice(i*2,i*2+2));}return geometry(P,[],U);}
 return geometry(p,n,u,[],idx);
}
export function torus(major=1,minor=.075,segments=36,tube=6,arc=TAU){const p=[],n=[],u=[],idx=[];for(let j=0;j<=segments;j++)for(let i=0;i<=tube;i++){const a=j/segments*arc,b=i/tube*TAU,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);p.push((major+minor*cb)*ca,(major+minor*cb)*sa,minor*sb);n.push(cb*ca,cb*sa,sb);u.push(j/segments,i/tube);}for(let j=0;j<segments;j++)for(let i=0;i<tube;i++){const a=j*(tube+1)+i,b=a+tube+1;idx.push(a,b,a+1,b,b+1,a+1);}return geometry(p,n,u,[],idx);}
export function plane(){return geometry([-.5,0,-.5,-.5,0,.5,.5,0,.5,.5,0,-.5],[0,1,0,0,1,0,0,1,0,0,1,0],[0,1,0,0,1,0,1,1],[],[0,1,2,0,2,3]);}
export const primitives={box:box(),rounded:box(true),cylinder:cylinder(),hex:cylinder(6),cone:cylinder(7,0,1),sphere:sphere(),rock:sphere(7,5,true),ring:torus(),arch:torus(1,.12,24,6,Math.PI),plane:plane()};

/** Loads ordinary, uncompressed GLB geometry; no CDN, loader dependency or global path assumptions. */
export async function loadGLB(url){
 const response=await fetch(url);if(!response.ok)throw new Error(`Model ${url}: HTTP ${response.status}`);
 const buffer=await response.arrayBuffer(),view=new DataView(buffer);if(view.getUint32(0,true)!==0x46546c67)throw new Error('Invalid GLB header');
 let offset=12,json,bin;
 while(offset<buffer.byteLength){const len=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;const chunk=buffer.slice(offset,offset+len);if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(chunk));if(type===0x004e4942)bin=chunk;offset+=len;}
 if(!json||!bin)throw new Error('GLB is missing geometry');
 const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
 function read(id){const a=json.accessors[id],b=json.bufferViews[a.bufferView],size=components[a.type],d=new DataView(bin),methods={5126:['getFloat32',4],5125:['getUint32',4],5123:['getUint16',2],5121:['getUint8',1],5122:['getInt16',2],5120:['getInt8',1]};const [method,bytes]=methods[a.componentType],out=[];for(let i=0;i<a.count;i++)for(let j=0;j<size;j++){let v=d[method]((b.byteOffset||0)+(a.byteOffset||0)+i*(b.byteStride||size*bytes)+j*bytes,true);if(a.normalized)v/=a.componentType===5121?255:65535;out.push(v);}return out;}
 const result=[];
 for(let index=0;index<json.meshes.length;index++)for(const primitive of json.meshes[index].primitives){
  if(primitive.mode!==undefined&&primitive.mode!==4)continue;
  const a=primitive.attributes,positions=read(a.POSITION),normals=a.NORMAL!==undefined?read(a.NORMAL):[],uv=a.TEXCOORD_0!==undefined?read(a.TEXCOORD_0):[];
  let colors=a.COLOR_0!==undefined?read(a.COLOR_0):[];if(colors.length===positions.length/3*4)colors=colors.filter((_,i)=>i%4!==3);
  const material=json.materials?.[primitive.material]?.pbrMetallicRoughness?.baseColorFactor?.slice(0,3)||[1,1,1];
  result.push({name:json.meshes[index].name||`part_${index}`,geometry:geometry(positions,normals,uv,colors,primitive.indices!==undefined?read(primitive.indices):null),color:material});
 }
 return result;
}
