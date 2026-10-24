// What the build needs to write the service worker (scripts/sw.template.js) next to the page: the list of files to keep, the name
// of the stored copy, and the worker text with both filled in. Pure functions with no file access, so they are tested directly;
// vite.config.ts reads the files and calls them. Node only (it is part of the build, not of the page).
import { createHash } from 'node:crypto';

export interface PrecacheEntry {
  /** Path relative to the page ("assets/index-abc.js"), never starting with a slash. */
  path: string;
  /** Anything that changes when the content changes (a hash of the bytes, or the file name when the name carries the hash). */
  digest: string;
}

/** Files that are served by the host but never kept by the worker. */
const NOT_PRECACHED = new Set(['_headers', 'sw.js', 'version.json']);

/** The sorted list of paths to keep: the page itself ("./" is added by the worker through the scope) and every built or public file. */
export function precacheList(entries: PrecacheEntry[]): string[] {
  const paths = new Set<string>(['index.html']);
  for (const entry of entries) {
    const path = entry.path.replace(/\\/g, '/').replace(/^\.?\//, '');
    if (!path || NOT_PRECACHED.has(path) || path.endsWith('.map')) continue;
    paths.add(path);
  }
  return [...paths].sort();
}

/** The name of the stored copy: the version of the Studio and a short digest of everything in it. */
export function cacheVersion(version: string, entries: PrecacheEntry[]): string {
  const hash = createHash('sha256');
  for (const entry of [...entries].sort((a, b) => a.path.localeCompare(b.path))) hash.update(`${entry.path}\0${entry.digest}\0`);
  return `${version}-${hash.digest('hex').slice(0, 12)}`;
}

/** The text of the worker: the template with its two markers replaced. */
export function renderServiceWorker(template: string, version: string, entries: PrecacheEntry[]): string {
  if (!template.includes('__CACHE_VERSION__') || !template.includes('__PRECACHE__')) throw new Error('the service worker template lost its markers');
  if (!/^[0-9A-Za-z.-]+$/.test(version)) throw new Error(`not a version that can be part of a cache name: ${version}`);
  return template
    .replace('__CACHE_VERSION__', cacheVersion(version, entries))
    .replace('__PRECACHE__', JSON.stringify(precacheList(entries), null, 2));
}
