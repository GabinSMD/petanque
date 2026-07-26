import { Link } from 'react-router-dom';
import { usePendingCount, useSyncStatus } from '../db/hooks';
import { syncNow } from '../sync/engine';

const LABELS: Record<string, { text: string; cls: string }> = {
  idle: { text: 'Local', cls: 'sync-idle' },
  offline: { text: 'Hors ligne', cls: 'sync-offline' },
  syncing: { text: 'Synchronisation…', cls: 'sync-syncing' },
  synced: { text: 'Synchronisé', cls: 'sync-ok' },
  error: { text: 'Erreur réseau', cls: 'sync-error' },
  auth: { text: 'Session expirée', cls: 'sync-error' },
};

export function SyncBadge() {
  const status = useSyncStatus();
  const pending = usePendingCount();
  const info = LABELS[status] ?? LABELS.idle!;

  if (status === 'auth') {
    return (
      <Link to="/login" className={`sync-badge ${info.cls}`}>
        <span className="sync-dot" /> {info.text} — se reconnecter
      </Link>
    );
  }

  return (
    <button
      className={`sync-badge ${info.cls}`}
      onClick={() => void syncNow()}
      title="Forcer une synchronisation"
    >
      <span className="sync-dot" />
      {info.text}
      {pending > 0 && <span className="sync-pending">{pending}</span>}
    </button>
  );
}
