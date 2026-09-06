# Shehraz Khalid — Portfolio v6

Ready to upload: 26 unique games, 26 local icons and 138 unique gallery images, with full-resolution originals and lightweight previews. All project pages, profile content and the interactive 3D world are included.

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

- 17 galleries were fetched from current official store listings. 9 unavailable listings were recovered from archives matching their exact Android package or Apple numeric ID.
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
