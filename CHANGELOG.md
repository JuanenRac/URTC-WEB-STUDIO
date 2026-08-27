# Changelog

All notable work on URTC Web Studio, summarized from the project's internal
audit history. This file is public; the full session-by-session log (with
implementation-level detail) is kept privately outside this repository.

Versioning here does **not** follow Semantic Versioning. It follows a
base-10 "odometer" scheme (see the note at the bottom of this file) - every
real production build (`npm run build`) bumps the version automatically, so
the number reflects build count, not the size or compatibility of a change.

## [0.1.9] - Chinese and Japanese added to the language switcher

- New `src/locales/zh.json` (Simplified Chinese) and `src/locales/ja.json`
  (Japanese) - full translation of all 503 keys, matching the coverage of
  the existing en/es/de/fr/it files. Wired into `src/i18n.ts`'s own
  `resources` map and `SUPPORTED_LANGUAGES` list, and into the language
  `<select>` in `Header.tsx`. New `language_zh`/`language_ja` keys added to
  all 5 existing locale files. Verified with a real `npm run build` (clean,
  0 errors) and a real key-parity check (503/503 keys present in both new
  files, zero gaps or extras against `en.json`).
- New `README_zho.md` / `README_jpn.md` documentation translations, plus
  the 5 existing README files' language selectors updated to link them.

## [0.1.8] - Jumper Sync on connect + Oled Reset timer overlap fix

- **Jumper Sync** - a new `useEffect` queries the real active tool over CAN
  (`0x110`) as soon as the app connects to a board, instead of assuming
  Tool ID 0 by default until the user manually changes it.
- **Oled Reset overlap** - the splash animation's `setTimeout` id is now
  saved and cleared with `clearTimeout` before starting a new one, so
  triggering "Replay Splash" again while the previous animation is still
  running no longer lets a stale timer cut the new one off partway
  through.

## [0.1.x] - Automatic version bump on every build

- Added `scripts/bump-version.mjs`: a dependency-free Node script that reads
  `package.json`'s `version`, applies a base-10 carry increment (patch +1;
  past 9 it resets to 0 and minor +1; past 9 there too it resets and major
  +1 - e.g. `0.1.9` -> `0.2.0`, never `0.1.10`), and rewrites the file.
- Wired it in as the `prebuild` npm script, so it runs automatically before
  every real `npm run build` - no manual step, and it does not fire on
  `npm run dev`/`lint`/`preview`.
- Documented the scheme in `README.md` and its four translations.
- Checked for a natural place to surface this build version in the UI
  (`Header.tsx`, `App.tsx`, `TesterStudio.tsx`, `FlasherStudio.tsx`, and a
  search for any footer/About section): none exists. The only
  version-shaped UI already in the app is unrelated - the header's
  "FW v0.0/v0.1" pill is a sandbox toggle for the *simulated* tool catalog,
  and Flasher/Tester Studio's version panels show the *real connected
  board's* firmware, queried live over CAN. No new UI was invented to avoid
  conflating those with the web app's own build number.

## [0.1.0] and earlier - Project history (summarized)

- **First real session on this project.** Read the full
  source and the sibling Python tools (`URTC-FLASHER`, `URTC-TESTER`) to
  scope feature parity. Found and disclosed a real security issue (the
  OTA HMAC signing key hardcoded in the shipped JS bundle - the same
  convention the desktop tools use, but worse exposure for a web app,
  documented explicitly in the README). Fixed a real bug that would have
  double-sent every CAN-OTA frame against real hardware. Corrected stale
  local firmware filenames. Removed unused `@google/genai` and
  `tesseract.js` dependencies.
- **Full read-only audit, then fixes.** Audited the whole
  codebase and confirmed ten findings (an oversized 8209-line `.gitignore`
  that silently failed to ignore new files, three more orphaned
  dependencies, a known `nanoid` CVE, unvalidated raw CAN frame injection,
  a watchdog `useEffect` that thrashed on every CAN frame, an unbounded
  serial receive buffer, a stale scaffold capability flag, an unclear
  distinction between the real and simulated thermal camera views, a
  hex-formatting bug, and a `waitForFrame` race condition). Fixed all of
  them same-day except the one requiring physical USB-CAN hardware
  (deferred, documented). Also restructured `README.md` to match the rest
  of the ecosystem (banner, License section, Repository Structure,
  Related Projects, Author).
- **Documentation and code consistency sweep.** Added
  `dev.bat`/`dev.sh`/`build.bat`/`build.sh`. Fixed a stale Repository
  Structure tree and an outdated Related Projects block. Removed
  historical/dated narration from source comments. Added full README
  translations (`README_spa.md`, `README_ita.md`, `README_fra.md`,
  `README_deu.md`). Did a line-by-line review of every `.ts`/`.tsx` file
  and fixed four real bugs in `useSerialCanBus.ts`: a serial port that
  could get stuck open after a failed connection handshake, a guaranteed
  `TypeError` on physical disconnect during an active read, a silent
  write failure that logged a CAN frame as sent when it never reached the
  port, and (documented, not fixed) fire-and-forget sends with no visible
  UI warning on failure.
- **Backlog review, two passes.** First pass: implemented
  SLCAN bitrate auto-detection (matching the desktop tools' algorithm
  exactly) and a native folder picker (File System Access API) for
  firmware readback, with a `<a download>` fallback. Re-confirmed several
  other backlog items still couldn't be done (no physical hardware, `bun`
  not installed, SWD/JTAG is a structural browser limitation). Second
  pass, same day: implemented the visible UI warning for failed
  fire-for-forget CAN sends (a red banner below the header, reusing the
  app's existing error-pill styling) rather than leaving communication
  failures silent.

---

### Note on the versioning scheme

This project does not use Semantic Versioning (`MAJOR.MINOR.PATCH` with
meaning attached to each digit). Instead it uses a simple base-10 odometer:
every real production build increments the version by one "tick," carrying
over patch -> minor -> major exactly like a car's odometer rolling from 9 to
10. This keeps a monotonically increasing build identifier without requiring
a human to decide "is this a patch or a minor bump" on every build.
