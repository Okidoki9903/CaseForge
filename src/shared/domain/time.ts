/**
 * Saisie de temps et travaux en cours (WIP).
 *
 * Règles :
 *  - Toute durée est arrondie au dixième d'heure SUPÉRIEUR (tranches de 6 minutes),
 *    usage courant de facturation au Canada ; minimum 0,1 h.
 *  - Le taux horaire est figé au moment de la saisie (copié dans l'entrée).
 *  - Statuts : `wip` (non facturé) → `facture` ou `radie` ; retour à `wip` permis pour corriger.
 */
import type { FirmSnapshot, Id, TimeEntry, TimeEntryStatus } from '../types';

export const BILLING_INCREMENT_MINUTES = 6;
export const MAX_ENTRY_MINUTES = 24 * 60;

/** Arrondit au dixième d'heure supérieur (6 min). Lève une erreur si la durée est invalide. */
export function roundBillableMinutes(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error('Durée invalide.');
  const rounded = Math.ceil(Math.round(minutes * 1000) / 1000 / BILLING_INCREMENT_MINUTES) * BILLING_INCREMENT_MINUTES;
  if (rounded > MAX_ENTRY_MINUTES) throw new Error('Durée supérieure à 24 h.');
  return rounded;
}

/**
 * Interprète une durée saisie : « 1,5 » / « 1.5 » (heures), « 1:30 » / « 1h30 » (h:min),
 * « 45m » / « 45 min » (minutes). Retourne des minutes brutes (non arrondies) ou null.
 */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  let m = /^(\d+)(?:h|:)(\d{1,2})?$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = /^(\d+)(?:m|min)$/.exec(s);
  if (m) return Number(m[1]);
  m = /^(\d+(?:[.,]\d+)?)h?$/.exec(s);
  if (m) return Number(m[1].replace(',', '.')) * 60;
  return null;
}

const TRANSITIONS: Record<TimeEntryStatus, TimeEntryStatus[]> = {
  wip: ['facture', 'radie'],
  facture: ['wip'],
  radie: ['wip'],
};

export function assertStatusTransition(from: TimeEntryStatus, to: TimeEntryStatus): void {
  if (!TRANSITIONS[from]?.includes(to)) throw new Error(`Transition de statut interdite : ${from} → ${to}.`);
}

export const entryValueCents = (t: Pick<TimeEntry, 'minutes' | 'rateCents'>) => Math.round((t.minutes / 60) * t.rateCents);

export interface WipSummary {
  minutes: number;
  valueCents: number;
  entries: number;
  matters: number;
}

/** WIP = temps facturable non encore facturé ni radié. */
export function wipSummary(entries: TimeEntry[], matterId?: Id): WipSummary {
  const wip = entries.filter((t) => t.billable && t.status === 'wip' && (!matterId || t.matterId === matterId));
  return {
    minutes: wip.reduce((a, t) => a + t.minutes, 0),
    valueCents: wip.reduce((a, t) => a + entryValueCents(t), 0),
    entries: wip.length,
    matters: new Set(wip.map((t) => t.matterId)).size,
  };
}

/* ─────────────── Export CSV (import dans un logiciel de facturation) ─────────────── */

export const CSV_COLUMNS = [
  'date', 'no_dossier', 'dossier', 'client', 'collaborateur', 'initiales',
  'minutes', 'heures', 'taux_horaire', 'montant', 'facturable', 'statut', 'description', 'id_entree',
] as const;

/** RFC 4180 : guillemets si virgule, guillemet ou saut de ligne ; neutralise les formules Excel. */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s) && typeof value === 'string') s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV UTF-8 avec BOM (lisible par Excel), séparateur virgule, décimales avec point
 * (format le plus largement accepté par les logiciels de facturation).
 */
export function timeEntriesToCsv(entries: TimeEntry[], s: FirmSnapshot): string {
  const matters = new Map(s.matters.map((m) => [m.id, m]));
  const parties = new Map(s.parties.map((p) => [p.id, p]));
  const staff = new Map(s.staff.map((p) => [p.id, p]));
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map((t) => {
      const m = matters.get(t.matterId);
      const p = staff.get(t.staffId);
      return [
        t.date, m?.number ?? '', m?.title ?? '', (m && parties.get(m.clientId)?.name) ?? '', p?.name ?? '', p?.initials ?? '',
        t.minutes, (t.minutes / 60).toFixed(1), (t.rateCents / 100).toFixed(2), (entryValueCents(t) / 100).toFixed(2),
        t.billable ? 'oui' : 'non', t.status, t.description, t.id,
      ].map(csvCell).join(',');
    });
  return '﻿' + [CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}
