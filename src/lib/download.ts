// Saves a Blob as a file download. The link is attached to the page while it is
// clicked (some browsers ignore a link that is not) and the object URL is
// released only afterwards, so the download is not cut short.

export interface DownloadEnv {
  document: Pick<Document, 'createElement' | 'body'>;
  url: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
  later: (fn: () => void, ms: number) => unknown;
}

export const REVOKE_DELAY_MS = 10000;

export function downloadBlob(blob: Blob, fileName: string, env?: DownloadEnv): void {
  const e: DownloadEnv = env ?? { document, url: URL, later: (fn, ms) => setTimeout(fn, ms) };
  const href = e.url.createObjectURL(blob);
  const a = e.document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.style.display = 'none';
  e.document.body.appendChild(a);
  a.click();
  a.remove();
  e.later(() => e.url.revokeObjectURL(href), REVOKE_DELAY_MS);
}
