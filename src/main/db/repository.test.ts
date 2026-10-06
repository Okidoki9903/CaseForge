import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate, Repository } from './repository';

function freshRepo() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrate(db);
  const repo = new Repository(db);
  repo.seed('2026-10-06');
  return { db, repo };
}

describe('dépôt SQLite', () => {
  it('migre et amorce les données de démonstration', () => {
    const { repo, db } = freshRepo();
    expect(db.pragma('user_version', { simple: true })).toBe(1);
    const s = repo.getSnapshot();
    expect(s.practiceAreas).toHaveLength(5);
    expect(s.matters.length).toBeGreaterThan(10);
    expect(s.matters.find((m) => m.id === 'm-001')?.teamIds).toEqual(['st-02', 'st-08']);
  });

  it('migrer deux fois est sans effet', () => {
    const { db } = freshRepo();
    expect(() => migrate(db)).not.toThrow();
  });

  it('accusé de réception journalisé et validé', () => {
    const { repo, db } = freshRepo();
    const d = repo.getSnapshot().deadlines.find((x) => !x.acknowledgedAt)!;
    expect(() => repo.acknowledgeDeadline(d.id, '1')).toThrow();
    repo.acknowledgeDeadline(d.id, 'hb');
    const after = repo.getSnapshot().deadlines.find((x) => x.id === d.id)!;
    expect(after.acknowledgedBy).toBe('HB');
    expect((db.prepare('SELECT COUNT(*) n FROM audit_log').get() as { n: number }).n).toBe(1);
  });

  it('saisie de temps : arrondi à 0,1 h et taux figé à la saisie', () => {
    const { repo, db } = freshRepo();
    const e = repo.addTimeEntry({ matterId: 'm-001', staffId: 'st-01', date: '2026-10-06', minutes: 13, billable: true, description: ' Test ' });
    expect(e.minutes).toBe(18);
    expect(e.description).toBe('Test');
    expect(e.rateCents).toBe(52500);
    // Hausse de taux ultérieure : l'entrée existante conserve son taux.
    db.prepare('UPDATE staff SET hourly_rate_cents = 60000 WHERE id = ?').run('st-01');
    expect(repo.getSnapshot().timeEntries.find((t) => t.id === e.id)?.rateCents).toBe(52500);
    expect(repo.addTimeEntry({ ...e, minutes: 6 }).rateCents).toBe(60000);
    expect(() => repo.addTimeEntry({ ...e, minutes: 0 })).toThrow();
    expect(() => repo.addTimeEntry({ ...e, description: '  ' })).toThrow();
    expect(() => repo.addTimeEntry({ ...e, matterId: 'inconnu' })).toThrow();
  });

  it('statut facturé / radié journalisé, transitions contrôlées', () => {
    const { repo, db } = freshRepo();
    const e = repo.addTimeEntry({ matterId: 'm-001', staffId: 'st-01', date: '2026-10-06', minutes: 30, billable: true, description: 'Test' });
    expect(() => repo.setTimeEntryStatus(e.id, 'facture', 'x')).toThrow();
    repo.setTimeEntryStatus(e.id, 'facture', 'hb');
    expect(() => repo.setTimeEntryStatus(e.id, 'radie', 'HB')).toThrow();
    repo.setTimeEntryStatus(e.id, 'wip', 'HB');
    repo.setTimeEntryStatus(e.id, 'radie', 'HB');
    expect(repo.getSnapshot().timeEntries.find((t) => t.id === e.id)?.status).toBe('radie');
    const log = db.prepare("SELECT actor, details_json FROM audit_log WHERE action = 'set_time_status' ORDER BY id").all() as { actor: string; details_json: string }[];
    expect(log.map((l) => l.actor)).toEqual(['HB', 'HB', 'HB']);
    expect(JSON.parse(log[0].details_json)).toEqual({ from: 'wip', to: 'facture' });
  });

  it('changement d’étape contrôlé', () => {
    const { repo } = freshRepo();
    repo.setMatterStage('m-001', 'cloture');
    expect(repo.getSnapshot().matters.find((m) => m.id === 'm-001')?.stage).toBe('cloture');
    expect(() => repo.setMatterStage('m-001', 'inconnue' as never)).toThrow();
  });
});
