// The speed of the bus of the tool heads is 1 Mbit/s (BITRATE of the specification, spec/can_protocol.json of URTC-COMMON); 500 kbit/s stays as the legacy speed of
// early boards. This is the order in which a tool searches for the speed of a bus it does not know: the default first, then the legacy one, its two usual
// neighbours and the rest of the table of the adapter (the same order as the Python tools).

export const BITRATE_TRY_ORDER: Array<{ label: string; code: string }> = [
  { label: '1 Mbit/s', code: '8' },
  { label: '500 kbit/s', code: '6' },
  { label: '250 kbit/s', code: '5' },
  { label: '125 kbit/s', code: '4' },
  { label: '100 kbit/s', code: '3' },
  { label: '50 kbit/s', code: '2' },
  { label: '20 kbit/s', code: '1' },
  { label: '10 kbit/s', code: '0' },
  { label: '800 kbit/s', code: '7' },
];
