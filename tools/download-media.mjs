import {archiveMedia,validArchiveImageURL} from './archive-media.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {storeMedia,fetchURL,validImageURL,imageExtension,imageIdentity} from './media-lib.mjs';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const dataFile=path.join(root,'data/portfolio.json'),data=JSON.parse(await readFile(dataFile,'utf8'));
const refresh=process.argv.includes('--refresh'),strict=process.argv.includes('--strict');
const report={checkedOn:new Date().toISOString(),results:[],note:'Exact app IDs; every unique screenshot exposed by the verified official listing. No gallery size limit. Unavailable listings use verified exact-ID archives; completeness refers to the available source gallery. Artwork is bundled locally.'};
const selectedArg=process.argv.find(x=>x.startsWith('--project='));
const selected=selectedArg?data.projects.filter(p=>p.id===selectedArg.split('=')[1]):data.projects;
if(!selected.length)throw new Error('Unknown project ID.');
await mkdir(path.join(root,'.work/store-metadata'),{recursive:true});
async function download(p){
 await mkdir(path.join(root,'assets/projects',p.id),{recursive:true});
 if(!refresh&&p.media.galleryComplete){report.results.push({id:p.id,status:'complete-local',screenshots:p.media.screenshots.length,expectedScreenshots:p.media.storeScreenshotCount});console.log(`Complete local gallery: ${p.id} (${p.media.screenshots.length})`);return;}
 try{
  let metadata;try{metadata=await storeMedia(p);}catch(error){console.log('Checking exact-ID archive: '+p.id);metadata=await archiveMedia(p);}
  await writeFile(path.join(root,'.work/store-metadata',p.id+'.json'),JSON.stringify(metadata,null,2));
  const jobs=[...(metadata.icon?[{url:metadata.icon,kind:'icon'}]:[]),...metadata.screenshots.map(url=>({url,kind:'screenshot'}))];
  const downloaded=[],failures=[];let cursor=0;
  async function imageJob(item){
   try{
    if(!validArchiveImageURL(item.url))throw new Error('Unsupported image origin.');
    let url=item.url;if(new URL(url).hostname.endsWith('googleusercontent.com'))url=imageIdentity(url)+'=s0';
    let bytes,error;
    for(let attempt=0;attempt<3;attempt++){try{const r=await fetchURL(url,{timeout:25000});if(r.url&&!validArchiveImageURL(r.url))throw new Error('Unexpected media redirect.');if(Number(r.headers.get('content-length')||0)>20_000_000)throw new Error('Image exceeds 20MB.');const candidate=Buffer.from(await r.arrayBuffer());if(candidate.length>20_000_000||!imageExtension(candidate))throw new Error('Invalid or oversized image.');bytes=candidate;break;}catch(e){error=e;}}
    if(!bytes)throw error||new Error('Download failed.');
    const hash=createHash('sha256').update(bytes).digest('hex'),name=item.kind==='icon'?'store-icon':`store-${createHash('sha1').update(imageIdentity(item.url)).digest('hex').slice(0,12)}`;
    const src=`assets/projects/${p.id}/${name}.${imageExtension(bytes)}`;
    await writeFile(path.join(root,src),bytes);downloaded.push({...item,src,sha256:hash,bytes:bytes.length});
   }catch(error){failures.push({url:item.url,error:error.message});console.warn(`Image pending ${p.id}: ${error.message}`);}
  }
  await Promise.all(Array.from({length:3},async()=>{while(cursor<jobs.length)await imageJob(jobs[cursor++]);}));
  const icon=downloaded.find(i=>i.kind==='icon'),order=new Map(metadata.screenshots.map((u,i)=>[u,i]));
  const allShots=downloaded.filter(i=>i.kind==='screenshot').sort((a,b)=>order.get(a.url)-order.get(b.url));
  const shots=[...new Map(allShots.map(s=>[s.sha256,s])).values()];
  if(icon){p.media.icon=icon.src;delete p.media.iconPreview;}
  if(shots.length){p.media.screenshots=shots.map((s,i)=>({src:s.src,caption:`${p.title} — store gallery ${i+1}`,sourceUrl:s.url,sha256:s.sha256}));p.media.cover=shots[0].src;delete p.media.coverPreview;}
  else if(icon&&!p.media.screenshots.length)p.media.cover=icon.src;
  p.media.galleryComplete=!!icon&&metadata.screenshots.length>0&&allShots.length===metadata.screenshots.length&&failures.length===0;
  p.media.status=p.media.screenshots.length?'local':icon?'icon-only':'pending';
  p.media.storeScreenshotCount=metadata.screenshots.length;p.media.duplicateStoreImages=allShots.length-shots.length;
  p.media.source=metadata.archived?'Store artwork recovered from the exact app listing on '+metadata.archiveName:'Official store gallery, saved locally at original resolution';p.media.archived=!!metadata.archived;if(metadata.archiveUrl){p.media.archiveUrl=metadata.archiveUrl;p.source.archiveUrl=metadata.archiveUrl;}p.media.downloadedOn=report.checkedOn;
  p.media.originalURLs=downloaded.map(i=>i.url);p.media.failures=failures;
  if(metadata.title){p.source.resolvedTitle=metadata.title;if(p.source.kind==='unavailable'||p.title.endsWith(' project'))p.title=metadata.title;}
  p.source.kind=metadata.archived?'archived-store':'official-store';p.source.checkedOn=report.checkedOn.slice(0,10);
  report.results.push({id:p.id,title:p.title,status:p.media.galleryComplete?'complete':'partial',screenshots:shots.length,expectedScreenshots:metadata.screenshots.length,duplicateImages:allShots.length-shots.length,icon:!!icon,archived:!!metadata.archived,archiveUrl:metadata.archiveUrl,failures});
  console.log(`${p.id}: ${shots.length}/${metadata.screenshots.length} screenshots, icon ${icon?'saved':'pending'}`);
 }catch(error){p.media.galleryComplete=false;report.results.push({id:p.id,status:'unavailable',error:error.message});console.warn(`Store unavailable ${p.id}: ${error.message}`);}
}
let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<selected.length)await download(selected[cursor++]);}));
report.localProjects=data.projects.filter(p=>p.media.status==='local').length;
report.completeProjects=data.projects.filter(p=>p.media.galleryComplete).length;
report.pending=data.projects.filter(p=>!p.media.galleryComplete).map(p=>p.id);report.pendingProjects=report.pending.length;
report.totalScreenshots=data.projects.reduce((n,p)=>n+p.media.screenshots.length,0);
await writeFile(dataFile,JSON.stringify(data,null,2)+'\n');await writeFile(path.join(root,'data/media-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Complete galleries: ${report.completeProjects}/${data.projects.length}; screenshots: ${report.totalScreenshots}; pending: ${report.pending.join(', ')||'none'}.`);
if(strict&&report.pendingProjects)process.exitCode=1;

