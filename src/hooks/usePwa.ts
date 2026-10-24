import { useCallback, useEffect, useRef, useState } from 'react';
import { askToInstall, registerOfflineCopy, type InstallPromptEvent, type OfflineCopyState } from '../lib/pwa';

export interface PwaState {
  /** The Studio and the bundled firmware are stored in this browser. */
  offlineReady: boolean;
  /** The browser reports a network; false means the stored copy is what is running. */
  online: boolean;
  /** The browser offers to install the Studio as an application. */
  canInstall: boolean;
  install: () => void;
}

/** Registers the offline copy once, follows the network state and keeps the install offer of the browser until it is used. */
export function usePwa(): PwaState {
  const [copy, setCopy] = useState<OfflineCopyState | 'pending'>('pending');
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [canInstall, setCanInstall] = useState(false);
  const prompt = useRef<InstallPromptEvent | null>(null);

  useEffect(() => {
    let cancelled = false;
    void registerOfflineCopy({
      production: import.meta.env.PROD,
      secureContext: typeof window !== 'undefined' && window.isSecureContext,
      baseUrl: import.meta.env.BASE_URL,
      serviceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
    }).then((state) => { if (!cancelled) setCopy(state); });
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    const offer = (event: Event) => { event.preventDefault(); prompt.current = event as InstallPromptEvent; setCanInstall(true); };
    const installed = () => { prompt.current = null; setCanInstall(false); };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', installed);
    return () => {
      cancelled = true;
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('beforeinstallprompt', offer);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const install = useCallback(() => {
    const event = prompt.current;
    if (!event) return;
    void askToInstall(event).then((accepted) => { if (accepted) { prompt.current = null; setCanInstall(false); } });
  }, []);

  return { offlineReady: copy === 'ready', online, canInstall, install };
}
