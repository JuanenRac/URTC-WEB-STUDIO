# The CAN trace viewer

The **CAN Traces** tab of the Tester Studio opens a recorded bus trace and lists its frames: each one is named with the specification, the refusals and the odd frames are marked, and the selection can be saved as CSV or JSON. It needs no board and no adapter, and it sends nothing to the bus.

The file is read as text in the page. Nothing is uploaded, nothing in it is run, and the text of the file is only ever shown as text (a line that is not a frame is counted and listed by its number, never drawn).

## What it reads

The two trace formats the studio and the tester already write and the replay reads:

* PEAK PCAN-View text traces (`.trc`, file version 1.1);
* Vector ASCII traces (`.asc`).

Both directions are kept (`Tx` and `Rx`) and the order of the file is kept: a frame whose time is older than the one before is not sorted away but marked. A line that is not a frame (a header, a comment, an event line) is skipped; a line that looks like a frame and cannot be read is counted and listed with the reason.

| Reason | Meaning |
|---|---|
| `not_a_frame` | the line matches none of the two formats |
| `line_too_long` | more than 200 characters |
| `bad_time` | the time is not a number |
| `id_out_of_range` | an identifier above `0x7FF` (the bus has 11-bit identifiers) |
| `dlc_out_of_range` | a length above 8 |
| `bad_data` | the data bytes are not whole hexadecimal bytes |
| `data_longer_than_dlc` | more data bytes than the length says |

A frame with **fewer** data bytes than its length says is kept and marked `short_dlc`, because that is a fact about the recording.

### Limits

5 MB per file and 200,000 frames. A bigger file is not read (the page says so); frames after the 200,000th are counted and left out. The table draws the first 1,000 frames of the selection; the CSV and JSON downloads hold the whole selection.

## What it says about each frame

The frame is read with the generated layouts of the common specification (`src/lib/generated/urtcCanIds.ts`), the same ones the panels use, so the names, the lengths and the fields are the ones of the specification, including the frames of the multinode extension (the node is the address in the identifier) and the free tool mode (`0x1A2` write, `0x1A3` query and answer).

| Column | Content |
|---|---|
| Type | `request`, `response`, `rack reply` or `unknown` (an identifier that is not in the specification is not marked, only called unknown) |
| Name | the layout, for example `set_free_tool` |
| Node | the address of the node for the addressed frames of the multinode extension |
| Fields | the decoded fields as `name=value`, with the name of the tool where the frame carries one |
| Result | `ok`, `refused`, `fault`, `malformed` or `info` |
| Mark | zero or more of the marks below |

An identifier that has both a request and an answer (such as `0x1A3`) is read as the one that fits the direction of the line, and, for a trace in which every line is received, as the one whose length rule fits the frame.

### Results

* `refused`: the bootloader status `0x7F5` with *verify fail* or *error*; a free tool answer (`0x1A3`) that is not valid (the jumper reading is not `0x1F`, or the selection is `0` or above `25`); a rack reply with a refusal reason (see below).
* `fault`: the active tool answer (`0x111`) with the system error or the CAN error flag; the status of a node (`0x440` plus the address) with the fault or conflict state or a non-zero error.
* `malformed`: the frame has the identifier of a layout but a length the layout does not allow.
* `ok`: a positive status (verify OK), a valid free tool answer, a rack acknowledgement.

### The reply of the rack

The reply of the rack to a command has its own CAN identifier in the specification, `0x261`, and is three bytes (the command answered, the tool, the code of the reason, as in `rackSim.ts`). The page reads every frame on `0x261` as a rack reply with no setting: a code other than *applied* or *repeat* is a refusal with its reason (`temp_out_of_range`, `held_rate`, ...), a frame that does not have three bytes or has a code that does not exist is malformed, the order `0x260` is read as a request with its layout (`rack_set_preheat`: tool, target, sequence), and the identifier next to the reply stays *unknown*.

Under **Advanced** there is a box, **Other identifiers of rack replies**, empty by default. It is only for a trace recorded with a bench that sent the reply with another identifier: the identifiers typed there are read the same way, in addition to `0x261`.

### Marks

| Mark | When |
|---|---|
| `short_dlc` | fewer data bytes than the length says, or fewer than the layout needs |
| `bad_length` | a length the layout does not allow, other than too short |
| `duplicate` | the same identifier, direction and data as the frame before it with that identifier, at most the *duplicate window* apart (1 ms by default) |
| `reordered` | the time is older than the frame before it in the file |
| `gap` | more than the *silence* limit (1,000 ms by default, the heartbeat period) since the frame before |

The two limits are boxes of the page; the defaults are `DEFAULT_TRACE_SETTINGS` in `src/lib/canTrace.ts`.

## Filtering, order, timeline

The table can be filtered by identifier (a list such as `0x1A2 7F5`, what cannot be read is shown apart and ignored), type, direction, result, node, mark, a range of time in milliseconds and a text (identifier, name, data or fields). The columns sort on a click, and equal rows keep the order of the file. The timeline cuts the selection into 60 equal parts of time; a bar is red where it holds refusals or faults, amber where it holds marked frames, and a click on it keeps only that time.

## The downloads

CSV (`index,line,time_ms,direction,id,dlc,data,name,type,node,tool,result,anomalies,summary`) and JSON (`urtc-trace-view/1`, the same fields with a fixed order of keys). The same selection gives the same bytes: nothing about the moment of the export is written, and the name of the source file is cut to 120 characters. A text cell that a spreadsheet could read as a formula (it starts with `=`, `+`, `@` or a minus that does not start a number) gets a quote in front.

## Where it is, and what it does not show

* `src/lib/canTrace.ts`: the reader, the decoding, the marks, the filters and the export (pure functions); `src/lib/canTrace.test.ts` holds them against the vectors of the specification; `src/components/tester/TraceViewerPanel.tsx` is the page; `e2e/traces.e2e.ts` drives it in a browser.
* The traces it was tested with are made by the studio's own exporter and by hand. It has not been tried with a file from a real adapter or from another tool, and the formats are the recognizable shape of the PCAN-View and Vector files, not guaranteed byte-identical to what each vendor writes.
* A recording says what was on the bus, not why: a `duplicate` or a `gap` can be the way a node works as much as a fault.
