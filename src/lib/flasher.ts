import CRC32 from 'crc-32';
import { CanFrame } from '../types';

export const HMAC_KEY = new Uint8Array([
  0x55, 0x52, 0x54, 0x43, 0x2D, 0x48, 0x59, 0x44,
  0x52, 0x41, 0x2D, 0x55, 0x4D, 0x43, 0x2D, 0x32,
  0x30, 0x32, 0x36, 0x2D, 0x43, 0x48, 0x41, 0x4E,
  0x47, 0x45, 0x2D, 0x4D, 0x45, 0x2D, 0x21, 0x21
]);
export const THIS_HARDWARE_ID = 0x0303CC01;
export const FLASH_PAGE_SIZE = 2048;

export const CAN_ID_ENTER_BOOTLOADER = 0x7F0;
export const CAN_ID_START_UPDATE = 0x7F1;
export const CAN_ID_DATA = 0x7F2;
export const CAN_ID_PAGE_ACK = 0x7F3;
export const CAN_ID_END_UPDATE = 0x7F4;
export const CAN_ID_STATUS = 0x7F5;
export const CAN_ID_HEARTBEAT = 0x7F6;
export const CAN_ID_HMAC_CHUNK = 0x7F7;
export const FIRMWARE_VERSION_MAJOR = 1;
export const FIRMWARE_VERSION_MINOR = 1;

export async function computeHmacSha256(data: ArrayBuffer): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    HMAC_KEY,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return new Uint8Array(signature);
}

export function packUInt32BE(value: number): number[] {
  return [
    (value >>> 24) & 0xFF,
    (value >>> 16) & 0xFF,
    (value >>> 8) & 0xFF,
    value & 0xFF
  ];
}

export function packUInt16BE(value: number): number[] {
  return [
    (value >>> 8) & 0xFF,
    value & 0xFF
  ];
}

export function getCrc32(data: Uint8Array): number {
  return CRC32.buf(data) >>> 0;
}
