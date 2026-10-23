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
