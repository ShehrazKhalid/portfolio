/** Match the canvas aspect ratio to the physical sign to avoid stretched lettering. */
export function signCanvas(lines,{bg='#173b34',fg='#fffbed',accent='#d9efb1',width=2048,height=384}={}){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
 const pad=Math.max(24,width*.035);ctx.fillStyle=accent;ctx.fillRect(pad*.55,height*.16,Math.max(5,width*.006),height*.68);
 ctx.textAlign='center';ctx.textBaseline='middle';
 const list=Array.isArray(lines)?lines:[lines],max=width-pad*3;
 list.forEach((line,i)=>{
  let size=height*(list.length===1?.56:i===0?.37:.21);
  const font=()=>ctx.font=`${i===0?800:600} ${size}px Arial, sans-serif`;font();
  while(ctx.measureText(line).width>max&&size>18){size-=1;font();}
  ctx.fillStyle=i===0?fg:accent;ctx.fillText(line,width/2+pad*.12,height*(list.length===1?.51:i===0?.36:.75));
 });return canvas;
}
