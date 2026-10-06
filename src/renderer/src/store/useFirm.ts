/**
 * État global de l'interface (Zustand).
 * Les données métier viennent de l'API locale ; les valeurs dérivées (alertes, indicateurs)
 * sont recalculées dans `useDerived` à partir de l'instantané.
 */
import { create } from 'zustand';
import type { ConflictCheck, ConflictStatus, FirmSnapshot, Id, PipelineStage, TimeEntry, TimeEntryStatus } from '@shared/types';
import { timeEntriesToCsv } from '@shared/domain/time';
import { localToday } from '@shared/domain/dates';
import { api } from '../api';

export type Selection =
  | { kind: 'matter'; id: Id }
  | { kind: 'area'; id: Id }
  | { kind: 'staff'; id: Id }
  | { kind: 'party'; id: Id }
  | null;

export interface RunningTimer {
  matterId: Id;
  startedAt: number;
}

interface FirmState {
  snapshot: FirmSnapshot | null;
  today: string;
  error: string | null;
  selection: Selection;
  hovered: Selection;
  stageFilter: PipelineStage | null;
  alertCenterOpen: boolean;
  conflictOpen: boolean;
  currentStaffId: Id;
  timer: RunningTimer | null;

  load: () => Promise<void>;
  select: (s: Selection) => void;
  hover: (s: Selection) => void;
  setStageFilter: (s: PipelineStage | null) => void;
  setAlertCenterOpen: (open: boolean) => void;
  setConflictOpen: (open: boolean) => void;
  setCurrentStaff: (id: Id) => void;
  acknowledge: (deadlineId: Id, initials: string) => Promise<void>;
  complete: (deadlineId: Id) => Promise<void>;
  setStage: (matterId: Id, stage: PipelineStage) => Promise<void>;
  /** Saisie de temps (durée brute en minutes, arrondie au dixième d'heure par la couche de données). */
  logMinutes: (matterId: Id, minutes: number, description: string, billable?: boolean) => Promise<boolean>;
  setTimeStatus: (entryId: Id, status: TimeEntryStatus) => Promise<void>;
  exportCsv: (entries: TimeEntry[], label: string) => Promise<void>;
  timeDrawerOpen: boolean;
  setTimeDrawerOpen: (open: boolean) => void;
  recordConflictCheck: (query: string, matterId?: Id | null) => Promise<ConflictCheck | null>;
  updateConflictCheck: (id: Id, patch: { status?: ConflictStatus; matterId?: Id | null }) => Promise<void>;
  /** Initiales de l'utilisateur de la session (auteur des actions journalisées). */
  actor: () => string;
  startTimer: (matterId: Id) => void;
  stopTimer: (description?: string) => Promise<void>;
  resetDemo: () => Promise<void>;
}

/** Préférences propres au poste (non critiques) : localStorage, avec repli silencieux. */
const pref = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignoré */
    }
  },
};

export const useFirm = create<FirmState>((set, get) => {
  /** Exécute une mutation puis recharge l'instantané ; les erreurs sont affichées. */
  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    try {
      await fn();
      set({ snapshot: await api.getSnapshot(), error: null });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  };

  return {
    snapshot: null,
    today: localToday(),
    error: null,
    selection: null,
    hovered: null,
    stageFilter: null,
    alertCenterOpen: false,
    conflictOpen: false,
    currentStaffId: pref.get('cf.staff', 'st-01'),
    timer: pref.get<RunningTimer | null>('cf.timer', null),

    timeDrawerOpen: false,

    load: async () => {
      await run(async () => set({ today: localToday() }));
    },
    actor: () => get().snapshot?.staff.find((p) => p.id === get().currentStaffId)?.initials ?? '',
    select: (selection) => set({ selection }),
    hover: (hovered) => set({ hovered }),
    setStageFilter: (stageFilter) => set({ stageFilter }),
    setAlertCenterOpen: (alertCenterOpen) => set(alertCenterOpen ? { alertCenterOpen, timeDrawerOpen: false } : { alertCenterOpen }),
    setConflictOpen: (conflictOpen) => set({ conflictOpen }),
    setCurrentStaff: (id) => {
      pref.set('cf.staff', id);
      set({ currentStaffId: id });
    },
    setTimeDrawerOpen: (timeDrawerOpen) => set(timeDrawerOpen ? { timeDrawerOpen, alertCenterOpen: false } : { timeDrawerOpen }),
    acknowledge: async (id, initials) => {
      await run(() => api.acknowledgeDeadline(id, initials));
    },
    complete: async (id) => {
      await run(() => api.completeDeadline(id));
    },
    setStage: async (id, stage) => {
      await run(() => api.setMatterStage(id, stage, get().actor()));
    },
    logMinutes: (matterId, minutes, description, billable = true) =>
      run(() =>
        api.addTimeEntry({ matterId, staffId: get().currentStaffId, date: localToday(), minutes, billable, description }),
      ),
    setTimeStatus: async (entryId, status) => {
      await run(() => api.setTimeEntryStatus(entryId, status, get().actor()));
    },
    exportCsv: async (entries, label) => {
      const s = get().snapshot;
      if (!s) return;
      try {
        await api.saveTextFile(`caseforge-temps-${label}-${localToday()}.csv`, timeEntriesToCsv(entries, s));
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    },
    startTimer: (matterId) => {
      const timer = { matterId, startedAt: Date.now() };
      pref.set('cf.timer', timer);
      set({ timer });
    },
    stopTimer: async (description) => {
      const t = get().timer;
      if (!t) return;
      pref.set('cf.timer', null);
      set({ timer: null });
      // Durée brute : la couche de données arrondit au dixième d'heure supérieur (6 min).
      const minutes = Math.max(0.01, (Date.now() - t.startedAt) / 60000);
      await get().logMinutes(t.matterId, minutes, description || 'Chronomètre');
    },
    recordConflictCheck: async (query, matterId = null) => {
      let check: ConflictCheck | null = null;
      await run(async () => {
        check = await api.recordConflictCheck(query, get().actor(), matterId);
      });
      return check;
    },
    updateConflictCheck: async (id, patch) => {
      await run(() => api.updateConflictCheck(id, patch, get().actor()));
    },
    resetDemo: async () => {
      await run(() => api.resetDemoData());
    },
  };
});
