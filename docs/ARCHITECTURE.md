<!-- =============================================================================
URTC-WEB-STUDIO - Architecture guide
Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
GPL-3.0-or-later - see LICENSE
============================================================================= -->

# Architecture

URTC-WEB-STUDIO is a Vite/TypeScript browser client. It presents Flasher and
Tester workflows while keeping the browser UI, persisted settings and external
transport authority separate. `metadata.json` and the ecosystem manifest carry
project identity; browser code must not infer a connected device from a saved
URL or previous UI state.

The sandbox is not a physical test or flash result. The interface must expose
offline and unavailable states rather than presenting simulated data as live.
