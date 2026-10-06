/**
 * Contrat entre l'interface et la couche de données.
 *
 * Deux implémentations, toutes deux strictement locales :
 *  - Electron : SQLite (better-sqlite3) dans le processus principal, via IPC.
 *  - Mode démo navigateur : IndexedDB.
 */
import type {
  ConflictCheck, ConflictStatus, FirmSnapshot, Id, NewTimeEntry, PipelineStage, TimeEntry, TimeEntryStatus,
} from './types';

export interface CaseForgeApi {
  /** Indique le moteur de stockage, affiché dans l'interface pour la transparence. */
  readonly storage: 'sqlite' | 'indexeddb';
  getSnapshot(): Promise<FirmSnapshot>;
  /** Accusé de réception d'une alerte d'échéance (journalisé). */
  acknowledgeDeadline(deadlineId: Id, initials: string): Promise<void>;
  completeDeadline(deadlineId: Id): Promise<void>;
  setMatterStage(matterId: Id, stage: PipelineStage): Promise<void>;
  /** Durée arrondie au dixième d'heure supérieur ; taux du collaborateur figé à la saisie. */
  addTimeEntry(entry: NewTimeEntry): Promise<TimeEntry>;
  /** wip → facture | radie, ou retour à wip ; journalisé avec les initiales de l'auteur. */
  setTimeEntryStatus(entryId: Id, status: TimeEntryStatus, actor: string): Promise<void>;
  /**
   * Enregistre un fichier texte sur le poste (boîte de dialogue native dans Electron,
   * téléchargement local dans le navigateur). Retourne false si l'utilisateur annule.
   */
  saveTextFile(suggestedName: string, content: string): Promise<boolean>;
  /**
   * Exécute ET enregistre une vérification de conflits. La recherche est refaite par la
   * couche de données sur ses propres données (la trace ne dépend pas de l'interface).
   */
  recordConflictCheck(query: string, actor: string, matterId?: Id | null): Promise<ConflictCheck>;
  /** Change le statut et/ou le dossier visé d'une vérification ; journalisé. */
  updateConflictCheck(id: Id, patch: { status?: ConflictStatus; matterId?: Id | null }, actor: string): Promise<void>;
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
  setTimeEntryStatus: 'cf:setTimeEntryStatus',
  saveTextFile: 'cf:saveTextFile',
  recordConflictCheck: 'cf:recordConflictCheck',
  updateConflictCheck: 'cf:updateConflictCheck',
  resetDemoData: 'cf:resetDemoData',
} as const;
