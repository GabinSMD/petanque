import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import webpush from 'web-push';
import type { AuthContext } from './index.js';
import type { PushSubRow, ShareRow } from './db.js';
import { rateLimiter } from './public.js';

/** Charge (ou génère et conserve) les clés VAPID pour le Web Push. */
function loadVapid(dataDir: string): { publicKey: string; privateKey: string } {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  }
  const path = join(dataDir, '.vapid.json');
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, 'utf8'));
  }
  const keys = webpush.generateVAPIDKeys();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(keys), { mode: 0o600 });
  return keys;
}

interface CallInput {
  matchId: string;
  teamNumbers: number[];
  title: string;
  body: string;
  url?: string;
}

/**
 * Notifications push : les équipes s'abonnent depuis le lien public
 * (par numéro de dossard) ; la table de marque signale les convocations
 * (barrage, nouveau tour…) et le serveur les relaie aux téléphones.
 * Le serveur ne calcule aucune règle : il relaie ce que la table envoie,
 * en dédupliquant par partie.
 */
export function registerPushRoutes(
  app: FastifyInstance,
  db: DatabaseSync,
  dataDir: string,
  authenticate: (req: FastifyRequest) => AuthContext | null,
): void {
  const vapid = loadVapid(dataDir);
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:contact@petanque-concours.local',
    vapid.publicKey,
    vapid.privateKey,
  );

  const subscribeLimit = rateLimiter(30, 60_000);
  const selectShareByToken = db.prepare(
    'SELECT * FROM shares WHERE token = ? AND revoked = 0',
  );
  const upsertSub = db.prepare(`
    INSERT INTO push_subs (id, org_id, concours_id, team_number, endpoint, p256dh, auth, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (concours_id, team_number, endpoint) DO UPDATE SET
      p256dh = excluded.p256dh, auth = excluded.auth, created_at = excluded.created_at
  `);
  const markNotified = db.prepare(
    'INSERT OR IGNORE INTO notified_calls (concours_id, match_id, created_at) VALUES (?, ?, ?)',
  );
  const subsForTeams = db.prepare(
    'SELECT * FROM push_subs WHERE concours_id = ? AND team_number = ?',
  );
  const deleteSub = db.prepare('DELETE FROM push_subs WHERE id = ?');

  /** Clé publique VAPID (nécessaire au navigateur pour s'abonner). */
  app.get('/api/vapid-public', async () => ({ key: vapid.publicKey }));

  /** Un téléphone s'abonne aux convocations d'un ou plusieurs dossards. */
  app.post('/api/public/:token/subscribe', async (req, reply) => {
    if (!subscribeLimit(req.ip)) return reply.code(429).send({ error: 'Trop de requêtes' });
    const { token } = req.params as { token: string };
    const share = selectShareByToken.get(token) as unknown as ShareRow | undefined;
    if (!share) return reply.code(404).send({ error: 'Lien inconnu ou révoqué' });

    const body = (req.body ?? {}) as {
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      teamNumbers?: unknown;
    };
    const sub = body.subscription;
    const teamNumbers = Array.isArray(body.teamNumbers)
      ? body.teamNumbers.filter((n): n is number => Number.isInteger(n)).slice(0, 20)
      : [];
    if (
      !sub?.endpoint ||
      sub.endpoint.length > 1000 ||
      !sub.keys?.p256dh ||
      !sub.keys?.auth ||
      teamNumbers.length === 0
    ) {
      return reply.code(400).send({ error: 'Abonnement invalide' });
    }
    const now = new Date().toISOString();
    for (const n of teamNumbers) {
      upsertSub.run(
        randomUUID(),
        share.org_id,
        share.concours_id,
        n,
        sub.endpoint,
        sub.keys.p256dh,
        sub.keys.auth,
        now,
      );
    }
    return { ok: true, count: teamNumbers.length };
  });

  /**
   * La table de marque signale des convocations. Dédupliquées par partie :
   * une même convocation n'est envoyée qu'une fois même avec plusieurs
   * appareils à la table.
   */
  app.post('/api/notify', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth) return reply.code(401).send({ error: 'Non authentifié' });
    const body = (req.body ?? {}) as { concoursId?: string; calls?: CallInput[] };
    const concoursId = typeof body.concoursId === 'string' ? body.concoursId : '';
    const calls = Array.isArray(body.calls) ? body.calls.slice(0, 200) : [];
    if (!concoursId) return reply.code(400).send({ error: 'concoursId requis' });

    const now = new Date().toISOString();
    let sent = 0;
    for (const call of calls) {
      if (typeof call?.matchId !== 'string' || !Array.isArray(call.teamNumbers)) continue;
      const inserted = markNotified.run(concoursId, call.matchId, now);
      if (inserted.changes === 0) continue; // déjà notifiée

      for (const n of call.teamNumbers) {
        if (!Number.isInteger(n)) continue;
        const subs = subsForTeams.all(concoursId, n) as unknown as PushSubRow[];
        for (const s of subs) {
          const payload = JSON.stringify({
            title: call.title || 'Votre équipe est appelée',
            body: call.body || '',
            tag: `${concoursId}:${call.matchId}:${n}`,
            url: call.url || '/',
          });
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
            );
            sent += 1;
          } catch (err) {
            const status = (err as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) deleteSub.run(s.id); // abonnement mort
          }
        }
      }
    }
    return { ok: true, sent };
  });
}
