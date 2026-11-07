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
    expect(FIRMWARE_SIDECAR_SUFFIXES.map(suffix => firmwareSidecarName(image, suffix))).toEqual([`${image}.sha256`, `${image}.manifest.json`, `${image}.sig`, `${image}.imgsig`]);
  });

  it('lists the signature record of the image among the files that travel with it', () => {
    expect(FIRMWARE_SIDECAR_SUFFIXES).toContain('.imgsig');
    expect(new Set(FIRMWARE_SIDECAR_SUFFIXES).size).toBe(FIRMWARE_SIDECAR_SUFFIXES.length);
    for (const suffix of FIRMWARE_SIDECAR_SUFFIXES) {
      expect(suffix.startsWith('.')).toBe(true);
      expect(parseFirmwareImageName(`URTC_MAIN_FIRMWARE_v0.4.1.bin${suffix}`)).toBeNull();
    }
  });

  it('reads every board and kind and a version of three or four parts, and nothing else', () => {
    for (const board of ['MAIN', 'SLAVE']) {
      for (const kind of ['FIRMWARE', 'BOOTLOADER']) {
        expect(parseFirmwareImageName(`URTC_${board}_${kind}_v1.2.3.bin`)).toEqual({ board, kind, version: '1.2.3' });
        expect(parseFirmwareImageName(`URTC_${board}_${kind}_v1.2.3.4.bin`)?.version).toBe('1.2.3.4');
      }
    }
    for (const name of ['URTC_MAIN_FIRMWARE_v1.2.3.bin ', ' URTC_MAIN_FIRMWARE_v1.2.3.bin', 'URTC_MAIN_FIRMWARE_1.2.3.bin', 'URTC_MAIN_APP_v1.2.3.bin', 'URTC_MAIN_FIRMWARE_v1.2.3.binx', 'URTC_MAIN_FIRMWARE_v1..3.bin']) {
      expect(parseFirmwareImageName(name)).toBeNull();
    }
  });
});