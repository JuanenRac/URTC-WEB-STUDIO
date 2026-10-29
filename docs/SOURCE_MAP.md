# Source map

Every file of the repository with a line on what it does: the annotated tree that the README carried before it was reduced to the first level (the first level, in eight languages, is in the section Repository Structure of the README).

```text
/
├── src/
│   ├── App.tsx                     Root component - tab state, hardware state, CAN
│   │                                frame logging, and the handlers wired into every
│   │                                tab below (including CAN OTA start/readback and
│   │                                the CAN Bus Analyzer's own frame injector)
│   ├── main.tsx                    Vite/React entry point
│   ├── i18n.ts                     i18next setup - en/es/de/fr/it/zh/ja/pt, persisted
│   │                                to localStorage
│   ├── index.css                   Tailwind entry point
│   ├── types.ts                    Shared TypeScript types (CanFrame, HardwareState,
│   │                                FlasherState, ExpansionBoardType, ...)
│   ├── vite-env.d.ts                Vite's own ambient type declarations
│   ├── *.test.ts                    Vitest tests, each next to the module it covers (npm test)
│   ├── components/
│   │   ├── Header.tsx               Top bar: connect/disconnect button, active tool
│   │   │                            name, FW v0.0/v0.1 sandbox toggle
│   │   ├── Sidebar.tsx              Left nav - the 7 tabs described in this README
│   │   ├── ToolCatalog.tsx          Sandbox tab: the 25-tool catalog, tool selection,
│   │   │                            setpoint control
│   │   ├── OledDisplay.tsx          Sandbox tab: OLED status-screen preview
│   │   ├── SpecsAndBomViewer.tsx    Sandbox tab: BOM/pinout browser
│   │   ├── ThermalCameraViewer.tsx  Sandbox tab: simulated MLX90640 feed - 100%
│   │   │                            Math.random(), no CAN traffic at all (see
│   │   │                            "What's real vs. what's a sandbox" above)
│   │   ├── HardwarePanel.tsx        Sandbox jumper/LED/expansion-board control panel,
│   │   │                            used inside the Control and OLED tabs
│   │   ├── CanBusAnalyzer.tsx       Real tab: raw CAN frame log, custom frame
│   │   │                            injector, preset command triggers
│   │   ├── TraceReplayPanel.tsx     Loads a .trc/.asc trace and plays it into the log
│   │   ├── NodePickerDialog.tsx     The tool heads window: find the heads, select one, release it
│   │   ├── ConfirmDialog.tsx        The confirmation before an action that acts on the board
│   │   ├── FlasherStudio.tsx        Real tab: CAN-OTA UI (main + expansion slave) and
│   │   │                            the SWD/JTAG capability explainer
│   │   ├── TesterStudio.tsx         Real tab: per-tool live control/telemetry, built
│   │   │                            from the tester/ folder below
│   │   └── tester/
│   │       ├── ToolPanels.tsx       One panel per tool profile - real command bytes,
│   │       │                        real telemetry decode, per-tool watchdog keepalive
│   │       ├── GlobalPanels.tsx     Global Controls, Expansion Board, F-RAM,
│   │       │                        Self-Test, Raw Bus Monitor, Custom Frame injector
│   │       ├── ExtrasPanels.tsx     Black Box, optional functions, heater PID, rack bench and thermal view panels
│   │       └── shared.tsx           Shared UI primitives (Section, Field, button/input
│   │                                classes, safeInt)
│   ├── data/
│   │   └── toolsData.ts             The 25 TOOL_PROFILES - names, defaults, icons for
│   │                                the sandbox tabs
│   ├── hooks/
│   │   ├── useSerialCanBus.ts       Web Serial + SLCAN transport - connect/disconnect,
│   │   │                            frame TX/RX, per-ID waitForFrame with a bounded
│   │   │                            rx buffer and a 500-frame queue cap
│   │   ├── useFlasher.ts            CAN-OTA state machine (main board + expansion
│   │   │                            slave), mirrors flasher_protocol.py
│   │   ├── useTraceReplay.ts        Plays a recorded trace into the log and the panels
│   │   ├── useConfirmAction.ts      Asks for the confirmation before an action that acts on the board
│   │   ├── useNodePicker.ts         Finds the tool heads of the bus and keeps the selected one
│   │   ├── usePwa.ts                Offline copy, Install button and the notice of a newer version
│   │   └── useKeepalive.ts          Fixed-interval resend hook backing every tool's
│   │                                active-checkbox watchdog keepalive
│   ├── lib/
│   │   ├── flasher.ts               OTA protocol constants, CRC32/HMAC helpers,
│   │   │                            manifest parsing (no signing key)
│   │   ├── traceReplay.ts           Reads .trc/.asc traces; the player with speed and pauses
│   │   ├── boardVersion.ts          Version queries: 0x7F9/0x7FA/0x7E9 and the slave's 0x217/0x218
│   │   ├── githubRelease.ts         Images of the newest GitHub release and their download
│   │   ├── firmwareImage.ts         Image checks, manifest target and version (with patch)
│   │   ├── firmwareSignature.ts     Picks the signature to send: the published one,
│   │   │                            or a key typed in for one flash; sha256 check
│   │   ├── quickState.ts            0x111 decoding (thermal fault, reset cause)
│   │   ├── bundledFirmware.ts       Generated by scripts/sync-firmware.mjs
│   │   ├── slcan.ts / customFrame.ts / boardConfig.ts / boardTelemetry.ts / toolLimits.ts / simPresets.ts SLCAN parsing, custom frames, board configuration, what the board said, tool limits and the analyzer presets
│   │   ├── frameFilter.ts / frameQueue.ts / frameRouter.ts / frameBatcher.ts Raw Bus Monitor filter, queue of unclaimed frames, routing of the answers and batching of the frames for the screen
│   │   ├── blackBox.ts / thermalStats.ts / thermalHistory.ts / thermalView.ts / pid.ts Fault recorder, lifetime thermal counters and their history, thermal image, heater PID frames
│   │   ├── nodePicker.ts / multinodeSim.ts Rules of the tool heads window and a model of the nodes to try it without boards
│   │   ├── rackSim.ts               Simulator of the tool rack (frame version 2, big-endian)
│   │   ├── sessionRecord.ts / recordSigning.ts / traceExport.ts / download.ts Saved session record (SHA-256 of the log, signed), trace files and downloads
│   │   ├── safeOff.ts / keepaliveLoop.ts / confirmController.ts / dangerousActions.ts Switching off the actuators kept alive, and which actions ask for a confirmation first
│   │   ├── pwa.ts / serviceWorkerBuild.ts / selfUpdate.ts Offline copy, the text of the service worker and the notice of a newer version
│   │   ├── releaseSignature.ts      Check of the signature of a release in the browser
│   │   ├── generated/               Tables and vectors written by URTC-COMMON (tools, identifiers, shared vectors) and their lock
│   │   └── canIds.ts                CAN ID constants for Tester Studio - mirrors
│   │                                 tester_config.py byte-for-byte
│   └── locales/                     UI strings - en.json, es.json, de.json, fr.json,
│                                     it.json, ja.json, zh.json, pt.json
├── scripts/
│   ├── bump-version.mjs             Dependency-free version-bump script; legacy
│   │                                 today, kept for reference only - superseded
│   │                                 by bump_manifest_version.py (see "Versioning")
│   ├── sync-firmware.mjs            Copies the URTC release assets (or a local
│   │                                  folder) into public/firmware/, digests
│   │                                  checked - npm run sync-firmware
│   ├── sw.template.js               Template of the service worker the build writes as sw.js
│   └── sync-firmware.test.mjs       Tests of sync-firmware.mjs
├── public/
│   ├── firmware/                    Bundled .bin/.elf/.hex for the main application,
│   │                                  main bootloader, expansion slave application, and
│   │                                  expansion slave bootloader
│   ├── _headers                     Security headers for hosts that read this file
│   └── manifest.webmanifest         Web app manifest (name, icons) for installing the Studio
├── images/
│   ├── URTC_WEB_STUDIO_BANNER.svg   Full logo banner (shown at the top of this README)
│   ├── URTC_APP_ICON_NEW.svg        App icon
│   ├── urtc_custom_icon.svg         App icon, same artwork
│   └── urtc_icon.ico                Favicon
├── index.html                       Vite entry HTML
├── vite.config.ts                   Vite + Tailwind plugin config
├── tsconfig.json                    TypeScript config
├── playwright.config.ts             Settings of the end-to-end checks in a real browser (npm run test:e2e)
├── e2e/                             The end-to-end checks and the model of the adapter and the board they drive
├── .env.example                     No variable is read by the app
├── dev.bat / dev.sh                 Install deps + start the Vite dev server
├── build.bat / build.sh             Install deps + produce the static dist/ build
├── build-test.bat / build-test.sh   Non-versioning check: type check, tests and build
├── tools/
│   ├── ci_validate.py               Manifest/CHANGELOG/docs validation used by CI
│   ├── build_test.py                Non-versioning check used by build-test.sh / .bat
│   └── _doc_policy.py / _readme_parity.py / _tracked_names.py Shared checks used by ci_validate.py
├── bump.py                          Explicit version bump command (building never bumps)
├── bump_manifest_version.py         Real build-time version bump (package.json + manifest, see "Versioning"); `--sync` mode also exists for accepting one prior native-only bump
├── package.json
├── package-lock.json Exact versions of the dependencies (npm ci)
├── urtc_i18n.lock.json Lock of the language files generated from the catalog of URTC-COMMON
├── CHANGELOG.md                     Version history and a summary of past work
├── LICENSE
├── NOTICE                      Copyright notice and the license of the documentation
├── README.md                        This file
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BUILD_AND_RUN.md
│   └── INTEGRATION_CONTRACT.md
└── README_spa.md / README_ita.md / README_fra.md / README_deu.md / README_zho.md / README_jpn.md / README_por.md  <- translations
```
