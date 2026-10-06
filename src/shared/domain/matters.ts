/**
 * Ouverture d'un dossier et ajout d'une échéance : validations partagées SQLite / démo.
 */
import type {
  Deadline, DeadlineKind, FeeArrangement, FirmSnapshot, Id, IsoDate, Jurisdiction, Matter,
} from '../types';
import { ALL_JURISDICTIONS } from './firm';
import { computeDeadline, findRule } from './deadlineRules';
import { normalizeName } from './conflicts';

export interface NewMatterInput {
  title: string;
  clientName: string;
  /** Parties adverses connues à l'ouverture (vérifiées pour les conflits). */
  adverseNames: string[];
  practiceAreaId: Id;
  responsibleId: Id;
  jurisdiction: Jurisdiction;
  feeArrangement: FeeArrangement;
  budgetCents: number;
}

export interface NewDeadlineInput {
  matterId: Id;
  assignedTo: Id;
  /** Calcul par règle du catalogue… */
  ruleId?: string | null;
  triggerDate?: IsoDate | null;
  /** …ou saisie directe. */
  title?: string;
  kind?: DeadlineKind;
  dueDate?: IsoDate;
  legalBasis?: string | null;
}

const FEES: FeeArrangement[] = ['horaire', 'forfait', 'contingence'];
const KINDS: DeadlineKind[] = ['prescription', 'procedure', 'audience', 'interne'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const text = (v: unknown, label: string, max = 200) => {
  const s = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (s.length < 2 || s.length > max) throw new Error(`${label} invalide.`);
  return s;
};

export function normalizeNewMatter(input: NewMatterInput, s: FirmSnapshot): NewMatterInput {
  const area = s.practiceAreas.find((a) => a.id === input.practiceAreaId);
  if (!area) throw new Error('Pôle invalide.');
  if (!s.staff.some((p) => p.id === input.responsibleId && p.active)) throw new Error('Responsable invalide.');
  if (!ALL_JURISDICTIONS.includes(input.jurisdiction)) throw new Error('Ressort invalide.');
  if (!FEES.includes(input.feeArrangement)) throw new Error('Mode de rémunération invalide.');
  const budget = Number(input.budgetCents);
  if (!Number.isInteger(budget) || budget < 0 || budget > 1_000_000_000) throw new Error('Budget invalide.');
  return {
    ...input,
    title: text(input.title, 'Titre du dossier'),
    clientName: text(input.clientName, 'Nom du client', 160),
    adverseNames: (input.adverseNames ?? []).map((n) => n.trim()).filter(Boolean).slice(0, 20).map((n) => text(n, 'Partie adverse', 160)),
    budgetCents: budget,
  };
}

/** Personne ou entreprise, d'après la présence d'une forme juridique dans le nom. */
export function partyKindFor(name: string): 'personne' | 'entreprise' {
  return /\b(inc|lt[ée]e|ltd|llp|lp|corp|cie|limit[ée]e|soci[ée]t[ée]|groupe|s\.?e\.?n\.?c|s\.?a\.?)\b\.?/i.test(name) ? 'entreprise' : 'personne';
}

/** Numéro séquentiel par année : 2026-0001, 2026-0002… */
export function nextMatterNumber(matters: Pick<Matter, 'number'>[], year: string): string {
  const max = matters
    .map((m) => /^(\d{4})-(\d{4})$/.exec(m.number))
    .filter((r): r is RegExpExecArray => Boolean(r) && r![1] === year)
    .reduce((acc, r) => Math.max(acc, Number(r[2])), 0);
  return `${year}-${String(max + 1).padStart(4, '0')}`;
}

/** Partie existante portant exactement le même nom normalisé (évite les doublons). */
export function findPartyByName(s: FirmSnapshot, name: string): Id | undefined {
  const key = normalizeName(name).join(' ');
  return s.parties.find((p) => [p.name, ...p.aliases].some((n) => normalizeName(n).join(' ') === key))?.id;
}

/**
 * Échéance à créer. Avec une règle du catalogue, la date retenue est la date BRUTE
 * (avant report pour jour non juridique) : c'est la plus prudente.
 */
export function buildDeadline(input: NewDeadlineInput, s: FirmSnapshot, id: Id): Deadline {
  const matter = s.matters.find((m) => m.id === input.matterId);
  if (!matter) throw new Error('Dossier introuvable.');
  if (!s.staff.some((p) => p.id === input.assignedTo && p.active)) throw new Error('Responsable invalide.');
  const base = {
    id, matterId: matter.id, assignedTo: input.assignedTo, status: 'ouvert' as const,
    acknowledgedAt: null, acknowledgedBy: null, completedAt: null,
  };
  if (input.ruleId) {
    const rule = findRule(input.ruleId);
    if (!rule) throw new Error('Règle inconnue.');
    if (rule.jurisdiction !== matter.jurisdiction) throw new Error('Règle d’un autre ressort que le dossier.');
    if (!input.triggerDate || !ISO.test(input.triggerDate)) throw new Error('Date déclencheuse invalide.');
    const c = computeDeadline(rule, input.triggerDate);
    return {
      ...base, kind: rule.kind, title: input.title?.trim() || rule.label, dueDate: c.rawDate,
      legalBasis: rule.legalBasis, ruleId: rule.id, triggerDate: input.triggerDate,
    };
  }
  if (!input.kind || !KINDS.includes(input.kind)) throw new Error('Type d’échéance invalide.');
  if (!input.dueDate || !ISO.test(input.dueDate)) throw new Error('Date d’échéance invalide.');
  return {
    ...base, kind: input.kind, title: text(input.title, 'Titre de l’échéance'), dueDate: input.dueDate,
    legalBasis: input.legalBasis?.trim() || null, ruleId: null, triggerDate: null,
  };
}
