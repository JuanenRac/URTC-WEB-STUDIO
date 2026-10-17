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
