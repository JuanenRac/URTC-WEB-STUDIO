// GENERATED from spec/firmware_images.json by tools/generate_tools.py - do not edit by hand.
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE

export const FIRMWARE_PREFIX = "URTC";
export const FIRMWARE_BOARDS = ["MAIN", "SLAVE"] as const;
export const FIRMWARE_KINDS = ["FIRMWARE", "BOOTLOADER"] as const;
export const FIRMWARE_IMAGE_EXTENSION = ".bin";
export const FIRMWARE_SIDECAR_SUFFIXES = [".sha256", ".manifest.json", ".sig"] as const;
export const FIRMWARE_IMAGE_NAME = /^URTC_(MAIN|SLAVE)_(FIRMWARE|BOOTLOADER)_v(\d+(?:\.\d+)+)\.bin$/i;

export interface FirmwareImageName { board: (typeof FIRMWARE_BOARDS)[number]; kind: (typeof FIRMWARE_KINDS)[number]; version: string }

/** The parts of an image file name, or null when the name is not an image (a sidecar is not an image). */
export function parseFirmwareImageName(name: string): FirmwareImageName | null {
  const m = FIRMWARE_IMAGE_NAME.exec(name);
  return m ? { board: m[1].toUpperCase() as FirmwareImageName['board'], kind: m[2].toUpperCase() as FirmwareImageName['kind'], version: m[3] } : null;
}

/** The name of the file that travels with an image, for one suffix of FIRMWARE_SIDECAR_SUFFIXES. */
export function firmwareSidecarName(image: string, suffix: (typeof FIRMWARE_SIDECAR_SUFFIXES)[number]): string {
  return image + suffix;
}
