import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('..',import.meta.url),d=JSON.parse(await readFile(new URL('data/portfolio.json',root),'utf8'));
const count=d.projects.reduce((n,p)=>n+p.media.screenshots.length,0),archived=d.projects.filter(p=>p.media.archived).length;
await writeFile(new URL('README.md',root),`# Shehraz Khalid — Portfolio v6

Ready to upload: 26 unique games, 26 local icons and ${count} unique gallery images, with full-resolution originals and lightweight previews. All project pages, profile content and the interactive 3D world are included.

## Start locally

On Windows, double-click START_WINDOWS.bat. Node.js 20 or newer is required; npm install is not needed to run the website. Open http://127.0.0.1:3000 if the browser does not open automatically. Keep the server terminal open.

The 3D world needs HTTP/HTTPS. Opening 3d-view.html directly as a file will show instructions for starting the server.

## Upload to GitHub

1. Extract the ZIP into a new folder.
2. Upload the contents to your repository root, including assets, src, js, css, data, tools, tests and the hidden .github folder. index.html must be at the repository root.
3. In Settings → Pages, choose GitHub Actions. Push to main/master, or run “Build and publish portfolio” from Actions.
4. The workflow tests the project, builds dist and deploys the bundled artwork. No image download is required for this ZIP.

The normal push workflow uses the images committed with your website. The manual workflow offers an optional refresh_media checkbox for a future refresh. Refreshed media is included in the deployment and its downloadable artifact; it is not automatically committed to your repository. This delivery has not been uploaded or deployed to your GitHub account.

Alternatively, run npm run build and upload the contents of dist to any static host.

## Galleries and project details

- ${26-archived} galleries were fetched from current official store listings. ${archived} unavailable listings were recovered from archives matching their exact Android package or Apple numeric ID.
- All unique images exposed by those available source galleries are included. Byte-identical images are displayed once. The archive count is not a claim to recover every historical image from a removed listing.
- No project has a pending icon or gallery. The source links and counts are documented in docs/MEDIA_INVENTORY.md and data/media-report.json.
- Every project is marked as built from scratch, following the owner's confirmation. Displayed durations are explicitly labelled estimates: 1, 2, 3 or 4 weeks based on scope. Previously confirmed timings remain in the source data as confirmedDuration.
- The two Thief apps and the Android/iOS gym apps retain their distinct identifiers. The separate publisher collection is not counted as a game.

## 3D interactions

Drive with WASD/arrows. Trees, street lamps and small flags break on vehicle impact, with falling pieces, particles and wood/metal sounds. Use the TNT playground shortcut to reach three red crates; six more are placed around the island. Crates produce a fire burst, smoke, debris, shockwave, sound, a brief slowdown and camera zoom. Nearby crates can trigger each other.

Sound starts with the “Let's take a drive” gesture. L or the sound button mutes it. Reset props in Settings restores scenery and TNT. R recovers the vehicle. M opens the map, G the garage, P photo mode, Shift boosts, Space jumps, and Enter opens nearby content. Touch joystick and buttons are included.

Sign textures match the physical boards' proportions, with higher resolution, stronger contrast and screen-space labels near readable locations. Reduced motion suppresses the blast zoom/shake/flash. The Canvas fallback retains the same gameplay when WebGL2 is unavailable.

## Editing and verification

Edit data/portfolio.json for content. tools/build.mjs generates the normal HTML pages; src/portfolio-content.js shares rendering with in-world dialogs. Editing generated HTML alone will be overwritten by a build.

- npm start — local server
- npm test — data, physics, destruction, parser and server tests
- npm run build — regenerate pages and dist
- npm run verify — check generated pages and local assets over HTTP
- npm run media -- --refresh — optional future refresh of exact-ID source galleries

Browser QA is optional: install Playwright with npm install --no-save playwright, then run npm run qa:browser. Windows uses installed Chrome; set CHROME_PATH for a different executable. See QA.md for the actual test results and limits.

The site has no runtime CDN dependency. Local browser storage holds preferences and progress. The optional community server remains off by default and is not part of GitHub Pages.
`);
const lines=['# Project media inventory — v6','',`Checked: ${d.updated}. ${d.projects.length} unique projects; ${count} unique gallery images; 26 icons. Full-size originals and local previews are bundled.`, '', 'The screenshot count includes promotional artwork present in the source gallery. Exact duplicate image bytes are omitted. An archived gallery contains everything exposed by the available archive, which may differ from a historical store gallery.','','| Project | Unique gallery images | Estimate | Source |','|---|---:|---|---|'];
for(const p of d.projects)lines.push(`| ${p.title} | ${p.media.screenshots.length} | ${p.duration} | [${p.media.archived?'Archived store gallery':'Official store'}](${p.source.archiveUrl||p.storeUrl}) |`);
lines.push('','## Exact identifiers','');for(const p of d.projects)lines.push(`- **${p.title}**: \`${p.packageId}\` → \`${p.detailPage}\``);
await writeFile(new URL('docs/MEDIA_INVENTORY.md',root),lines.join('\n')+'\n');
await writeFile(new URL('docs/MEDIA.md',root),`# Local project media

All 26 projects have an icon and complete available source gallery. See [the inventory](MEDIA_INVENTORY.md) for counts, links and identifiers.

data/portfolio.json is the manifest. media.icon and each screenshot.src point to full-size originals. iconPreview, coverPreview and screenshot.preview provide local WebP thumbnails; the lightbox opens the original file. Originals remain in the ZIP and repository.

The downloader has no five-image limit and refreshes existing galleries with --refresh. It first checks the exact official listing and falls back to a verified exact-ID archive if the listing is unavailable. It checks image signatures, origin hosts and duplicate SHA-256 hashes. No APKs are downloaded.

Run npm run media -- --refresh to update all projects, or node tools/download-media.mjs --refresh --project=ballblast for one. A refresh preserves the previous gallery if no screenshots can be downloaded, reports partial failures, and updates data/media-report.json. Run npm run build afterwards. Existing previews are discarded when their originals change, so the page falls back to full-size images rather than displaying a stale preview.

Images from this delivery are already bundled; visitors and GitHub Actions do not need to fetch them from the stores. Upload assets together with the website files.
`);
await writeFile(new URL('START_HERE.txt',root),`SHEHRAZ PORTFOLIO v6 — GITHUB READY\n\n1. ZIP ko naye folder mein extract karein.\n2. START_WINDOWS.bat double-click karein (Node.js 20+).\n3. 3D World mein Let's take a drive dabayein.\n4. TNT playground shortcut se red crates tak jayein; W se takrayein.\n5. L se sound on/off; Settings > Reset props se trees, poles aur TNT wapas aate hain.\n\n26 projects ke 26 icons aur ${count} unique gallery images LOCAL included hain. Dobara download karna zaroori nahi.\nGitHub par ZIP ke andar ki files/folders upload karein, ZIP file akeli nahi. Hidden .github folder bhi include karein.\nREADME.md mein Pages setup aur docs/MEDIA_INVENTORY.md mein tamam galleries ki list hai.\n`);
await writeFile(new URL('CHANGELOG.md',root),`# v6\n\n- Bundled 26 exact-ID project icons and ${count} unique source gallery images, including archival recovery of ${archived} unavailable listings.\n- Removed the five-screenshot cap and the old skip behaviour; retained source and SHA-256 records.\n- Added local WebP previews while keeping full-resolution images in the lightbox.\n- Added owner-confirmed from-scratch notes, fuller descriptions and clearly labelled scope estimates for every game.\n- Verified unique project IDs, app identifiers and detail pages.\n- Added breakable trees, street lamps and flags, nine TNT crates, chain reactions, debris, fire/smoke, sound, slowdown and camera zoom.\n- Corrected 3D sign aspect ratios, improved font contrast and added clickable nearby labels.\n- Kept all media in the uploadable project; routine Pages deployments do not need to redownload it.\n`);
console.log('Delivery README, inventory, media guide, start instructions and changelog updated.');
