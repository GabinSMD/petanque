/**
 * Sauvegarde à chaud de la base SQLite (VACUUM INTO : cohérente même
 * pendant l'utilisation). Usage :
 *   node scripts/backup-db.mjs [chemin-db] [dossier-sortie]
 * Par défaut : server/data/petanque.sqlite → backups/
 * À planifier en cron, ex. : 0 3 * * * node /app/scripts/backup-db.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dbPath = resolve(process.argv[2] ?? 'server/data/petanque.sqlite');
const outDir = resolve(process.argv[3] ?? 'backups');
mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const target = join(outDir, `petanque-${stamp}.sqlite`);

const db = new DatabaseSync(dbPath, { readOnly: false });
db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
db.close();
console.log(`✔ Sauvegarde : ${target}`);

// Rétention : garde les 30 sauvegardes les plus récentes.
const backups = readdirSync(outDir)
  .filter((f) => f.startsWith('petanque-') && f.endsWith('.sqlite'))
  .map((f) => ({ f, t: statSync(join(outDir, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);
for (const { f } of backups.slice(30)) {
  unlinkSync(join(outDir, f));
  console.log(`  purge : ${f}`);
}
