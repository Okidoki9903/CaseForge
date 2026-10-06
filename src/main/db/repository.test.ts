import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate, Repository } from './repository';
import { MIGRATIONS } from './migrations';
import { buildAlerts } from '@shared/domain/alerts';

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
    expect(db.pragma('user_version', { simple: true })).toBe(MIGRATIONS.length);
    const s = repo.getSnapshot();
    expect(s.practiceAreas).toHaveLength(5);
    expect(s.matters.length).toBeGreaterThanOrEqual(12);
    // Vérifications de conflits et historique de démonstration persistés dans SQLite.
    expect(s.conflictChecks).toHaveLength(4);
    expect(s.auditLog[0].action).toBe('set_stage');
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
    expect((db.prepare("SELECT COUNT(*) n FROM audit_log WHERE action = 'acknowledge'").get() as { n: number }).n).toBe(1);
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

  it('changement d’étape contrôlé et journalisé (qui + quand)', () => {
    const { repo, db } = freshRepo();
    repo.setMatterStage('m-001', 'cloture', 'hb');
    expect(repo.getSnapshot().matters.find((m) => m.id === 'm-001')?.stage).toBe('cloture');
    // Même étape : aucune écriture au journal.
    repo.setMatterStage('m-001', 'cloture', 'HB');
    expect(() => repo.setMatterStage('m-001', 'inconnue' as never, 'HB')).toThrow();
    expect(() => repo.setMatterStage('m-001', 'depot', '')).toThrow();
    const log = repo.getSnapshot().auditLog.filter((a) => a.action === 'set_stage' && a.entityId === 'm-001');
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ actor: 'HB', entity: 'matter', entityId: 'm-001', details: { from: 'audience', to: 'cloture' } });
    expect(Number.isNaN(Date.parse(log[0].at))).toBe(false);
    expect((db.prepare("SELECT COUNT(*) n FROM audit_log WHERE action = 'set_stage' AND entity_id = 'm-001'").get() as { n: number }).n).toBe(1);
  });

  it('migration v1 → v2 conserve les vérifications existantes', () => {
    const db = new Database(':memory:');
    db.exec(MIGRATIONS[0]);
    db.pragma('user_version = 1');
    db.prepare("INSERT INTO conflict_checks (id, query, performed_by, performed_at, results_json) VALUES ('c1', 'X', 'HB', '2026-01-01', '[]')").run();
    migrate(db);
    expect(db.pragma('user_version', { simple: true })).toBe(MIGRATIONS.length);
    expect(db.prepare('SELECT status, matter_id FROM conflict_checks').get()).toEqual({ status: 'en_cours', matter_id: null });
  });

  it('vérification de conflits enregistrée, recherche refaite côté données', () => {
    const { repo, db } = freshRepo();
    const c = repo.recordConflictCheck('Béton Laurentides inc.', 'hb');
    expect(c.status).toBe('potentiel');
    expect(c.performedBy).toBe('HB');
    expect(c.hits[0].partyName).toBe('Béton Laurentides ltée');
    expect(c.hits[0].roles.some((r) => r.role === 'adverse')).toBe(true);
    const clear = repo.recordConflictCheck('Zyxw Qrst', 'HB');
    expect(clear.status).toBe('clair');
    expect(clear.hits).toEqual([]);
    expect(() => repo.recordConflictCheck('  ', 'HB')).toThrow();
    expect(() => repo.recordConflictCheck('X', '1')).toThrow();
    const checks = repo.getSnapshot().conflictChecks;
    expect(checks.map((x) => x.id)).toEqual(expect.arrayContaining([c.id, clear.id]));
    expect((db.prepare("SELECT COUNT(*) n FROM audit_log WHERE action = 'conflict_check'").get() as { n: number }).n).toBe(2);
  });

  it('mise à jour du statut et du dossier visé, journalisée', () => {
    const { repo, db } = freshRepo();
    const c = repo.recordConflictCheck('Béton Laurentides', 'HB');
    repo.updateConflictCheck(c.id, { status: 'confirme', matterId: 'm-002' }, 'so');
    const after = repo.getSnapshot().conflictChecks.find((x) => x.id === c.id)!;
    expect(after).toMatchObject({ status: 'confirme', matterId: 'm-002', updatedBy: 'SO' });
    expect(() => repo.updateConflictCheck(c.id, { status: 'inconnu' as never }, 'SO')).toThrow();
    expect(() => repo.updateConflictCheck(c.id, { matterId: 'zzz' }, 'SO')).toThrow();
    const log = db.prepare("SELECT details_json FROM audit_log WHERE action = 'update_conflict_check'").get() as { details_json: string };
    expect(JSON.parse(log.details_json).to).toEqual({ status: 'confirme', matterId: 'm-002' });
  });

  it('alerte critique : impossible de la faire disparaître sans initiales nominatives', () => {
    const { repo, db } = freshRepo();
    const pending = () => buildAlerts(repo.getSnapshot().deadlines, repo.getSnapshot().matters, '2026-10-06').filter((a) => a.requiresAcknowledgement);
    const first = pending()[0];
    expect(first).toBeDefined();
    // Ni accusé de réception ni « marquer fait » sans initiales valides.
    for (const bad of ['', ' ', 'X', '12', 'TROPLONG']) {
      expect(() => repo.acknowledgeDeadline(first.deadline.id, bad)).toThrow();
      expect(() => repo.completeDeadline(first.deadline.id, bad)).toThrow();
    }
    expect(pending().some((a) => a.deadline.id === first.deadline.id)).toBe(true);
    repo.completeDeadline(first.deadline.id, 'hb');
    expect(pending().some((a) => a.deadline.id === first.deadline.id)).toBe(false);
    const log = db.prepare("SELECT actor FROM audit_log WHERE action = 'complete' AND entity_id = ?").get(first.deadline.id) as { actor: string };
    expect(log.actor).toBe('HB');
    expect(() => repo.completeDeadline(first.deadline.id, 'HB')).toThrow(); // déjà fermée
  });

  it('paramètres persistés et journalisés', () => {
    const { repo } = freshRepo();
    expect(repo.getSettings()).toMatchObject({ demo: true, onboarded: false, jurisdictions: ['QC', 'ON', 'FED'] });
    repo.updateSettings({ firmName: 'Roy Avocats', jurisdictions: ['QC', 'BC'], defaultRateCents: 35000, onboarded: true }, 'hb');
    expect(repo.getSnapshot().settings).toMatchObject({ firmName: 'Roy Avocats', jurisdictions: ['QC', 'BC'], defaultRateCents: 35000, onboarded: true });
    expect(() => repo.updateSettings({ jurisdictions: [] }, 'HB')).toThrow();
    expect(repo.getSnapshot().auditLog[0]).toMatchObject({ action: 'update_settings', actor: 'HB' });
  });

  it('collaborateurs : création, modification du taux (futur seulement), désactivation', () => {
    const { repo } = freshRepo();
    const p = repo.saveStaff({ name: 'Me Anne Roy', initials: 'anr', role: 'avocat', practiceAreaId: 'pa-lit', hourlyRateCents: 30000, targetHoursWeek: 30 }, 'HB');
    expect(repo.getSnapshot().staff.find((x) => x.id === p.id)).toMatchObject({ initials: 'ANR', active: true });
    expect(() => repo.saveStaff({ name: 'Autre', initials: 'HB', role: 'avocat', practiceAreaId: 'pa-lit', hourlyRateCents: 1, targetHoursWeek: 30 }, 'HB')).toThrow(/déjà utilisées/);
    const e = repo.addTimeEntry({ matterId: 'm-001', staffId: p.id, date: '2026-10-06', minutes: 60, billable: true, description: 'Test' });
    repo.saveStaff({ ...p, hourlyRateCents: 40000 }, 'HB');
    expect(repo.getSnapshot().timeEntries.find((t) => t.id === e.id)?.rateCents).toBe(30000);
    repo.setStaffActive(p.id, false, 'HB');
    expect(repo.getSnapshot().staff.find((x) => x.id === p.id)?.active).toBe(false);
    expect(() => repo.addTimeEntry({ matterId: 'm-001', staffId: p.id, date: '2026-10-06', minutes: 6, billable: true, description: 'X' })).toThrow(/inactif/);
    // L'entrée existante reste lisible avec son auteur.
    expect(repo.getSnapshot().timeEntries.find((t) => t.id === e.id)?.staffId).toBe(p.id);
  });

  it('cabinet vide : remplace tout, un seul collaborateur, dernier actif protégé', () => {
    const { repo } = freshRepo();
    const owner = repo.createEmptyFirm({
      firmName: 'Roy Avocats', jurisdictions: ['ON'], defaultRateCents: 30000,
      owner: { name: 'Me Anne Roy', initials: 'AR', role: 'associe', hourlyRateCents: 45000, targetHoursWeek: 30 },
    });
    const s = repo.getSnapshot();
    expect(s.settings).toMatchObject({ firmName: 'Roy Avocats', demo: false, onboarded: true, jurisdictions: ['ON'] });
    expect(s.matters).toHaveLength(0);
    expect(s.deadlines).toHaveLength(0);
    expect(s.conflictChecks).toHaveLength(0);
    expect(s.staff).toEqual([expect.objectContaining({ id: owner.id, initials: 'AR' })]);
    expect(() => repo.setStaffActive(owner.id, false, 'AR')).toThrow(/au moins un/);
    expect(s.auditLog[0]).toMatchObject({ action: 'create_firm', actor: 'AR' });
  });
});
