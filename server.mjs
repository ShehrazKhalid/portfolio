/** Zero-dependency development/static server with an optional small community API.
 * Default: local-only host, API off. Read README before enabling public writes.
 */
import http from 'node:http';
import {readFile,writeFile,mkdir,rename,stat} from 'node:fs/promises';
import {resolve,extname,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
const ROOT=dirname(fileURLToPath(import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.glb':'model/gltf-binary','.pdf':'application/pdf','.ico':'image/x-icon'};
export function createPortfolioServer({root=ROOT,community=process.env.ENABLE_COMMUNITY==='1',dataDir=process.env.DATA_DIR||resolve(ROOT,'server-data'),rateMs=10000}={}){
 let database={notes:[],scores:[]},loaded=false,queue=Promise.resolve();const rates=new Map();const databaseFile=resolve(dataDir,'community.json');
 const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
 const load=async()=>{if(loaded)return;try{const data=JSON.parse(await readFile(databaseFile,'utf8'));for(const k of ['notes','scores'])if(Array.isArray(data[k]))database[k]=data[k].slice(0,k==='notes'?40:100);}catch(e){if(e.code!=='ENOENT')console.warn('Community data could not be read. Check DATA_DIR and the JSON file.');}loaded=true;};
 const save=()=>{queue=queue.catch(()=>{}).then(async()=>{await mkdir(dataDir,{recursive:true});const temp=databaseFile+'.tmp';await writeFile(temp,JSON.stringify(database,null,2));await rename(temp,databaseFile);});return queue;};
 const readJSON=req=>new Promise((resolve,reject)=>{let total=0,text='';req.on('data',part=>{total+=part.length;if(total>4096){reject(Object.assign(new Error('Request is too large.'),{status:413}));req.resume();return;}text+=part;});req.on('end',()=>{try{resolve(JSON.parse(text));}catch{reject(Object.assign(new Error('A valid JSON object is required.'),{status:400}));}});req.on('error',reject);});
 const clean=(v,max)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';
 const handler=async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  try{
   const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname);
   if(pathname.startsWith('/api/')){
    if(!community){json(res,503,{error:'The optional community service is disabled. Browser-local notes still work.'});return;}
    await load();const kind=pathname.slice(5);
    if(kind==='status'&&req.method==='GET'){json(res,200,{service:'shehraz-grove',version:2});return;}
    if(!['notes','scores'].includes(kind)){json(res,404,{error:'Unknown endpoint.'});return;}
    if(req.method==='GET'){json(res,200,[...database[kind]].sort(kind==='scores'?(a,b)=>a.time-b.time:(a,b)=>b.createdAt.localeCompare(a.createdAt)));return;}
    if(req.method!=='POST'){json(res,405,{error:'Use GET or POST.'});return;}
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){json(res,403,{error:'Cross-origin writes are not accepted.'});return;}
    if(!req.headers['content-type']?.includes('application/json')){json(res,415,{error:'Send application/json.'});return;}
    const key=createHash('sha256').update((req.socket.remoteAddress||'unknown')+kind).digest('hex'),now=Date.now();if(now-(rates.get(key)||0)<rateMs){json(res,429,{error:'Please wait a few seconds before posting again.'});return;}
    const body=await readJSON(req);if(!body||typeof body!=='object'){json(res,400,{error:'A JSON object is required.'});return;}const name=clean(body.name,24);if(!name){json(res,400,{error:'Please enter a name.'});return;}
    const item={id:randomUUID(),name,createdAt:new Date().toISOString()};
    if(kind==='notes'){const message=clean(body.message,140);if(!message){json(res,400,{error:'Please enter a note.'});return;}item.message=message;}
    else {if(!Number.isFinite(body.time)||body.time<15||body.time>3600||body.track!=='grove-v2'){json(res,400,{error:'This lap time or track is not valid.'});return;}item.time=Math.round(body.time*1000)/1000;item.track='grove-v2';}
    const previous=database[kind];database[kind]=[item,...previous].slice(0,kind==='notes'?40:100);try{await save();}catch(e){database[kind]=previous;throw e;}rates.set(key,now);if(rates.size>5000)for(const [k,t] of rates)if(now-t>rateMs)rates.delete(k);json(res,201,item);return;
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
   let relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
   
   if(!(/^[^/]+\.(html|css|js)$/.test(relative)||/^(assets|css|js|src|data)\//.test(relative))||!MIME[extname(relative)]||relative.split('/').some(part=>part==='..'||part.startsWith('.'))){res.writeHead(403);res.end('Forbidden');return;}
   const file=resolve(root,relative);if(!file.startsWith(resolve(root)+sep)){res.writeHead(403);res.end('Forbidden');return;}
   let info;try{info=await stat(file);}catch{res.writeHead(404);res.end('Not found');return;}if(!info.isFile()){res.writeHead(404);res.end('Not found');return;}
   res.writeHead(200,{'Content-Type':MIME[extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':relative.startsWith('assets/')?'public, max-age=3600':'no-cache'});res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch(e){console.error('Request failed:',e.message);if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'The server could not complete this request.'});else res.end();}
 };
 return http.createServer(handler);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||3000),server=createPortfolioServer();
 server.listen(port,host,()=>console.log(`\nThe Grove - Shehraz Khalid\nOpen http://${host}:${port}\nCommunity API: ${process.env.ENABLE_COMMUNITY==='1'?'enabled (public writes)':'off (browser-local notes)'}\nPress Ctrl+C to stop.\n`));
 server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is busy. Choose a different PORT.`:e.message);process.exitCode=1;});
}

