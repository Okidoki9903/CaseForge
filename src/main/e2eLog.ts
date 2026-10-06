/**
 * Trace de test de bout en bout : n'écrit que si CASEFORGE_E2E_LOG désigne un fichier local.
 * Inactive en utilisation normale ; rien n'est jamais transmis.
 */
import { appendFileSync } from 'node:fs';

export function e2eLog(line: string): void {
  const file = process.env.CASEFORGE_E2E_LOG;
  if (!file) return;
  try {
    appendFileSync(file, `${new Date().toISOString()} ${line}\n`);
  } catch {
    /* trace facultative */
  }
}
