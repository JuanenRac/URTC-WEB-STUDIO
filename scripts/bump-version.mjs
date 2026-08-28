#!/usr/bin/env node
// =============================================================================
// URTC-WEB-STUDIO - Legacy native-only version helper: bump-version.mjs
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// Root build scripts own the single project increment through
// bump_manifest_version.py. `npm run build` is deliberately compilation-only
// so it cannot create manifest/package version drift.
//
// Rule: a base-10 odometer carry, applied to MAJOR.MINOR.PATCH.
//   - patch += 1
//   - if patch rolls past 9 (i.e. would become 10): patch = 0, minor += 1
//   - if that minor carry also rolls past 9: minor = 0, major += 1
// Example: 1.1.9 -> 1.2.0 (never 1.1.10). 1.9.9 -> 2.0.0.
//
// No new dependencies: plain Node (fs/path/url from the standard library).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '..', 'package.json');

const raw = readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(raw);

const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(pkg.version ?? ''));
if (!match) {
  console.error(
    `[bump-version] Unrecognized "version" field in package.json: "${pkg.version}" ` +
    `(expected MAJOR.MINOR.PATCH) - leaving it untouched.`
  );
  process.exit(1);
}

let major = Number(match[1]);
let minor = Number(match[2]);
let patch = Number(match[3]);
const oldVersion = `${major}.${minor}.${patch}`;

patch += 1;
if (patch > 9) {
  patch = 0;
  minor += 1;
  if (minor > 9) {
    minor = 0;
    major += 1;
  }
}

const newVersion = `${major}.${minor}.${patch}`;
pkg.version = newVersion;

// Preserve the same 2-space indentation the file already uses, plus a
// trailing newline - matches what `npm install`/editors normally write.
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

console.log(`[bump-version] ${oldVersion} -> ${newVersion}`);
