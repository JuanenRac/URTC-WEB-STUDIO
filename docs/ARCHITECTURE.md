<!-- =============================================================================
URTC-WEB-STUDIO - Architecture guide
Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
GPL-3.0-or-later - see LICENSE
============================================================================= -->

# Architecture

URTC-WEB-STUDIO is a Vite/TypeScript browser client. It presents Flasher and
Tester workflows while keeping the browser UI, persisted settings and external
transport authority separate. The ecosystem manifest carries project
identity; browser code must not infer a connected device from a saved
URL or previous UI state.

The sandbox is not a physical test or flash result. The interface must expose
offline and unavailable states rather than presenting simulated data as live.

## Several tool heads on one bus

The multinode extension of the firmware is off by default; with it off, or with one head, nothing below changes what the page sends. The rules live in
`src/lib/nodePicker.ts` (no React and no serial port: the caller gives the clock, a way to send and a way to wait) and are the same as
`urtc_common.node_picker` in the flasher and the tester; both are held to `src/lib/generated/node_picker_vectors.json`, copied from URTC-COMMON.
`src/hooks/useNodePicker.ts` makes one picker per connection, feeds it the frames of the bus and sets the gate `useSerialCanBus.setSendGate`, which makes
`sendFrame` refuse a single-head frame while several heads are on the bus and none is selected and confirmed (the frames of the extension itself pass).
`src/components/NodePickerDialog.tsx` is the window: address, tool, serial and a state written in words per head, a confirmation before a head is
selected, a banner when the selected head is lost, and the checkbox that decides whether every head is then put in its safe state (on by default).
`src/lib/multinodeSim.ts` models the nodes and the bus for the tests; nothing has been tried against boards.
