/**
 * Paramètres du cabinet, collaborateurs et création d'un cabinet vide.
 * Validations partagées entre SQLite et le mode démo.
 */
import type {
  FirmSettings, FirmSnapshot, Jurisdiction, NewFirmInput, PracticeArea, Staff, StaffInput, StaffRole,
} from '../types';
import { normalizeInitials } from './validation';

export const ALL_JURISDICTIONS: Jurisdiction[] = ['QC', 'ON', 'FED', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE'];
export const STAFF_ROLES: StaffRole[] = ['associe', 'avocat', 'stagiaire', 'parajuriste', 'adjoint'];

/** Taux horaire maximal accepté (garde-fou contre les fautes de frappe) : 5 000 $/h. */
export const MAX_RATE_CENTS = 500_000;
/** Coût interne estimé par défaut : 38 % du taux facturé. */
export const DEFAULT_COST_RATIO = 0.38;

/** Pôles proposés à la création d'un cabinet (bâtiments du campus). */
export const DEFAULT_PRACTICE_AREAS: PracticeArea[] = [
  { id: 'pa-lit', code: 'LIT', name: 'Litige civil et commercial', color: '#4f6bed', gridX: -1, gridZ: -1 },
  { id: 'pa-aff', code: 'AFF', name: 'Droit des affaires', color: '#0e9f8f', gridX: 1, gridZ: -1 },
  { id: 'pa-trv', code: 'TRV', name: 'Droit du travail', color: '#d9822b', gridX: -1, gridZ: 1 },
  { id: 'pa-fam', code: 'FAM', name: 'Droit de la famille', color: '#c2417d', gridX: 1, gridZ: 1 },
  { id: 'pa-pi', code: 'PI', name: 'Propriété intellectuelle', color: '#7c4dcc', gridX: 0, gridZ: 2.6 },
];

export const DEFAULT_SETTINGS: FirmSettings = {
  firmName: 'Mon cabinet',
  jurisdictions: ['QC'],
  defaultRateCents: 30_000,
  onboarded: false,
  demo: false,
};

function rateCents(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_RATE_CENTS) throw new Error(`${label} invalide (0 à 5 000 $).`);
  return n;
}

export function normalizeFirmName(value: unknown): string {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 120) throw new Error('Nom du cabinet invalide (2 à 120 caractères).');
  return name;
}

export function normalizeJurisdictions(value: unknown): Jurisdiction[] {
  if (!Array.isArray(value)) throw new Error('Ressorts invalides.');
  const list = ALL_JURISDICTIONS.filter((j) => value.includes(j));
  if (list.length === 0) throw new Error('Choisissez au moins un ressort.');
  return list;
}

export function normalizeSettingsPatch(patch: Partial<FirmSettings>): Partial<FirmSettings> {
  const out: Partial<FirmSettings> = {};
  if (patch.firmName !== undefined) out.firmName = normalizeFirmName(patch.firmName);
  if (patch.jurisdictions !== undefined) out.jurisdictions = normalizeJurisdictions(patch.jurisdictions);
  if (patch.defaultRateCents !== undefined) out.defaultRateCents = rateCents(patch.defaultRateCents, 'Taux par défaut');
  if (patch.onboarded !== undefined) out.onboarded = Boolean(patch.onboarded);
  return out;
}

/**
 * Valide un collaborateur. Les initiales servent de signature (accusés de réception,
 * journal d'audit) : elles doivent être uniques dans le cabinet.
 */
export function normalizeStaffInput(input: StaffInput, existing: Staff[], areaIds: string[]): Omit<Staff, 'id' | 'active'> {
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 120) throw new Error('Nom invalide (2 à 120 caractères).');
  const initials = normalizeInitials(input.initials);
  if (existing.some((p) => p.initials === initials && p.id !== input.id)) {
    throw new Error(`Les initiales ${initials} sont déjà utilisées dans le cabinet.`);
  }
  if (!STAFF_ROLES.includes(input.role)) throw new Error('Rôle invalide.');
  if (!areaIds.includes(input.practiceAreaId)) throw new Error('Pôle invalide.');
  const hourlyRateCents = rateCents(input.hourlyRateCents, 'Taux horaire');
  const target = Number(input.targetHoursWeek);
  if (!Number.isFinite(target) || target < 1 || target > 80) throw new Error('Objectif hebdomadaire invalide (1 à 80 h).');
  const costRateCents =
    input.costRateCents === undefined ? Math.round(hourlyRateCents * DEFAULT_COST_RATIO) : rateCents(input.costRateCents, 'Coût horaire');
  return { name, initials, role: input.role, practiceAreaId: input.practiceAreaId, hourlyRateCents, costRateCents, targetHoursWeek: target };
}

/** Cabinet vide : pôles par défaut, un premier collaborateur (l'utilisateur), aucun dossier. */
export function emptyFirmSnapshot(input: NewFirmInput): FirmSnapshot {
  const settings: FirmSettings = {
    firmName: normalizeFirmName(input.firmName),
    jurisdictions: normalizeJurisdictions(input.jurisdictions),
    defaultRateCents: rateCents(input.defaultRateCents, 'Taux par défaut'),
    onboarded: true,
    demo: false,
  };
  const owner: Staff = {
    id: 'st-01',
    active: true,
    ...normalizeStaffInput({ ...input.owner, practiceAreaId: DEFAULT_PRACTICE_AREAS[0].id }, [], DEFAULT_PRACTICE_AREAS.map((a) => a.id)),
  };
  return {
    settings,
    practiceAreas: DEFAULT_PRACTICE_AREAS,
    staff: [owner],
    parties: [],
    matters: [],
    matterParties: [],
    deadlines: [],
    timeEntries: [],
    invoices: [],
    documents: [],
    conflictChecks: [],
    auditLog: [],
  };
}
