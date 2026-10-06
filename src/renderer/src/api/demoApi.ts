/**
 * Implémentation de démonstration pour le navigateur : persistance dans IndexedDB.
 * Les données restent dans le navigateur de l'utilisateur ; rien n'est transmis.
 */
import type { CaseForgeApi } from '@shared/api';
import type { FirmSnapshot, TimeEntry } from '@shared/types';
import { buildDemoSnapshot } from '@shared/seed';
import { localToday } from '@shared/domain/dates';

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
        d.acknowledgedAt = new Date().toISOString();
        d.acknowledgedBy = initials.trim().toUpperCase();
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
        const staff = s.staff.find((x) => x.id === e.staffId);
        if (!staff) throw new Error('Collaborateur introuvable.');
        created = { id: `t-${crypto.randomUUID()}`, ...e, rateCents: staff.hourlyRateCents, status: 'wip' };
        s.timeEntries.push(created);
      });
      return created!;
    },
    resetDemoData: () => save(buildDemoSnapshot(localToday())),
  };
}
