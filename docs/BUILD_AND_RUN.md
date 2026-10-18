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

## GitHub Pages (bench tool)

`.github/workflows/pages.yml` builds the static site and deploys it with `actions/upload-pages-artifact` and `actions/deploy-pages`. The build reads the project base path from `URTC_BASE_PATH` (`vite.config.ts`; the workflow takes it from `actions/configure-pages`, for example `/URTC-WEB-STUDIO/`) and sets `VITE_BENCH_NOTICE=1`, which makes the app show a notice that the firmware images are signed with the public development key. Bundled firmware is fetched relative to `import.meta.env.BASE_URL`, so the page works under that path.

To enable it, the repository owner opens Settings > Pages and sets Source to "GitHub Actions". Until then the workflow reports a notice and finishes without deploying. To check the Pages build locally: `URTC_BASE_PATH=/URTC-WEB-STUDIO/ VITE_BENCH_NOTICE=1 npm run build`, then `npm run preview`.
