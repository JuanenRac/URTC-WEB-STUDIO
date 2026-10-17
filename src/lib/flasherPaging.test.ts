import { describe, expect, it } from 'vitest';
import { FLASH_PAGE_SIZE, isLastPartialPage, readbackChunkLength } from './flasher';

describe('the last page of an update', () => {
  it('is acknowledged by the board only at the end when it is not a whole page', () => {
    expect(isLastPartialPage(73476, 73476, FLASH_PAGE_SIZE)).toBe(true);
    expect(isLastPartialPage(FLASH_PAGE_SIZE + 1, FLASH_PAGE_SIZE + 1, FLASH_PAGE_SIZE)).toBe(true);
    expect(isLastPartialPage(1, 1, FLASH_PAGE_SIZE)).toBe(true);
  });
  it('is acknowledged at once when it is a whole page, and the pages before it always are', () => {
    expect(isLastPartialPage(2 * FLASH_PAGE_SIZE, 2 * FLASH_PAGE_SIZE, FLASH_PAGE_SIZE)).toBe(false);
    expect(isLastPartialPage(73476, FLASH_PAGE_SIZE, FLASH_PAGE_SIZE)).toBe(false);
    expect(isLastPartialPage(73476, 36 * FLASH_PAGE_SIZE, FLASH_PAGE_SIZE)).toBe(false);
  });
});

describe('a frame of a readback', () => {
  it('may carry from 1 to 8 bytes of the image, never more than what is left', () => {
    expect(readbackChunkLength(8, 100)).toBe(8);
    expect(readbackChunkLength(4, 4)).toBe(4);
    expect(readbackChunkLength(8, 3)).toBe(3);
    expect(readbackChunkLength(1, 1)).toBe(1);
  });
  it('is nothing when it is empty or longer than a CAN frame', () => {
    expect(readbackChunkLength(0, 10)).toBe(0);
    expect(readbackChunkLength(9, 10)).toBe(0);
  });
});
