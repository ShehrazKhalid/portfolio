# Local project media

All 26 projects have an icon and complete available source gallery. See [the inventory](MEDIA_INVENTORY.md) for counts, links and identifiers.

data/portfolio.json is the manifest. media.icon and each screenshot.src point to full-size originals. iconPreview, coverPreview and screenshot.preview provide local WebP thumbnails; the lightbox opens the original file. Originals remain in the ZIP and repository.

The downloader has no five-image limit and refreshes existing galleries with --refresh. It first checks the exact official listing and falls back to a verified exact-ID archive if the listing is unavailable. It checks image signatures, origin hosts and duplicate SHA-256 hashes. No APKs are downloaded.

Run npm run media -- --refresh to update all projects, or node tools/download-media.mjs --refresh --project=ballblast for one. A refresh preserves the previous gallery if no screenshots can be downloaded, reports partial failures, and updates data/media-report.json. Run npm run build afterwards. Existing previews are discarded when their originals change, so the page falls back to full-size images rather than displaying a stale preview.

Images from this delivery are already bundled; visitors and GitHub Actions do not need to fetch them from the stores. Upload assets together with the website files.
