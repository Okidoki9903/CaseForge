/**
 * Contrat entre l'interface et la couche de données.
 *
 * Deux implémentations, toutes deux strictement locales :
 *  - Electron : SQLite (better-sqlite3) dans le processus principal, via IPC.
 *  - Mode démo navigateur : IndexedDB.
 */
import type { NewDeadlineInput, NewMatterInput } from './domain/matters';
import type {
  Deadline, Matter, ConflictCheck, ConflictStatus, FirmSettings, FirmSnapshot, NewFirmInput, Staff, StaffInput, Id, NewTimeEntry, PipelineStage, TimeEntry, TimeEntryStatus,
} from './types';

export interface CaseForgeApi {
  /** Indique le moteur de stockage, affiché dans l'interface pour la transparence. */
  readonly storage: 'sqlite' | 'indexeddb';
  getSnapshot(): Promise<FirmSnapshot>;
  /** Accusé de réception d'une alerte d'échéance (journalisé). */
  acknowledgeDeadline(deadlineId: Id, initials: string): Promise<void>;
  /** Marque l'échéance comme faite ; exige aussi des initiales nominatives (journalisé). */
  completeDeadline(deadlineId: Id, initials: string): Promise<void>;
  /** Change l'étape du dossier ; journalisé avec les initiales de l'auteur (qui + quand). */
  setMatterStage(matterId: Id, stage: PipelineStage, actor: string): Promise<void>;
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
   * Convertit un document HTML autonome en PDF localement et l'enregistre (Electron :
   * printToPDF + boîte de dialogue ; navigateur : impression → « Enregistrer en PDF »).
   */
  savePdf(suggestedName: string, html: string): Promise<boolean>;
  /**
   * Exécute ET enregistre une vérification de conflits. La recherche est refaite par la
   * couche de données sur ses propres données (la trace ne dépend pas de l'interface).
   */
  recordConflictCheck(query: string, actor: string, matterId?: Id | null): Promise<ConflictCheck>;
  /** Change le statut et/ou le dossier visé d'une vérification ; journalisé. */
  updateConflictCheck(id: Id, patch: { status?: ConflictStatus; matterId?: Id | null }, actor: string): Promise<void>;
  /** Ouvre un dossier ; vérifie automatiquement les conflits (client et parties adverses). */
  createMatter(input: NewMatterInput, actor: string): Promise<Matter>;
  /** Ajoute une échéance (calculée par une règle du catalogue ou saisie directement). */
  addDeadline(input: NewDeadlineInput, actor: string): Promise<Deadline>;
  /** Met à jour les paramètres du cabinet (nom, ressorts, taux par défaut, accueil terminé). */
  updateSettings(patch: Partial<FirmSettings>, actor: string | null): Promise<void>;
  /** Crée ou modifie un collaborateur ; un nouveau taux ne vaut que pour les saisies futures. */
  saveStaff(input: StaffInput, actor: string): Promise<Staff>;
  /** Désactive (départ) ou réactive un collaborateur. */
  setStaffActive(staffId: Id, active: boolean, actor: string): Promise<void>;
  /** Remplace toutes les données par un cabinet vide ; retourne le premier collaborateur. */
  createEmptyFirm(input: NewFirmInput): Promise<Staff>;
  /** Remplace toutes les données par le cabinet de démonstration (fictif). */
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
  savePdf: 'cf:savePdf',
  recordConflictCheck: 'cf:recordConflictCheck',
  updateConflictCheck: 'cf:updateConflictCheck',
  resetDemoData: 'cf:resetDemoData',
  updateSettings: 'cf:updateSettings',
  saveStaff: 'cf:saveStaff',
  setStaffActive: 'cf:setStaffActive',
  createEmptyFirm: 'cf:createEmptyFirm',
  createMatter: 'cf:createMatter',
  addDeadline: 'cf:addDeadline',
} as const;
