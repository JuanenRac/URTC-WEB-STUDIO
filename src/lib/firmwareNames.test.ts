import { describe, expect, it } from 'vitest';
import { FIRMWARE_SIDECAR_SUFFIXES, firmwareSidecarName, parseFirmwareImageName } from './generated/firmwareNames';

describe('firmware file names', () => {
  it('reads the parts of an image name, whatever the case', () => {
    expect(parseFirmwareImageName('URTC_MAIN_FIRMWARE_v0.4.1.bin')).toEqual({ board: 'MAIN', kind: 'FIRMWARE', version: '0.4.1' });
    expect(parseFirmwareImageName('urtc_slave_bootloader_v0.2.5.BIN')).toEqual({ board: 'SLAVE', kind: 'BOOTLOADER', version: '0.2.5' });
    expect(parseFirmwareImageName('URTC_MAIN_FIRMWARE_v0.8.0.2.bin')?.version).toBe('0.8.0.2');
  });

  it('does not take a sidecar, a hex file or another name for an image', () => {
    for (const name of ['URTC_MAIN_FIRMWARE_v0.4.1.bin.sha256', 'URTC_MAIN_FIRMWARE_v0.4.1.hex', 'URTC_TOP_FIRMWARE_v0.4.1.bin', 'URTC_MAIN_FIRMWARE_v1.bin', 'x/URTC_MAIN_FIRMWARE_v0.4.1.bin', '']) {
      expect(parseFirmwareImageName(name)).toBeNull();
    }
  });

  it('names the files that travel with an image', () => {
    const image = 'URTC_MAIN_FIRMWARE_v0.4.1.bin';
    expect(FIRMWARE_SIDECAR_SUFFIXES.map(suffix => firmwareSidecarName(image, suffix))).toEqual([`${image}.sha256`, `${image}.manifest.json`, `${image}.sig`]);
  });
});