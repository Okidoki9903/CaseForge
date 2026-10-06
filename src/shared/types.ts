/**
 * Modèle de domaine CaseForge.
 *
 * Conventions :
 *  - Les dates « calendrier » sont des chaînes ISO `AAAA-MM-JJ` (pas de fuseau horaire :
 *    un délai juridique tombe un jour donné, pas à un instant UTC).
 *  - Les horodatages sont des chaînes ISO 8601 complètes.
 *  - Les montants sont en cents (entiers) pour éviter les erreurs d'arrondi.
 *  - Les durées de travail sont en minutes.
 */

export type IsoDate = string;
export type IsoDateTime = string;
export type Id = string;

/** Ressorts dont le calendrier judiciaire est géré. */
export type Jurisdiction = 'QC' | 'ON' | 'FED' | 'BC' | 'AB' | 'MB' | 'SK' | 'NS' | 'NB' | 'NL' | 'PE';

/** Pipeline de production juridique, dans l'ordre. */
export const PIPELINE_STAGES = [
  'ouverture',
  'conflits',
  'recherche',
  'redaction',
  'revision',
  'depot',
  'audience',
  'cloture',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type StaffRole = 'associe' | 'avocat' | 'stagiaire' | 'parajuriste' | 'adjoint';
export type FeeArrangement = 'horaire' | 'forfait' | 'contingence';
export type MatterStatus = 'actif' | 'en_attente' | 'ferme';
export type DeadlineKind = 'prescription' | 'procedure' | 'audience' | 'interne';
export type DeadlineStatus = 'ouvert' | 'complete' | 'annule';
export type PartyRole = 'client' | 'adverse' | 'liee' | 'avocat_adverse' | 'tribunal';
export type TimeEntryStatus = 'wip' | 'facture' | 'radie';
export type DocumentCategory = 'procedure' | 'piece' | 'correspondance' | 'note' | 'jugement';

/** Pôle / département = bâtiment sur la carte. */
export interface PracticeArea {
  id: Id;
  code: string;
  name: string;
  color: string;
  /** Position du bâtiment sur la grille du campus. */
  gridX: number;
  gridZ: number;
}

/** Collaborateur = unité assignable. */
export interface Staff {
  id: Id;
  name: string;
  initials: string;
  role: StaffRole;
  practiceAreaId: Id;
  hourlyRateCents: number;
  /** Coût horaire interne (salaire chargé), pour la rentabilité. */
  costRateCents: number;
  targetHoursWeek: number;
}

/** Personne ou entité connue du cabinet (clients, parties adverses, tribunaux…). */
export interface Party {
  id: Id;
  name: string;
  kind: 'personne' | 'entreprise' | 'tribunal';
  /** Autres noms connus : ancienne raison sociale, nom de jeune fille, nom commercial. */
  aliases: string[];
}

export interface Matter {
  id: Id;
  number: string;
  title: string;
  clientId: Id;
  practiceAreaId: Id;
  responsibleId: Id;
  teamIds: Id[];
  stage: PipelineStage;
  status: MatterStatus;
  jurisdiction: Jurisdiction;
  court: string | null;
  courtFileNumber: string | null;
  feeArrangement: FeeArrangement;
  budgetCents: number;
  openedAt: IsoDate;
}

/** Lien entre un dossier et une partie (rôle dans ce dossier). */
export interface MatterParty {
  matterId: Id;
  partyId: Id;
  role: PartyRole;
}

export interface Deadline {
  id: Id;
  matterId: Id;
  kind: DeadlineKind;
  title: string;
  dueDate: IsoDate;
  /** Référence légale (ex. « art. 2925 C.c.Q. »), affichée pour vérification. */
  legalBasis: string | null;
  /** Règle de calcul utilisée, le cas échéant. */
  ruleId: string | null;
  /** Date déclencheuse (signification, jugement, connaissance du préjudice…). */
  triggerDate: IsoDate | null;
  assignedTo: Id;
  status: DeadlineStatus;
  acknowledgedAt: IsoDateTime | null;
  acknowledgedBy: string | null;
  completedAt: IsoDateTime | null;
}

export interface TimeEntry {
  id: Id;
  matterId: Id;
  staffId: Id;
  date: IsoDate;
  minutes: number;
  rateCents: number;
  billable: boolean;
  description: string;
  status: TimeEntryStatus;
}

export interface Invoice {
  id: Id;
  matterId: Id;
  number: string;
  issuedAt: IsoDate;
  /** Valeur au taux standard du travail facturé. */
  standardValueCents: number;
  amountCents: number;
  paidCents: number;
}

export interface MatterDocument {
  id: Id;
  matterId: Id;
  title: string;
  category: DocumentCategory;
  /** Cote de la pièce (P-1, D-3…) le cas échéant. */
  exhibit: string | null;
  /** Chemin local du fichier (jamais téléversé). */
  filePath: string | null;
  addedAt: IsoDate;
}

/** Statuts d'une vérification de conflits. */
export const CONFLICT_STATUSES = ['en_cours', 'clair', 'potentiel', 'confirme'] as const;
export type ConflictStatus = (typeof CONFLICT_STATUSES)[number];

/** Correspondance trouvée lors d'une vérification (figée au moment de la recherche). */
export interface ConflictCheckHit {
  partyId: Id;
  partyName: string;
  matchedName: string;
  score: number;
  roles: { matterId: Id; role: PartyRole }[];
}

/** Trace d'une vérification de conflits (preuve de diligence). */
export interface ConflictCheck {
  id: Id;
  query: string;
  performedBy: string;
  performedAt: IsoDateTime;
  status: ConflictStatus;
  /** Dossier visé par la vérification (ex. ouverture d'un nouveau mandat), facultatif. */
  matterId: Id | null;
  hits: ConflictCheckHit[];
  updatedAt: IsoDateTime | null;
  updatedBy: string | null;
}

/** Entrée du journal d'audit : qui a fait quoi, quand. */
export interface AuditEntry {
  id: number;
  at: IsoDateTime;
  actor: string;
  action: string;
  entity: string;
  entityId: Id;
  details: Record<string, unknown>;
}

/** Instantané complet des données : un cabinet de taille petite/moyenne tient en mémoire. */
export interface FirmSnapshot {
  firmName: string;
  practiceAreas: PracticeArea[];
  staff: Staff[];
  parties: Party[];
  matters: Matter[];
  matterParties: MatterParty[];
  deadlines: Deadline[];
  timeEntries: TimeEntry[];
  invoices: Invoice[];
  documents: MatterDocument[];
  conflictChecks: ConflictCheck[];
  /** Entrées d'audit les plus récentes (les plus récentes d'abord). */
  auditLog: AuditEntry[];
}

/** Entrée de saisie de temps (sans id ni statut). */
export interface NewTimeEntry {
  matterId: Id;
  staffId: Id;
  date: IsoDate;
  minutes: number;
  billable: boolean;
  description: string;
}
