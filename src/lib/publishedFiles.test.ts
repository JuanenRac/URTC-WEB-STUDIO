import { describe, expect, it } from 'vitest';
import { readPublishedManifest, requireReadableSidecar, UnreadablePublishedFile } from './publishedFiles';

const hex = 'ab'.repeat(32);

describe('a published file that cannot be read', () => {
  it.each(['', '<html>404</html>', hex.slice(0, 40), '\u0000\u0001'])('refuses a .sha256 holding %j', text => {
    expect(() => requireReadableSidecar(text)).toThrow(UnreadablePublishedFile);
  });

  it.each(['', '{"sha2', '[1, 2]', '5', 'null', '"text"', '{"sha256": ""}', '{"sha256": null}', '{"sha256": 7}', '<!doctype html>'])(
    'refuses a manifest holding %j', text => {
      expect(() => readPublishedManifest(text)).toThrow(UnreadablePublishedFile);
    });

  it('keeps no file, good files and a manifest without a digest', () => {
    expect(requireReadableSidecar(null)).toBeNull();
    expect(requireReadableSidecar(`${hex}  x.bin\n`)).toContain(hex);
    expect(readPublishedManifest('{"version": "0.3.5"}').version).toBe('0.3.5');
    expect(readPublishedManifest(`\uFEFF{"sha256": "${hex.toUpperCase()}"}`).sha256).toBe(hex);
  });
});
