# Vite for Padelstar: scope and plan

Last updated: 2026-10-12. Status: planned, not started (see `docs/MASTER-ROADMAP.md` §13). Checked against `main` on 2026-10-12.

## Short answer

Yes, Vite is worth it, but for slightly different reasons than the first answer gave. The biggest win is deleting the hand-kept version bookkeeping and loading the app as a few bundles instead of ~155 separate files. Instant reload and TypeScript only fully arrive after a second, larger step: turning the scripts into real ES modules.

## What the repo looks like today

- **No build step.** `package.json` has only `test` and `check:syntax`. Vercel serves the repo root as static files, plus three functions in `api/`.
- **125 classic scripts** in `index.html` (`<script defer src="app/...js?v=padelstar-...-N">`), plus 26 CSS files. They talk through globals: almost every file is `window.PadelstarX = (() => { ... })()`. `app/app.js` (2,740 lines) loads last and has 419 top-level declarations.
- **Five pages**: `index.html`, `tv.html`, `admin.html`, `guide.html`, `privacy.html`, each with its own script list. `tv.html` loads its scripts without `defer`.
- **Version bookkeeping:**
  - every asset URL carries `?v=padelstar-<name>-<n>`
  - `service-worker.js` lists about 150 versioned URLs and a `cacheName` counter (now `padelstar-v382`)
  - 12 test files pin 196 version strings
  - `scripts/bump-asset-versions.js` exists to keep all of that in sync
- **The bookkeeping already drifts.** `admin.html` loads `responsive.css?v=padelstar-responsive-4`, while `index.html` and the service worker use `-6`.
- **Service worker**: network-first, with the cache as the offline fallback. It precaches the app shell on install and deletes old caches on activate. It also handles push messages, in-app notification messages and notification clicks, so it is custom code and can't simply be replaced.
- **Supabase** is loaded from jsDelivr as `@supabase/supabase-js@2`. That URL is unpinned (any 2.x) on three pages. Config is a runtime global in `supabase-config.js` and meta tags in `index.html`.
- **Tests**: 72 files run with `node --test`. Most of them read source files as text and match patterns. 55 of them load app scripts into a `node:vm` context, which only works because the scripts are classic scripts.
- **Leftover**: `.github/workflows/pages.yml` still deploys `.` to GitHub Pages. `docs/technical/operations.md` says Pages was switched off on 2026-09-20.

## How the first answer holds up

| Claim | Verdict |
|---|---|
| Replaces the `?v=` versions and the test that checks them | **True, and bigger than it sounds.** Vite gives every built file a content hash, so the bump script, the `cacheName` counter, about 150 service-worker entries and 196 pinned test strings all go away. |
| Phones always get the newest files | **Partly.** Online phones already get new files, because the service worker fetches from the network first. Vercel's default for static files is to revalidate on every load (inferred from Vercel defaults; I couldn't read the live headers from here). The real gain is that a forgotten bump can no longer leave a stale file in the offline cache. Hashed files can also be cached "forever", which makes repeat loads faster. |
| Instant reload while you work | **Partly, at first.** Hot module replacement only works for ES modules. Before the modules step (Stage 4) you get instant CSS updates and a fast full-page reload. |
| Move to TypeScript one file at a time | **Only after the modules step.** Type checking is possible today without Vite: `// @ts-check` plus JSDoc and `tsc --checkJs --noEmit`. |
| One build step on Vercel | **True.** It also needs an output folder (`dist`) and a generated service worker. The `api/` functions keep working as they are. |
| Careful migration since it's live | **True.** The service worker is the main risk (see below). Supabase and the database are not affected. |

**Two wins the first answer missed:**
- **Faster first load on phones.** About 155 requests become a handful of bundled, minified files.
- **Pinned Supabase.** Installing `@supabase/supabase-js` from npm fixes the exact version, so a new 2.x release can't change behaviour on the live site without a deploy.

## Risks for the live site

1. **Service worker and installed PWAs.** The precache list has to come from the build, using `vite-plugin-pwa` in `injectManifest` mode so the push and notification code stays. `service-worker.js` must stay at the site root with a stable, unhashed name. The existing `vercel.json` header (`max-age=0, must-revalidate`) must stay. The old worker fetches from the network first, so it will pick up the new `index.html` and its hashed files on the next online load. The new worker's activate step then removes the old `padelstar-v382` cache. Before releasing, test this on an iPhone with Padelstar installed to the home screen, with Wi-Fi on and off.
2. **Rollback.** Promoting the previous Vercel deployment still works, because the old build's worker is also network-first. Do one rehearsal on a preview deployment.
3. **Script order and strict mode.** Module scripts run in order like `defer`, but always in strict mode and with file-local top-level variables. `app/app.js` is last and `translations.js` exports through `window`, so this looks safe. The browser smoke tests on all three viewports must confirm it. `tv.html` changes from blocking to deferred loading, so check that page by hand.
4. **Tests.** The tests that read `index.html` for script tags and versions have to be rewritten. The 55 `vm`-based tests keep working until a file is converted to `import`/`export` (Stage 4).
5. **Vercel configuration.** Set the build command to `vite build` and the output directory to `dist`. Copy anything not referenced from HTML into `dist` by putting it in `public/`: the manifest, icons, fonts, `supabase-config.js` and `.well-known` files. Keep `/_vercel/insights/script.js` as an external script. The CSP needs no change, since everything is still same-origin.
6. **Supabase.** No change to the database, keys or edge functions. The publishable config can stay a runtime file in `public/`.

## Step-by-step plan

**Stage 0: tidy up (small, can be done any time)**
- Delete or archive `.github/workflows/pages.yml`.
- Fix the `responsive.css` version drift in `admin.html`.

**Stage 1: Vite builds the site with no code changes**
- Add `vite` as a dev dependency with `dev`, `build` and `preview` scripts.
- Write `vite.config.js` with the five HTML pages as inputs.
- Move static files that HTML doesn't reference into `public/`.
- Change `<script defer src>` to `<script type="module" src>` and remove the `?v=` query strings. Vite then bundles each page's scripts and CSS into hashed files.
- Leave the Supabase CDN tag as it is for now.
- Run `npm test`, `check:syntax` and the browser smoke tests against `vite preview`.

**Stage 2: service worker and deploy**
- Move to `vite-plugin-pwa` with `injectManifest`. Keep the push and notification handlers and replace the hand-written list with `self.__WB_MANIFEST`.
- Delete `scripts/bump-asset-versions.js`, the `cacheName` counter and the pinned version strings in the 12 test files.
- Change the Vercel project to build `dist`, and open the change as a PR. Vercel then builds a preview of it.
- On the preview, check the critical path (account → create Round Robin → results → finish) and the phone PWA update and offline behaviour. Merge only after that.
- Update CHANGELOG, PROJECT ("how it is deployed"), `docs/technical/operations.md` and `architecture.md`.

**Stage 3: pin Supabase (small)**
- Install `@supabase/supabase-js` from npm and import it from one small module that sets `window.supabase`. Remove the CDN tags on three pages and jsDelivr from the CSP, and update the privacy page's list of services.

**Stage 4: real modules, then types (gradual, no deadline)**
- Convert files one at a time to `export`/`import`, starting with leaf files that depend on nothing else (`scoring-engine.js`, `tournament-engine.js`, `backup-format.js`, and so on). Hot reload starts working for each converted file.
- Each converted file's `vm` test switches to a plain `import`.
- `app/app.js` goes last.
- Add `// @ts-check` or rename to `.ts` per file as it is converted.

## Timing

Recorded in `docs/MASTER-ROADMAP.md` §13 on the developer's decision of 2026-10-12: start after Zigonia Events M0, once Vite has been tried there. Nothing here blocks 1.0.x. Stages 1–2 are one PR, Stage 3 is a small follow-up, and Stage 4 runs alongside feature work, starting with `app/scoring-engine.js` ahead of the 1.5 standalone scoring engine.
