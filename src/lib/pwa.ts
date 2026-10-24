// The offline copy of the Studio: the page asks the browser to register the service worker the build wrote (scripts/sw.template.js)
// and learns when the copy is complete. The worker only exists in the built page, on https or on localhost; anywhere else the
// Studio simply works as a normal page. No React here, the environment is passed in, so the rules are tested directly.

export interface PwaEnv {
  /** True for the built page; the development server has no worker. */
  production: boolean;
  secureContext: boolean;
  /** Where the page and the worker live ("/" or "/<repository>/"). */
  baseUrl: string;
  serviceWorker?: {
    register: (url: string, options?: { scope?: string }) => Promise<unknown>;
    ready: Promise<unknown>;
  };
}

export type OfflineCopyState = 'ready' | 'unsupported' | 'failed';

/** True when a worker can and should be registered here. */
export function canRegisterWorker(env: PwaEnv): boolean {
  return env.production && env.secureContext && env.serviceWorker !== undefined;
}

/** Registers the worker and resolves once it is active, which for this worker means every file of the copy is stored. */
export async function registerOfflineCopy(env: PwaEnv): Promise<OfflineCopyState> {
  if (!canRegisterWorker(env) || !env.serviceWorker) return 'unsupported';
  const base = env.baseUrl.endsWith('/') ? env.baseUrl : `${env.baseUrl}/`;
  try {
    await env.serviceWorker.register(`${base}sw.js`, { scope: base });
    await env.serviceWorker.ready;
    return 'ready';
  } catch {
    return 'failed';
  }
}

/** The part of the install prompt event the page uses (the event is not in the standard typings yet). */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Shows the browser's own install dialog once; true when the person accepted. */
export async function askToInstall(event: Pick<InstallPromptEvent, 'prompt' | 'userChoice'>): Promise<boolean> {
  try {
    await event.prompt();
    return (await event.userChoice).outcome === 'accepted';
  } catch {
    return false;
  }
}
