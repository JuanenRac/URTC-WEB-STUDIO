# Changelog

All notable changes to this project are documented here.

## [Unreleased]

- **The README follows the universal layout in the eight languages:** the sections are in the fixed order with the fixed names, the Architecture and the Repository Structure are drawn from `docs/architecture.json` and `docs/structure.json`, the checks and confirmations moved to Security & Safety, the hardware and the frame validation to Interfaces, and the sections for role, testing and roadmap are new. The annotated tree of the source files is now `docs/SOURCE_MAP.md`.
- **The layout of the README is checked in the CI:** the validator runs `tools/universal_readme_check.py` and lists, as a warning, what differs from the universal layout of the README.
- **Project status is the second section of the README,** right after At a glance, in the eight languages.
- **The full CI runs every night:** a scheduled workflow runs the complete baseline again on the default branch and opens (or updates) one issue when it fails, so a change in a runner image, a toolchain or a pinned dependency is found the next day instead of with the next unrelated change. The workflow also starts when the firmware repository announces a new release of its images.

## [0.3.7] - Filter of the Raw Bus Monitor and the Studio works offline and can be installed

### Firmware and protocol

- **Filter of the Raw Bus Monitor:** the monitor can show only the IDs typed in a box (hex, separated by spaces or commas, `0x` allowed, nothing readable means all) and, with a check box, only the frames whose data changed since the last frame of the same ID; the rate and the load keep counting every frame. 2 texts in the eight languages, the rules in `src/lib/frameFilter.ts` (7 tests) and two end-to-end checks.
- **End-to-end checks in a real browser:** `npm run test:e2e` (Playwright, Chromium) builds the site, serves it on this machine and drives it: the tabs without an error, no violation of the content security policy, the eight languages and the remembered one, the manifest and its icon, the reload with the network switched off, the bundled firmware and `version.json` offline, the thermal counters history, the saved session, the filter of the bus monitor and a whole CAN-OTA update of the main board against a modelled bootloader (a good image, one the bootloader refuses at the end, an image that is not an application, a manifest of the other board). A board is modelled behind a fake `navigator.serial` (`e2e/support/fakeBoard.ts`: the version, the active tool, the thermal counters and the bootloader conversation); no hardware is needed. The CI installs the browser and runs them after the build and keeps the traces of a failed run.
- **Thermal counters over time:** the Black Box panel can read the lifetime thermal counters again every 10 s, 30 s, 1 min or 5 min (off until chosen); every reading goes into a history kept in the browser that draws the hours of the heater and the faults over time (with a mark where the count went up), shows how many faults were added, can be downloaded as CSV and cleared, and starts again when a counter goes down (another board). 10 texts in the eight languages and 10 tests (`src/lib/thermalHistory.test.ts`).
- **A saved session that can be checked:** the Raw Bus Monitor saves the frames as a `.log` and a `.json` record that names the log by its SHA-256 and its size, in the same format as the desktop Tester (`log_file`, `log_sha256`, `log_bytes` and the context, keys sorted, byte for byte what its `session_manifest` writes); **Check a saved session** takes a record and its log and says whether they belong together, or that the file is not a record. It shows that a log was not edited; it is not a signature. 9 texts in the eight languages and 7 tests, one of them against the bytes the Python code writes.
- **The lifetime thermal counters in the fault recorder panel:** a button asks the board for `0x1AA` and shows the thermal runaway faults it ever had, the hours its heater was on, the last fault by name and, when the F-RAM does not answer, that the numbers are RAM-only since the last boot; a board from before the counters is told so. The decoding is `src/lib/thermalStats.ts`, held by vitest to the frames the shared code builds; the texts are in the eight languages.
- **The whole version of the slave application:** the Connected Board panel shows `v0.2.4` where it showed `v0.?.4`, from the low byte of the minor number that the master now sends in a third byte of `0x222`; the hint of the field says where the number comes from, in the eight languages, and the vitest cases include the new vectors of the shared code.
- **A window for several tool heads on one bus:** the **Heads** button of the header opens a window (`NodePickerDialog`, rules in `src/lib/nodePicker.ts`, the same as the flasher and the tester carry in Python and held to the same vectors) that finds the heads, lists each with its address, tool and serial number and a state written in words (ready, selected, address conflict, fault latched, in its bootloader, lost), asks for a confirmation before it selects one and sends nothing to a head until it has confirmed; while several heads are on the bus `sendFrame` refuses a single-head frame until one is selected and confirmed (the frames of the extension itself pass). The multinode extension of the firmware is off by default: with it off, or with one head, nothing is found and everything is sent as before, and the window says whether the head reports the extension as on, off or saved for the next power-up. If the selected head is lost the window shows why and, by default, every head is put in its safe state (a checkbox, kept in the browser, switches that off after asking). Texts in the eight languages, a README section, tests in Vitest against a model of the bus (`src/lib/multinodeSim.ts`). Tried against that model only, not against boards.
- **The version of the slave application in Flasher Studio:** the "Connected Board" panel reads the version register of the slave application through the master (`0x221`, and the patch in its `0x222` companion) and shows `v0.?.5` (the minor number is not in the answer, so it shows as `?`; no patch for a slave application from before the field). Vitest runs the shared vectors.
- **Rack bench: minimum interval between commands:** the simulated rack holds back a command for a tool sent less than the configured interval after the previous one (20 ms by default, 0 = off), as the rack firmware does; a safe state and a retransmission are never held back. The option is in the rack bench, in the eight languages.
- **Black Box viewer:** the Black Box tab draws the measured temperature and the setpoint of the recorded seconds with a line where the error flag first shows, and opens a record saved earlier (the JSON or CSV the tab writes) with no board connected; a file that is not a record, has a value out of range, a fault code that does not exist or more than 67 samples is refused with the reason. 9 texts in the eight languages and 10 tests (every shared vector round-trips through JSON and CSV).
- **Replay of a recorded trace:** the CAN Bus Protocol Analyzer tab opens a `.trc` or `.asc` file (also the ones the Raw Bus Monitor exports) and plays its received frames into the log and the panels with no board, from 0.25x to 10x, paused, stopped or in a loop; a long silence of the recording is cut to two seconds. The frames carry a REPLAY badge, a line the recording tool itself transmitted is not played, a replayed frame never reaches the request / answer router (a recording cannot answer something the page just sent), it is left out of the board export, and the replay pauses by itself while a board is connected. A trace of more than 20 MB or with no received frame is refused with a message. The texts are in the eight languages (15 keys) and the parser and the player have 13 tests with a clock moved by hand.
- **The rack simulator speaks frame version 2:** the temperature of the pre-heat command is two bytes, big-endian, like every other multi-byte value of the family, and `rackSim.ts` carries version 2, so a version 1 frame is refused as an unsupported version. The copy of the rack vectors from URTC-COMMON (frames, command checks, CAN data and link scenarios) was written again for the new layout and the tests pass against it.

### Programs and windows

- **The Studio works offline and can be installed:** the build writes a service worker (`sw.js`, from `scripts/sw.template.js`) and the page has a web app manifest. After the first visit over https or on localhost the browser keeps the page, every script, style and font and the firmware bundled with its signatures; the header says **Works offline**, and with the network gone the Studio reloads from the copy and says **Offline** (also the tabs that are loaded when first opened). The page and the firmware manifest are asked from the network first, everything else from the copy first; `version.json` and `sw.js` are never answered from the copy, so a newer Studio is still noticed. A new worker waits for the open tabs to close before it takes over (a flash or a bench session is never swapped under the person) and then removes the copies of earlier versions. Where the browser offers it an **Install** button installs the Studio as an application. The content security policy gains `worker-src 'self'` (page and `public/_headers`), and `public/_headers` sends `no-cache` for the worker and the manifest and `no-store` for `version.json`. 6 texts in the eight languages; the rules are tested in `src/lib/pwa.test.ts`, the build in `src/lib/serviceWorkerBuild.ts` and the worker itself, run against a model of the caches and the network, in `src/lib/serviceWorker.test.ts`.
- **GitHub Pages is switched off until the owner turns it on, and can only publish an official release:** both jobs of `pages.yml` run only when the repository variable `URTC_PAGES_ENABLED` is `true`; the firmware step is `sync-firmware --require-official`, which takes the newest official release only (no pre-release, no fallback tag, no local folder), refuses any file without a valid release signature and any application image not built with a production key, so the published page cannot carry development-key images (the bench notice is no longer set for it). `tests` cover the new option and the gate; `docs/BUILD_AND_RUN.md` and the eight READMEs say how to turn it on.
- **Notice of a newer version:** the build writes `version.json` (name and version of package.json) next to the page, and the built page compares it with its own version once when it opens, over the same origin only, with no cache and a five second limit. When a higher version is being served it says so with a Reload button; nothing reloads by itself (a reload in the middle of a flash would be harmful), an equal or older version, a missing file, a file of another application or no network say nothing, and a page opened from disk does not ask. 2 texts in the eight languages and 7 tests.

### Tests, builds and checks

- **The language files are generated** from the catalog of texts of URTC-COMMON (`tools/i18n_generate.py sync`), with a lock (`urtc_i18n.lock.json`) and a test of this program (`src/locales/generated.test.ts`) that fails when a generated file is edited by hand; a text the glossary names is a reference to it. The eight files keep the order of the English one; no text changes.
- **Texts the other programs also say follow the shared glossary of URTC-COMMON:** 7 strings changed to say what the flasher and the tester say - Italian `Pulisci` for Clear and `Ciclo di lavoro (%)`, Chinese `通电` for Energize, `Falló la actualización` / `Falhou a atualização`, and the heater PID in Japanese. The glossary names each shared phrase once in the eight languages and the nightly comparison checks the programs against it.
- The tests run with a coverage floor (`npm run test:coverage`, used by the CI): 26 percent of the lines and statements, 27 of the functions and 85 of the branches, about eight points under what is measured today (34, 35 and 93; the screens are not exercised by the unit tests).

### Documentation

- **The README files carry sections written once in URTC-COMMON:** "Compatibility", in the eight languages, between marker comments before the license heading (`tools/readme_sections.py` of URTC-COMMON writes and checks them; the rest of each README is hand-written as before).

## [0.3.6] - Heater PID panel in the web studio

- **Heater PID panel (in the Optional Functions tab):** reads the state of the heater PID of the firmware (`0x1B9` / `0x1BA`: the gains in force, the state and the output of the last cycle), stores gains from 0 to 600 and starts or aborts the relay autotune, with its texts in the eight languages (15 new keys). Storing gains and starting the autotune ask for a confirmation, aborting does not; a gain that is not a number from 0 to 600 is refused before anything is sent, and `0x1B9` typed by hand in the custom frame panel now asks for a confirmation because the autotune heats. 6 new tests.

## [0.3.5] - Black box, optional functions, rack bench and thermal view tabs

- **Black Box tab**: reads the fault recorder (`0x1A8` / `0x1A9`), checks it and downloads it as CSV or JSON; it reads it by itself once for each error the board reports when the option is on (on by default, switchable in the tab).
- **Optional Functions tab**: queries and writes the optional firmware functions (`0x1AE` / `0x1AF`) after a confirmation.
- **Rack Bench tab**: a simulation of the tool rack in the page, with the identity of each head (type and serial number), and the download of the status as JSON.
- **Thermal View tab**: the thermal inspection image in false colour, read from the board or, marked as simulated, from a synthetic image.
- The tool catalog is generated from the shared tool profiles of URTC-COMMON instead of being typed in the app; the shared vectors of the fault recorder, the rack and the false colour are reproduced by new tests.
- The README lists URTC-GATEWAY, the new gateway in front of the CAN bus, among the related projects.

## [0.3.4] - Signed firmware checked in the browser, a final content policy and the shared dashboard notice

- `tools/ci_validate.py` fails when a versioned file has the name of a Windows path (a colon, the character a file system uses to store one, or a first folder named like a drive or a user profile): a path handed to WSL without translation once put build output inside a repository. The same check (`tools/_tracked_names.py`) is in every URTC repository.
- **The firmware images are no longer kept in git.** `public/firmware/` is created by `npm run sync-firmware` from the assets of the URTC releases (newest official release; while there is none, the release named in `firmware-release.json`, today the bench pre-release), verifying every digest and release signature first; the CI and the Pages build run it before the tests. A test covers the fallback to the named release (never for a tag that was asked for, never for another failure).
- **The content security policy is final**: the fonts (JetBrains Mono and Plus Jakarta Sans, Latin subset) are packaged with the app instead of loaded from Google Fonts, so `style-src` and `font-src` name only the page itself; only the style attributes that React writes are allowed inline (`style-src-attr`), and the page names no host other than the GitHub ones that serve the releases. `public/_headers` carries the same policy for hosts that can send headers, with `Permissions-Policy: serial=(self)` and every other powerful feature switched off; GitHub Pages cannot send headers, so there only the policy inside the page applies. Tests keep `_headers`, `vite.config.ts` and `index.html` in agreement. The built page was loaded in a Chromium browser (Edge, headless): it renders and reports no policy violation, and a control page with inline style and script does report them.
- The `build-test` scripts use the interpreter named by `URTC_PYTHON` (which URTC-UPDATER sets to its own) and, without it, the first `python3` or `py -3` found.
- The dashboard notice is sent only after the CI of the push finished green (`workflow_run`).
- The banner follows the animated style of the ecosystem banners, with the name, the kind and the technologies of the project.
- The rows of the CAN log are drawn once (`React.memo`): the log keeps 100 frames and a batch of new ones no longer redraws the others.
- **The page verifies the release signature in the browser** (`src/lib/releaseSignature.ts`, Ed25519 through Web Crypto, against the pinned key of the releases) before it sends the bundled image or an image of a GitHub release to a board: a signature that is not valid stops the update before any frame is sent; an image without a signature (or a browser without Ed25519) is only noted in the log, because the board still verifies its own signature. The release listing now carries each image's `.sig` asset. Messages in eight languages; tests sign with a generated key, refuse a changed name, changed bytes, another key and malformed text, check that the pinned key is the one of `scripts/sync-firmware.mjs`, and verify the real bundled images.
- The manifest declares how far the project has been shown to work (`evidence`: simulator) and `tools/ci_validate.py` checks the value.

## [0.3.3] - Follow URTC-COMMON 0.0.5 and the 0.3.8 firmware

- The 0.3.8 firmware images are bundled, and the generated identifiers and the shared vectors follow URTC-COMMON 0.0.5.

## [0.3.2] - An explicit bump command: building never changes the version

- Building no longer changes the version: build.sh and build.bat only compile, and raising the version is the explicit `python bump.py` step. A test fails if a build script runs a bump.
- Every licence statement and source header says GPL-3.0-or-later.

## [0.3.1] - GitHub Pages deployment as a bench tool

- New workflow .github/workflows/pages.yml builds the static site (type check, tests, build) and deploys it with actions/upload-pages-artifact and actions/deploy-pages; it skips the deployment, without failing, until Pages is enabled for the repository.
- The build takes its base path from URTC_BASE_PATH and the bundled firmware is fetched relative to the base, so the site works under /URTC-WEB-STUDIO/.
- The page published on GitHub Pages shows a notice, in eight languages, that it is a bench tool and that firmware images are signed with the public development key.
- The generated protocol module is synchronised with URTC-COMMON 0.0.3 (it adds the designed multinode frames; the app does not use them).
- README in eight languages and docs/BUILD_AND_RUN.md explain how the repository owner enables Pages.

## [0.3.0] - Release signatures and shared protocol constants

- scripts/sync-firmware.mjs checks the release signature (<file>.sig, Ed25519, public key pinned in the script) of every file it takes from a release or a local folder: a wrong signature is always refused, a missing one only with --allow-unsigned (a bench pre-release or a local build). Signatures that are there are copied with the files.
- src/lib/canIds.ts takes its identifiers and magic payloads from the generated module (src/lib/generated/urtcCanIds.ts, a copy of URTC-COMMON kept honest by a lock file); new tests fail when a copy is edited by hand or falls behind, and the shared conformance vectors are refreshed.
- The build and run scripts read URTC_CI as their non-interactive switch.
- The configuration field of the ADS1115 in the flying probe panel takes 1 to 4 hexadecimal digits (0x prefix allowed); anything else marks the field and disables Send instead of sending the configuration 0x0000.
- The reason the bootloader gives for a failed verification is worded in the language of the page (the eight languages) instead of in English only, for the main board and for the expansion slave; the unused English status table was removed.
- The bootloader identifiers, the magic payloads, the hardware ids and the page size of src/lib/flasher.ts are taken from the generated module like the rest of the identifiers.
- A STOP ALL button in the header (shown while connected) switches off every actuator the page keeps alive; closing the page and disconnecting already did the same. It is a software command, not an emergency stop.
- Flashing an image whose manifest says it is signed with the public development key asks for confirmation first, in the eight languages; declining leaves the board untouched.
- The critical error banner of Tester Studio names the reason of the thermal runaway guard when the board reports one (three reasons, eight languages).
- Tabs that are not on screen at start (analyzer, flasher, thermal, specs, tester) are loaded the first time they are opened, which makes the first download smaller.
- The built page declares a content security policy (scripts only from the page, connections only to itself and to GitHub); the development and preview servers listen on localhost only, since Web Serial needs https or localhost anyway. A test keeps the policy and the GitHub host the app reads from in agreement. It has not been tried in a real browser.
- The CI workflow builds the static site and no longer carries steps for stacks this repository does not have.
- .gitattributes normalizes text like the other repositories and keeps firmware images (.bin, .elf) binary and Intel HEX files byte for byte.
- LICENSE holds the full text of the GNU General Public License v3.0; the copyright notice and the license of the documentation moved to a new NOTICE file. The license is GPL-3.0-or-later everywhere: LICENSE.md, source headers, script banners, About texts and READMEs (eight languages). package.json declares the license.
- The critical error banner says, in the eight languages, that the error stays until the board is reset and that there is no reset command over CAN.

## [0.2.9] - Claims aligned with what has been tested

- Maturity is functional: nothing here has been verified on real hardware yet.
- The README (all eight languages) says that the Web Serial path has never been run against a USB-CAN adapter or a real board, describes the HMAC-SHA256 check as a shared-key check (the published images use the public development key), and no longer headlines the simulator separation and confirmations as safety.
- The build section is called Static Build instead of Production Build.

## [0.2.8] - Firmware from the GitHub release, and the firmware patch number over CAN

- **Firmware list and download follow the new distribution:** the URTC binaries are no longer files in git but assets of the GitHub release of each version, so Flasher Studio now lists the application images of the selected board from the releases API of JuanenRac/URTC (the newest release), each with its .sha256 and .manifest.json. A downloaded image must match the digest in its .sha256 file and the one GitHub lists, and the existing checks stay: stack pointer and reset handler, manifest target, a strict hmac_sha256, and the version from the manifest first and then from the file name.
- **The browser limit is handled openly:** api.github.com allows cross-origin reads, but the files themselves are served from a host that sends no CORS headers. The download goes through the asset endpoint of the API (Accept: application/octet-stream) and then browser_download_url; when the browser blocks both, the log says why, a manifest that cannot be downloaded stops the flash instead of asking for a key, and the anonymous API limit has its own message. A browsed .bin can now be picked together with its .manifest.json to use the published signature.
- **npm run sync-firmware takes its files from the release or from a folder:** with no argument it downloads the newest release, with --tag a given one, and with a folder argument it uses a local build. The sha256 against the manifest and the .sha256 file and the signature fields are checked in a temporary folder before public/firmware is touched; the optional .hex and .elf files are copied when present. The bundled firmware keeps working as before.
- **The patch number is read from the board:** the new frame 0x7E9 (side, patch, flags) is waited for at most 300 ms after 0x7F9 and 0x7FA, and the expansion slave is read with 0x217 and the extended 0x218 (application patch, bootloader minor and patch). A board that predates the patch keeps working with major.minor.
- **major.minor.patch is shown and compared:** the installed firmware, the slave and the selected image are shown with their patch, the log tells whether the image is older, equal or newer than what the board reported, and the patch takes part in the comparison only when both sides carry one.
- **The patch goes into END_UPDATE only where it is accepted:** 0x80 or the patch in the high byte of the minor field of 0x7F4 and 0x214, only towards a bootloader that announced it (flag of 0x7E9, asked once the bootloader is listening; a 5-byte 0x218 for the slave) and for a patch of 0 to 127; otherwise the legacy minor is sent unchanged. The simulator answers 0x7E9 with an unknown patch, and 0x7E9 cannot be sent from the frame injectors.
- **Documentation:** the integration contract describes where the images come from, the CORS reality and the patch rules; the READMEs in all eight languages describe the release listing, the sync modes, the new library files and the pt.json locale, and list the browser download limit under not covered yet.
- Every new text exists in all 8 languages. Tests: 158 (before 116), covering the release listing and download with fakes, the digests, the sync script, the patch frame, the minor field, the comparison rules and the version queries of both boards with and without the patch.

## [0.2.7] - Each reply belongs to its request, actuators switch off when left, the simulator is apart from the real bus and dangerous actions ask first

- **A reply is always the answer to its own request:** every query now forgets the frames kept for the answering identifier, registers its waiter before sending and accepts only a frame that arrived after the send. Self-tests, the F-RAM query, the version query, the thermal reading and the flashing steps can no longer pass or fail on an old frame.
- **Actuators are switched off when they are left behind:** unchecking Active, replacing the panel, changing tab, disconnecting or closing the page sends the tool's off command, instead of letting the firmware watchdog cut it and latch a critical error.
- **The simulator is kept apart from the real bus:** the Control, OLED and Thermal IR tabs transmit nothing and say so; their frames are marked SIM and no simulated answer is produced while a board is connected. With a board connected, only plain queries of the predefined messages are sent (with their real payload); the writes to the board configuration are no longer sent as a demonstration, and the demonstration payloads that did not match the firmware (bootloader trigger length, LED and ring bytes, SPI passthrough) are corrected.
- **Tester Studio follows the board, not the sandbox:** its tool panel and fault banner come from what the board itself reported, no panel is shown before it has answered, an invalid tool number is shown as such, and detecting the hardware shows what answered even if only one of the two replies came.
- **Dangerous actions ask for confirmation first:** laser, drill, UV curing, welding, heaters, motion, paste jetting, programming the free tool or the serial number, erasing the F-RAM and hand-typed frames that write to the board memory, enter the bootloader or move an actuator. Identifiers that only the board transmits cannot be sent from the frame injectors. A serial number outside 0 to 255 is refused instead of wrapped.
- **Less work per frame:** received frames are applied a few times per second instead of once each, the context handed to the tool panels is stable so they no longer resubscribe on every frame, and the bus load is computed from the real length of the frames.
- **The heater temperature goes to the right tool** (the hot air station or the soldering iron, according to what the board reported) instead of always the paste dispenser.
- **Trace files open in the usual CAN tools:** the exported files have the PCAN and Vector headers and times relative to the first frame, and downloads are no longer cut short by releasing the file too early. The debug bundle holds only what really crossed the bus.
- **Simulator data follows the firmware:** the drill and the UV lamp have the 250 ms watchdog, the drill shows its real pins, all seven expansion variants are offered, and the analyzer shows the real bus speed of 500 kbit/s in all eight languages.
- **Smaller fixes:** the expansion slave hardware identifier is no longer shown in green as if it were the main board, the jumper log shows the tool after the change, the port-gone path removes its listener, the framing message no longer talks about a preview pane, and the thermal reading shows its error.
- **Install and files:** the build scripts install with npm ci and the second lockfile is gone, the unused per-device state module (announced before but never connected) and the hosting-platform metadata file are removed, and .env.example no longer names a variable nothing reads.
- **Documentation:** the integration contract describes the real transport, requests, manifests and safety rules, the build notes say when the version is incremented, and the READMEs in all eight languages no longer claim full parity or a masked identifier, describe the simulator and the confirmations and list what is not covered yet.
- Every new text exists in all 8 languages. Tests: 116 (before 68), covering request/answer matching, switching off, the simulator rules, confirmations, batching, trace files, board status and the simulator data.

## [0.2.6] - Only real application images are flashed, the manifest is checked, and the panels respect the firmware limits

- **Only application images of the chosen board are offered and flashed:** the GitHub list no longer shows Intel HEX files, bootloaders or the other board image, and before anything is sent the file is checked (initial stack pointer in RAM, reset handler inside the application slot of the board), so a bootloader or a text file is refused with a clear message instead of reaching the board.
- **The manifest is checked like the desktop Flasher does:** a malformed hmac_sha256 is an error instead of being ignored, and a manifest whose component or hardware id belongs to the other board is refused.
- **No invented version:** an image without a version in its manifest or its file name is refused, instead of declaring version 1.1 to the bootloader (which made later legitimate updates look like a rollback).
- **Erasing the F-RAM happens before the board enters the bootloader**, where the running application can still do it (it was sent to the bootloader, which does not know the command).
- **A frame typed by hand is validated, not repaired:** an identifier outside 0-7FF, an invalid byte or more than 8 bytes is refused with a message instead of being masked, dropped or cut.
- **A reply is never taken from an old frame:** a frame that arrived more than one second before a request waits for it is discarded, so a self-test or a query no longer passes with a stale answer.
- **Sending without a connection fails** with a message instead of silently doing nothing (a keepalive or a button could believe the command had left).
- **Tester limits follow the firmware:** heater setpoints stop at 445 C (also in the simulator), move steps are 1 to 4294967295 and no longer wrap into another count, the motion panels have a Stop button, the AOI strobe period is in milliseconds (1 to 500) and the paste jetting pulse is at least 1 ms.
- **The drill is kept alive:** the command is resent while Active is checked, because the board stops the drill 250 ms after the last command.
- **The 3D printer nozzle Off and a one-off extruder move no longer re-arm the heater:** they send a temperature of 0 unless the heater is switched on.
- The five translations that lacked the signing texts (German, French, Italian, Japanese, Chinese) are complete, every new text exists in all 8 languages, and a test keeps the 8 files identical in keys and placeholders.
- The favicon is served in the production build, and the README asks for Node.js 20 LTS or newer.
- Tests: 68 (before 41): image and manifest checks against the real bundled firmware, hand-typed frames, stale frames, limits and language parity.

## [0.2.5] - The update of any image size works and a readback of any size is complete

- **An update of an image whose size is not a whole number of pages now completes:** the last, partial page is acknowledged by the bootloader only when the end of the update arrives, so it is no longer waited for before sending it (the official image of 73476 bytes could never be installed).
- **The start of an update waits for the bootloader to finish erasing:** the first status after the start (erasing) is no longer taken for a refusal; only the status that says it is receiving starts the transfer.
- **The last frame of the image keeps its real length** instead of being padded with zeros, which made the board count bytes that are not in the image.
- **A readback of an image whose size is not a multiple of 8 is complete:** the last frame has fewer than 8 bytes and used to make the backup fail.
- **Portuguese (Portugal) is a language of the interface**, with the same 508 texts as the others, and the README exists in Portuguese too.
- Tests: 41 (before 37): the rules for the last page and for the length of a readback frame.

## [0.2.4] - Bundled firmware 0.3.3, READMEs updated

- `public/firmware` re-synced with URTC's current build (main 0.3.3 / boot
  0.3.8, slave 0.1.9 / boot 0.2.2) via `npm run sync-firmware`.
- READMEs in all 7 languages: the "OTA signing key" section now describes
  the published-signature model (no key in the app), the manifest bullet says
  a sha256 mismatch blocks the flash, and the repository tree lists the new
  files (`firmwareSignature.ts`, `quickState.ts`, `bundledFirmware.ts`,
  `scripts/sync-firmware.mjs`).

## [0.2.3] - No signing key in the app, published signatures, real firmware

- **The HMAC signing keys are gone from `src/lib/flasher.ts`.** The URTC
  build now signs each application image and publishes `hmac_sha256` in
  `<bin>.manifest.json`; `lib/firmwareSignature.ts` (new) sends that
  published signature. An image with no published signature (a self-built
  file picked from disk) can only be flashed with a key typed in for that one
  flash - kept in memory, never stored. See URTC `docs/FIRMWARE_SIGNING.TXT`.
- **A manifest sha256 mismatch now blocks the flash** instead of only
  warning.
- **`public/firmware` holds the real URTC build** (main 0.3.2 / boot 0.3.7,
  slave 0.1.8 / boot 0.2.1) with its `.sha256`/`.manifest.json` sidecars,
  replacing stale binaries under old names (`URTC_V1.1_F303CC.bin`,
  `URTC_SLAVE_APP.bin`...). `npm run sync-firmware` (`scripts/sync-firmware.mjs`,
  new) re-copies them from URTC, verifying each sha256, and regenerates
  `lib/bundledFirmware.ts`; a test checks the bundle against its manifests.
- **`0x111` decoding** (`lib/quickState.ts`, new): firmware 0.3.2's thermal
  runaway code and reset cause are shown in the error message; 4-byte
  answers from older firmware still work.

## [0.2.2] - Device state model

- Added, as a library only, a per-device state model (offline, connecting, online, error) in which a configuration change stays pending until the device confirms it. It was never connected to the screens and has been removed.

## [0.2.1] - Unsupported-browser banner shown before connecting

- Firefox/Safari visitors used to get no in-app indication that Web Serial
  isn't available until they clicked Connect and hit a plain `alert()` from
  `useSerialCanBus.ts`. A visible banner (feature-detected via `'serial' in
  navigator`, the same real check `connect()` already used) now appears at
  the top of the app before any connection attempt, guiding the user to
  Chrome or Edge. New `app.browser_unsupported_banner` key across all 7
  languages.

## [0.2.0] - First automated test suite (Vitest) for SLCAN parsing

- Added the project's first automated test suite (Vitest): `src/lib/slcan.ts`'s
  `parseSlcanLine()` was extracted, unchanged, from `useSerialCanBus.ts`'s own
  frame-parsing logic so it can be driven directly by 16 real test cases.
  Writing them surfaced and fixed a real bug: the parsing regex was
  case-insensitive on the leading frame-type letter, so a real 29-bit
  extended-frame line (`T...`) was silently misread as a standard 11-bit
  `t` frame with a garbage ID and payload instead of being rejected. `npm
  test` is now wired into this project's own CI step (`npm test --if-present`).
- Hardened the Web Serial SLCAN path in both directions: malformed received
  identifiers, non-hex payloads, truncated payloads and impossible DLC values
  (`9`-`F`) are discarded before they can create `NaN` bytes or reach CAN
  control panels. Outbound commands now reject invalid identifiers, payload
  sizes and byte values before writing or logging them. Optional adapter
  timestamps remain accepted after a valid received payload.

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

## Earlier history

### [0.1.x] - Automatic version bump on every build

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

### [0.1.0] and earlier - Project history (summarized)

- **First real session on this project.** Read the full
  source and the sibling Python tools (`URTC-FLASHER`, `URTC-TESTER`) to
  scope feature parity. Found and disclosed a real security issue (the
  OTA HMAC signing key hardcoded in the shipped JS bundle - the same
  convention the desktop tools use, but worse exposure for a web app,
  documented explicitly in the README). Fixed a real bug that would have
  double-sent every CAN-OTA frame against real hardware. Corrected stale
  local firmware filenames. Removed unused `@google/genai` and
  `tesseract.js` dependencies.
- **Full read-only review, then fixes.** Reviewed the whole
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
