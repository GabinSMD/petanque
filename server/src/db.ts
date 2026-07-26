import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface OrgRow {
  id: string;
  name: string;
  seq: number;
  created_at: string;
}

export interface UserRow {
  id: string;
  org_id: string;
  email: string;
  name: string;
  pass_hash: string;
  created_at: string;
}

export interface EntityRow {
  org_id: string;
  type: string;
  id: string;
  data: string | null;
  updated_at: string;
  deleted: number;
  device_id: string;
  seq: number;
}

export function openDb(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS orgs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      seq INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      pass_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entities (
      org_id TEXT NOT NULL REFERENCES orgs(id),
      type TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      device_id TEXT NOT NULL DEFAULT '',
      seq INTEGER NOT NULL,
      PRIMARY KEY (org_id, type, id)
    );

    CREATE INDEX IF NOT EXISTS idx_entities_org_seq ON entities(org_id, seq);

    CREATE TABLE IF NOT EXISTS shares (
      token TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      concours_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_shares_concours ON shares(org_id, concours_id);

    CREATE TABLE IF NOT EXISTS invites (
      code TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS declarations (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      concours_id TEXT NOT NULL,
      match_id TEXT NOT NULL,
      side TEXT NOT NULL,
      score_a INTEGER NOT NULL,
      score_b INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      applied INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_decl_org ON declarations(org_id, applied);
    CREATE INDEX IF NOT EXISTS idx_decl_match ON declarations(match_id, side);
  `);
  return db;
}

export interface DeclarationRow {
  id: string;
  org_id: string;
  concours_id: string;
  match_id: string;
  side: string;
  score_a: number;
  score_b: number;
  created_at: string;
  applied: number;
}

export interface ShareRow {
  token: string;
  org_id: string;
  concours_id: string;
  created_at: string;
  revoked: number;
}

export interface InviteRow {
  code: string;
  org_id: string;
  created_at: string;
  expires_at: string;
}

/** Numéro de séquence suivant pour l'oplog d'une organisation. */
export function nextSeq(db: DatabaseSync, orgId: string): number {
  db.prepare('UPDATE orgs SET seq = seq + 1 WHERE id = ?').run(orgId);
  const row = db.prepare('SELECT seq FROM orgs WHERE id = ?').get(orgId) as
    | { seq: number }
    | undefined;
  if (!row) throw new Error(`Organisation inconnue : ${orgId}`);
  return row.seq;
}
