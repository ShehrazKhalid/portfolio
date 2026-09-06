/** Classic script: even file:// can display a useful explanation before any module runs. */
(() => {
  'use strict';
  const entry = new URL('../src/app.js', document.currentScript.src);
  const error = document.getElementById('load-error');
  const label = document.getElementById('load-label');
  const startLabel = document.getElementById('start-label');
  const retry = document.getElementById('world-retry');
  let ready = false;
  function show(title, explanation) {
    error.hidden = false;
    error.replaceChildren();
    const heading = document.createElement('strong'); heading.textContent = title;
    const p = document.createElement('p'); p.textContent = explanation;
    error.append(heading, p);
    label.textContent = 'The normal portfolio is still available.';
    return error;
  }
  if (location.protocol === 'file:') {
    const box = show('Start this page through a web server.', 'Double-click opens a file:// page. The 3D world needs HTTP or HTTPS to load its JavaScript, models and portfolio data. Your normal portfolio links still work.');
    const p = document.createElement('p'); p.textContent = 'On Windows: close this tab, then double-click START_WINDOWS.bat in the full project folder. Or run the command below in that folder:';
    const code = document.createElement('code'); code.textContent = 'node server.mjs';
    const p2 = document.createElement('p'); p2.textContent = 'Then open http://127.0.0.1:3000 . On GitHub, enable Settings > Pages and use the published website address, not the repository file preview.';
    box.append(p,code,p2);
    startLabel.textContent = 'A local server is needed';
    document.body.classList.add('startup-problem');
    return;
  }
  const timer = setTimeout(() => {
    if (!ready) { show('The world is taking longer than expected.', 'Check that the complete website folder is uploaded. If the browser cannot load 3D graphics, the normal portfolio and CV are still available. Try reloading the page.'); retry.hidden = false; }
  }, 25000);
  window.addEventListener('portfolio-ready', () => { ready = true; clearTimeout(timer); error.hidden = true; retry.hidden = true; }, {once:true});
  window.addEventListener('portfolio-startup-error', () => { clearTimeout(timer); retry.hidden = false; }, {once:true});
  import(entry.href).catch(err => {
    clearTimeout(timer);
    show('The world could not load.', 'A JavaScript file is missing or was blocked. Upload the complete src, assets, data, css and js folders alongside 3d-view.html. Technical detail: ' + err.message);
    startLabel.textContent = 'World unavailable'; retry.hidden = false;
  });
})();
