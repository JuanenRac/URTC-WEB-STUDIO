<!-- =============================================================================
URTC-WEB-STUDIO - Integration contract
Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
GPL-3.0-or-later - see LICENSE
============================================================================= -->

# Integration Contract

This is what the browser client does with the board, the firmware images and
the adapter. It is a contract with the URTC firmware (`docs/CANBUS.TXT` of the
URTC repository) and with the files that the URTC build publishes; there is no
server API.

## Transport

- The adapter is a USB-CAN device that speaks SLCAN, opened with the Web Serial
  API. The URTC bus runs at 500 kbit/s; the bitrate is probed on connect.
- Outbound frames are standard 11-bit data frames of at most 8 bytes. A frame
  that does not fit is refused with a message, never repaired.
- Inbound lines are parsed strictly; a malformed or truncated line is dropped.
- A send without a connection fails. Nothing is reported as sent when it did
  not leave.

## Requests and answers

- A request forgets the frames kept for the answering identifier, registers its
  waiter, sends, and accepts only a frame that arrived after the send.
- A frame nobody was waiting for is kept for at most one second; an older one is
  never taken for the answer to a new request.
- No answer within the timeout is reported as "no answer", not as a failure of
  the test or the flash, and not as a success.

## What the board said and what the simulator shows

- The tool, the fault state and the version shown for the board come only from
  frames received from the bus.
- The sandbox tabs (Control, OLED, Thermal IR) model a board. They transmit
  nothing, the frames they log are flagged as simulated, and while a board is
  connected they produce no simulated answer.
- With a board connected, the predefined messages of the protocol analyzer send
  only plain queries; the others stay simulated.
- Tester Studio shows a tool panel only for the tool the board itself reported,
  and not at all before the board has answered.

## Firmware images and manifests

- Only an application image of the chosen board is flashed: the initial stack
  pointer and the reset handler are checked against that board before any frame
  is sent.
- Each image published by the URTC build has `<file>.manifest.json` (version,
  `sha256`, `hmac_sha256`, component and hardware id) and `<file>.sha256`. A
  digest that does not match blocks the flash, a malformed signature is an
  error, and a manifest for the other board is refused.
- The version reported to the bootloader is the manifest's (or the one in the
  file name); there is no default. An image whose version is unknown is refused.
- No signing key is part of this app. The published signature is transported as
  is. A self-built image without a manifest can be flashed to a bench board only
  with a key typed in for that one flash, kept in memory and never stored.
- Flashing happens in this browser, over the adapter, through the CAN-OTA
  protocol; SWD/JTAG programming is not possible from a browser.

## Physical safety

- Anything that moves, heats, fires, cuts or writes to the memory of the board is
  confirmed first, and hand-typed frames that collide with the board's own
  identifiers are refused.
- A tool with a firmware watchdog is kept alive by repeating its command, and is
  switched off explicitly when the panel is replaced, the tab or the connection
  changes, or the page is closed.
