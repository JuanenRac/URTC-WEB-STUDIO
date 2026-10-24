<!-- =============================================================================
URTC-WEB-STUDIO - Build and run guide
Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
GPL-3.0-or-later - see LICENSE
============================================================================= -->

# Build and Run

Use `build-test.bat` or `build-test.sh` for the non-mutating TypeScript and
test validation path. Use `dev.bat` or `dev.sh` for a local development server.
`build.bat` and `build.sh` are the release workflows. Their first step
increments the version in `package.json` and the manifest and, if the CHANGELOG
has no entry for that version, adds a bare one; only then do they run
`npm ci` and `npm run build`. The version is therefore incremented even if the
build that follows fails.

Do not put OTA signing material in browser configuration. `.env.example` is a
template only; deployment secrets stay outside Git.

## GitHub Pages (switched off until the owner turns it on)

`.github/workflows/pages.yml` builds the static site and deploys it with `actions/upload-pages-artifact` and `actions/deploy-pages`. The build reads the project base path from `URTC_BASE_PATH` (`vite.config.ts`; the workflow takes it from `actions/configure-pages`, for example `/URTC-WEB-STUDIO/`). Bundled firmware is fetched relative to `import.meta.env.BASE_URL`, so the page works under that path.

**The workflow is off.** Both jobs have `if: vars.URTC_PAGES_ENABLED == 'true'`, so with the repository variable unset (or any other value) a push or a manual run shows both jobs as skipped and nothing is built or published. To turn it on, after the first signed official release of URTC exists:

1. Settings > Secrets and variables > Actions > Variables: add `URTC_PAGES_ENABLED` with the value `true`.
2. Settings > Pages: Source "GitHub Actions" (once). Until then the run reports a notice and ends without deploying.
3. Run the workflow by hand (Actions > URTC Web Studio on GitHub Pages > Run workflow), or push to `main`.

The firmware step is `npm run sync-firmware -- --require-official`. It takes the newest official release of URTC (GitHub's "latest", so never a pre-release; no fallback tag, no local folder), refuses a file whose release signature is missing or does not verify against the pinned key of the releases, and refuses an application image whose manifest says it was built with a key other than a production one (`release` or `production`). A page published this way therefore cannot carry images of the public development key, and the bench notice (`VITE_BENCH_NOTICE`) is not set. To check the Pages build locally with a bench build instead: `URTC_BASE_PATH=/URTC-WEB-STUDIO/ npm run build`, then `npm run preview`.

## End-to-end checks

`npm run test:e2e` opens the built page in a real Chromium (Playwright) and drives it: the tabs and the languages, the content security policy, the offline copy (the page is reloaded with the network switched off), the history of the thermal counters, the saved session, the filter of the bus monitor and a whole CAN-OTA update of the main board against a modelled bootloader. It builds the site and serves it with `vite preview` on `127.0.0.1:4173` itself (an already running server on that port is reused outside CI). A board is modelled in the page by `e2e/support/fakeBoard.ts` (it answers the version, the active tool and the thermal counters queries and plays the bootloader of the main board through a fake `navigator.serial`); no adapter and no hardware are needed. The first time on a machine, `npx playwright install chromium` downloads the browser. The files are called `*.e2e.ts` so that `npm test` (Vitest) does not run them.

## The offline copy

The build writes `sw.js` (from `scripts/sw.template.js`) and the page registers it when it is served over https or from localhost; the development server has none. The worker stores `index.html`, every built script, style and font, and everything of `public/` (the manifest of the web app, the images and the bundled firmware with its signatures) when it installs. The page and the firmware manifest are answered from the network first and from the copy when there is no network; everything else is answered from the copy first (the names of the built files carry their content); `version.json` and `sw.js` are never answered from the copy. A new worker waits for the open tabs to close before it takes over, and removes the copies of earlier versions then. A host that sends headers should send `Cache-Control: no-cache` for `sw.js` and `manifest.webmanifest` and `no-store` for `version.json` (`public/_headers` does).
