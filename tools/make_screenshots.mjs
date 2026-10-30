#!/usr/bin/env node
/**
 * Takes the screenshots of the README: the built Studio in a real browser (headless Microsoft Edge, no window) with a board modelled behind the
 * adapter (e2e/support/fakeBoard.ts) and made-up data. Nothing real is behind them. Copyright (C) 2026 JuanenRac (Electro Hobby 3D). GPL-3.0-or-later.
 *
 *   npm run build                                 the Studio built (dist/)
 *   node tools/make_screenshots.mjs               writes images/screenshots/<name>.png at 1920x1080
 *   node tools/make_screenshots.mjs --out DIR     writes them in DIR instead
 *
 * It needs Edge (the one Windows has) and the dev dependencies (`npm ci`). It takes no mouse or keyboard of the desktop. The preview server it
 * starts is stopped when the run ends.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outIndex = process.argv.indexOf("--out");
const env = { ...process.env };
if (outIndex > 0) env.URTC_SHOTS_OUT = path.resolve(process.argv[outIndex + 1]);
const result = spawnSync(process.execPath, [path.join(root, "node_modules", "@playwright", "test", "cli.js"), "test", "-c", "playwright.screenshots.config.ts"], { cwd: root, env, stdio: "inherit" });
process.exit(result.status ?? 1);
