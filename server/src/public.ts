import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AuthContext } from './index.js';
import type { DeclarationRow, EntityRow, RegistrationRow, ShareRow } from './db.js';

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

    const declarations = selectDeclarations
      .all(share.org_id, share.concours_id)
      .map((r) => {
        const row = r as unknown as DeclarationRow;
        return {
          matchId: row.match_id,
          side: row.side,
          scoreA: row.score_a,
          scoreB: row.score_b,
          createdAt: row.created_at,
        };
      });

    return {
      concours: JSON.parse(concoursRow.data),
      teams: byType('team'),
      poules: byType('poule'),
      matches: byType('match'),
      declarations,
      generatedAt: new Date().toISOString(),
    };
  });

  /* ---------------------------------------------------------------- */
  /* Auto-déclaration des scores (auto-arbitrage)                      */
  /* ---------------------------------------------------------------- */

  const declareLimit = rateLimiter(30, 60_000);
  const selectDeclarations = db.prepare(
    'SELECT * FROM declarations WHERE org_id = ? AND concours_id = ? AND applied = 0',
  );
  const deleteSideDeclaration = db.prepare(
    'DELETE FROM declarations WHERE match_id = ? AND side = ? AND applied = 0',
  );
  const insertDeclaration = db.prepare(`
    INSERT INTO declarations (id, org_id, concours_id, match_id, side, score_a, score_b, created_at, applied)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);
  const selectMatchEntity = db.prepare(
    "SELECT data FROM entities WHERE org_id = ? AND type = 'match' AND id = ? AND deleted = 0",
  );
  const selectOtherSide = db.prepare(
    'SELECT * FROM declarations WHERE match_id = ? AND side = ? AND applied = 0',
  );

  /**
   * Une équipe déclare le score de sa partie depuis le lien public.
   * Quand les deux camps déclarent le même score, la déclaration est
   * « concordante » — la table de marque n'a plus qu'à l'appliquer.
   */
  app.post('/api/public/:token/declarations', async (req, reply) => {
    if (!declareLimit(req.ip)) {
      return reply.code(429).send({ error: 'Trop de déclarations, patientez' });
    }
    const { token } = req.params as { token: string };
    const share = selectByToken.get(token) as unknown as ShareRow | undefined;
    if (!share) return reply.code(404).send({ error: 'Lien inconnu ou révoqué' });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const matchId = typeof body.matchId === 'string' ? body.matchId : '';
    const side = body.side === 'A' || body.side === 'B' ? body.side : null;
    const scoreA = Number(body.scoreA);
    const scoreB = Number(body.scoreB);
    if (
      !matchId ||
      matchId.length > 64 ||
      !side ||
      !Number.isInteger(scoreA) ||
      !Number.isInteger(scoreB) ||
      scoreA < 0 ||
      scoreB < 0 ||
      scoreA > 30 ||
      scoreB > 30 ||
      scoreA === scoreB
    ) {
      return reply.code(400).send({ error: 'Déclaration invalide' });
    }
    const matchRow = selectMatchEntity.get(share.org_id, matchId) as unknown as
      | { data: string }
      | undefined;
    if (!matchRow) return reply.code(404).send({ error: 'Partie introuvable' });
    const match = JSON.parse(matchRow.data) as { concoursId?: string; done?: boolean };
    if (match.concoursId !== share.concours_id) {
      return reply.code(404).send({ error: 'Partie introuvable' });
    }
    if (match.done) {
      return reply.code(409).send({ error: 'Le score de cette partie est déjà validé' });
    }

    // Une déclaration par camp : la plus récente remplace la précédente.
    deleteSideDeclaration.run(matchId, side);
    insertDeclaration.run(
      randomUUID(),
      share.org_id,
      share.concours_id,
      matchId,
      side,
      scoreA,
      scoreB,
      new Date().toISOString(),
    );

    const other = selectOtherSide.get(matchId, side === 'A' ? 'B' : 'A') as unknown as
      | DeclarationRow
      | undefined;
    const agreement = Boolean(other && other.score_a === scoreA && other.score_b === scoreB);
    return { ok: true, agreement };
  });

  /** Déclarations en attente pour la table de marque (authentifié). */
  app.get('/api/declarations', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth) return reply.code(401).send({ error: 'Non authentifié' });
    const { concoursId } = req.query as { concoursId?: string };
    const rows = (
      concoursId
        ? selectDeclarations.all(auth.orgId, concoursId)
        : db
            .prepare('SELECT * FROM declarations WHERE org_id = ? AND applied = 0')
            .all(auth.orgId)
    ) as unknown as DeclarationRow[];
    return {
      declarations: rows.map((r) => ({
        id: r.id,
        concoursId: r.concours_id,
        matchId: r.match_id,
        side: r.side,
        scoreA: r.score_a,
        scoreB: r.score_b,
        createdAt: r.created_at,
      })),
    };
  });

  /** La table de marque solde les déclarations d'une partie. */
  app.delete('/api/declarations/match/:matchId', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth) return reply.code(401).send({ error: 'Non authentifié' });
    const { matchId } = req.params as { matchId: string };
    db.prepare(
      'UPDATE declarations SET applied = 1 WHERE org_id = ? AND match_id = ?',
    ).run(auth.orgId, matchId);
    return { ok: true };
  });

  /* ---------------------------------------------------------------- */
  /* Pré-inscriptions en ligne                                        */
  /* ---------------------------------------------------------------- */

  const registerLimit = rateLimiter(20, 60_000);
  const insertRegistration = db.prepare(
    'INSERT INTO registrations (id, org_id, concours_id, players, club, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const selectRegistrations = db.prepare(
    'SELECT * FROM registrations WHERE org_id = ? AND concours_id = ? ORDER BY created_at',
  );
  const deleteRegistration = db.prepare(
    'DELETE FROM registrations WHERE id = ? AND org_id = ?',
  );

  /** Une équipe se pré-inscrit depuis le lien public (avant le concours). */
  app.post('/api/public/:token/register', async (req, reply) => {
    if (!registerLimit(req.ip)) return reply.code(429).send({ error: 'Trop de requêtes' });
    const { token } = req.params as { token: string };
    const share = selectByToken.get(token) as unknown as ShareRow | undefined;
    if (!share) return reply.code(404).send({ error: 'Lien inconnu ou révoqué' });

    const body = (req.body ?? {}) as { players?: unknown; club?: unknown };
    const players = Array.isArray(body.players)
      ? body.players
          .map((p) => {
            const o = (p ?? {}) as { name?: unknown; licence?: unknown };
            const name = typeof o.name === 'string' ? o.name.trim().slice(0, 80) : '';
            const licence = typeof o.licence === 'string' ? o.licence.trim().slice(0, 30) : '';
            return name ? { name, licence: licence || undefined } : null;
          })
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .slice(0, 3)
      : [];
    if (players.length === 0) return reply.code(400).send({ error: 'Nom(s) requis' });
    const club = typeof body.club === 'string' ? body.club.trim().slice(0, 80) : '';

    insertRegistration.run(
      randomUUID(),
      share.org_id,
      share.concours_id,
      JSON.stringify(players),
      club || null,
      new Date().toISOString(),
    );
    return { ok: true };
  });

  /** Pré-inscriptions en attente (table de marque). */
  app.get('/api/registrations', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth) return reply.code(401).send({ error: 'Non authentifié' });
    const { concoursId } = req.query as { concoursId?: string };
    if (!concoursId) return reply.code(400).send({ error: 'concoursId requis' });
    const rows = selectRegistrations.all(auth.orgId, concoursId) as unknown as RegistrationRow[];
    return {
      registrations: rows.map((r) => ({
        id: r.id,
        players: JSON.parse(r.players),
        club: r.club ?? undefined,
        createdAt: r.created_at,
      })),
    };
  });

  /** La table de marque valide ou refuse une pré-inscription. */
  app.delete('/api/registrations/:id', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth) return reply.code(401).send({ error: 'Non authentifié' });
    const { id } = req.params as { id: string };
    deleteRegistration.run(id, auth.orgId);
    return { ok: true };
  });
}
