// Decodes the URTC 0x111 "active tool + quick state" answer (URTC
// docs/CANBUS.TXT). Firmware before 0.3.2 answers 4 bytes; 0.3.2 and newer add
// byte 4 (why the thermal runaway guard cut the heater) and byte 5 (RCC
// reset cause latched at boot). Missing bytes mean "not reported".

export const THERMAL_FAULT_TEXT: Record<number, string> = {
  1: 'MAXTEMP - measured temperature above the hard ceiling',
  2: 'HEATING NO RISE - heater on but temperature not rising (loose sensor/tip?)',
  3: 'DROPPED AT TARGET - temperature sagged with the heater on (sensor fell out?)',
};

export interface QuickState {
  toolId: number;
  systemError: boolean;
  canBusError: boolean;
  bootSequenceActive: boolean;
  thermalFault: number | null;  // null = not reported (older firmware)
  resetCause: number | null;    // null = not reported (older firmware)
  watchdogReset: boolean;       // bit0 of resetCause: the IWDG fired, the main loop hung
  errorMessage: string;
}

export function decodeQuickState(data: ArrayLike<number>): QuickState {
  const thermalFault = data.length >= 5 ? data[4] : null;
  const resetCause = data.length >= 6 ? data[5] : null;
  const systemError = data[1] !== 0;
  let errorMessage = '';
  if (systemError) {
    errorMessage = 'CRITICAL ERROR DECLARED';
    if (thermalFault) errorMessage += ` - THERMAL RUNAWAY: ${THERMAL_FAULT_TEXT[thermalFault] ?? `code ${thermalFault}`}`;
  }
  return {
    toolId: data[0],
    systemError,
    canBusError: data[2] !== 0,
    bootSequenceActive: data[3] !== 0,
    thermalFault,
    resetCause,
    watchdogReset: resetCause !== null && (resetCause & 0x01) !== 0,
    errorMessage,
  };
}
