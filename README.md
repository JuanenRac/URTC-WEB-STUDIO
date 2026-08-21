<p align="center">
  <img src="images/URTC_LOGO_WEB_STUDIO.svg" alt="URTC Web Studio Logo" width="100%">
</p>

# URTC Web Studio

A browser-based companion to the **Universal Robot Tool Controller (URTC)** -
a React/Vite single-page app that talks to real URTC hardware over a USB-CAN
adapter via the [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API),
using the same SLCAN framing and CAN protocol as the two desktop companion
tools, [URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) and
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER). The goal is feature
parity with those two tools inside a single browser tab, not a simplified
demo of them - the Flasher Studio and Tester Studio tabs send and receive the
real CAN frames described in `docs/CANBUS.TXT` of the
[URTC firmware repo](https://github.com/JuanenRac/URTC).

---

## 🧭 What's real vs. what's a sandbox

This app has two kinds of tabs:

- **Real, hardware-driven tabs** - Flasher Studio, Tester Studio, and the CAN
  Bus Protocol Analyzer. These only do anything once you've connected a real
  USB-CAN adapter (top-right header button); every command they send and
  every reading they show comes from the actual CAN bus. This includes the
  real **thermal camera reading** - Tester Studio's "Thermal Inspection"
  panel (`0x250`/`0x251`/`0x254`/`0x255`) queries the tool head's actual
  MLX90640 IR array over CAN.
- **Offline sandbox tabs** - Control (tool catalog), OLED, Specs/BOM, and
  Thermal IR Inspection. These let you explore the 25-tool catalog, preview
  the OLED status screens, browse the BOM/pinouts, and view a simulated
  thermal camera feed, all without any hardware connected. The "FW v1.0 /
  v1.1" toggle in the header only affects these sandbox tabs (which tool
  profiles a given firmware build would unlock) - it has no bearing on what a
  real, connected board reports.
  - **Do not confuse the two thermal views**: the standalone "Thermal IR
    Inspection" tab (`ThermalCameraViewer.tsx`) is 100% client-side
    `Math.random()` noise with no CAN traffic at all - it's a UI mockup, not
    a sensor reading. The real MLX9064x data only ever appears inside Tester
    Studio's "Thermal Inspection" panel, and only once hardware is
    connected.

## 🔌 Hardware you need

- A USB-CAN adapter running **SLCAN** firmware (e.g. a CANable running
  `candlelight`/`slcan`, or any adapter that speaks the standard `lawicel`
  SLCAN serial protocol) - the same adapter class both desktop tools support
  via their own Serial transport.
- The bus set to **500 kbit/s** (this app doesn't auto-detect bitrate the way
  the desktop tools' `--auto-detect` flag does; it always opens at 500k).
- A browser with Web Serial support - **Chrome or Edge**. Firefox and Safari
  don't implement Web Serial and won't be able to connect at all.
- Web Serial requires either a secure context (HTTPS) or `localhost` - and it
  cannot be used from inside an iframe. If you're previewing this app inside
  an embedded frame, open it in its own tab first.

## ⚡ Flasher Studio - real feature coverage

Ported from `URTC-FLASHER`'s own `flasher_protocol.py`, against the same CAN
IDs:

- **CAN-OTA update of the main board** (`0x7F0`-`0x7F7`): enter-bootloader
  trigger, HMAC-SHA256 signing, paged transfer with page-ACK flow control and
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
- **Live board version query** (`0x7F8`/`0x7F9`/`0x7FA`) - shows the real
  responder (app or bootloader), HardwareID, and version, not a simulated
  toggle.
- **`<file>.manifest.json` sidecar support** - when flashing a file that came
  from the GitHub firmware listing (or the local `public/firmware/` folder),
  a matching manifest's declared version takes priority when reporting what's
  being installed, and its `sha256` (if present) is checked as an early,
  non-blocking sanity warning - same behavior as the desktop tool's
  `_check_manifest`.
- **Board config**: expansion board type / MLX9064x sensor variant / free
  tool configuration (ID pins `11111`) / peripheral info & serial number -
  `0x1A0`-`0x1A7`.

### SWD/JTAG - not available from a browser, by design

There is no Web API that can drive an SWD/JTAG debug probe - Web Serial only
talks to serial-framed devices (like a USB-CAN adapter), not a probe's own
protocol, and STM32CubeProgrammer/pyOCD are native subprocesses the desktop
tool shells out to. This is a structural limitation of running in a browser
sandbox, not a missing feature here. The SWD/JTAG tab in Flasher Studio
explains the exact commands the desktop `URTC Flasher` tool would run
locally, for reference - use that tool directly for full-chip programming,
option-byte/RDP checks, or a full-flash backup before a mass erase.

## 🧰 Tester Studio - real feature coverage

Ported from `URTC-TESTER`'s own `tester_tool_panels.py` /
`tester_common_panels.py`, against the same CAN IDs:

- A panel per tool (soldering iron + wire feeder, shared plain-stepper
  motion tools, vacuum pickup, drill, AOI, laser, 3D printer heater/motion/
  fans, scan probe, electromagnet, spot/ultrasonic welder, flying probe
  incl. the ADS1115 advanced path, UV curing, hot air rework, crimping,
  thermal inspection, paste jetting), each sending the tool's real command
  bytes and decoding its real telemetry.
- **Active-checkbox + keepalive** for every tool with a firmware-side
  communication watchdog (soldering iron, laser, UV curing, hot air rework,
  3D printer nozzle - 150ms resend under a 250ms watchdog; 3D printer layer
  fan - 400ms resend under its own 1000ms watchdog), matching the desktop
  tool's own timing exactly.
- **Global Controls** (`0x100`), **Expansion Board** SPI passthrough +
  TMC DIAG0 query (`0x180`-`0x183`), **F-RAM** query/erase (`0x190`-`0x192`),
  **Self-Test** (safe, at-rest checks per tool), a **Raw Bus Monitor** with
  `.trc`/`.asc` trace export, and a **Custom Frame** injector with an
  optional repeat interval - validated the same way as the CAN Bus Protocol
  Analyzer's own frame injector: the ID is masked to the 11-bit CAN standard
  range, and data tokens are filtered to valid hex bytes before being capped
  to the 8-byte CAN payload limit.
- **Detect Hardware** queries the real active tool (`0x110`/`0x111`) and
  board version (`0x7F8`/`0x7F9`), and a declared critical error
  (`0x111` byte 1) surfaces as a live fault banner.

## 🔐 Security note: the OTA signing key

Like the desktop `URTC Flasher`, this app ships with the project's default
HMAC-SHA256 signing key committed in source
(`src/lib/flasher.ts`) - the bootloader's own anti-tamper key that gates
whether a CAN-OTA update is accepted. That's an intentional match to the
desktop tool's own convention (`flasher_config.py`'s `HMAC_KEY`, itself
overridable via a local, non-committed config), not an oversight. It comes
with a caveat specific to running as a **web app**: unlike a downloaded
desktop executable, anyone who loads this page can read the key straight out
of the shipped JS bundle - there is no way for a static client-side app to
keep a signing secret private from its own visitors. If you rotate the real
signing key for a production deployment, only deploy this app somewhere you
control access to (an internal network, VPN, or access-gated host), or treat
it the same way you'd treat handing out the desktop Flasher tool itself -
to authorized technicians, not the public internet.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation

```bash
git clone https://github.com/JuanenRac/URTC-Web-Studio.git
cd URTC-Web-Studio
npm install
```

### Development Mode

Runs the app with Vite's dev server and live-reloading:
- **Windows:** double-click `dev.bat` or run `npm run dev`
- **Linux/Mac:** run `./dev.sh` or `npm run dev`

Then open `http://localhost:3000` in Chrome or Edge.

### Production Build

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

## 🛠️ Technology Stack
- **Language:** TypeScript
- **Frontend Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **CRC32:** `crc-32` - firmware image integrity check, mirrors the
  bootloader's own CRC32 computation
- **Hardware transport:** Web Serial API + SLCAN framing (no native
  dependencies, no companion backend server)

## 📂 Repository Structure

```
/
├── src/
│   ├── App.tsx                     Root component - tab state, hardware state, CAN
│   │                                frame logging, and the handlers wired into every
│   │                                tab below (including CAN OTA start/readback and
│   │                                the CAN Bus Analyzer's own frame injector)
│   ├── main.tsx                    Vite/React entry point
│   ├── i18n.ts                     i18next setup - en/es/de/fr/it, persisted to
│   │                                localStorage
│   ├── index.css                   Tailwind entry point
│   ├── types.ts                    Shared TypeScript types (CanFrame, HardwareState,
│   │                                FlasherState, ExpansionBoardType, ...)
│   ├── vite-env.d.ts                Vite's own ambient type declarations
│   ├── components/
│   │   ├── Header.tsx               Top bar: connect/disconnect button, active tool
│   │   │                            name, FW v1.0/v1.1 sandbox toggle
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
│   │   ├── FlasherStudio.tsx        Real tab: CAN-OTA UI (main + expansion slave) and
│   │   │                            the SWD/JTAG capability explainer
│   │   ├── TesterStudio.tsx         Real tab: per-tool live control/telemetry, built
│   │   │                            from the tester/ folder below
│   │   └── tester/
│   │       ├── ToolPanels.tsx       One panel per tool profile - real command bytes,
│   │       │                        real telemetry decode, per-tool watchdog keepalive
│   │       ├── GlobalPanels.tsx     Global Controls, Expansion Board, F-RAM,
│   │       │                        Self-Test, Raw Bus Monitor, Custom Frame injector
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
│   │   └── useKeepalive.ts          Fixed-interval resend hook backing every tool's
│   │                                active-checkbox watchdog keepalive
│   ├── lib/
│   │   ├── flasher.ts               OTA protocol constants, the committed HMAC-SHA256
│   │   │                            signing key, CRC32/HMAC helpers, manifest parsing
│   │   └── canIds.ts                CAN ID constants for Tester Studio - mirrors
│   │                                 tester_config.py byte-for-byte
│   └── locales/                     UI strings - en.json, es.json, de.json, fr.json,
│                                     it.json
├── public/
│   └── firmware/                    Bundled .bin/.elf/.hex for the main application,
│                                     main bootloader, expansion slave application, and
│                                     expansion slave bootloader
├── images/
│   ├── URTC_LOGO_WEB_STUDIO.svg     Full logo banner (shown at the top of this README)
│   ├── URTC_APP_ICON_NEW.svg        App icon
│   ├── urtc_custom_icon.svg         App icon, same artwork
│   └── urtc_icon.ico                Favicon
├── index.html                       Vite entry HTML
├── metadata.json                    App name/description + requested "serial"
│                                     permission (used by the hosting platform)
├── vite.config.ts                   Vite + Tailwind plugin config
├── tsconfig.json                    TypeScript config
├── .env.example                     VITE_APP_TITLE
├── dev.bat / dev.sh                 Install deps + start the Vite dev server
├── build.bat / build.sh             Install deps + produce the static dist/ build
├── package.json
├── LICENSE
├── README.md                        This file
└── README_spa.md / README_ita.md / README_fra.md / README_deu.md  <- translations
```

## 📜 License and Copyright Notices

URTC Web Studio is (c) 2026 JuanenRac (Electro Hobby 3D). This notice must
be included in any distributions of this project or derivative works.

This project consists of source code and its own documentation, made
available under different licenses - each suited to what it actually
covers:

1. The source code (everything under `src/`, plus the Vite/TypeScript
   config that builds it) is available under the **GNU General Public
   License v3.0 (GPL-3.0)**. Full text at
   https://www.gnu.org/licenses/gpl-3.0.html.

2. The documentation (this README and its own translations -
   `README_spa.md`, `README_ita.md`, `README_fra.md`, `README_deu.md`) is
   available under **Creative Commons Attribution-ShareAlike 4.0
   International (CC BY-SA 4.0)**. Full text at
   https://creativecommons.org/licenses/by-sa/4.0/.

This tool is the browser-based companion to the
[URTC (Universal Robot Tool Controller)](https://github.com/JuanenRac/URTC)
project - see that project's own repository for the board firmware,
hardware designs, and full protocol documentation this tool implements
against. URTC's own firmware is GPL-3.0 and its hardware designs are
CERN-OHL-S v2; this tool's own license here doesn't extend to that separate
project, and vice versa. Two desktop-native alternatives covering the same
ground also exist: [URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER)
and [URTC Tester](https://github.com/JuanenRac/URTC-TESTER).

If you build on this project, keep the licensing split in mind: code
changes should stay GPL-3.0, documentation derivatives should stay CC
BY-SA - each with attribution back to this project and its author.

## 🔗 Related Projects

This project is part of a larger robotics ecosystem by the same author (JuanenRac / Electro Hobby 3D). Worth knowing about, since a request might actually be about one of these rather than this repository:

**HYDRA-UMC platform** — the multi-robot micro-factory cell
- **[HYDRA-UMC](https://github.com/JuanenRac/HYDRA-UMC)** — the motherboard itself: Raspberry Pi CM5 host + dual-core STM32H745 real-time co-processor, orchestrating up to 8 distributed robot arms over CAN-OTA/SPI-OTA. Own hardware + firmware, GPL-3.0/CERN-OHL-S v2/CC BY-SA 4.0.
- **[HYDRA-UMC STUDIO](https://github.com/JuanenRac/HYDRA-UMC-STUDIO)** — web-based control dashboard for HYDRA-UMC: multi-robot 3D visualization, kinematics/trajectory recording, CAN-OTA flashing and testing for the whole platform. React + Vite + Three.js.
- **[HYDRA-UMC-ANDROID-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-ANDROID-CONTROL)** — Android control app for HYDRA-UMC over Wi-Fi/Bluetooth. Real, working app - full remote-control feature set, JWT auth, encrypted credential storage.
- **[HYDRA-UMC-IOS-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-IOS-CONTROL)** — iOS/iPadOS control app for HYDRA-UMC over Wi-Fi, built in Flutter (cross-platform, verifiable on Windows without a Mac; final `.ipa` packaging still needs Xcode). Real, working app - same feature set as the Android app.
- **[HYDRA-UMC-SUITE](https://github.com/JuanenRac/HYDRA-UMC-SUITE)** — desktop (Python/PySide6) swarm command center: multi-controller network discovery, live bidirectional sync, real 3D robot viewport, Photoshop-style dockable workspace. Real and working, not a placeholder.
- **[HYDRA-UMC-EDITOR-URDF](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-URDF)** — desktop (Python/PySide6) graphical URDF creator/editor for this project's own model catalog: pulls source files from GitHub or a local folder, validates DOF feasibility, edits color/scale/kinematics with a live 3D preview, and pushes the finished result to a running STUDIO server. Real and working, not a placeholder.
- **[HYDRA-UMC-DSI](https://github.com/JuanenRac/HYDRA-UMC-DSI)** — native Flutter touch UI for HYDRA-UMC's own 5"/7" DSI touchscreen (1280×720, same resolution at both sizes) on the Compute Module 5, controlling this same server directly from the board. Real, working scaffold with all 6 catalog screens (dashboard, manual control, camera, simplified 3D view, system metrics, login) connected to the live server; the real Linux build target has not yet been run on real hardware (Windows-only working environment so far - see that project's own README).

**URTC platform** — the tool head controller every HYDRA-UMC robot arm carries
- **[URTC](https://github.com/JuanenRac/URTC)** — Universal Robot Tool Controller: STM32F303-based CAN bus tool head controller, 25 fully-implemented tool profiles, CAN-OTA firmware update.
- **[URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER)** — desktop CAN-OTA + full-chip SWD/JTAG flashing tool for URTC boards (Windows/Linux).
- **[URTC Tester](https://github.com/JuanenRac/URTC-TESTER)** — desktop live CAN-bus diagnostic tool for URTC boards, one panel per tool profile (Windows/Linux).
- **URTC Web Studio** *(this repository)* — browser-based alternative to the 2 desktop tools above (Web Serial API + SLCAN), no local install needed.

## 👤 Author

**JuanenRac** (Electro Hobby 3D)
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)
