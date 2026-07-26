/**
 * Session d'authentification, conservée en localStorage pour que
 * l'application reste utilisable hors connexion après une première
 * connexion réussie.
 */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export interface SessionOrg {
  id: string;
  name: string;
}

export interface Session {
  token: string;
  user: SessionUser;
  org: SessionOrg;
}

const SESSION_KEY = 'petanque.session';
const DEVICE_KEY = 'petanque.deviceId';

/** Cache : `useSyncExternalStore` exige un instantané référentiellement stable. */
let cached: Session | null | undefined;

export function getSession(): Session | null {
  if (cached !== undefined) return cached;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      cached = null;
      return cached;
    }
    const parsed = JSON.parse(raw) as Session;
    cached = parsed.token && parsed.org?.id ? parsed : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function setSession(session: Session): void {
  cached = session;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  notify();
}

export function clearSession(): void {
  cached = null;
  localStorage.removeItem(SESSION_KEY);
  notify();
}

/** Identifiant stable de l'appareil, pour départager la synchronisation. */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/* Abonnement minimal pour que React réagisse aux changements de session. */
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function subscribeSession(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
