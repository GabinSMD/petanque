import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { nextSeq } from './db.js';
import type { EntityRow } from './db.js';
import type { AuthContext } from './index.js';

/**
 * Types acceptés à la réplication. Copie de `ENTITY_TYPES` dans
 * `shared/src/types.ts` : le serveur ne peut pas importer `shared` sans sortir
 * de son `rootDir`. **Les deux listes doivent rester identiques** — un type
 * connu du client mais absent d'ici est ignoré sans bruit, et l'entité reste
 * bloquée sur l'appareil.
 */
const ENTITY_TYPES = new Set([
  'concours',
  'team',
  'poule',
  'match',
  'licencie',
  'feuilleMatch',
  'photo',
  'licencieEtranger',
]);
const MAX_CHANGES_PER_PUSH = 2000;
const PULL_PAGE_SIZE = 2000;

interface IncomingChange {
  type: string;
  id: string;
  data: unknown;
  updatedAt: string;
  deleted: 0 | 1;
  deviceId: string;
}

/**
 * Réplication « local-first » : le client pousse ses modifications
 * (résolution dernier-écrivain-gagnant, départage par deviceId) et
 * récupère tout ce qui a changé depuis son curseur dans l'oplog de
 * son organisation. Idempotent : rejouer un push ne change rien.
 */
export function registerSyncRoutes(
  app: FastifyInstance,
  db: DatabaseSync,
  authenticate: (req: FastifyRequest) => AuthContext | null,
): void {
  const selectEntity = db.prepare(
    'SELECT * FROM entities WHERE org_id = ? AND type = ? AND id = ?',
  );
  const upsertEntity = db.prepare(`
    INSERT INTO entities (org_id, type, id, data, updated_at, deleted, device_id, seq)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (org_id, type, id) DO UPDATE SET
      data = excluded.data,
      updated_at = excluded.updated_at,
      deleted = excluded.deleted,
      device_id = excluded.device_id,
      seq = excluded.seq
  `);
  const selectSince = db.prepare(`
    SELECT * FROM entities WHERE org_id = ? AND seq > ? ORDER BY seq LIMIT ?
  `);

  app.post('/api/sync', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth) return reply.code(401).send({ error: 'Non authentifié' });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const cursor = Number.isInteger(body.cursor) ? (body.cursor as number) : 0;
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.slice(0, 64) : '';
    const rawChanges = Array.isArray(body.changes) ? body.changes : [];
    if (rawChanges.length > MAX_CHANGES_PER_PUSH) {
      return reply.code(413).send({ error: 'Trop de modifications en un envoi' });
    }

    const accepted: string[] = [];
    // Push rejeté (version serveur plus récente) : renvoyer la version
    // gagnante pour que l'appareil émetteur converge immédiatement.
    const rejected: { type: string; id: string }[] = [];
    db.exec('BEGIN');
    try {
      for (const raw of rawChanges) {
        const change = raw as Partial<IncomingChange>;
        if (
          !change ||
          typeof change.type !== 'string' ||
          !ENTITY_TYPES.has(change.type) ||
          typeof change.id !== 'string' ||
          change.id.length === 0 ||
          change.id.length > 64 ||
          typeof change.updatedAt !== 'string'
        ) {
          continue;
        }
        const changeDevice =
          typeof change.deviceId === 'string' ? change.deviceId.slice(0, 64) : deviceId;
        const deleted = change.deleted ? 1 : 0;
        const existing = selectEntity.get(auth.orgId, change.type, change.id) as
          | EntityRow
          | undefined;

        const wins =
          !existing ||
          change.updatedAt > existing.updated_at ||
          (change.updatedAt === existing.updated_at && changeDevice > existing.device_id);
        if (!wins) {
          rejected.push({ type: change.type, id: change.id });
          continue;
        }
        // Écriture identique (rejeu du même appareil) : rien à faire.
        if (
          existing &&
          change.updatedAt === existing.updated_at &&
          changeDevice === existing.device_id
        ) {
          accepted.push(`${change.type}:${change.id}`);
          continue;
        }

        const seq = nextSeq(db, auth.orgId);
        upsertEntity.run(
          auth.orgId,
          change.type,
          change.id,
          deleted ? null : JSON.stringify(change.data ?? null),
          change.updatedAt,
          deleted,
          changeDevice,
          seq,
        );
        accepted.push(`${change.type}:${change.id}`);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const rows = selectSince.all(auth.orgId, cursor, PULL_PAGE_SIZE + 1) as unknown as EntityRow[];
    const hasMore = rows.length > PULL_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PULL_PAGE_SIZE) : rows;
    const newCursor = page.length > 0 ? page[page.length - 1]!.seq : cursor;

    const outgoing = page.filter((row) => row.device_id !== deviceId);
    const seen = new Set(outgoing.map((row) => `${row.type}:${row.id}`));
    for (const { type, id } of rejected) {
      if (seen.has(`${type}:${id}`)) continue;
      seen.add(`${type}:${id}`);
      const row = selectEntity.get(auth.orgId, type, id) as EntityRow | undefined;
      if (row) outgoing.push(row);
    }

    return {
      cursor: newCursor,
      hasMore,
      accepted,
      changes: outgoing.map((row) => ({
        type: row.type,
        id: row.id,
        data: row.data === null ? null : JSON.parse(row.data),
        updatedAt: row.updated_at,
        deleted: row.deleted as 0 | 1,
        seq: row.seq,
      })),
    };
  });
}
