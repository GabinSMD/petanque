import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { hashPassword, signToken, verifyPassword, verifyToken } from './security.js';
import { registerSyncRoutes } from './sync.js';
import type { OrgRow, UserRow } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const DATA_DIR = resolve(process.env.DATA_DIR ?? join(__dirname, '..', 'data'));
const DB_PATH = process.env.DB_PATH ?? join(DATA_DIR, 'petanque.sqlite');
const CLIENT_DIST = resolve(__dirname, '..', '..', 'client', 'dist');

const db = openDb(DB_PATH);

/** Secret JWT : variable d'environnement, sinon généré et conservé sur disque. */
function loadSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const secretPath = join(DATA_DIR, '.jwt-secret');
  if (existsSync(secretPath)) return readFileSync(secretPath, 'utf8').trim();
  const secret = randomBytes(32).toString('hex');
  writeFileSync(secretPath, secret, { mode: 0o600 });
  return secret;
}
const JWT_SECRET = loadSecret();

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

/* ------------------------------------------------------------------ */
/* Aides                                                               */
/* ------------------------------------------------------------------ */

function fieldStr(value: unknown, min: number, max: number): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (s.length < min || s.length > max) return null;
  return s;
}

export interface AuthContext {
  userId: string;
  orgId: string;
}

function authenticate(header: string | undefined): AuthContext | null {
  if (!header?.startsWith('Bearer ')) return null;
  const payload = verifyToken(header.slice(7), JWT_SECRET);
  if (!payload) return null;
  return { userId: payload.sub, orgId: payload.org };
}

function publicUser(user: UserRow, org: OrgRow) {
  return {
    user: { id: user.id, email: user.email, name: user.name },
    org: { id: org.id, name: org.name },
  };
}

/* ------------------------------------------------------------------ */
/* Authentification                                                    */
/* ------------------------------------------------------------------ */

app.post('/api/auth/register', async (req, reply) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const orgName = fieldStr(body.orgName, 2, 80);
  const userName = fieldStr(body.userName, 2, 80);
  const email = fieldStr(body.email, 5, 120)?.toLowerCase() ?? null;
  const password = typeof body.password === 'string' ? body.password : null;

  if (!orgName || !userName || !email || !email.includes('@')) {
    return reply.code(400).send({ error: 'Champs invalides' });
  }
  if (!password || password.length < 8) {
    return reply.code(400).send({ error: 'Mot de passe : 8 caractères minimum' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return reply.code(409).send({ error: 'Un compte existe déjà avec cet e-mail' });
  }

  const now = new Date().toISOString();
  const orgId = randomUUID();
  const userId = randomUUID();
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO orgs (id, name, seq, created_at) VALUES (?, ?, 0, ?)').run(
      orgId,
      orgName,
      now,
    );
    db.prepare(
      'INSERT INTO users (id, org_id, email, name, pass_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(userId, orgId, email, userName, hashPassword(password), now);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const token = signToken({ sub: userId, org: orgId, name: userName }, JWT_SECRET);
  return {
    token,
    user: { id: userId, email, name: userName },
    org: { id: orgId, name: orgName },
  };
});

app.post('/api/auth/login', async (req, reply) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const email = fieldStr(body.email, 5, 120)?.toLowerCase() ?? null;
  const password = typeof body.password === 'string' ? body.password : null;
  if (!email || !password) return reply.code(400).send({ error: 'Champs invalides' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
    | UserRow
    | undefined;
  if (!user || !verifyPassword(password, user.pass_hash)) {
    return reply.code(401).send({ error: 'Identifiants incorrects' });
  }
  const org = db.prepare('SELECT * FROM orgs WHERE id = ?').get(user.org_id) as unknown as OrgRow;
  const token = signToken({ sub: user.id, org: user.org_id, name: user.name }, JWT_SECRET);
  return { token, ...publicUser(user, org) };
});

app.get('/api/me', async (req, reply) => {
  const auth = authenticate(req.headers.authorization);
  if (!auth) return reply.code(401).send({ error: 'Non authentifié' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(auth.userId) as
    | UserRow
    | undefined;
  if (!user) return reply.code(401).send({ error: 'Compte introuvable' });
  const org = db.prepare('SELECT * FROM orgs WHERE id = ?').get(user.org_id) as unknown as OrgRow;
  return publicUser(user, org);
});

app.get('/api/health', async () => ({ ok: true, ts: new Date().toISOString() }));

/* ------------------------------------------------------------------ */
/* Synchronisation                                                     */
/* ------------------------------------------------------------------ */

registerSyncRoutes(app, db, (req) => authenticate(req.headers.authorization));

/* ------------------------------------------------------------------ */
/* Client statique (PWA) — production                                  */
/* ------------------------------------------------------------------ */

if (existsSync(CLIENT_DIST)) {
  // wildcard:true résout les fichiers à la requête : un nouveau build du
  // client est servi sans redémarrage du serveur.
  await app.register(fastifyStatic, { root: CLIENT_DIST, wildcard: true });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || req.method !== 'GET') {
      return reply.code(404).send({ error: 'Introuvable' });
    }
    return reply.sendFile('index.html');
  });
} else {
  app.log.warn(`Client non construit (${CLIENT_DIST} absent) — API seule.`);
}

app
  .listen({ port: PORT, host: HOST })
  .then(() => app.log.info(`Pétanque Concours prêt sur le port ${PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
