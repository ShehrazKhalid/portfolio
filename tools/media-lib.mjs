/** Fetch only exact store IDs, then store genuine image bytes locally. No dependencies. */
export function decodeHTML(v){return String(v).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));}
export function attributes(tag){const out={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))out[m[1].toLowerCase()]=decodeHTML(m[2]??m[3]);return out;}
export function parseGooglePlay(html){
 const icon=[],screenshots=[];let title='',description='',shortDescription='';
 for(const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)){try{const app=JSON.parse(match[1]);if(app['@type']==='SoftwareApplication'){shortDescription=app.description||'';}}catch{}}
 const about=html.match(/<div\b[^>]*data-g-id="description"[^>]*>([\s\S]*?)<\/div>/i);
 if(about)description=decodeHTML(about[1].replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'')).trim();
 for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const a=attributes(tag);if(a.property==='og:title')title=(a.content||'').replace(/\s*[-\u2013]\s*Apps on Google Play.*$/i,'').trim();if(a.property==='og:image'&&a.content)icon.push(a.content);}
 for(const tag of html.match(/<img\b[^>]*>/gi)||[]){const a=attributes(tag),src=a.src||a['data-src'];if(!src)continue;const alt=(a.alt||'').toLowerCase().trim();if(/^icon image$|^app icon$/.test(alt))icon.push(src);if(/^screenshot image$|^screenshot$/.test(alt))screenshots.push(src);}
 const unique=urls=>[...new Map(urls.map(u=>u.replace(/\\u003d/g,'=').replace(/%3D/gi,'=')).filter(validImageURL).map(u=>[imageIdentity(u),u])).values()];
 return {title,description,shortDescription,icon:unique(icon)[0]||null,screenshots:unique(screenshots)};
}
export function imageIdentity(value){const u=new URL(value);return u.origin+u.pathname.replace(/=[^/]*$/,'');}
export function validImageURL(value){try{const u=new URL(value);return u.protocol==='https:'&&(/(^|\.)googleusercontent\.com$/.test(u.hostname)||/(^|\.)mzstatic\.com$/.test(u.hostname));}catch{return false;}}
export function imageExtension(bytes){
 if(bytes.length>=8&&bytes[0]===137&&bytes.subarray(1,4).toString()==='PNG')return 'png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';
 if(bytes.length>=12&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return 'webp';
 return null;
}
export async function fetchURL(url,{fetchImpl=fetch,timeout=18000}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{const r=await fetchImpl(url,{signal:controller.signal,redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 (compatible; PortfolioMediaFetcher/1.0)','Accept-Language':'en-US,en;q=0.8'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r;}finally{clearTimeout(timer);}
}
export async function storeMedia(project,{fetchImpl=fetch,timeout=18000}={}){
 const options={fetchImpl,timeout};
 if(project.platform==='iOS'){
  const id=project.packageId.replace('ios:','');
  for(const country of ['us','pk']){
   try{const r=await fetchURL(`https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&country=${country}`,options),json=await r.json(),app=json.results?.find(p=>String(p.trackId)===id);if(app)return {title:app.trackName,description:app.description||'',shortDescription:'',icon:app.artworkUrl512||app.artworkUrl100,screenshots:[...new Set([...(app.screenshotUrls||[]),...(app.ipadScreenshotUrls||[]),...(app.appletvScreenshotUrls||[])])].filter(validImageURL),listingUrl:app.trackViewUrl};}catch{}
  }throw new Error('The exact iOS app ID could not be verified.');
 }
 const id=project.packageId;const urls=['us','pk','gb'].map(country=>`https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}&hl=en&gl=${country}`);let last;
 for(const url of urls){try{const r=await fetchURL(url,options);if(r.url){const actual=new URL(r.url);if(actual.hostname!=='play.google.com'||actual.searchParams.get('id')!==id)throw new Error('Unexpected listing redirect; refusing another app.');}const html=await r.text();if(html.length>6_000_000)throw new Error('Listing HTML exceeds size limit.');const parsed=parseGooglePlay(html);if(parsed.icon||parsed.screenshots.length)return parsed;throw new Error('No unambiguous app icon or screenshot image was found.');}catch(error){last=error;}}
 throw last||new Error('Store listing unavailable.');
}
