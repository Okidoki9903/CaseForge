/**
 * Implémentation de démonstration pour le navigateur : persistance dans IndexedDB.
 * Les données restent dans le navigateur de l'utilisateur ; rien n'est transmis.
 */
import type { CaseForgeApi } from '@shared/api';
import type { FirmSnapshot, TimeEntry } from '@shared/types';
import { buildDemoSnapshot } from '@shared/seed';
import { localToday } from '@shared/domain/dates';
import { assertStatusTransition, roundBillableMinutes } from '@shared/domain/time';
import { normalizeInitials } from '@shared/domain/validation';
import { initialConflictStatus, normalizeName, searchConflicts, toCheckHits } from '@shared/domain/conflicts';
import { CONFLICT_STATUSES, PIPELINE_STAGES, type ConflictCheck, type Deadline, type Matter, type Staff } from '@shared/types';
import { buildDeadline, findPartyByName, nextMatterNumber, normalizeNewMatter, partyKindFor } from '@shared/domain/matters';
import { emptyFirmSnapshot, normalizeSettingsPatch, normalizeStaffInput } from '@shared/domain/firm';

const DB_NAME = 'caseforge-demo';
const STORE = 'kv';
const KEY = 'snapshot';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function read(): Promise<FirmSnapshot | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result as FirmSnapshot | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function write(s: FirmSnapshot): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(s, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function createDemoApi(): CaseForgeApi {
  // Repli en mémoire si IndexedDB est indisponible (navigation privée stricte).
  let memory: FirmSnapshot | undefined;

  const load = async (): Promise<FirmSnapshot> => {
    try {
      memory = (await read()) ?? memory;
    } catch {
      /* IndexedDB indisponible : on reste en mémoire */
    }
    if (!memory) {
      memory = buildDemoSnapshot(localToday());
      await save(memory);
    }
    // Données enregistrées par une version antérieure : champs ajoutés depuis.
    memory.conflictChecks ??= [];
    memory.auditLog ??= [];
    // Versions antérieures : nom du cabinet à la racine, collaborateurs sans statut actif.
    const legacy = memory as FirmSnapshot & { firmName?: string };
    if (!memory.settings) {
      memory.settings = { firmName: legacy.firmName ?? 'Cabinet Démo s.e.n.c.r.l.', jurisdictions: ['QC', 'ON', 'FED'], defaultRateCents: 32_500, onboarded: false, demo: true };
    }
    memory.staff.forEach((p) => (p.active ??= true));
    return memory;
  };
  const save = async (s: FirmSnapshot) => {
    memory = s;
    try {
      await write(s);
    } catch {
      /* mémoire seulement */
    }
  };
  /** Journal d'audit (même format que la table SQLite `audit_log`). */
  const audit = (s: FirmSnapshot, actor: string, action: string, entity: string, entityId: string, details: Record<string, unknown> = {}) => {
    const id = (s.auditLog[0]?.id ?? 0) + 1;
    s.auditLog.unshift({ id, at: new Date().toISOString(), actor, action, entity, entityId, details });
    s.auditLog.length = Math.min(s.auditLog.length, 500);
  };
  const mutate = async (fn: (s: FirmSnapshot) => void) => {
    const s = structuredClone(await load());
    fn(s);
    await save(s);
  };

  return {
    storage: 'indexeddb',
    getSnapshot: load,
    acknowledgeDeadline: (id, initials) =>
      mutate((s) => {
        const d = s.deadlines.find((x) => x.id === id && x.status === 'ouvert');
        if (!d) throw new Error('Échéance introuvable ou déjà fermée.');
        d.acknowledgedBy = normalizeInitials(initials);
        d.acknowledgedAt = new Date().toISOString();
        audit(s, d.acknowledgedBy, 'acknowledge', 'deadline', id);
      }),
    completeDeadline: (id, initials) =>
      mutate((s) => {
        const who = normalizeInitials(initials);
        const d = s.deadlines.find((x) => x.id === id && x.status === 'ouvert');
        if (!d) throw new Error('Échéance introuvable ou déjà fermée.');
        d.status = 'complete';
        d.completedAt = new Date().toISOString();
        audit(s, who, 'complete', 'deadline', id);
      }),
    setMatterStage: (id, stage, actor) =>
      mutate((s) => {
        const who = normalizeInitials(actor);
        if (!PIPELINE_STAGES.includes(stage)) throw new Error(`Étape inconnue : ${stage}`);
        const m = s.matters.find((x) => x.id === id);
        if (!m) throw new Error('Dossier introuvable.');
        if (m.stage === stage) return;
        audit(s, who, 'set_stage', 'matter', id, { from: m.stage, to: stage });
        m.stage = stage;
      }),
    addTimeEntry: async (e) => {
      let created: TimeEntry | undefined;
      await mutate((s) => {
        const minutes = roundBillableMinutes(e.minutes);
        const description = e.description.trim();
        if (!description) throw new Error('Description requise.');
        if (!s.matters.some((m) => m.id === e.matterId)) throw new Error('Dossier introuvable.');
        const staff = s.staff.find((x) => x.id === e.staffId && x.active);
        if (!staff) throw new Error('Collaborateur introuvable ou inactif.');
        created = {
          id: `t-${crypto.randomUUID()}`,
          matterId: e.matterId,
          staffId: e.staffId,
          date: e.date,
          billable: Boolean(e.billable),
          description,
          minutes,
          rateCents: staff.hourlyRateCents,
          status: 'wip',
        };
        s.timeEntries.push(created);
      });
      return created!;
    },
    setTimeEntryStatus: (id, status, actor) =>
      mutate((s) => {
        const who = normalizeInitials(actor);
        const t = s.timeEntries.find((x) => x.id === id);
        if (!t) throw new Error('Entrée de temps introuvable.');
        assertStatusTransition(t.status, status);
        audit(s, who, 'set_time_status', 'time_entry', id, { from: t.status, to: status });
        t.status = status;
      }),
    saveTextFile: async (name, content) => {
      // Téléchargement local (Blob) : aucune donnée n'est transmise.
      const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    },
    savePdf: async (_name, html) => {
      // Navigateur : impression du document (l'utilisateur choisit « Enregistrer en PDF »).
      const w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), '_blank');
      if (!w) throw new Error('Fenêtre bloquée par le navigateur : autorisez les fenêtres pour imprimer.');
      w.addEventListener('load', () => w.print(), { once: true });
      return true;
    },
    recordConflictCheck: async (query, actor, matterId = null) => {
      let created: ConflictCheck | undefined;
      await mutate((s) => {
        const who = normalizeInitials(actor);
        const q = query.trim().slice(0, 300);
        if (normalizeName(q).length === 0) throw new Error('Recherche vide.');
        if (matterId && !s.matters.some((m) => m.id === matterId)) throw new Error('Dossier introuvable.');
        const hits = toCheckHits(searchConflicts(q, s));
        created = {
          id: `cc-${crypto.randomUUID()}`, query: q, performedBy: who, performedAt: new Date().toISOString(),
          status: initialConflictStatus(hits), matterId, hits, updatedAt: null, updatedBy: null,
        };
        s.conflictChecks.unshift(created);
        audit(s, who, 'conflict_check', 'conflict_check', created.id, { query: q, hits: hits.length, status: created.status });
      });
      return created!;
    },
    updateConflictCheck: (id, patch, actor) =>
      mutate((s) => {
        const who = normalizeInitials(actor);
        const c = s.conflictChecks.find((x) => x.id === id);
        if (!c) throw new Error('Vérification introuvable.');
        const from = { status: c.status, matterId: c.matterId };
        if (patch.status !== undefined) {
          if (!CONFLICT_STATUSES.includes(patch.status)) throw new Error('Statut invalide.');
          c.status = patch.status;
        }
        if (patch.matterId !== undefined) {
          if (patch.matterId && !s.matters.some((m) => m.id === patch.matterId)) throw new Error('Dossier introuvable.');
          c.matterId = patch.matterId;
        }
        c.updatedAt = new Date().toISOString();
        c.updatedBy = who;
        audit(s, who, 'update_conflict_check', 'conflict_check', id, { from, to: { status: c.status, matterId: c.matterId } });
      }),
    resetDemoData: () => {
      const s = buildDemoSnapshot(localToday());
      s.settings.onboarded = true;
      return save(s);
    },
    updateSettings: (patch, actor) =>
      mutate((s) => {
        const clean = normalizeSettingsPatch(patch);
        const who = actor ? normalizeInitials(actor) : 'local';
        s.settings = { ...s.settings, ...clean };
        audit(s, who, 'update_settings', 'settings', 'firm', clean);
      }),
    saveStaff: async (input, actor) => {
      let saved: Staff | undefined;
      await mutate((s) => {
        const who = normalizeInitials(actor);
        const clean = normalizeStaffInput(input, s.staff, s.practiceAreas.map((a) => a.id));
        const existing = input.id ? s.staff.find((p) => p.id === input.id) : undefined;
        if (input.id && !existing) throw new Error('Collaborateur introuvable.');
        saved = { id: existing?.id ?? `st-${crypto.randomUUID()}`, active: existing?.active ?? true, ...clean };
        s.staff = existing ? s.staff.map((p) => (p.id === saved!.id ? saved! : p)) : [...s.staff, saved];
        audit(s, who, existing ? 'update_staff' : 'create_staff', 'staff', saved.id);
      });
      return saved!;
    },
    setStaffActive: (id, active, actor) =>
      mutate((s) => {
        const who = normalizeInitials(actor);
        const p = s.staff.find((x) => x.id === id);
        if (!p) throw new Error('Collaborateur introuvable.');
        if (!active && !s.staff.some((x) => x.active && x.id !== id)) throw new Error('Le cabinet doit conserver au moins un collaborateur actif.');
        p.active = active;
        audit(s, who, active ? 'activate_staff' : 'deactivate_staff', 'staff', id);
      }),
    createMatter: async (input, actor) => {
      let created: Matter | undefined;
      await mutate((s) => {
        const who = normalizeInitials(actor);
        const clean = normalizeNewMatter(input, s);
        const today = localToday();
        const checks = [
          { name: clean.clientName, as: 'client' as const },
          ...clean.adverseNames.map((name) => ({ name, as: 'adverse' as const })),
        ].map(({ name, as }) => {
          const hits = toCheckHits(searchConflicts(name, s));
          return { name, hits, status: initialConflictStatus(hits, as) };
        });
        const ensureParty = (name: string) => {
          const existing = findPartyByName(s, name);
          if (existing) return existing;
          const id = `p-${crypto.randomUUID()}`;
          s.parties.push({ id, name, kind: partyKindFor(name), aliases: [] });
          return id;
        };
        const m: Matter = {
          id: `m-${crypto.randomUUID()}`, number: nextMatterNumber(s.matters, today.slice(0, 4)), title: clean.title,
          clientId: ensureParty(clean.clientName), practiceAreaId: clean.practiceAreaId, responsibleId: clean.responsibleId,
          teamIds: [], stage: 'ouverture', status: 'actif', jurisdiction: clean.jurisdiction, court: null, courtFileNumber: null,
          feeArrangement: clean.feeArrangement, budgetCents: clean.budgetCents, openedAt: today,
        };
        s.matters.push(m);
        s.matterParties.push({ matterId: m.id, partyId: m.clientId, role: 'client' });
        clean.adverseNames.forEach((n) => s.matterParties.push({ matterId: m.id, partyId: ensureParty(n), role: 'adverse' }));
        for (const c of checks) {
          const check: ConflictCheck = {
            id: `cc-${crypto.randomUUID()}`, query: c.name, performedBy: who, performedAt: new Date().toISOString(),
            status: c.status, matterId: m.id, hits: c.hits, updatedAt: null, updatedBy: null,
          };
          s.conflictChecks.unshift(check);
          audit(s, who, 'conflict_check', 'conflict_check', check.id, { query: c.name, hits: c.hits.length, status: c.status });
        }
        audit(s, who, 'create_matter', 'matter', m.id, { number: m.number, title: m.title });
        created = m;
      });
      return created!;
    },
    addDeadline: async (input, actor) => {
      let created: Deadline | undefined;
      await mutate((s) => {
        const who = normalizeInitials(actor);
        const d = buildDeadline(input, s, `d-${crypto.randomUUID()}`);
        s.deadlines.push(d);
        audit(s, who, 'add_deadline', 'deadline', d.id, { matterId: d.matterId, dueDate: d.dueDate, ruleId: d.ruleId });
        created = d;
      });
      return created!;
    },
    createEmptyFirm: async (input) => {
      const s = emptyFirmSnapshot(input);
      audit(s, s.staff[0].initials, 'create_firm', 'settings', 'firm', { firmName: s.settings.firmName });
      await save(s);
      return s.staff[0];
    },
  };
}
