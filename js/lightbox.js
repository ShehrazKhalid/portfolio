/** Accessible, delegated image viewer shared by site pages and in-world dialogs. */
let installed=false;
export function installLightbox(){
 if(installed)return;installed=true;
 const box=document.createElement('section');box.className='media-lightbox';box.hidden=true;box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Project image viewer');
 box.innerHTML='<span class="lightbox-count"></span><button class="lightbox-close" aria-label="Close image viewer">&#215;</button><button class="lightbox-prev" aria-label="Previous image">&#8592;</button><img alt=""><button class="lightbox-next" aria-label="Next image">&#8594;</button><p class="lightbox-caption"></p>';
 document.body.append(box);let entries=[],index=0,returnTo=null,startX=null;
 const update=()=>{const e=entries[index];box.querySelector('img').src=e.src;box.querySelector('img').alt=e.caption;box.querySelector('.lightbox-caption').textContent=e.caption;box.querySelector('.lightbox-count').textContent=`${index+1} / ${entries.length}`;box.querySelector('.lightbox-prev').hidden=entries.length<2;box.querySelector('.lightbox-next').hidden=entries.length<2;};
 const close=()=>{box.hidden=true;document.body.classList.remove('lightbox-open');window.__portfolioLightboxOpen=false;if(returnTo?.isConnected)returnTo.focus({preventScroll:true});};
 const move=delta=>{index=(index+delta+entries.length)%entries.length;update();};
 document.addEventListener('click',e=>{const b=e.target.closest('[data-lightbox]');if(!b)return;const path=b.dataset.src;if(!path||path.startsWith('http')||path.includes('..'))return;e.preventDefault();const all=[...document.querySelectorAll('[data-lightbox]')].filter(el=>el.dataset.lightbox===b.dataset.lightbox);entries=all.map(el=>({src:el.dataset.src,caption:el.dataset.caption||'Project image'}));index=all.indexOf(b);returnTo=b;box.hidden=false;document.body.classList.add('lightbox-open');window.__portfolioLightboxOpen=true;update();box.querySelector('.lightbox-close').focus();});
 box.querySelector('.lightbox-close').onclick=close;box.querySelector('.lightbox-prev').onclick=()=>move(-1);box.querySelector('.lightbox-next').onclick=()=>move(1);
 box.addEventListener('click',e=>{if(e.target===box)close();});
 document.addEventListener('keydown',e=>{if(box.hidden)return;if(['Escape','ArrowLeft','ArrowRight','Tab',' '].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();}if(e.key==='Escape')close();if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1);if(e.key==='Tab'){const controls=[...box.querySelectorAll('button')].filter(x=>!x.hidden);const i=controls.indexOf(document.activeElement);controls[(i+(e.shiftKey?-1:1)+controls.length)%controls.length].focus();}},true);
 box.addEventListener('pointerdown',e=>startX=e.clientX);box.addEventListener('pointerup',e=>{if(startX!==null&&Math.abs(e.clientX-startX)>65)move(e.clientX<startX?1:-1);startX=null;});
}
