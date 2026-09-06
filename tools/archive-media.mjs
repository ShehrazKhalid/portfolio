import {attributes,decodeHTML,fetchURL,validImageURL,imageIdentity} from './media-lib.mjs';

export const validArchiveImageURL=value=>{
 try{const u=new URL(value);return validImageURL(value)||u.protocol==='https:'&&['image.winudf.com','img.tapimg.net'].includes(u.hostname);}catch{return false;}
};
function originalImage(value){
 const u=new URL(value);
 if(u.hostname==='image.winudf.com'&&u.pathname.startsWith('/p/')){
  const original=Buffer.from(u.pathname.slice(3),'base64url').toString();
  if(validImageURL(original))return imageIdentity(original)+'=s0';
 }
 if(u.hostname==='image.winudf.com'){u.searchParams.set('w','1024');return u.href;}
 if(u.hostname==='img.tapimg.net')return u.origin+u.pathname.replace(/\/appicon$/,'');
 return value;
}
export function parseAPKArchive(html,project){
 let canonical='',title='',icon='';const screenshots=[];
 for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const a=attributes(tag);if(a.property==='og:url')canonical=a.content;}
 if(!canonical||decodeURIComponent(new URL(canonical).pathname).split('/').at(-1)!==project.packageId)throw new Error('Archive identifier mismatch.');
 for(const tag of html.match(/<img\b[^>]*>/gi)||[]){const a=attributes(tag);
  if(a.class==='app-icon-img'){icon=originalImage(a.src);title=a.alt;}
  if(/ (screenshot \d+|poster)$/.test(a.alt||'')){const src=a['data-original']||a.src;if(src&&validArchiveImageURL(src))screenshots.push(originalImage(src));}
 }
 const description=decodeHTML((html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)||[])[1]||'').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').trim();
 return {title,description,icon,screenshots:[...new Set(screenshots)],archiveUrl:canonical,archiveName:'APKPure',archived:true};
}
export function parseAppleArchive(html,project){
 const id=project.packageId.replace('ios:','');
 // The TapTap detail data explicitly retains the original Apple numeric ID.
 if(!html.includes('"'+id+'"')||!html.includes('"Gym Simulator 24 Fitness Games"'))throw new Error('Apple archive identifier mismatch.');
 for(const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)){
  const app=JSON.parse(m[1]);if(!app.screenshot||app.name!==project.title)continue;
  return {title:app.name,description:app.description||'',icon:originalImage(app.image),screenshots:[...new Set(app.screenshot.map(s=>originalImage(s.url)))],archiveUrl:'https://www.taptap.io/app/33657128',archiveName:'TapTap',archived:true};
 }throw new Error('No archived Apple gallery found.');
}
export async function archiveMedia(project){
 if(project.platform==='iOS'){
  if(project.packageId!=='ios:6475784064')throw new Error('No verified archive mapping for this Apple ID.');
  const r=await fetchURL('https://www.taptap.io/app/33657128');return parseAppleArchive(await r.text(),project);
 }
 const r=await fetchURL('https://apkpure.net/'+project.id+'/'+encodeURIComponent(project.packageId));
 if(!['apkpure.net','www.apkpure.net'].includes(new URL(r.url).hostname))throw new Error('Unexpected archive redirect.');
 return parseAPKArchive(await r.text(),project);
}
