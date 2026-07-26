/**
 * Stockage persistant : demande au navigateur de ne jamais purger les
 * données locales (IndexedDB) en cas de manque d'espace — essentiel pour
 * un concours géré hors connexion.
 */

let persisted: boolean | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export async function ensurePersistentStorage(): Promise<boolean> {
  try {
    if (!('storage' in navigator) || !navigator.storage?.persist) {
      persisted = false;
      notify();
      return false;
    }
    persisted = await navigator.storage.persisted();
    if (!persisted) {
      persisted = await navigator.storage.persist();
    }
  } catch {
    persisted = false;
  }
  notify();
  return persisted === true;
}

/** null = demande en cours, true = données protégées, false = refusé. */
export function isStoragePersisted(): boolean | null {
  return persisted;
}

export function subscribeStorage(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
