import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import type { AuthContext } from './index.js';
import type { EntityRow, ShareRow } from './db.js';

/**
 * Limiteur de débit minimaliste en mémoire (par IP) — suffisant pour un
 * déploiement mono-instance, sans dépendance.
 */
export function rateLimiter(max: number, windowMs: number): (key: string) => boolean {
  const hits = new Map<string, { n: number; reset: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref?.();
  return (key: string) => {
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) {
      hits.set(key, { n: 1, reset: now + windowMs });
      return true;
    }
    h.n += 1;
    return h.n <= max;
  };
}

/**
 * Partage public : l'organisateur crée un lien en lecture seule pour un
 * concours ; spectateurs et joueurs le consultent sans compte, avec
 * rafraîchissement côté client.
 */
export function registerPublicRoutes(
  app: FastifyInstance,
  db: DatabaseSync,
  authenticate: (req: FastifyRequest) => AuthContext | null,
): void {
  const publicLimit = rateLimiter(120, 60_000);

  const selectShare = db.prepare(
    'SELECT * FROM shares WHERE org_id = ? AND concours_id = ? AND revoked = 0',
  );
  const selectByToken = db.prepare('SELECT * FROM shares WHERE token = ? AND revoked = 0');
  const insertShare = db.prepare(
    'INSERT INTO shares (token, org_id, concours_id, created_at, revoked) VALUES (?, ?, ?, ?, 0)',
  );
  const revokeShares = db.prepare(
    'UPDATE shares SET revoked = 1 WHERE org_id = ? AND concours_id = ?',
  );
  const selectConcours = db.prepare(
    "SELECT * FROM entities WHERE org_id = ? AND type = 'concours' AND id = ? AND deleted = 0",
  );
  const selectChildren = db.prepare(`
    SELECT * FROM entities
    WHERE org_id = ? AND deleted = 0
      AND type IN ('team', 'poule', 'match')
      AND json_extract(data, '$.concoursId') = ?
  `);

  /** Crée (ou renvoie) le lien public d'un concours. */
  app.post('/api/share', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth) return reply.code(401).send({ error: 'Non authentifié' });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const concoursId = typeof body.concoursId === 'string' ? body.concoursId : '';
    if (!concoursId || concoursId.length > 64) {
      return reply.code(400).send({ error: 'concoursId invalide' });
    }
    const concours = selectConcours.get(auth.orgId, concoursId);
    if (!concours) return reply.code(404).send({ error: 'Concours introuvable' });

    const existing = selectShare.get(auth.orgId, concoursId) as unknown as
      | ShareRow
      | undefined;
    if (existing) return { token: existing.token };

    const token = randomBytes(9).toString('base64url');
    insertShare.run(token, auth.orgId, concoursId, new Date().toISOString());
    return { token };
  });

  /** Lien public actuel d'un concours (null si aucun). */
  app.get('/api/share/:concoursId', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth) return reply.code(401).send({ error: 'Non authentifié' });
    const { concoursId } = req.params as { concoursId: string };
    const existing = selectShare.get(auth.orgId, concoursId) as unknown as
      | ShareRow
      | undefined;
    return { token: existing?.token ?? null };
  });

  /** Révoque le lien public d'un concours. */
  app.delete('/api/share/:concoursId', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth) return reply.code(401).send({ error: 'Non authentifié' });
    const { concoursId } = req.params as { concoursId: string };
    revokeShares.run(auth.orgId, concoursId);
    return { ok: true };
  });

  /** Données publiques d'un concours partagé (lecture seule, sans compte). */
  app.get('/api/public/:token', async (req, reply) => {
    if (!publicLimit(req.ip)) {
      return reply.code(429).send({ error: 'Trop de requêtes' });
    }
    const { token } = req.params as { token: string };
    if (!token || token.length > 32) return reply.code(400).send({ error: 'Jeton invalide' });
    const share = selectByToken.get(token) as unknown as ShareRow | undefined;
    if (!share) return reply.code(404).send({ error: 'Lien inconnu ou révoqué' });

    const concoursRow = selectConcours.get(share.org_id, share.concours_id) as unknown as
      | EntityRow
      | undefined;
    if (!concoursRow?.data) {
      return reply.code(404).send({ error: 'Concours supprimé' });
    }
    const children = selectChildren.all(share.org_id, share.concours_id) as unknown as EntityRow[];

    const byType = (t: string) =>
      children.filter((r) => r.type === t && r.data).map((r) => JSON.parse(r.data!));

    return {
      concours: JSON.parse(concoursRow.data),
      teams: byType('team'),
      poules: byType('poule'),
      matches: byType('match'),
      generatedAt: new Date().toISOString(),
    };
  });
}
