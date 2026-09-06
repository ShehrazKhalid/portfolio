# v6 verification

Checked on 2026-09-06 against the generated dist directory.

- 42/42 Node tests passed: unique identifiers, complete gallery manifests, local files, 1–4 week estimates, exact-ID parsers, physics, destruction, chain reactions, resets, bounded debris and server behaviour.
- 59/59 browser checks passed using real local HTTP navigation in installed Chrome. The primary renderer was WebGL2; the Canvas compatibility renderer was tested separately.
- 36 HTML pages and 393 local resources passed actual HTTP checks. No missing local resources or external runtime image URLs were found.
- All 26 project detail pages loaded their local icons and complete gallery previews. Lightbox navigation and focus restoration passed.
- Real keyboard input broke a tree and detonated TNT. Three nearby crates chained together. Tests measured a nonzero explosion audio signal, slower simulation time, reduced camera field of view and restoration to normal.
- Muting, reset props, reduced motion, career chapter changes, desktop project labels, mobile navigation and mobile driving controls passed.

Screenshots and reports are in qa/v6-*.png, qa/v6-browser-tests.json, qa/v6-node-tests.txt and qa/static-http.json.

The 390 × 844 mobile viewport is emulated. No physical-phone, Safari, live GitHub deployment or listening evaluation on the user's speakers is claimed. This is a local ZIP delivery; GitHub account deployment will happen after upload.

Media: 26 icons and 138 unique gallery images. Seventeen galleries came from current official listings; nine unavailable listings were recovered from exact-ID archives. Every unique image exposed by the available source galleries is bundled. Some archived source URLs contain identical image bytes; those appear once. See docs/MEDIA_INVENTORY.md.

To reproduce: npm test, npm run build, npm run verify. Optional Chrome tests: install Playwright, then npm run qa:browser.

