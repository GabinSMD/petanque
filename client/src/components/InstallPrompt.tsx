import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from '../db/hooks';

/** Événement d'installation PWA (non typé par la lib DOM standard). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'install-dismissed';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = window.navigator.userAgent;
  const iOSDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ se présente comme un Mac tactile.
  const iPadOS = /macintosh/i.test(ua) && 'ontouchend' in document;
  return iOSDevice || iPadOS;
}

/**
 * Invite à installer l'application : bouton natif (Android / Chrome via
 * `beforeinstallprompt`) ou astuce « Partager → Sur l'écran d'accueil »
 * sur iOS. Masquée si déjà installée ou refusée précédemment.
 *
 * Masquée aussi tant qu'aucune session n'existe : on ne demande pas à un
 * visiteur d'installer une application qu'il n'a pas encore essayée.
 */
export function InstallPrompt() {
  const { pathname } = useLocation();
  const session = useSession();
  const hiddenRoute =
    !session || pathname.includes('/affichage') || pathname.includes('/imprimer');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (dismissed || isStandalone()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    const onInstalled = () => {
      setDeferred(null);
      setIosHint(false);
    };
    window.addEventListener('appinstalled', onInstalled);

    // iOS ne déclenche pas l'événement : on propose l'astuce manuelle.
    let iosTimer: number | undefined;
    if (isIOS()) iosTimer = window.setTimeout(() => setIosHint(true), 1500);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, [dismissed]);

  const close = () => {
    setDismissed(true);
    setDeferred(null);
    setIosHint(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    close();
  };

  if (hiddenRoute || dismissed || isStandalone()) return null;
  if (!deferred && !iosHint) return null;

  return (
    <div className="install-banner no-print" role="dialog" aria-label="Installer l'application">
      <span className="install-icon" aria-hidden>
        📲
      </span>
      {deferred ? (
        <>
          <span className="install-text">
            Installez l'application pour un accès plein écran, même hors ligne.
          </span>
          <span className="install-actions">
            <button className="btn btn-primary btn-sm" onClick={() => void install()}>
              Installer
            </button>
            <button className="btn btn-ghost btn-sm" onClick={close} aria-label="Fermer">
              ✕
            </button>
          </span>
        </>
      ) : (
        <>
          <span className="install-text">
            Ajoutez l'app à l'écran d'accueil : appuyez sur le bouton{' '}
            <strong>Partager</strong> de Safari, puis{' '}
            <strong>« Sur l'écran d'accueil »</strong>.
          </span>
          <span className="install-actions">
            <button className="btn btn-ghost btn-sm" onClick={close} aria-label="Fermer">
              ✕
            </button>
          </span>
        </>
      )}
    </div>
  );
}
