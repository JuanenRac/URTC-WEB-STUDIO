# The CAN trace viewer

The **CAN Traces** tab of the Tester Studio opens a recorded bus trace and lists its frames: each one is named with the specification, the refusals and the odd frames are marked, and the selection can be saved as CSV or JSON. It needs no board and no adapter, and it sends nothing to the bus.

The file is read as text in the page. Nothing is uploaded, nothing in it is run, and the text of the file is only ever shown as text (a line that is not a frame is counted and listed by its number, never drawn).

## What it reads

Five formats, told apart line by line. The first frame decides the format of the file; a line of another format after it is **refused** (`mixed_format`), because the time bases differ (a `.trc` counts milliseconds, a candump log counts seconds since 1970) and mixing them would give times that mean nothing.

| Format | What a frame looks like | Notes |
|---|---|---|
| PEAK PCAN-View text trace (`.trc`, file version 1.1) | `     1)        10.0  Rx  01A3  2  1F 06` | the format the studio and the tester write and the replay reads |
| Vector ASCII trace (`.asc`) | `   0.0100 1 1A3 Rx d 2 1F 06` | seconds, converted to milliseconds |
| candump log (`candump -L`, usually a `.log` file) | `(1436509052.260000) can0 1A3#1F06` | the time is seconds since 1970 (shown from the first frame); the interface name is not used (a log of several interfaces is read as one bus); candump does not record the direction, so every frame is a received one |
| candump on the screen with the time (`candump -ta`) | `(1436509052.260000)  can0  1A3   [2]  1F 06` | the same; without `-ta` the line has no time and is refused (`no_timestamp`) |
| JSON lines (`.jsonl`) | `{"time_ms":10,"direction":"Rx","id":"0x1A3","dlc":2,"data":"1F 06"}` | one object per line; all five keys are required, `id` is a hexadecimal text (with or without `0x`) or a whole number, `direction` is `Rx` or `Tx`; other keys are ignored |
| The JSON the viewer exports (`urtc-trace-view/1`) | a document with a `rows` list | its rows are read back the same way as the JSON lines (the "line" of a frame is its position in the list); the other keys of a row (`name`, `result` ...) are recomputed, never trusted |

None of the programs of the family writes a trace as JSON lines on its own today: that format is the way to bring a trace in from another tool, or the rows of the export of this page, one per line.

Both directions are kept (`Tx` and `Rx`) and the order of the file is kept: a frame whose time is older than the one before is not sorted away but marked. A line that is not a frame (a header, a comment, an event line) is skipped; a line that looks like a frame and cannot be read is counted and listed with the reason.

| Reason | Meaning |
|---|---|
| `not_a_frame` | the line matches none of the formats |
| `line_too_long` | more than 200 characters |
| `bad_time` | the time is not a number |
| `id_out_of_range` | an identifier above `0x7FF` (the bus has 11-bit identifiers; a candump extended identifier of eight digits lands here) |
| `dlc_out_of_range` | a length above 8 |
| `bad_data` | the data bytes are not whole hexadecimal bytes |
| `data_longer_than_dlc` | more data bytes than the length says |
| `remote_frame` | a candump remote frame (`123#R`): it has no data and the viewer does not read it |
| `can_fd` | a candump CAN FD frame (`123##`): this bus is classic CAN |
| `no_timestamp` | a candump screen line without a time |
| `bad_json` | a JSON line that cannot be read, or is not an object |
| `bad_fields` | a JSON frame without `time_ms`, `id`, `dlc` and `data` of the right type |
| `bad_direction` | a JSON frame whose direction is not `Rx` or `Tx` |
| `mixed_format` | a line of another format than the first frame of the file |

A frame with **fewer** data bytes than its length says is kept and marked `short_dlc`, because that is a fact about the recording. A refused line is never drawn in the table and never hidden: the page says how many there were and lists the first fifty with their line number and reason.

### Limits

5 MB per file and 200,000 frames. A bigger file is not read (the page says so); frames after the 200,000th are counted and left out. The table is **virtualized**: only the rows in view (and a few more above and below) are in the page, each with a fixed height, so a selection of 200,000 frames scrolls as smoothly as one of 50 and the page does not freeze; the CSV and JSON downloads hold the whole selection.

**Keyboard and screen reader.** The table is one control (`role="grid"`) that takes the focus; the arrow keys, Page Up, Page Down, Home and End move the chosen row (the table scrolls to keep it in view) and a click chooses a row. The table says how many rows it has (`aria-rowcount`), every row says its position (`aria-rowindex`), the chosen row is `aria-selected` and named as the active descendant, and a status line announces "Row N of M" as it moves. The headers of the columns are buttons that sort. Limit: the layout is a fixed-width table that scrolls sideways on a narrow screen, and the rows do not wrap, so a long field is cut (its full text is in the tooltip and in the downloads).

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

* `src/lib/canTrace.ts`: the reader, the decoding, the marks, the filters and the export (pure functions); `src/lib/canTrace.test.ts` holds them against the vectors of the specification; `src/lib/traceWindow.ts` is the arithmetic of the virtual table (which rows to draw, where the keys move); `src/components/tester/TraceViewerPanel.tsx` is the page; `e2e/traces.e2e.ts` drives it in a browser.
* The traces it was tested with are made by the studio's own exporter and by hand. It has not been tried with a file from a real adapter or from another tool, and the formats are the recognizable shape of the PCAN-View and Vector files, not guaranteed byte-identical to what each vendor writes.
* A recording says what was on the bus, not why: a `duplicate` or a `gap` can be the way a node works as much as a fault.
