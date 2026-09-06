# Code map

- data/portfolio.json: shared profile, project, gallery and career data.
- tools/build.mjs: normal HTML generation and static dist build; only referenced media is copied.
- src/portfolio-content.js: shared project/profile content for pages and world dialogs.
- tools/media-lib.mjs: official-store parsers and exact-ID fetching without screenshot caps.
- tools/archive-media.mjs: verified archived Android/Apple listings for unavailable apps.
- tools/download-media.mjs: local originals, hashes, byte deduplication and completion reports.
- tools/update-project-content.mjs: owner-approved scope estimates and project descriptions.
- tools/delivery-docs.mjs: delivery guide and media inventory generation.
- tools/package-site.py: reproducible source ZIP, including only the referenced assets from dist.
- src/app.js: fixed-step simulation, real-time blast envelope, camera, audio and UI integration.
- src/destruction.js: breakable scenery, disabled colliders, TNT chains and bounded particle pools.
- src/world.js: island layout, breakable trees/lamps/flags, nine TNT crates and project exhibition.
- src/physics.js: vehicle suspension and rigid-body solver, respecting disabled scenery colliders.
- src/audio.js: motor, interface, wood/metal break and layered explosion synthesis.
- src/sign-texture.js: proportion-correct sign textures shared by both renderers.
- src/engine.js / canvas-engine.js: primary WebGL2 and software compatibility renderers.
- src/world-experience.js: picking, nearby labels and position-driven career story.
- src/ui.js / input.js: dialogs, settings, maps and keyboard/touch/gamepad input.
- js/site.js / lightbox.js: catalog filters, mobile navigation and full-size gallery viewer.
- css/site.css / content.css / world-content.css: normal pages, shared content and world overlays.
- server.mjs: local HTTP server. Community API remains disabled unless explicitly enabled.
- .github/workflows/pages.yml: validate and deploy committed assets; optional manual media refresh.

Career Road follows x=-53..56, z=-58. The exhibition is around x=-27, z=-44. The TNT playground shortcut starts at x=10, z=45, facing a cluster at z=36..40. Reset props restores broken scenery without resetting career or collection progress.

