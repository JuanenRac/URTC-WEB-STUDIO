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

## What's real vs. what's a sandbox

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

## Hardware you need

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

## Flasher Studio - real feature coverage

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

## Tester Studio - real feature coverage

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
  optional repeat interval.
- **Detect Hardware** queries the real active tool (`0x110`/`0x111`) and
  board version (`0x7F8`/`0x7F9`), and a declared critical error
  (`0x111` byte 1) surfaces as a live fault banner.

## Security note: the OTA signing key

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

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation

```bash
git clone https://github.com/JuanenRac/URTC-Web-Studio.git
cd URTC-Web-Studio
npm install
npm run dev
```

Then open `http://localhost:3000` in Chrome or Edge.

`npm run build` produces a static production build in `dist/`; `npm run
lint` runs the TypeScript compiler in check-only mode.

## Technology Stack
- **Frontend Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Hardware transport:** Web Serial API + SLCAN framing (no native
  dependencies, no companion backend server)

## License
URTC Web Studio is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.
See the [LICENSE](LICENSE) file for more details.

---
**Author:** JuanenRac (Electro Hobby 3D)
**Contact:** electrohobby3d@gmail.com
