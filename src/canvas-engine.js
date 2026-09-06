import {signCanvas} from './sign-texture.js';
/* A real, triangle-projected software renderer for devices without WebGL.
 * It uses the SAME world, meshes, camera and physics; only shadows and geometric
 * detail are reduced. This is a compatibility path, not the primary renderer. */
import {compose,mMul,perspective,lookAt,hex,qIdentity,norm,mix3,dot} from './math.js';
import {geometry,primitives,box,cylinder,sphere,torus} from './geometry.js';
import {heightAt,normalAt} from './terrain.js';
const lod={box:primitives.box,rounded:primitives.box,cylinder:cylinder(8),hex:primitives.hex,cone:cylinder(6,0,1),sphere:sphere(6,4),rock:sphere(5,3,true),ring:torus(1,.075,12,3),arch:torus(1,.12,10,3,Math.PI),plane:primitives.plane};
const reduced=new Map(Object.entries(primitives).map(([key,g])=>[g.id,lod[key]]));
function coarseTerrain(){const p=[],n=[],uv=[],c=[],indices=[],N=31;for(let i=0;i<N;i++)for(let j=0;j<N;j++){const x=-120+i*8,z=-120+j*8,h=heightAt(x,z),r=Math.hypot(x,z);p.push(x,h,z);n.push(...normalAt(x,z));uv.push(0,0);const blend=Math.max(0,Math.min(1,(r-85)/19));c.push(...mix3(hex('#94aa80'),hex('#d9c69b'),blend));}for(let i=0;i<N-1;i++)for(let j=0;j<N-1;j++){const a=i*N+j,b=a+N;indices.push(a,a+1,b,b,a+1,b+1);}return geometry(p,n,uv,c,indices);}
const terrain=coarseTerrain();
export class CanvasEngine{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx)throw new Error('Graphics unavailable. Please use the text portfolio.');this.meshes=[];this.textures=[];this.night=0;this.quality='low';this.software=true;this.stats={draws:0,triangles:0};this.sun=norm([-.5,1,.48]);this.lastVP=null;this.resize();}
 resize(){this.canvas.width=Math.min(innerWidth,1100);this.canvas.height=Math.round(innerHeight*this.canvas.width/innerWidth);this.canvas.style.width='100%';this.canvas.style.height='100%';}
 texture(canvas){const t={id:this.textures.length+1,canvas,pixels:canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};this.textures.push(t);return t;}
 textTexture(lines,options={}){return this.texture(signCanvas(lines,options));}

 mesh(shape,position=[0,0,0],scale=[1,1,1],color='#ffffff',options={}){let geo=typeof shape==='string'?lod[shape]:reduced.get(shape.id)||shape;if(geo.positions.length>20000)geo=terrain;const mesh={geometry:geo,position:[...position],quaternion:qIdentity(),scale:[...scale],color:hex(color),emissive:0,visible:true,castsShadow:true,texture:null,water:false,parent:null,matrix:compose(),...options};this.meshes.push(mesh);return mesh;}
 setQuality(value){this.quality=value;}
 render(camera,time){const ctx=this.ctx,W=this.canvas.width,H=this.canvas.height,eye=camera.position,view=lookAt(eye,camera.target),VP=mMul(perspective(camera.fov||Math.PI/4,W/H,.3,420),view);this.lastVP=VP;const fog=mix3(hex('#c8dbd2'),hex('#17282e'),this.night);ctx.fillStyle=`rgb(${fog.map(v=>Math.round(v*255)).join(',')})`;ctx.fillRect(0,0,W,H);const triangles=[];
  for(const mesh of this.meshes){if(!mesh.visible||mesh.parent?.visible===false)continue;compose(mesh.position,mesh.quaternion,mesh.scale,mesh.matrix);if(mesh.parent?.matrix)mesh.matrix=mMul(mesh.parent.matrix,mesh.matrix);const M=mesh.matrix,g=mesh.geometry,mvp=mMul(VP,M),vcount=g.positions.length/3;
   const centerW=mvp[15];if(centerW<-.5)continue;if(centerW>0&&Math.abs(mvp[12]/centerW)>2.8&&!mesh.water&&g!==terrain)continue;
   const projected=new Float32Array(vcount*4);for(let i=0;i<vcount;i++){const x=g.positions[i*3],y=g.positions[i*3+1],z=g.positions[i*3+2],w=mvp[3]*x+mvp[7]*y+mvp[11]*z+mvp[15];projected[i*4]=(mvp[0]*x+mvp[4]*y+mvp[8]*z+mvp[12])/w*W/2+W/2;projected[i*4+1]=H/2-(mvp[1]*x+mvp[5]*y+mvp[9]*z+mvp[13])/w*H/2;projected[i*4+2]=w;projected[i*4+3]=1;}
   const count=g.indices?.length??vcount;for(let j=0;j<count;j+=3){const a=g.indices?g.indices[j]:j,b=g.indices?g.indices[j+1]:j+1,c=g.indices?g.indices[j+2]:j+2;const ax=projected[a*4],ay=projected[a*4+1],az=projected[a*4+2],bx=projected[b*4],by=projected[b*4+1],bz=projected[b*4+2],cx=projected[c*4],cy=projected[c*4+1],cz=projected[c*4+2];if(az<.3||bz<.3||cz<.3)continue;if(Math.max(ax,bx,cx)<0||Math.min(ax,bx,cx)>W||Math.max(ay,by,cy)<0||Math.min(ay,by,cy)>H)continue;const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(Math.abs(area)<.25)continue;
    const nx=(g.normals[a*3]+g.normals[b*3]+g.normals[c*3])/3,ny=(g.normals[a*3+1]+g.normals[b*3+1]+g.normals[c*3+1])/3,nz=(g.normals[a*3+2]+g.normals[b*3+2]+g.normals[c*3+2])/3;const sx=M[0]**2+M[1]**2+M[2]**2,sy=M[4]**2+M[5]**2+M[6]**2,sz=M[8]**2+M[9]**2+M[10]**2;let n=norm([M[0]*nx/sx+M[4]*ny/sy+M[8]*nz/sz,M[1]*nx/sx+M[5]*ny/sy+M[9]*nz/sz,M[2]*nx/sx+M[6]*ny/sy+M[10]*nz/sz]);
    // Winding varies between supplied primitives; lighting remains double-sided.
    const depth=(az+bz+cz)/3,shade=Math.max(0,dot(n,this.sun)),ambient=.38+(n[1]*.5+.5)*.23,night=this.night,light=ambient*(1-night*.7)+shade*.85*(1-night*.6)+mesh.emissive*(1+night*2);
    const color=mesh.color.map((v,k)=>{const tint=(g.colors[a*3+k]+g.colors[b*3+k]+g.colors[c*3+k])/3,linear=Math.pow(v*tint,2.2)*light,mapped=(linear*(2.51*linear+.03))/(linear*(2.43*linear+.59)+.14),f=Math.max(0,Math.min(1,(depth-115)/130));return Math.round((Math.pow(Math.max(0,mapped),1/2.2)*(1-f)+fog[k]*f)*255);});
    triangles.push({ax,ay,az,bx,by,bz,cx,cy,cz,depth,color,texture:mesh.texture,uv:mesh.texture?[g.uvs[a*2],g.uvs[a*2+1],g.uvs[b*2],g.uvs[b*2+1],g.uvs[c*2],g.uvs[c*2+1]]:null});
   }
  }
  this.stats.triangles=triangles.length;this.stats.draws=triangles.length;
  if(!this.image||this.image.width!==W||this.image.height!==H){this.image=ctx.createImageData(W,H);this.depth=new Float32Array(W*H);this.pixels32=new Uint32Array(this.image.data.buffer);}
  const sky=fog.map(v=>Math.round(v*255)),rgba=(255<<24)|(sky[2]<<16)|(sky[1]<<8)|sky[0];this.pixels32.fill(rgba);this.depth.fill(0);
  const pixels=this.image.data,zbuffer=this.depth;
  for(const t of triangles){
   const minX=Math.max(0,Math.floor(Math.min(t.ax,t.bx,t.cx))),maxX=Math.min(W-1,Math.ceil(Math.max(t.ax,t.bx,t.cx))),minY=Math.max(0,Math.floor(Math.min(t.ay,t.by,t.cy))),maxY=Math.min(H-1,Math.ceil(Math.max(t.ay,t.by,t.cy)));
   const determinant=(t.by-t.cy)*(t.ax-t.cx)+(t.cx-t.bx)*(t.ay-t.cy);if(Math.abs(determinant)<.001)continue;const invD=1/determinant;
   const waX=(t.by-t.cy)*invD,waY=(t.cx-t.bx)*invD,wbX=(t.cy-t.ay)*invD,wbY=(t.ax-t.cx)*invD;
   const ia=1/t.az,ib=1/t.bz,ic=1/t.cz;const tex=t.texture,uv=t.uv;
   for(let y=minY;y<=maxY;y++){let wa=waX*(minX+.5-t.cx)+waY*(y+.5-t.cy),wb=wbX*(minX+.5-t.cx)+wbY*(y+.5-t.cy);
    for(let x=minX;x<=maxX;x++,wa+=waX,wb+=wbX){const wc=1-wa-wb;if(wa<-.00001||wb<-.00001||wc<-.00001)continue;const invZ=wa*ia+wb*ib+wc*ic,index=y*W+x;if(invZ<=zbuffer[index])continue;zbuffer[index]=invZ;const offset=index*4;
     if(tex){const u=(wa*uv[0]*ia+wb*uv[2]*ib+wc*uv[4]*ic)/invZ,v=(wa*uv[1]*ia+wb*uv[3]*ib+wc*uv[5]*ic)/invZ,tx=Math.max(0,Math.min(tex.width-1,Math.floor(u*tex.width))),ty=Math.max(0,Math.min(tex.height-1,Math.floor((1-v)*tex.height))),ti=(ty*tex.width+tx)*4;pixels[offset]=tex.pixels[ti];pixels[offset+1]=tex.pixels[ti+1];pixels[offset+2]=tex.pixels[ti+2];}
     else{pixels[offset]=t.color[0];pixels[offset+1]=t.color[1];pixels[offset+2]=t.color[2];}
    }
   }
  }
  ctx.putImageData(this.image,0,0);
 }
 drawTexture(t){const image=t.texture.canvas,uv=t.uv,u0=uv[0]*image.width,v0=(1-uv[1])*image.height,u1=uv[2]*image.width,v1=(1-uv[3])*image.height,u2=uv[4]*image.width,v2=(1-uv[5])*image.height,det=u0*(v1-v2)+u1*(v2-v0)+u2*(v0-v1);if(Math.abs(det)<.001)return;const ctx=this.ctx;const calc=(a,b,c)=>[(a*(v1-v2)+b*(v2-v0)+c*(v0-v1))/det,(a*(u2-u1)+b*(u0-u2)+c*(u1-u0))/det,(a*(u1*v2-u2*v1)+b*(u2*v0-u0*v2)+c*(u0*v1-u1*v0))/det];const x=calc(t.ax,t.bx,t.cx),y=calc(t.ay,t.by,t.cy);ctx.save();ctx.clip();ctx.transform(x[0],y[0],x[1],y[1],x[2],y[2]);ctx.drawImage(image,0,0);ctx.restore();}
 project(p){if(!this.lastVP)return null;const m=this.lastVP,[x,y,z]=p,w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=0)return null;return{x:((m[0]*x+m[4]*y+m[8]*z+m[12])/w*.5+.5)*innerWidth,y:(.5-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*.5)*innerHeight};}
}
