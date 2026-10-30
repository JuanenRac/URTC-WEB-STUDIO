/**
 * The data bytes of the frames of a firmware update, as pure functions.
 *
 * The identifier of each frame stays with the code that sends it (it names it with the constant of `canIds`); here is only what goes in the
 * eight bytes, so that it can be tested without a bus. Every multi-byte value is big-endian, as everything on the bus is.
 */
import { packUInt16BE, packUInt32BE } from './flasher';

/** START_UPDATE: the size of the image and the hardware identifier it is built for (eight bytes). */
export const startUpdateData = (imageSize: number, hardwareId: number): number[] => [...packUInt32BE(imageSize), ...packUInt32BE(hardwareId)];

/** One of the four frames that carry the 32-byte HMAC signature: bytes `index * 8` to `index * 8 + 7`. */
export function hmacChunkData(signature: ArrayLike<number>, index: number): number[] {
  const out: number[] = [];
  for (let i = index * 8; i < (index + 1) * 8 && i < signature.length; i++) out.push(signature[i]);
  return out;
}

/** One frame of image data: up to eight bytes from `from`; the last frame of an image keeps its real length (no padding). */
export function dataChunkData(image: ArrayLike<number>, from: number, end: number = image.length): number[] {
  const out: number[] = [];
  for (let i = from; i < Math.min(from + 8, end, image.length); i++) out.push(image[i]);
  return out;
}

/** END_UPDATE: the CRC-32 of the image, the major number and the 16-bit minor field (which can carry the patch, see `minorField`). */
export const endUpdateData = (crc32: number, major: number, minorFieldValue: number): number[] => [...packUInt32BE(crc32), ...packUInt16BE(major), ...packUInt16BE(minorFieldValue)];
