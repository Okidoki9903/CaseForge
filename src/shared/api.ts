/**
 * Contrat entre l'interface et la couche de données.
 *
 * Deux implémentations, toutes deux strictement locales :
 *  - Electron : SQLite (better-sqlite3) dans le processus principal, via IPC.
 *  - Mode démo navigateur : IndexedDB.
 */
import type { FirmSnapshot, Id, NewTimeEntry, PipelineStage, TimeEntry } from './types';

export interface CaseForgeApi {
  /** Indique le moteur de stockage, affiché dans l'interface pour la transparence. */
  readonly storage: 'sqlite' | 'indexeddb';
  getSnapshot(): Promise<FirmSnapshot>;
  /** Accusé de réception d'une alerte d'échéance (journalisé). */
  acknowledgeDeadline(deadlineId: Id, initials: string): Promise<void>;
  completeDeadline(deadlineId: Id): Promise<void>;
  setMatterStage(matterId: Id, stage: PipelineStage): Promise<void>;
  addTimeEntry(entry: NewTimeEntry): Promise<TimeEntry>;
  /** Remet les données de démonstration à zéro. */
  resetDemoData(): Promise<void>;
}

/** Canaux IPC (préfixés pour éviter toute collision). */
export const IPC = {
  getSnapshot: 'cf:getSnapshot',
  acknowledgeDeadline: 'cf:acknowledgeDeadline',
  completeDeadline: 'cf:completeDeadline',
  setMatterStage: 'cf:setMatterStage',
  addTimeEntry: 'cf:addTimeEntry',
  resetDemoData: 'cf:resetDemoData',
} as const;
