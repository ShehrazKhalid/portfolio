import {signCanvas} from './sign-texture.js';
import {compose,mMul,perspective,lookAt,ortho,hex,qIdentity,add,mul,norm,mix3} from './math.js';
import {primitives} from './geometry.js';

const vertex=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
layout(location=3) in mat4 aModel;
layout(location=7) in vec4 aColor;
layout(location=8) in vec3 aTint;
uniform mat4 uVP;uniform mat4 uLightVP;
uniform float uTime;uniform float uWater;
out vec3 vNormal;out vec3 vWorld;out vec2 vUV;out vec4 vColor;out vec4 vShadow;
void main(){
 vec4 world=aModel*vec4(aPosition,1.);
 mat3 basis=mat3(aModel);
 vec3 scaleSquared=max(vec3(dot(basis[0],basis[0]),dot(basis[1],basis[1]),dot(basis[2],basis[2])),vec3(.000001));
 vec3 normal=normalize(basis*(aNormal/scaleSquared));
 if(uWater>0.){world.y+=sin(world.x*.17+uTime*.6)*.075+cos(world.z*.21+uTime*.4)*.07;normal=normalize(vec3(-cos(world.x*.17+uTime*.6)*.05,1.,sin(world.z*.21+uTime*.4)*.05));}
 vWorld=world.xyz;vNormal=normal;vUV=aUV;vColor=vec4(aColor.rgb*aTint,aColor.a);vShadow=uLightVP*world;gl_Position=uVP*world;
}`;
const fragment=`#version 300 es
precision highp float;
in vec3 vNormal;in vec3 vWorld;in vec2 vUV;in vec4 vColor;in vec4 vShadow;
uniform sampler2D uTexture;uniform sampler2D uShadow;
uniform vec3 uEye;uniform vec3 uSun;uniform vec3 uFog;
uniform float uNight;uniform float uHasTexture;uniform float uShadows;uniform float uWater;
out vec4 outColor;
float shadow(vec3 n){
 vec3 p=vShadow.xyz/vShadow.w*.5+.5;
 if(uShadows<.5||p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.)return 1.;
 float bias=max(.0016*(1.-dot(n,uSun)),.0007);float vis=0.;vec2 texel=1./vec2(textureSize(uShadow,0));
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)vis+=p.z-bias<=texture(uShadow,p.xy+vec2(x,y)*texel).r?1.:0.;return vis/9.;
}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){
 vec4 tex=uHasTexture>.5?texture(uTexture,vUV):vec4(1.);if(tex.a<.1)discard;
 if(vColor.a<0.){outColor=vec4(tex.rgb*vColor.rgb,1.);return;}
 vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
 vec3 base=pow(vColor.rgb*tex.rgb,vec3(2.2));float diffuse=max(dot(n,uSun),0.);float shade=shadow(n);
 vec3 ambient=mix(vec3(.28,.32,.30),vec3(.66,.73,.73),n.y*.5+.5);
 vec3 light=ambient*mix(.84,.22,uNight)+vec3(1.,.91,.76)*diffuse*shade*mix(1.6,.46,uNight);
 vec3 color=base*light+base*vColor.a*mix(1.4,3.,uNight);
 if(uWater>.5){float shine=pow(max(dot(reflect(-uSun,n),normalize(uEye-vWorld)),0.),65.);color+=vec3(.4,.6,.6)*shine*.5;}
 color=pow(aces(color),vec3(1./2.2));
 float fog=smoothstep(105.,230.,distance(uEye,vWorld));color=mix(color,uFog,fog);
 outColor=vec4(color,1.);
}`;
const shadowVertex=`#version 300 es
precision highp float;layout(location=0) in vec3 aPosition;layout(location=3) in mat4 aModel;uniform mat4 uLightVP;void main(){gl_Position=uLightVP*aModel*vec4(aPosition,1.);}`;
const shadowFragment=`#version 300 es
precision highp float;void main(){}`;

function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(gl,vs,fs){const p=gl.createProgram(),v=shader(gl,gl.VERTEX_SHADER,vs),f=shader(gl,gl.FRAGMENT_SHADER,fs);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));gl.deleteShader(v);gl.deleteShader(f);return p;}

export class Engine{
 constructor(canvas){
  this.canvas=canvas;this.gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
  if(!this.gl)throw new Error('This browser cannot start WebGL 2. The text portfolio is still available.');
  const gl=this.gl;this.program=program(gl,vertex,fragment);this.depthProgram=program(gl,shadowVertex,shadowFragment);
  this.uniforms=Object.fromEntries(['uVP','uLightVP','uTime','uWater','uTexture','uShadow','uEye','uSun','uFog','uNight','uHasTexture','uShadows'].map(n=>[n,gl.getUniformLocation(this.program,n)]));
  this.depthLight=gl.getUniformLocation(this.depthProgram,'uLightVP');
  this.meshes=[];this.groups=new Map();this.gpuGeometry=new Map();this.textures=[];this.night=0;this.quality='high';this.pixelRatio=Math.min(devicePixelRatio,1.65);this.shadowSize=2048;this.stats={draws:0,triangles:0};
  this.makeShadow();gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  this.resize();this.sun=norm([-.5,1,.48]);this.lastVP=null;
 }
 resize(){const ratio=this.quality==='low'?1:this.pixelRatio;this.canvas.width=Math.round(innerWidth*ratio);this.canvas.height=Math.round(innerHeight*ratio);this.canvas.style.width='100%';this.canvas.style.height='100%';}
 makeShadow(){const gl=this.gl;this.shadowTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.shadowTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,this.shadowSize,this.shadowSize,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);this.shadowFBO=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.shadowFBO);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.shadowTexture,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Shadow framebuffer unavailable');gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
 texture(canvas){const gl=this.gl,texture={id:this.textures.length+1,handle:gl.createTexture()};gl.bindTexture(gl.TEXTURE_2D,texture.handle);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.generateMipmap(gl.TEXTURE_2D);const aniso=gl.getExtension('EXT_texture_filter_anisotropic');if(aniso)gl.texParameterf(gl.TEXTURE_2D,aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));this.textures.push(texture);return texture;}
 textTexture(lines,options={}){return this.texture(signCanvas(lines,options));}

 mesh(shape,position=[0,0,0],scale=[1,1,1],color='#ffffff',options={}){
  const geo=typeof shape==='string'?primitives[shape]:shape;if(!geo)throw new Error(`Unknown geometry: ${shape}`);
  const object={geometry:geo,position:[...position],quaternion:qIdentity(),scale:[...scale],color:hex(color),emissive:0,visible:true,castsShadow:true,texture:null,water:false,parent:null,matrix:new Float32Array(16),...options};
  this.meshes.push(object);return object;
 }
 uploadGeometry(geo){
  if(this.gpuGeometry.has(geo.id))return this.gpuGeometry.get(geo.id);const gl=this.gl,vao=gl.createVertexArray();gl.bindVertexArray(vao);
  for(const [location,data,size] of [[0,geo.positions,3],[1,geo.normals,3],[2,geo.uvs,2],[8,geo.colors,3]]){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0);}
  if(geo.indices){const b=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,geo.indices,gl.STATIC_DRAW);}
  const result={vao,count:geo.indices?.length??geo.positions.length/3,indexed:!!geo.indices};this.gpuGeometry.set(geo.id,result);return result;
 }
 prepare(){
  for(const group of this.groups.values())group.count=0;
  for(const mesh of this.meshes){if(!mesh.visible||mesh.parent?.visible===false)continue;
   compose(mesh.position,mesh.quaternion,mesh.scale,mesh.matrix);if(mesh.parent?.matrix)mesh.matrix=mMul(mesh.parent.matrix,mesh.matrix);
   const key=`${mesh.geometry.id}:${mesh.texture?.id||0}:${+mesh.castsShadow}:${+mesh.water}`;
   let group=this.groups.get(key);if(!group){group={geo:this.uploadGeometry(mesh.geometry),texture:mesh.texture,castsShadow:mesh.castsShadow,water:mesh.water,count:0,capacity:2048,data:new Float32Array(2048*20),buffer:this.gl.createBuffer()};this.groups.set(key,group);}
   if(group.count>=group.capacity){group.capacity*=2;const n=new Float32Array(group.capacity*20);n.set(group.data);group.data=n;}
   const offset=group.count++*20;group.data.set(mesh.matrix,offset);group.data.set([...mesh.color,mesh.emissive],offset+16);
  }
  const gl=this.gl;for(const group of this.groups.values()){if(!group.count)continue;gl.bindBuffer(gl.ARRAY_BUFFER,group.buffer);gl.bufferData(gl.ARRAY_BUFFER,group.data.subarray(0,group.count*20),gl.DYNAMIC_DRAW);}
 }
 drawGroup(group){const gl=this.gl;gl.bindVertexArray(group.geo.vao);gl.bindBuffer(gl.ARRAY_BUFFER,group.buffer);for(let i=0;i<4;i++){gl.enableVertexAttribArray(3+i);gl.vertexAttribPointer(3+i,4,gl.FLOAT,false,80,i*16);gl.vertexAttribDivisor(3+i,1);}gl.enableVertexAttribArray(7);gl.vertexAttribPointer(7,4,gl.FLOAT,false,80,64);gl.vertexAttribDivisor(7,1);if(group.geo.indexed)gl.drawElementsInstanced(gl.TRIANGLES,group.geo.count,gl.UNSIGNED_INT,0,group.count);else gl.drawArraysInstanced(gl.TRIANGLES,0,group.geo.count,group.count);this.stats.draws++;this.stats.triangles+=group.geo.count/3*group.count;}
 render(camera,time){
  const gl=this.gl;this.prepare();this.stats.draws=0;this.stats.triangles=0;
  const eye=camera.position,target=camera.target,view=lookAt(eye,target),projection=perspective(camera.fov||Math.PI/4,this.canvas.width/this.canvas.height,.3,420),VP=mMul(projection,view);this.lastVP=VP;
  const lightTarget=[target[0],0,target[2]],lightEye=add(lightTarget,mul(this.sun,105));const lightVP=mMul(ortho(-67,67,-67,67,1,220),lookAt(lightEye,lightTarget));
  if(this.quality!=='low'){gl.bindFramebuffer(gl.FRAMEBUFFER,this.shadowFBO);gl.viewport(0,0,this.shadowSize,this.shadowSize);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(this.depthProgram);gl.uniformMatrix4fv(this.depthLight,false,lightVP);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.5,3);for(const g of this.groups.values())if(g.count&&g.castsShadow)this.drawGroup(g);gl.disable(gl.POLYGON_OFFSET_FILL);}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);const fog=mix3(hex('#c8dbd2'),hex('#17282e'),this.night);gl.clearColor(...fog,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);const u=this.uniforms;
  gl.uniformMatrix4fv(u.uVP,false,VP);gl.uniformMatrix4fv(u.uLightVP,false,lightVP);gl.uniform1f(u.uTime,time);gl.uniform3fv(u.uEye,eye);gl.uniform3fv(u.uSun,this.sun);gl.uniform3fv(u.uFog,fog);gl.uniform1f(u.uNight,this.night);gl.uniform1f(u.uShadows,this.quality==='low'?0:1);gl.uniform1i(u.uTexture,0);gl.uniform1i(u.uShadow,1);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.shadowTexture);
  for(const g of this.groups.values()){if(!g.count)continue;gl.uniform1f(u.uHasTexture,g.texture?1:0);gl.uniform1f(u.uWater,g.water?1:0);if(g.texture){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,g.texture.handle);}this.drawGroup(g);}
  gl.bindVertexArray(null);
 }
 project(position){if(!this.lastVP)return null;const m=this.lastVP,[x,y,z]=position,w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=0)return null;return {x:((m[0]*x+m[4]*y+m[8]*z+m[12])/w*.5+.5)*innerWidth,y:(.5-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*.5)*innerHeight};}
 setQuality(value){this.quality=value==='low'?'low':'high';this.resize();}
}
