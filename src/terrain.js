import {smooth,clamp,norm,hex,mix3} from './math.js';
import {geometry} from './geometry.js';
export const TERRAIN_SIZE=240, TERRAIN_STEP=2, TERRAIN_HALF=120;
/** The renderer and collider share this exact sampled grid, including triangle interpolation. */
function elevation(x,z){
 const r=Math.hypot(x,z),coast=smooth(91,110,r),island=1.2-coast*7;
 const hills=(7*Math.exp(-((x+81)**2/260+(z+65)**2/340))+9*Math.exp(-((x-71)**2/330+(z+77)**2/270))+4*Math.exp(-((x+75)**2/230+(z-69)**2/380)));
 const flat=smooth(62,86,r);return island+flat*hills+flat*(Math.sin(x*.18)*Math.cos(z*.13)*.32);
}
export const terrainGrid=Array.from({length:TERRAIN_SIZE/TERRAIN_STEP+1},(_,i)=>Array.from({length:TERRAIN_SIZE/TERRAIN_STEP+1},(_,j)=>elevation(i*TERRAIN_STEP-TERRAIN_HALF,j*TERRAIN_STEP-TERRAIN_HALF)));
export function heightAt(x,z){
 const u=clamp((x+TERRAIN_HALF)/TERRAIN_STEP,0,terrainGrid.length-1.001),v=clamp((z+TERRAIN_HALF)/TERRAIN_STEP,0,terrainGrid.length-1.001),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,h=terrainGrid;
 // Mesh triangles: (00,01,10), (10,01,11).
 return a+b<=1?h[i][j]*(1-a-b)+h[i+1][j]*a+h[i][j+1]*b:h[i+1][j]*(1-b)+h[i][j+1]*(1-a)+h[i+1][j+1]*(a+b-1);
}
export function normalAt(x,z){const e=.35;return norm([heightAt(x-e,z)-heightAt(x+e,z),2*e,heightAt(x,z-e)-heightAt(x,z+e)]);}
export function terrainGeometry(){
 const p=[],n=[],u=[],colors=[],indices=[],N=terrainGrid.length;
 for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  const x=i*TERRAIN_STEP-TERRAIN_HALF,z=j*TERRAIN_STEP-TERRAIN_HALF,h=terrainGrid[i][j];p.push(x,h,z);n.push(...normalAt(x,z));u.push(i/N,j/N);
  const grass=mix3(hex('#91a77d'),hex('#9fb18a'),(Math.sin(x*.08)*Math.cos(z*.09)+1)*.5),sand=hex('#d9c69b'),rock=hex('#b3baa8');
  let c=mix3(grass,sand,smooth(85,104,Math.hypot(x,z)));c=mix3(c,rock,smooth(4,10,h)*.75);colors.push(...c);
 }
 for(let i=0;i<N-1;i++)for(let j=0;j<N-1;j++){const a=i*N+j,b=a+N;indices.push(a,a+1,b,b,a+1,b+1);}
 return geometry(p,n,u,colors,indices);
}
