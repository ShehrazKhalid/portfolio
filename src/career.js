/** Position-based story progression: moving backwards also rewinds the career. */
export const CAREER_ROAD={startX:-53,endX:56,z:-58,halfWidth:5.2};
export function careerIndexAt(position,chapters,previous=-1){
 const [x,y,z]=position;if(!chapters.length||x<CAREER_ROAD.startX||x>CAREER_ROAD.endX||Math.abs(z-CAREER_ROAD.z)>CAREER_ROAD.halfWidth||y>8||y<0)return -1;
 let nearest=0;for(let i=1;i<chapters.length;i++)if(Math.abs(x-chapters[i].x)<Math.abs(x-chapters[nearest].x))nearest=i;
 if(previous>=0&&previous<chapters.length&&nearest!==previous){const boundary=(chapters[previous].x+chapters[nearest].x)/2;if(Math.abs(x-boundary)<.6)return previous;}
 return nearest;
}
export const careerProgress=x=>Math.max(0,Math.min(1,(x-CAREER_ROAD.startX)/(CAREER_ROAD.endX-CAREER_ROAD.startX)));
export function pointInPolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
