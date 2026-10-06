/**
 * Ouverture de la base SQLite locale, avec réglages de robustesse et sauvegarde quotidienne.
 */
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { migrate } from './repository';

export function openDatabase(file: string): Database.Database {
  const db = new Database(file);
  db.pragma('journal_mode = WAL'); // résistant aux coupures, lectures concurrentes
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}

/**
 * Sauvegarde locale quotidienne (API de sauvegarde en ligne de SQLite : cohérente même en écriture).
 * Conserve les `keep` plus récentes. Les sauvegardes restent sur le poste de l'utilisateur.
 */
export async function dailyBackup(db: Database.Database, dir: string, today: string, keep = 14): Promise<void> {
  mkdirSync(dir, { recursive: true });
  const target = join(dir, `caseforge-${today}.sqlite`);
  if (existsSync(target)) return;
  await db.backup(target);
  const files = readdirSync(dir).filter((f) => /^caseforge-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort();
  for (const old of files.slice(0, Math.max(0, files.length - keep))) rmSync(join(dir, old));
}
