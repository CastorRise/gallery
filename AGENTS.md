# CastorRise Gallery

## Boundaries

- This is an independent repository for `CastorRise/gallery`, hosted at `/gallery/`.
- Never modify `CastorRise.github.io`, its worktree, its workflows, or Pages settings.
- Only the owner may authorize remote repository creation, pushes, deployment, and permanent data deletion. The local Publish UI requires an explicit confirmation before commit/push.
- No force push, reset of user changes, automatic conflict resolution, or credentials in files/browser storage.
- Bind admin and development services to `127.0.0.1`. Preserve Host, Origin and CSRF checks.

## Architecture

- npm workspaces; Node >=22.12 (Node 24 LTS used for development and CI).
- `apps/web`: Astro static pages. Reads only `content/gallery.json` and sanitized `public/images`.
- `apps/admin`: React/Vite UI and Node/Express server. API and UI share one loopback origin (4173).
- `packages/shared`: Zod schema, migrations, publication privacy projection, shared types.
- `packages/image-processing`: Sharp/ExifReader import, orientation, ICC conversion, WebP variants.
- `scripts/publication.ts`: validated export, production build and explicit publish plan.
- `.local`: ignored local metadata, originals, derivatives, automatic backup snapshots and export archives. Never stage or deploy this directory.
- `content/gallery.json`: generated public content. Do not edit private coordinates into it.

## Implementation conventions

- TypeScript strict; plain text story blocks, React/Astro escaping. Do not accept HTML/MDX execution from content.
- Stable photo IDs. Categories are data driven. Missing EXIF is omitted, never invented.
- No cropping, auto color adjustments or upscaling. Convert ICC-aware to sRGB, attach its profile, remove EXIF/XMP from public derivatives.
- All imports default to draft and hidden location. Exact coordinates require an explicit per-photo checkbox. City markers use deliberately coarse centers; approximate coordinates are rounded.
- Keep atomic metadata saves, serialized writes, automatic pre-save backup, and optimistic revision checks.
- Deletion is archiving; retain original files. Metadata deletion and backup restore need a UI confirmation.
- `.local` is the authoritative unpublished library. Public export is a separate snapshot, and CI must never depend on the local library.

## Verification

- `npm run check` for all TypeScript and Astro files.
- `npm test` for real image transformations, EXIF/GPS, API import, edits, backup/restore, archiving, Host/Origin/CSRF and publication boundaries. Tests use temporary data only.
- `npm run build`, `npm run build -w @gallery/admin` and `npm run audit:dist`.
- `npx playwright install chromium` once, then `npm run test:browser`: desktop/mobile public interactions and isolated admin workflow. Browser fixture uses public derivatives, never real private originals.
- Use `npm run format` after edits. Do not add tests that merely repeat a minor reversible implementation.
- Report separately: automated browser checks, actual device acceptance, local publish build, Git push and GitHub Actions deployment. Never claim remote deployment from local build success.

## Deployment contract

- Astro `site=https://castorrise.github.io`, `base=/gallery/`, trailing slash pages.
- Workflow uploads ONLY `apps/web/dist`; builds `build:web` from committed sanitized assets.
- `npm run build` is for the owner's local export plus build. Do not run it on a fresh CI checkout without `.local`.
- Push only to verified HTTPS origin `https://github.com/CastorRise/gallery.git` on `main`; preserve failed local commits for retry.
- No online admin, originals, draft metadata, backup archives or local filesystem paths in the public build.
