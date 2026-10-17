import { FirmwareManifest, APP_MAX_SIZE, SLAVE_APP_MAX_SIZE, THIS_HARDWARE_ID, SLAVE_HARDWARE_ID } from './flasher';

// Checks that run before anything is sent to a board, shared by every place
// that offers or flashes an image. They mirror the desktop Flasher's own
// image validation and manifest target check.

export type FlashTarget = 'main' | 'slave';

const SLOTS: Record<FlashTarget, { base: number; max: number }> = {
  main: { base: 0x08008000, max: APP_MAX_SIZE },
  slave: { base: 0x08005000, max: SLAVE_APP_MAX_SIZE },
};

/**
 * Only application images of the wanted board are offered for an update: not a bootloader (it would be copied into the application slot), not an Intel HEX text file
 * and not the other board's image.
 */
export function isFlashableFirmwareName(name: string, target: FlashTarget): boolean {
  const m = /^URTC_(MAIN|SLAVE)_FIRMWARE_v\d+(\.\d+)+\.bin$/i.exec(name);
  if (!m) return false;
  return (m[1].toUpperCase() === 'SLAVE') === (target === 'slave');
}

export type ImageProblem = 'empty' | 'too_large' | 'too_small' | 'bad_stack' | 'bad_reset';

/** The stack pointer must lie in the main SRAM or the CCM RAM, and the reset handler inside the application slot of the target (a bootloader links elsewhere). */
export function validateImage(data: Uint8Array, target: FlashTarget): ImageProblem | null {
  const slot = SLOTS[target];
  if (data.length === 0) return 'empty';
  if (data.length > slot.max) return 'too_large';
  if (data.length < 8) return 'too_small';
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const sp = view.getUint32(0, true);
  const reset = view.getUint32(4, true);
  const spOk = (sp >= 0x20000100 && sp <= 0x2000A000) || (sp >= 0x10000100 && sp <= 0x10002000);
  if (!spOk) return 'bad_stack';
  if (reset < slot.base || reset >= slot.base + slot.max) return 'bad_reset';
  return null;
}

export type SidecarProblem =
  | { code: 'malformed_signature' }
  | { code: 'wrong_target'; got: string; want: string };

/** A sidecar that is malformed, or that belongs to the other board, is refused. */
export function checkSidecar(manifest: FirmwareManifest | null, target: FlashTarget): SidecarProblem | null {
  if (!manifest) return null;
  if (manifest.hmacMalformed) return { code: 'malformed_signature' };
  const wantComponent = target === 'slave' ? 'slave_application' : 'main_application';
  const wantHardware = target === 'slave' ? SLAVE_HARDWARE_ID : THIS_HARDWARE_ID;
  if ((manifest.component === 'main_application' || manifest.component === 'slave_application') && manifest.component !== wantComponent) {
    return { code: 'wrong_target', got: manifest.component, want: wantComponent };
  }
  if (manifest.hardwareId !== undefined && !Number.isNaN(manifest.hardwareId) && manifest.hardwareId !== wantHardware) {
    return { code: 'wrong_target', got: hex32(manifest.hardwareId), want: hex32(wantHardware) };
  }
  return null;
}

function hex32(v: number): string {
  return '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

/**
 * The version declared to the bootloader's anti-rollback check: the manifest's, else the one in the file name ("..._v0.3.3.bin"). There is no made-up fallback: a wrong
 * version stored in the board would make every later legitimate update look like a rollback.
 */
export function resolveVersion(manifest: FirmwareManifest | null, fileName: string): { major: number; minor: number } | null {
  const candidates: Array<[number, number] | null> = [];
  if (manifest?.versionMajor !== undefined && manifest.versionMinor !== undefined) candidates.push([manifest.versionMajor, manifest.versionMinor]);
  const m = /[vV](\d+)\.(\d+)/.exec(fileName);
  if (m) candidates.push([parseInt(m[1], 10), parseInt(m[2], 10)]);
  for (const c of candidates) {
    if (c && c[0] >= 0 && c[0] <= 255 && c[1] >= 0 && c[1] <= 255) return { major: c[0], minor: c[1] };
  }
  return null;
}
