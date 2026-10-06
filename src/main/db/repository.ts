/**
 * Accès aux données SQLite. Aucune dépendance à Electron : testable sous Node.
 */
import type Database from 'better-sqlite3';
import type {
  ConflictCheck, ConflictStatus, FirmSnapshot, Id, Matter, NewTimeEntry, PipelineStage, TimeEntry, TimeEntryStatus,
} from '@shared/types';
import { CONFLICT_STATUSES, PIPELINE_STAGES } from '@shared/types';
import { initialConflictStatus, normalizeName, searchConflicts, toCheckHits } from '@shared/domain/conflicts';
import { assertStatusTransition, roundBillableMinutes } from '@shared/domain/time';
import { normalizeInitials } from '@shared/domain/validation';
import { buildDemoSnapshot } from '@shared/seed';
import { MIGRATIONS } from './migrations';

type Row = Record<string, any>;

export function migrate(db: Database.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

function rowToCheck(r: Row): ConflictCheck {
  return {
    id: r.id, query: r.query, performedBy: r.performed_by, performedAt: r.performed_at, status: r.status,
    matterId: r.matter_id, hits: JSON.parse(r.results_json), updatedAt: r.updated_at, updatedBy: r.updated_by,
  };
}

export class Repository {
  constructor(private readonly db: Database.Database) {}

  isEmpty(): boolean {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM practice_areas').get() as Row).n === 0;
  }

  getSnapshot(): FirmSnapshot {
    const all = (sql: string) => this.db.prepare(sql).all() as Row[];
    const team = new Map<string, string[]>();
    for (const r of all('SELECT matter_id, staff_id FROM matter_team')) {
      team.set(r.matter_id, [...(team.get(r.matter_id) ?? []), r.staff_id]);
    }
    const firmName =
      (this.db.prepare("SELECT value FROM settings WHERE key = 'firm_name'").get() as Row | undefined)?.value ?? 'Mon cabinet';

    return {
      firmName,
      practiceAreas: all('SELECT * FROM practice_areas ORDER BY code').map((r) => ({
        id: r.id, code: r.code, name: r.name, color: r.color, gridX: r.grid_x, gridZ: r.grid_z,
      })),
      staff: all('SELECT * FROM staff WHERE active = 1 ORDER BY name').map((r) => ({
        id: r.id, name: r.name, initials: r.initials, role: r.role, practiceAreaId: r.practice_area_id,
        hourlyRateCents: r.hourly_rate_cents, costRateCents: r.cost_rate_cents, targetHoursWeek: r.target_hours_week,
      })),
      parties: all('SELECT * FROM parties').map((r) => ({
        id: r.id, name: r.name, kind: r.kind, aliases: JSON.parse(r.aliases_json),
      })),
      matters: all('SELECT * FROM matters ORDER BY number').map(
        (r): Matter => ({
          id: r.id, number: r.number, title: r.title, clientId: r.client_id, practiceAreaId: r.practice_area_id,
          responsibleId: r.responsible_id, teamIds: team.get(r.id) ?? [], stage: r.stage, status: r.status,
          jurisdiction: r.jurisdiction, court: r.court, courtFileNumber: r.court_file_number,
          feeArrangement: r.fee_arrangement, budgetCents: r.budget_cents, openedAt: r.opened_at,
        }),
      ),
      matterParties: all('SELECT * FROM matter_parties').map((r) => ({ matterId: r.matter_id, partyId: r.party_id, role: r.role })),
      deadlines: all('SELECT * FROM deadlines ORDER BY due_date').map((r) => ({
        id: r.id, matterId: r.matter_id, kind: r.kind, title: r.title, dueDate: r.due_date, legalBasis: r.legal_basis,
        ruleId: r.rule_id, triggerDate: r.trigger_date, assignedTo: r.assigned_to, status: r.status,
        acknowledgedAt: r.acknowledged_at, acknowledgedBy: r.acknowledged_by, completedAt: r.completed_at,
      })),
      timeEntries: all('SELECT * FROM time_entries').map((r) => ({
        id: r.id, matterId: r.matter_id, staffId: r.staff_id, date: r.date, minutes: r.minutes, rateCents: r.rate_cents,
        billable: r.billable === 1, description: r.description, status: r.status,
      })),
      invoices: all('SELECT * FROM invoices').map((r) => ({
        id: r.id, matterId: r.matter_id, number: r.number, issuedAt: r.issued_at,
        standardValueCents: r.standard_value_cents, amountCents: r.amount_cents, paidCents: r.paid_cents,
      })),
      documents: all('SELECT * FROM documents ORDER BY added_at').map((r) => ({
        id: r.id, matterId: r.matter_id, title: r.title, category: r.category, exhibit: r.exhibit,
        filePath: r.file_path, addedAt: r.added_at,
      })),
      conflictChecks: all('SELECT * FROM conflict_checks ORDER BY performed_at DESC').map(rowToCheck),
    };
  }

  private audit(actor: string, action: string, entity: string, entityId: string, details: object = {}): void {
    this.db
      .prepare('INSERT INTO audit_log (at, actor, action, entity, entity_id, details_json) VALUES (?, ?, ?, ?, ?, ?)')
      .run(new Date().toISOString(), actor, action, entity, entityId, JSON.stringify(details));
  }

  acknowledgeDeadline(id: Id, initials: string): void {
    const who = normalizeInitials(initials);
    this.db.transaction(() => {
      const res = this.db
        .prepare("UPDATE deadlines SET acknowledged_at = ?, acknowledged_by = ? WHERE id = ? AND status = 'ouvert'")
        .run(new Date().toISOString(), who, id);
      if (res.changes !== 1) throw new Error('Échéance introuvable ou déjà fermée.');
      this.audit(who, 'acknowledge', 'deadline', id);
    })();
  }

  completeDeadline(id: Id): void {
    this.db.transaction(() => {
      const res = this.db
        .prepare("UPDATE deadlines SET status = 'complete', completed_at = ? WHERE id = ? AND status = 'ouvert'")
        .run(new Date().toISOString(), id);
      if (res.changes !== 1) throw new Error('Échéance introuvable ou déjà fermée.');
      this.audit('local', 'complete', 'deadline', id);
    })();
  }

  recordConflictCheck(query: string, actor: string, matterId: Id | null = null): ConflictCheck {
    const who = normalizeInitials(actor);
    const q = query.trim().slice(0, 300);
    if (normalizeName(q).length === 0) throw new Error('Recherche vide.');
    if (matterId && !this.db.prepare('SELECT 1 FROM matters WHERE id = ?').get(matterId)) throw new Error('Dossier introuvable.');
    // La recherche est refaite ici, sur les données de la base : la trace fait foi.
    const hits = toCheckHits(searchConflicts(q, this.getSnapshot()));
    const check: ConflictCheck = {
      id: `cc-${crypto.randomUUID()}`,
      query: q,
      performedBy: who,
      performedAt: new Date().toISOString(),
      status: initialConflictStatus(hits),
      matterId,
      hits,
      updatedAt: null,
      updatedBy: null,
    };
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO conflict_checks (id, query, performed_by, performed_at, results_json, status, matter_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(check.id, check.query, who, check.performedAt, JSON.stringify(hits), check.status, matterId);
      this.audit(who, 'conflict_check', 'conflict_check', check.id, { query: q, hits: hits.length, status: check.status });
    })();
    return check;
  }

  updateConflictCheck(id: Id, patch: { status?: ConflictStatus; matterId?: Id | null }, actor: string): void {
    const who = normalizeInitials(actor);
    if (patch.status !== undefined && !CONFLICT_STATUSES.includes(patch.status)) throw new Error('Statut invalide.');
    this.db.transaction(() => {
      const prev = this.db.prepare('SELECT status, matter_id FROM conflict_checks WHERE id = ?').get(id) as Row | undefined;
      if (!prev) throw new Error('Vérification introuvable.');
      const status = patch.status ?? prev.status;
      const matterId = patch.matterId === undefined ? prev.matter_id : patch.matterId;
      if (matterId && !this.db.prepare('SELECT 1 FROM matters WHERE id = ?').get(matterId)) throw new Error('Dossier introuvable.');
      this.db
        .prepare('UPDATE conflict_checks SET status = ?, matter_id = ?, updated_at = ?, updated_by = ? WHERE id = ?')
        .run(status, matterId, new Date().toISOString(), who, id);
      this.audit(who, 'update_conflict_check', 'conflict_check', id, {
        from: { status: prev.status, matterId: prev.matter_id },
        to: { status, matterId },
      });
    })();
  }

  setMatterStage(id: Id, stage: PipelineStage): void {
    if (!PIPELINE_STAGES.includes(stage)) throw new Error(`Étape inconnue : ${stage}`);
    this.db.transaction(() => {
      const prev = this.db.prepare('SELECT stage FROM matters WHERE id = ?').get(id) as Row | undefined;
      if (!prev) throw new Error('Dossier introuvable.');
      this.db.prepare('UPDATE matters SET stage = ? WHERE id = ?').run(stage, id);
      this.audit('local', 'set_stage', 'matter', id, { from: prev.stage, to: stage });
    })();
  }

  addTimeEntry(e: NewTimeEntry): TimeEntry {
    const minutes = roundBillableMinutes(e.minutes);
    const description = e.description.trim();
    if (!description) throw new Error('Description requise.');
    const matter = this.db.prepare('SELECT id FROM matters WHERE id = ?').get(e.matterId);
    if (!matter) throw new Error('Dossier introuvable.');
    const staff = this.db.prepare('SELECT hourly_rate_cents FROM staff WHERE id = ?').get(e.staffId) as Row | undefined;
    if (!staff) throw new Error('Collaborateur introuvable.');
    // Construction explicite : aucun champ supplémentaire de l'appelant (id, statut…) n'est repris.
    const entry: TimeEntry = {
      id: `t-${crypto.randomUUID()}`,
      matterId: e.matterId,
      staffId: e.staffId,
      date: e.date,
      billable: Boolean(e.billable),
      description,
      minutes,
      // Taux figé : une hausse ultérieure du taux du collaborateur ne modifie pas cette entrée.
      rateCents: staff.hourly_rate_cents,
      status: 'wip',
    };
    this.db
      .prepare(
        `INSERT INTO time_entries (id, matter_id, staff_id, date, minutes, rate_cents, billable, description, status)
         VALUES (@id, @matterId, @staffId, @date, @minutes, @rateCents, @billable, @description, @status)`,
      )
      .run({ ...entry, billable: entry.billable ? 1 : 0 });
    return entry;
  }

  setTimeEntryStatus(id: Id, status: TimeEntryStatus, actor: string): void {
    const who = normalizeInitials(actor);
    this.db.transaction(() => {
      const row = this.db.prepare('SELECT status FROM time_entries WHERE id = ?').get(id) as Row | undefined;
      if (!row) throw new Error('Entrée de temps introuvable.');
      assertStatusTransition(row.status, status);
      this.db.prepare('UPDATE time_entries SET status = ? WHERE id = ?').run(status, id);
      this.audit(who, 'set_time_status', 'time_entry', id, { from: row.status, to: status });
    })();
  }

  /** Remplace toutes les données par le jeu de démonstration. */
  seed(today: string): void {
    const s = buildDemoSnapshot(today);
    this.db.transaction(() => {
      for (const t of ['audit_log', 'conflict_checks', 'documents', 'invoices', 'time_entries', 'deadlines',
        'matter_parties', 'matter_team', 'matters', 'parties', 'staff', 'practice_areas', 'settings']) {
        this.db.prepare(`DELETE FROM ${t}`).run();
      }
      const ins = (sql: string) => this.db.prepare(sql);
      ins("INSERT INTO settings (key, value) VALUES ('firm_name', ?)").run(s.firmName);
      const pa = ins('INSERT INTO practice_areas VALUES (@id, @code, @name, @color, @gridX, @gridZ)');
      s.practiceAreas.forEach((r) => pa.run(r));
      const st = ins(`INSERT INTO staff (id, name, initials, role, practice_area_id, hourly_rate_cents, cost_rate_cents, target_hours_week)
        VALUES (@id, @name, @initials, @role, @practiceAreaId, @hourlyRateCents, @costRateCents, @targetHoursWeek)`);
      s.staff.forEach((r) => st.run(r));
      const p = ins('INSERT INTO parties VALUES (?, ?, ?, ?)');
      s.parties.forEach((r) => p.run(r.id, r.name, r.kind, JSON.stringify(r.aliases)));
      const m = ins(`INSERT INTO matters VALUES (@id, @number, @title, @clientId, @practiceAreaId, @responsibleId, @stage,
        @status, @jurisdiction, @court, @courtFileNumber, @feeArrangement, @budgetCents, @openedAt)`);
      const mt = ins('INSERT INTO matter_team VALUES (?, ?)');
      s.matters.forEach((r) => {
        m.run(r);
        r.teamIds.forEach((sid) => mt.run(r.id, sid));
      });
      const mp = ins('INSERT INTO matter_parties VALUES (?, ?, ?)');
      s.matterParties.forEach((r) => mp.run(r.matterId, r.partyId, r.role));
      const d = ins(`INSERT INTO deadlines VALUES (@id, @matterId, @kind, @title, @dueDate, @legalBasis, @ruleId,
        @triggerDate, @assignedTo, @status, @acknowledgedAt, @acknowledgedBy, @completedAt)`);
      s.deadlines.forEach((r) => d.run(r));
      const t = ins(`INSERT INTO time_entries VALUES (@id, @matterId, @staffId, @date, @minutes, @rateCents, @billable,
        @description, @status)`);
      s.timeEntries.forEach((r) => t.run({ ...r, billable: r.billable ? 1 : 0 }));
      const iv = ins('INSERT INTO invoices VALUES (@id, @matterId, @number, @issuedAt, @standardValueCents, @amountCents, @paidCents)');
      s.invoices.forEach((r) => iv.run(r));
      const doc = ins('INSERT INTO documents VALUES (@id, @matterId, @title, @category, @exhibit, @filePath, @addedAt)');
      s.documents.forEach((r) => doc.run(r));
      const cc = ins(`INSERT INTO conflict_checks (id, query, performed_by, performed_at, results_json, status, matter_id, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      s.conflictChecks.forEach((c) =>
        cc.run(c.id, c.query, c.performedBy, c.performedAt, JSON.stringify(c.hits), c.status, c.matterId, c.updatedAt, c.updatedBy),
      );
    })();
  }
}
