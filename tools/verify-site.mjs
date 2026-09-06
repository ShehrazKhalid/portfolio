import {readFile, readdir, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createPortfolioServer} from '../server.mjs';
const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const pages=(await readdir(root)).filter(p=>p.endsWith('.html'));
const refs=new Set(pages), broken=[], externalImages=[];
for(const page of pages){
 const text=await readFile(path.join(root,page),'utf8');
 for(const match of text.matchAll(/\b(href|src)="([^"]+)"/g)){
  const value=match[2].replaceAll('&amp;','&');
  if(!value||value.startsWith('#')||value.startsWith('mailto:')||value.startsWith('tel:'))continue;
  if(value.startsWith('https://')){if(match[1]==='src')externalImages.push(value);continue;}
  if(value.startsWith('/')||value.includes('..')||value.includes('://')){broken.push({page,value,reason:'not project-relative'});continue;}
  refs.add(value.split(/[?#]/)[0]);
 }
}
const data=JSON.parse(await readFile(path.join(root,'data/portfolio.json'),'utf8'));
refs.add('data/portfolio.json');for(const p of data.projects)for(const ref of [p.media.icon,p.media.cover,...p.media.screenshots.map(s=>s.src)])refs.add(ref);
for(const name of await readdir(path.join(root,'src')))if(name.endsWith('.js'))refs.add('src/'+name);
for(const name of await readdir(path.join(root,'assets/models')))refs.add('assets/models/'+name);
// Serve exactly the generated static tree through the same MIME-aware server used locally.
const server=createPortfolioServer({root});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
try{for(const ref of refs){const response=await fetch(origin+'/'+ref);if(response.status!==200)broken.push({ref,status:response.status});await response.arrayBuffer();}}finally{await new Promise(resolve=>server.close(resolve));}
const report={pages:pages.length,uniqueLocalResources:refs.size,broken,externalRuntimeImages:externalImages,pass:!broken.length&&!externalImages.length,note:'Actual local HTTP checks of the generated dist tree, not a GitHub deployment.'};
await mkdir(fileURLToPath(new URL('../qa/',import.meta.url)),{recursive:true});
await writeFile(fileURLToPath(new URL('../qa/static-http.json',import.meta.url)),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
