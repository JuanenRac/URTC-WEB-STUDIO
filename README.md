<p align="center">
  <img src="images/URTC_WEB_STUDIO_BANNER.svg" alt="URTC Web Studio Logo" width="100%">
</p>

# URTC Web Studio

<p align="center">
  🇺🇸 <b>English</b> |
  <a href="README_spa.md">🇪🇸 Español</a> |
  <a href="README_fra.md">🇫🇷 Français</a> |
  <a href="README_ita.md">🇮🇹 Italiano</a> |
  <a href="README_deu.md">🇩🇪 Deutsch</a> |
  <a href="README_zho.md">🇨🇳 简体中文</a> |
  <a href="README_jpn.md">🇯🇵 日本語</a> |
  <a href="README_por.md">🇵🇹 Português</a>
</p>

### The main workflows of the URTC flasher and tester in a browser tab, over a USB-CAN adapter and Web Serial

<p align="center">
  <img src="https://img.shields.io/badge/License-GPL%203.0--or--later-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Tests-577-2ea44f.svg" alt="Tests">
  <img src="https://img.shields.io/badge/Framework-React-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/API-Web%20Serial-green.svg" alt="Web Serial">
  <img src="https://img.shields.io/badge/Tool-Vite-646CFF.svg" alt="Vite">
</p>

---

**Honesty check - what actually runs today:** `npm test` (Vitest) covers the pure logic: SLCAN parsing, request/answer matching, firmware image and manifest checks, tool limits, confirmations, the rules that keep the simulator apart from the real bus, trace export and the eight interface languages. The screens and the Web Serial transport itself have no unit tests (the end-to-end checks at the end of this paragraph drive them against a modelled board), and none of this has been run against a real URTC board in this environment (no USB-CAN adapter here to test with): Flasher Studio, Tester Studio and the CAN Bus Protocol Analyzer are real code verified only by those tests, type-checking (`npm run lint`) and code review. Control/OLED/Specs-BOM/Thermal IR Inspection are openly labeled sandbox tabs with zero CAN traffic. See `CHANGELOG.md` for exactly what has shipped so far. `npm run test:e2e` also opens the built page in a real browser (Playwright) against a modelled board: the offline copy, the history of the thermal counters and the saved session are checked that way.

---

> **Safety and security status:** this ecosystem is not a certified safety system, and no populated URTC board exists yet. The bootloaders check firmware images with CRC32 and a shared-key HMAC-SHA256, not with an asymmetric signature (planned); the published application images are signed with the public development key (`signing_key_kind: dev`), so anyone can produce an image the bootloader accepts; nothing has been transmitted to a real board. Read the [security baseline](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/SECURITY_BASELINE.md) and the [threat model](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/THREAT_MODEL.md) before relying on any statement here for the safety of a person.

## 📋 At a glance

| | |
|---|---|
| Version | `0.3.7` |
| Maturity | Functional |
| Tests | 577 (`npm test`) |
| Stack | Web Serial API / TypeScript |
| Target | A web browser on the user's PC |
| On real hardware | Simulated only: tested against emulators, fakes or simulators; no run on real hardware is recorded for this version |

**Jump to:** [Overview](#-overview) · [Architecture](#-architecture) · [Features](#-features) · [Security](#-security--safety) · [Interfaces](#-interfaces) · [Quick start](#-quick-start) · [Testing](#-testing) · [Structure](#-repository-structure) · [Related](#-related-projects)

<!-- urtc-section:status_web_studio -->
## 🚦 Project status

🟢 done and verified · 🟡 works, with known limits · 🟠 half done or not verified · 🔴 not done or not working. Nothing is green if it never ran on real hardware.

| Part | Status | What the repository can show |
| --- | :---: | --- |
| Software | 🟡 | Works on a PC and against the simulator; never run against a real board. |
| Interface | 🟡 | The window runs and is checked against a simulated board; not tried with a real adapter. |
| Tests | 🟢 | The test suite passes in the CI on every push. |
| Real hardware | 🟠 | No run on a real board yet: the bench test is still pending. |
| Documentation | 🟡 | README in eight languages and reference documents; the translations were not reviewed by native speakers. |

<!-- /urtc-section:status_web_studio -->

## 🎯 Overview

A browser-based companion to the **Universal Robot Tool Controller (URTC)** -
a React/Vite single-page app that is meant to talk to real URTC hardware (it has never been run against any) over a USB-CAN
adapter via the [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API),
using the same SLCAN framing and CAN protocol as the two desktop companion
tools, [URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) and
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER). The aim is to bring the main workflows of those two tools into a single browser tab, not a simplified demo of them; it does not reach full parity yet (see "Not covered yet" below) - the Flasher Studio and Tester Studio tabs send and receive the
real CAN frames described in `docs/CANBUS.TXT` of the
[URTC firmware repo](https://github.com/JuanenRac/URTC).

### What's real vs. what's a sandbox

This app has two kinds of tabs:

- **Real, hardware-driven tabs** - Flasher Studio, Tester Studio, and the CAN
  Bus Protocol Analyzer. These only do anything once you've connected a real
  USB-CAN adapter (top-right header button); every command they send and
  every reading they show comes from the CAN bus (this path has never been run against a real adapter or board). This includes the
  real **thermal camera reading** - Tester Studio's "Thermal Inspection"
  panel (`0x250`/`0x251`/`0x254`/`0x255`) queries the tool head's actual
  MLX90640 IR array over CAN.
- **Offline sandbox tabs** - Control (tool catalog), OLED, Specs/BOM, and
  Thermal IR Inspection. These let you explore the 25-tool catalog, preview
  the OLED status screens, browse the BOM/pinouts, and view a simulated
  thermal camera feed, all without any hardware connected. The "FW v0.0 /
  v0.1" toggle in the header only affects these sandbox tabs (which tool
  profiles a given firmware build would unlock) - it has no bearing on what a
  real, connected board reports.
  - **Do not confuse the two thermal views**: the standalone "Thermal IR
    Inspection" tab (`ThermalCameraViewer.tsx`) is 100% client-side
    `Math.random()` noise with no CAN traffic at all - it's a UI mockup, not
    a sensor reading. The real MLX9064x data only ever appears inside Tester
    Studio's "Thermal Inspection" panel, and only once hardware is
    connected.

## 🧩 Role in URTC

URTC-WEB-STUDIO is the browser version of the two desktop programs of URTC, URTC-FLASHER and URTC-TESTER: one React page that talks to a URTC board through a USB-CAN adapter with Web Serial, with the same SLCAN framing and the same CAN protocol (its tables and vectors are generated from URTC-COMMON). It brings their main workflows into a browser tab with nothing to install, and leaves SWD/JTAG, which no browser can drive, to the desktop flasher. It also has sandbox tabs that explore the 25 tools offline and transmit nothing.

## 🏛️ Architecture

<p align="center">
  <img src="images/architecture.svg" alt="URTC-WEB-STUDIO architecture: who uses it, what it holds and what it depends on" width="100%">
</p>

How the parts of this repository fit together: who uses it, what it holds and what it depends on. The picture is drawn from `docs/architecture.json` and checked against the code.

### Technology Stack

- **Language:** TypeScript
- **Frontend Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **CRC32:** `crc-32` - firmware image integrity check, mirrors the
  bootloader's own CRC32 computation
- **Hardware transport:** Web Serial API + SLCAN framing (no native
  dependencies, no companion backend server)

## ✨ Features

### Flasher Studio - real feature coverage

Ported from `URTC-FLASHER`'s own `flasher_protocol.py`, against the same CAN
IDs:

- **CAN-OTA update of the main board** (`0x7F0`-`0x7F7`): enter-bootloader
  trigger, shared-key HMAC-SHA256 chunks (tested against a simulator only), paged transfer with page-ACK flow control and
  retry/backoff, CRC32 + declared-version END_UPDATE, and terminal-status
  handling (including recovering from a lost confirmation frame the same way
  the desktop tool does - it re-queries the version rather than reporting a
  false failure).
- **CAN-OTA update of the expansion slave** (`0x210`-`0x219`, relayed through
  the main board's own I2C bridge) - same signing/CRC scheme, no page-ACK or
  heartbeat on this path (matches the real protocol; progress is polled, not
  pushed).
- **Downgrade authorization** (`0x7FD`) - a confirmation-gated checkbox that
  authorizes the current attempt to bypass the bootloader's anti-rollback
  check, for a deliberate revert to an older release.
- **F-RAM erase before flashing** (`0x192`), optional, main board only.
- **CAN error counter query** (`0x7FB`/`0x7FC`, TEC/REC read straight from
  the CAN controller's own error registers) - tells a genuine bus problem
  apart from an application/bootloader-side issue.
- **Firmware readback / backup over CAN** (`0x7FE`/`0x7FF`) - reads the main
  slot's current contents back before you overwrite it, paced 2KB/page with
  host ACKs, and saves it as a `.bin` download.
- **Live board version query** (`0x7F8`/`0x7F9`/`0x7FA`/`0x7E9`) - shows the real
  responder (app or bootloader), HardwareID, and version, not a simulated
  toggle.
- **Published signature and digest** - every image from the URTC build ships
  with `<file>.manifest.json` (version, `sha256`, and the `hmac_sha256` value the bootloader expects, a shared-key HMAC-SHA256 and not an asymmetric signature) and `<file>.sha256`. The app sends that
  published signature, a manifest `sha256` that does not match the file
  **blocks** the flash, and the manifest's version is what gets reported to
  the bootloader. A file picked from disk has no manifest: it can only be
  flashed with a signing key typed in for that one flash (bench boards),
  unless its `.manifest.json` is picked together with it.
- **Firmware patch number** (`0x7E9`, and the extended `0x218` of the slave) -
  the installed firmware and the selected image are shown as
  major.minor.patch. The patch takes part in the comparison only when both
  sides carry one, a board that predates it (it sends no `0x7E9`) keeps
  working with major.minor, and the patch goes into END_UPDATE only towards a
  bootloader that announced it. The log says whether the image is older,
  equal or newer than what the board reported.
- **Firmware from the newest GitHub release** - the binaries are assets of the
  release of each URTC version, not files in git. The list comes from the
  releases API of `JuanenRac/URTC` (only the application images of the selected
  board, each with its `.sha256` and `.manifest.json`); a downloaded image must
  match the digests the release publishes, and the image, manifest and
  signature checks stay. GitHub serves the files from a host that sends no CORS
  headers, so a browser may be unable to download them: the log then says so,
  and the image can be taken from the bundled folder, or downloaded from the
  release page and picked with Browse together with its `.manifest.json`.
- **Board config**: expansion board type / MLX9064x sensor variant / free
  tool configuration (ID pins `11111`) / peripheral info & serial number -
  `0x1A0`-`0x1A7`.

#### SWD/JTAG - not available from a browser, by design

There is no Web API that can drive an SWD/JTAG debug probe - Web Serial only
talks to serial-framed devices (like a USB-CAN adapter), not a probe's own
protocol, and STM32CubeProgrammer/pyOCD are native subprocesses the desktop
tool shells out to. This is a structural limitation of running in a browser
sandbox, not a missing feature here. The SWD/JTAG tab in Flasher Studio
explains the exact commands the desktop `URTC Flasher` tool would run
locally, for reference - use that tool directly for full-chip programming,
option-byte/RDP checks, or a full-flash backup before a mass erase.

### Tester Studio - real feature coverage

Ported from the panels of `URTC-TESTER`'s own Qt Quick deck
(`assets/qml/TesterDeck.qml`), against the same CAN IDs:

- A panel per tool (soldering iron + wire feeder, shared plain-stepper
  motion tools, vacuum pickup, drill, AOI, laser, 3D printer heater/motion/
  fans, scan probe, electromagnet, spot/ultrasonic welder, flying probe
  incl. the ADS1115 advanced path, UV curing, hot air rework, crimping,
  thermal inspection, paste jetting), each sending the tool's real command
  bytes and decoding its real telemetry.
- **Active-checkbox + keepalive** for every tool with a firmware-side
  communication watchdog (soldering iron, laser, UV curing, hot air rework,
  3D printer nozzle - 150ms resend under a 250ms watchdog; 3D printer layer
  fan - 400ms resend under its own 1000ms watchdog), the same resend
  intervals the desktop tool uses. Unchecking it, replacing the panel,
  changing tab, disconnecting or closing the page sends the tool's off
  command.
- **Global Controls** (`0x100`), **Expansion Board** SPI passthrough +
  TMC DIAG0 query (`0x180`-`0x183`), **F-RAM** query/erase (`0x190`-`0x192`),
  **Self-Test** (safe, at-rest checks per tool), a **Raw Bus Monitor** with
  `.trc`/`.asc` trace export, and a **Custom Frame** injector with an
  optional repeat interval - validated like the CAN Bus Protocol
  Analyzer's own frame injector: an identifier outside `0`-`7FF`, an invalid
  data byte or more than 8 bytes is refused with a message, never masked,
  dropped or cut. Identifiers that only the board transmits are refused, and
  writes to the board memory, bootloader commands and actuator commands are
  confirmed first.
- **Detect Hardware** queries the real active tool (`0x110`/`0x111`) and
  board version (`0x7F8`/`0x7F9`), and a declared critical error
  (`0x111` byte 1) surfaces as a live fault banner.

<!-- urtc-section:heads -->
### Several tool heads on one bus

The firmware can let several tool heads share one CAN bus (the multinode extension). It is **off by default**, and a bus with one head works exactly as before. The **Tool heads** window finds the heads, lists each with its address, tool and serial number, and shows its state: ready, selected, address conflict, fault latched, in its bootloader or lost. You select one, the program asks you to confirm, and only then does it send anything to that head; while several heads are on the bus, a command is refused until one is selected and has confirmed it. If the selected head is lost, every head is put in its safe state (a checkbox of the window switches that off). It has been tried against a model of the bus only, not against boards. See `docs/MULTINODE.md` in URTC-COMMON.
<!-- /urtc-section:heads -->

## 🔒 Security & Safety

| Threat | Defence |
|---|---|
| A malformed frame reaches the wire or the screen | Both directions of the SLCAN link are validated: an identifier outside `0x000`-`0x7FF`, a payload over 8 bytes or a byte outside `0x00`-`0xFF` is refused before it is written, and an inbound line that is not a real SLCAN frame is dropped |
| A secret ships in the page | The app contains no signing key: Flasher Studio only sends the signature that the URTC build published next to each image, so the page can be hosted publicly |
| A wrong or tampered firmware image | A manifest whose `sha256` does not match the file blocks the flash; every image of an official release carries an Ed25519 release signature that the page checks in the browser before it sends the image |
| A simulated answer taken for a real one | The sandbox tabs transmit nothing and, while a board is connected, answer nothing; their frames are marked SIM and a replayed trace is marked REPLAY |
| An action that acts on the board by mistake | Laser, drill, UV curing, welding, heaters, motion, paste jetting, writes to the board memory, risky hand-typed frames and an image signed with the public development key ask for a confirmation first |
| An actuator left running | Every tool with a firmware watchdog is kept alive by a resend and switched off when the panel is replaced, the tab changes, the board is disconnected or the page closes; STOP ALL switches off everything the page keeps alive |
| A page that loads code from elsewhere | A content security policy: scripts only from the page itself, connections only to itself and GitHub |

STOP ALL is a software command, not an emergency stop, and none of the checks above is a safety function.

### Simulator separation and confirmations (software checks, not safety functions)

- The sandbox tabs (Control, OLED, Thermal IR) transmit nothing. Their frames are marked SIM, and while a board is connected they produce no simulated answer. Of the protocol analyzer's predefined messages only plain queries are sent to a connected board; the rest stay simulated.
- Tester Studio shows a tool panel only for the tool the board itself reported (`0x111`), and none before the board has answered.
- Laser, drill, UV curing, welding, heaters, motion, paste jetting, writes to the board memory and risky hand-typed frames ask for confirmation first.
- **STOP ALL** in the header (shown while connected) switches off every actuator that this page keeps alive; closing the page and disconnecting do the same. It is a software command, not an emergency stop.
- Flashing an image signed with the public development key asks for confirmation first, because that key proves nothing about who made the image.
- When the board declares a critical error, the banner also gives the reason of the thermal runaway guard if the board reports one.
- **Replay of a recorded trace** (CAN Bus Protocol Analyzer): a `.trc` or `.asc` file, for example the one the Raw Bus Monitor exports, plays its received frames into the log and the panels with no board, at 0.25x to 10x and optionally in a loop. The frames are marked REPLAY, nothing is transmitted, a recording never answers a request, it is never exported as something the board said, and the replay pauses while a board is connected.

### Security note: no signing key in this app

Since 0.2.3 this app contains **no** HMAC-SHA256 signing key. The URTC build
signs every application image itself (with a private key on release builds only; the published images use the public development key)
and publishes the signature next to it; Flasher Studio only transports that
signature - the same model as the desktop `URTC Flasher`. Nothing secret is
shipped in the JS bundle, so the page can be hosted publicly.

The one exception is a self-built image with no manifest, for a bench board:
the app then asks for the signing key, keeps it in memory for that single
flash and never stores it. Images built with the PUBLIC development key
(`signing_key_kind: "dev"` in the manifest) only install on boards whose
bootloader was built the same way - the log says so. See URTC's
`docs/FIRMWARE_SIGNING.TXT`.

The folder is **not in git**: `npm run sync-firmware` creates it (the CI and the Pages build run it before the tests and the build). While there is no official release, GitHub's "latest" answers 404 and `firmware-release.json` names the release used instead (today the bench pre-release); delete the file, or change its tag, when an official one is published. **Security of the page**: scripts, styles, fonts and images come from the page itself (the fonts are packaged with the app, no request goes to a font host), only the style attributes that React writes are allowed inline, and the page can reach only its own origin and the GitHub hosts that serve the releases (Content-Security-Policy in the built `index.html`). A host that can send headers uses `public/_headers` (the same policy, `Permissions-Policy: serial=(self)` and nothing else powerful); GitHub Pages cannot send headers, so there only the policy inside the page applies.

`public/firmware/` holds exactly the files URTC published (same names, same
bytes, with their sidecars). The URTC binaries are not in git: they are assets
of each version's GitHub release. `npm run sync-firmware` downloads the newest
release (`npm run sync-firmware -- --tag v0.3.5` for a given one), or takes a
local folder as an argument (`npm run sync-firmware -- ../URTC/firmware` for a
bench build). Either way it checks every digest and the signature fields before
touching `public/firmware/`, and regenerates `src/lib/bundledFirmware.ts`; a
test verifies the bundle against its manifests.

Each file of an official release has a release signature (`<file>.sig`, Ed25519): the sync verifies it when it is there and refuses a wrong one; a set without signatures (a bench pre-release or a local build) needs `--allow-unsigned`. The page checks the same signature in the browser (Web Crypto) before it sends a bundled image or an image of a GitHub release to a board, and stops if it is not valid.

## 🔌 Interfaces

- A USB-CAN adapter running **SLCAN** firmware (e.g. a CANable running
  `candlelight`/`slcan`, or any adapter that speaks the standard `lawicel`
  SLCAN serial protocol) - the same adapter class both desktop tools support
  via their own Serial transport.
- The bus set to **500 kbit/s**. On connect the app tries 500, 250, 125 kbit/s and the other standard rates in turn and keeps the first one at which a board answers a version query; there is no way yet to choose the rate by hand or to listen without a board answering.
- A browser with Web Serial support - **Chrome or Edge**. Firefox and Safari
  don't implement Web Serial and won't be able to connect at all.
- Web Serial requires either a secure context (HTTPS) or `localhost` - and it
  cannot be used from inside an iframe. If you're previewing this app inside
  an embedded frame, open it in its own tab first.

### CAN Frame Validation

Both directions of the SLCAN link are validated before anything reaches the
UI or the wire (`src/hooks/useSerialCanBus.ts`):

- **Outbound** - `sendFrame()` refuses to serialize a command whose
  identifier falls outside the 11-bit standard CAN range (`0x000`-`0x7FF`),
  whose payload exceeds 8 bytes, or whose payload contains a byte outside
  `0x00`-`0xFF`. The UI shows "Refusing malformed CAN frame: ..." instead of
  writing invalid text to the serial port.
- **Inbound** - `processBuffer()` requires a real
  `t<3-hex ID><1-hex DLC 0-8><hex payload>` match before turning a received
  SLCAN line into a `CanFrame`; a DLC outside `0`-`8` or a payload shorter
  than its own declared length is logged to the console and dropped rather
  than handed to a tool panel as a `NaN` byte. An optional trailing adapter
  timestamp is still accepted after a valid payload.

## 🚀 Quick start

### Prerequisites

- Node.js 20 LTS+
- npm

### Installation

```bash
git clone https://github.com/JuanenRac/URTC-WEB-STUDIO.git
cd URTC-WEB-STUDIO
npm install
```

### Development Mode

Runs the app with Vite's dev server and live-reloading:
- **Windows:** double-click `dev.bat` or run `npm run dev`
- **Linux/Mac:** run `./dev.sh` or `npm run dev`

Then open `http://localhost:3000` in Chrome or Edge.

The development server listens on `localhost` only: Web Serial works on https or on localhost, so opening it to the network would gain nothing.

### Static Build

Compiles into a static, optimized bundle in `dist/`:
- **Windows:** double-click `build.bat` or run `npm run build`
- **Linux/Mac:** run `./build.sh` or `npm run build`

This is a plain static site - there's no bundled server component (unlike
`HYDRA-UMC STUDIO`'s own `server.ts`). Preview the built `dist/` folder
locally with:

```bash
npm run preview
```

or serve `dist/` with any static file host of your choice. `npm run lint`
runs the TypeScript compiler in check-only mode.

The built page declares a content security policy (scripts only from the page itself; connections only to itself and to GitHub) and loads each tab when it is first opened. `npm run test:e2e` drives it in a real Chromium against a modelled board; it has not been tried with a real adapter.

<!-- urtc-section:compatibility -->
### Requirements & compatibility

Which versions of the URTC programs work together, and which protocol version each one speaks, is listed in the compatibility table that URTC-COMMON generates: [docs/COMPATIBILITY.md](https://github.com/JuanenRac/URTC/blob/main/docs/COMPATIBILITY.md).
<!-- /urtc-section:compatibility -->

## 🧪 Testing

`npm test` (Vitest) runs 577 tests of the pure logic: SLCAN parsing, request and answer matching, firmware image and manifest checks, release signatures, tool limits, confirmations, the rules that keep the simulator apart from the real bus, trace export and replay, the node picker, the rack simulator, the saved session record, the offline copy, the sync of the firmware and the eight interface languages. `npm run lint` type-checks the sources and `npm run test:e2e` runs 19 end-to-end checks in a real Chromium against a modelled adapter and board (`npm run test:coverage` adds a coverage floor). The screens and the Web Serial transport have no unit tests of their own; the end-to-end checks drive them. None of it has run against a real adapter or board.

## 🏗️ Build & Release

### GitHub Pages (switched off until the owner turns it on)

The repository can publish the built site on GitHub Pages (workflow `.github/workflows/pages.yml`: `npm ci`, type check, tests, `npm run build` with the project base path, then `upload-pages-artifact` and `deploy-pages`). **The workflow is switched off**: both jobs run only when the repository variable `URTC_PAGES_ENABLED` is `true` (Settings > Secrets and variables > Actions > Variables), which the owner sets after the first signed official release of URTC. The build then runs `npm run sync-firmware -- --require-official`: it takes the firmware of the newest official release only (never a pre-release, never the fallback tag of `firmware-release.json`), refuses any file without a valid release signature and any application image built with the public development key, so the published page cannot carry development-key images. Pages itself must also be enabled once (Settings > Pages > Source: GitHub Actions); with the variable unset the workflow is skipped. Web Serial needs a Chromium-based browser and https, which Pages provides.

The `version` of `package.json` and the one of `urtc.project.json` change only with an explicit step (`python bump.py`, which keeps the two equal and writes the entry of the changelog); `build.bat` / `build.sh`, `npm run build`, `npm run dev`, `npm run lint` and `npm run preview` never change the version.

## 📂 Repository Structure

<p align="center">
  <img src="images/repository-structure.svg" alt="Repository structure of URTC-WEB-STUDIO" width="100%">
</p>

<details>
<summary>Text version of the tree</summary>

```text
URTC-WEB-STUDIO/
├── src/                                           the app: components, hooks, the CAN, SLCAN and firmware logic, the eight language files, generated tables
├── docs/                                          architecture, build and run, integration contract
├── e2e/                                           end-to-end checks and the model of the board
├── public/                                        bundled firmware, headers, web manifest
├── scripts/                                       firmware sync and service worker
├── tools/                                         build check and shared tools
├── images/                                        banner and the pictures of this README
├── .github/                                       CI workflow, issue and pull-request templates
├── build.sh build.bat                             build scripts
├── build-test.sh build-test.bat                   build and test scripts that change nothing in the repository
├── test.sh test.bat                               run the tests
├── urtc.project.json                              manifest: version, role, maturity and build command
├── CHANGELOG.md                                   what changed in each version
├── SECURITY.md SUPPORT.md LICENSE                 security policy, support and license
├── CONTRIBUTING.md CODE_OF_CONDUCT.md             how to contribute and the code of conduct
├── .gitattributes .gitignore                      Git settings
├── dev.sh dev.bat                                 install and start the dev server
├── bump.py bump_manifest_version.py               scripts that raise the version
├── index.html                                     Vite entry page
├── package.json package-lock.json tsconfig.json   packages, locked versions, TypeScript
├── playwright.config.ts vite.config.ts            Vite and end-to-end settings
├── urtc_i18n.lock.json                            lock of the generated language files
└── NOTICE LICENSE.md                              copyright notice and documentation license
```

</details>

The annotated list of every source file, one line each, is in [docs/SOURCE_MAP.md](docs/SOURCE_MAP.md).

## 🗺️ Roadmap & Known limits

- A listen-only mode and choosing the bitrate by hand: a bus on which no board answers cannot be joined.
- Reading the thermal image does not check that the sensor is ready first and does not retry a lost chunk.
- Downloading a firmware file straight from the GitHub release inside the browser: GitHub serves release files from a host without CORS headers, so the download may be blocked (the bundled image, or a file picked from disk with its `.manifest.json`, always work).

## 🌍 Languages

README and texts exist in English, Spanish, French, Italian, German, Chinese, Japanese and European Portuguese.

## 🔗 Related Projects

URTC is made of independent repositories, each with its own version, tests and README. This is the family, by group:

* **URTC Tool Platform:**
  * [URTC](https://github.com/JuanenRac/URTC) - firmware of the tool-head board (25 tool profiles, CAN bootloader) and the CAN protocol reference.
  * [URTC-COMMON](https://github.com/JuanenRac/URTC-COMMON) - the CAN protocol written once as data (specification, generated tables, conformance vectors) and the code the programs share.
  * [URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER) - desktop tool that updates the board firmware over CAN or over SWD/JTAG.
  * [URTC-GATEWAY](https://github.com/JuanenRac/URTC-GATEWAY) - gateway in front of the CAN bus: lets only listed identifiers through, limits their rate and asks for a session key.
  * [URTC-SMART-RACK](https://github.com/JuanenRac/URTC-SMART-RACK) - hardware-independent C logic and command protocol for a tool rack with pre-heating and lifecycle tracking.
  * [URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER) - desktop live CAN-bus tester that shows the controls and telemetry of the tool profile a board reports.
  * [URTC-VISION-TOOL](https://github.com/JuanenRac/URTC-VISION-TOOL) - sensor-frame protocol in C and a Python thermal/RGB companion for an inspection tool head.
  * **URTC-WEB-STUDIO** (this repository) - browser app that flashes and tests the board over Web Serial and SLCAN, with nothing to install.
* **Ecosystem Operations:**
  * [URTC-DOCS](https://github.com/JuanenRac/URTC-DOCS) - architecture, interfaces, security baseline and generated catalogue of the ecosystem, plus the tools that compare all repositories.
  * [URTC-UPDATER](https://github.com/JuanenRac/URTC-UPDATER) - desktop tool that detects, installs and updates the repositories of the URTC family, one explicit action at a time.

**Sister projects (independent, with the same base and tools):**

* **[HYDRA-UMC-DOCS](https://github.com/JuanenRac/HYDRA-UMC-DOCS)** - sister project: the documentation hub of HYDRA-UMC, an independent ecosystem that shares this one's base and tools
* **[ARMOR-DOCS](https://github.com/JuanenRac/ARMOR-DOCS)** - sister project: the documentation hub of A.R.M.O.R., the security ecosystem, also independent and on the same base
* **[JuanenRac](https://github.com/JuanenRac/JuanenRac)** - the profile and the status dashboard of all the ecosystems

## 📚 Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the UI, persisted
  settings, and external transport authority stay separate, and why the
  sandbox tabs must expose offline/unavailable states rather than present
  simulated data as live.
- [`docs/BUILD_AND_RUN.md`](docs/BUILD_AND_RUN.md) — the non-mutating
  `build-test.bat`/`.sh` validation path (TypeScript + tests, no version or
  CHANGELOG changes), `dev.bat`/`.sh` for local development, and why OTA
  signing material never belongs in browser configuration.
- [`docs/INTEGRATION_CONTRACT.md`](docs/INTEGRATION_CONTRACT.md) — what this
  client must do with an unknown schema, missing target identity, or a
  malformed API result, and why real flash authority stays server-side or
  in the dedicated desktop tools.

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — tech stack and coding guidelines for a pull request.
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — the standards of behavior expected in this community.
- **[SECURITY.md](SECURITY.md)** — how to report a vulnerability, and this project's own real security focus areas.
- **[SUPPORT.md](SUPPORT.md)** — where to ask questions and report bugs.
- **[LICENSE.md](LICENSE.md)** — this project's own license.

## 🤝 Contributing & Community

* Before a pull request run `URTC_CI=1 python tools/ci_validate.py`: it must pass. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md).
* The README exists in eight languages: a change to the text is made in all eight files, and the sections shared with other repositories are written by `tools/readme_sections.py` of URTC-COMMON.
* A change to the CAN protocol starts in URTC-COMMON (`spec/can_protocol.json`) and reaches this repository through the checked copy.
* Do not describe as working on a board what has only been built.
* Report a vulnerability privately: [SECURITY.md](SECURITY.md). Questions, ideas and reports: electrohobby3d@gmail.com ([SUPPORT.md](SUPPORT.md)).

## 👤 AUTHOR

**JuanenRac** (Electro Hobby 3D)
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)

## 📜 LICENSE

URTC Web Studio is (c) 2026 JuanenRac (Electro Hobby 3D). This notice must
be included in any distributions of this project or derivative works.

This project consists of source code and its own documentation, made
available under different licenses - each suited to what it actually
covers:

1. The source code (everything under `src/`, plus the Vite/TypeScript
   config that builds it) is available under the **GNU General Public
   License v3.0 (GPL-3.0-or-later)**. Full text at
   https://www.gnu.org/licenses/gpl-3.0.html.

2. The documentation (this README and its own translations -
   `README_spa.md`, `README_ita.md`, `README_fra.md`, `README_deu.md`,
   `README_zho.md`, `README_jpn.md`) is
   available under **Creative Commons Attribution-ShareAlike 4.0
   International (CC BY-SA 4.0)**. Full text at
   https://creativecommons.org/licenses/by-sa/4.0/.

This tool is the browser-based companion to the
[URTC (Universal Robot Tool Controller)](https://github.com/JuanenRac/URTC)
project - see that project's own repository for the board firmware,
hardware designs, and full protocol documentation this tool implements
against. URTC's own firmware is GPL-3.0-or-later and its hardware designs are
CERN-OHL-S v2; this tool's own license here doesn't extend to that separate
project, and vice versa. Two desktop-native alternatives covering the same
ground also exist: [URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER)
and [URTC Tester](https://github.com/JuanenRac/URTC-TESTER).

If you build on this project, keep the licensing split in mind: code
changes should stay GPL-3.0-or-later, documentation derivatives should stay CC
BY-SA - each with attribution back to this project and its author.

**Black Box, Optional Functions, Rack Bench and Thermal View tabs (new, checked with fakes only):** Tester Studio reads the fault recorder (`0x1A8` / `0x1A9`) and downloads it as CSV or JSON, automatically once for each error the board reports when that option is on; switches the optional firmware functions (`0x1AE` / `0x1AF`, off by default, after a confirmation; they act after the next power-up); simulates the tool rack in the page, with the identity of each head (type and serial number); and draws the thermal inspection image in false colour (a simulated image says so). The tool catalog now comes from the shared tool profiles of URTC-COMMON. None of it has been tried with a real board.

**Black Box viewer (new, checked with tests only):** the Black Box tab draws the measured temperature and the setpoint of the recorded seconds before the error, with a line where the error flag first shows, and opens a record saved earlier (the JSON or CSV file the tab itself writes) with no board connected; a file that is not a record, has a value out of range or more than 67 samples is refused with the reason.

**Offline copy and installation (new, checked with tests and a browser only):** the build writes a service worker (`sw.js`) and a web app manifest; after the first visit over https (or on localhost) the browser keeps the page, its scripts and the firmware bundled with it, the header says **Works offline**, and the Studio opens with no network (the header then says **Offline**); where the browser offers it, an **Install** button installs the Studio as an application. The page and the firmware manifest are always asked from the network first, so a person who is online gets the newest ones; `version.json` is never answered from the copy; a new version waits for the open tabs to close before it takes over. The GitHub API is not kept: with no network the newest release cannot be looked up, only the bundled images are used.

**Thermal counters over time (new, checked with tests and a modelled board only):** in the Black Box tab the lifetime thermal counters (`0x1AA` / `0x1AB`) can be read again every 10 s, 30 s, 1 min or 5 min; each reading is added to a history kept in the browser that draws the hours of the heater and the faults over time, can be downloaded as CSV and cleared; a counter that goes down (another board) starts the history again.

**Saved session (new, checked with tests and a modelled board only):** the Bus Monitor saves the frames as a log and a record that names the log by its SHA-256 and its size, in the same format the desktop Tester writes; **Check a saved session** takes the record and its log and says whether they belong together. It shows that a log was not edited. Where the browser can make Ed25519 signatures, the record also carries a signature made with a key of this browser (made on first use and kept in the browser): it shows the record was not edited after it was signed, and it does not say who holds the key. The monitor can also show only the IDs you type, or only the frames whose data changed (the rate and the load keep counting every frame).

**Version notice (new, checked with tests only):** the build writes a `version.json` next to the page; the built page compares it with its own version once, when it opens, over the same origin only, and tells you when a higher one is being served, with a Reload button. Nothing reloads by itself, an equal or older version says nothing, and a missing file or no network is silent.

**Heater PID (in the Optional Functions tab; new, checked with fakes only):** Tester Studio reads the state of the heater PID of the firmware (`0x1B9` / `0x1BA`: the gains in force, the state and the output of the last control cycle), stores gains (0 to 600) and starts or aborts the relay autotune, which heats the tip around the current set-point of the soldering iron (100 to 445 C) and stores the gains it finds. Storing gains and starting the autotune ask for a confirmation, aborting does not; a gain that is not a number from 0 to 600 is refused before anything is sent. The function must be switched on first among the optional functions; none of it has been tried with a real board.
