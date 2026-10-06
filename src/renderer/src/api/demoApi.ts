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
      }),
    completeDeadline: (id) =>
      mutate((s) => {
        const d = s.deadlines.find((x) => x.id === id && x.status === 'ouvert');
        if (!d) throw new Error('Échéance introuvable ou déjà fermée.');
        d.status = 'complete';
        d.completedAt = new Date().toISOString();
      }),
    setMatterStage: (id, stage) =>
      mutate((s) => {
        const m = s.matters.find((x) => x.id === id);
        if (!m) throw new Error('Dossier introuvable.');
        m.stage = stage;
      }),
    addTimeEntry: async (e) => {
      let created: TimeEntry | undefined;
      await mutate((s) => {
        const minutes = roundBillableMinutes(e.minutes);
        const description = e.description.trim();
        if (!description) throw new Error('Description requise.');
        if (!s.matters.some((m) => m.id === e.matterId)) throw new Error('Dossier introuvable.');
        const staff = s.staff.find((x) => x.id === e.staffId);
        if (!staff) throw new Error('Collaborateur introuvable.');
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
        normalizeInitials(actor);
        const t = s.timeEntries.find((x) => x.id === id);
        if (!t) throw new Error('Entrée de temps introuvable.');
        assertStatusTransition(t.status, status);
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
    resetDemoData: () => save(buildDemoSnapshot(localToday())),
  };
}
