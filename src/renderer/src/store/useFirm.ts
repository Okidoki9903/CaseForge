/**
 * État global de l'interface (Zustand).
 * Les données métier viennent de l'API locale ; les valeurs dérivées (alertes, indicateurs)
 * sont recalculées dans `useDerived` à partir de l'instantané.
 */
import { create } from 'zustand';
import type { FirmSnapshot, Id, PipelineStage } from '@shared/types';
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
  logMinutes: (matterId: Id, minutes: number, description: string) => Promise<void>;
  startTimer: (matterId: Id) => void;
  stopTimer: () => Promise<void>;
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
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      set({ snapshot: await api.getSnapshot(), error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
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

    load: () => run(async () => set({ today: localToday() })),
    select: (selection) => set({ selection }),
    hover: (hovered) => set({ hovered }),
    setStageFilter: (stageFilter) => set({ stageFilter }),
    setAlertCenterOpen: (alertCenterOpen) => set({ alertCenterOpen }),
    setConflictOpen: (conflictOpen) => set({ conflictOpen }),
    setCurrentStaff: (id) => {
      pref.set('cf.staff', id);
      set({ currentStaffId: id });
    },
    acknowledge: (id, initials) => run(() => api.acknowledgeDeadline(id, initials)),
    complete: (id) => run(() => api.completeDeadline(id)),
    setStage: (id, stage) => run(() => api.setMatterStage(id, stage)),
    logMinutes: (matterId, minutes, description) =>
      run(() =>
        api.addTimeEntry({ matterId, staffId: get().currentStaffId, date: localToday(), minutes, billable: true, description }),
      ),
    startTimer: (matterId) => {
      const timer = { matterId, startedAt: Date.now() };
      pref.set('cf.timer', timer);
      set({ timer });
    },
    stopTimer: async () => {
      const t = get().timer;
      if (!t) return;
      pref.set('cf.timer', null);
      set({ timer: null });
      // Arrondi au dixième d'heure supérieur (6 minutes), usage courant au Canada.
      const minutes = Math.max(6, Math.ceil((Date.now() - t.startedAt) / 60000 / 6) * 6);
      await get().logMinutes(t.matterId, minutes, 'Chronomètre');
    },
    resetDemo: () => run(() => api.resetDemoData()),
  };
});
