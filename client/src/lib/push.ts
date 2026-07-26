/**
 * Abonnement aux notifications push (côté téléphone, page publique).
 * Nécessite un navigateur compatible (Web Push) et l'autorisation de
 * l'utilisateur ; sans support, on le signale proprement.
 */

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export type PushResult =
  | { ok: true; count: number }
  | { ok: false; reason: string };

/** Demande l'autorisation, s'abonne au push et enregistre les dossards suivis. */
export async function subscribeForTeams(
  token: string,
  teamNumbers: number[],
): Promise<PushResult> {
  if (!pushSupported()) {
    return { ok: false, reason: 'Votre navigateur ne gère pas les notifications.' };
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'Notifications refusées. Activez-les dans le navigateur.' };
  }
  try {
    const keyRes = await fetch('/api/vapid-public');
    const { key } = (await keyRes.json()) as { key: string };
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      }));

    const res = await fetch(`/api/public/${token}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), teamNumbers }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, reason: body?.error ?? `Erreur ${res.status}` };
    }
    const body = (await res.json()) as { count: number };
    // Mémorise localement les dossards suivis (affichage de l'état).
    localStorage.setItem(`petanque.follow.${token}`, JSON.stringify(teamNumbers));
    return { ok: true, count: body.count };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Abonnement impossible' };
  }
}

export function followedTeams(token: string): number[] {
  try {
    const raw = localStorage.getItem(`petanque.follow.${token}`);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}
