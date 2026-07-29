import { Link } from 'react-router-dom';
import { useState, useSyncExternalStore } from 'react';
import { usePendingCount, useSyncStatus } from '../db/hooks';
import { syncNow } from '../sync/engine';
import { isStoragePersisted, subscribeStorage } from '../lib/storage';
import { PanneauAutreCompte } from './PanneauAutreCompte';

const LABELS: Record<string, { text: string; cls: string }> = {
  idle: { text: 'Local', cls: 'sync-idle' },
  guest: { text: 'Mode invité', cls: 'sync-guest' },
  offline: { text: 'Hors ligne', cls: 'sync-offline' },
  syncing: { text: 'Synchronisation…', cls: 'sync-syncing' },
  synced: { text: 'Synchronisé', cls: 'sync-ok' },
  error: { text: 'Erreur réseau', cls: 'sync-error' },
  protege: { text: 'En attente d\'un choix', cls: 'sync-protege' },
  auth: { text: 'Session expirée', cls: 'sync-error' },
};

function useStoragePersisted(): boolean | null {
  return useSyncExternalStore(subscribeStorage, isStoragePersisted);
}

export function SyncBadge() {
  const status = useSyncStatus();
  const [panneau, setPanneau] = useState(false);
  const pending = usePendingCount();
  const persisted = useStoragePersisted();
  const info = LABELS[status] ?? LABELS.idle!;
  const storageNote =
    persisted === true
      ? ' Stockage persistant activé : le navigateur ne purgera pas vos données.'
      : '';

  if (status === 'auth') {
    return (
      <Link to="/login" className={`sync-badge ${info.cls}`} data-tour="sync">
        <span className="sync-dot" /> {info.text} — se reconnecter
      </Link>
    );
  }

  if (status === 'protege') {
    // La synchronisation est suspendue : le badge n'a rien à forcer, il ouvre
    // le choix qui la débloquera.
    return (
      <>
        <button
          className="sync-badge sync-protege"
          data-tour="sync"
          onClick={() => setPanneau(true)}
          title="Des données non envoyées d'un autre compte sont sur cet appareil"
        >
          <span className="sync-dot" /> {info.text}
          {pending > 0 && <span className="sync-pending">{pending}</span>}
        </button>
        {panneau && <PanneauAutreCompte onClose={() => setPanneau(false)} />}
      </>
    );
  }

  if (status === 'guest') {
    return (
      <Link
        to="/login"
        className="sync-badge sync-guest"
        data-tour="sync"
        title={`Mode invité : les données restent sur cet appareil, sans sauvegarde en ligne. Créez un compte pour synchroniser.${storageNote}`}
      >
        <span className="sync-dot" /> Mode invité — créer un compte
      </Link>
    );
  }

  return (
    <button
      className={`sync-badge ${info.cls}`}
      data-tour="sync"
      onClick={() => void syncNow()}
      title={`Forcer une synchronisation.${storageNote}`}
    >
      <span className="sync-dot" />
      {info.text}
      {pending > 0 && <span className="sync-pending">{pending}</span>}
    </button>
  );
}
