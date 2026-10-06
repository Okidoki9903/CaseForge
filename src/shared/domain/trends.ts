/**
 * Tendances des indicateurs financiers (barre du haut). Calculs honnêtes à partir des
 * entrées de temps : aucune donnée inventée.
 *
 *  - Constitution du WIP : valeur du WIP actuel (facturable, non facturé) déjà saisie à la fin
 *    de chacune des N dernières semaines — montre comment le montant à facturer s'est accumulé.
 *  - Heures facturables : du 1er du mois à aujourd'hui, comparées à la même période du mois précédent.
 */
import type { IsoDate, TimeEntry } from '../types';
import { addDays, addMonths, weekday } from './dates';
import { entryValueCents } from './time';

/** Lundi de la semaine contenant `iso`. */
export const weekStart = (iso: IsoDate) => addDays(iso, -((weekday(iso) + 6) % 7));

/** Valeur cumulée du WIP actuel à la fin de chaque semaine (la dernière = aujourd'hui). */
export function wipBuildUp(entries: TimeEntry[], today: IsoDate, weeks = 8): number[] {
  const wip = entries.filter((t) => t.billable && t.status === 'wip');
  const ends = Array.from({ length: weeks }, (_, i) => (i === weeks - 1 ? today : addDays(weekStart(today), -7 * (weeks - 2 - i) - 1)));
  return ends.map((end) => wip.filter((t) => t.date <= end).reduce((a, t) => a + entryValueCents(t), 0));
}

/** WIP ajouté depuis le lundi de cette semaine (travail facturable saisi, encore non facturé). */
export function wipAddedThisWeek(entries: TimeEntry[], today: IsoDate): number {
  const from = weekStart(today);
  return entries
    .filter((t) => t.billable && t.status === 'wip' && t.date >= from && t.date <= today)
    .reduce((a, t) => a + entryValueCents(t), 0);
}

/** Heures facturables par semaine (lundi → dimanche), N dernières semaines. */
export function weeklyBillableHours(entries: TimeEntry[], today: IsoDate, weeks = 8): number[] {
  const start0 = addDays(weekStart(today), -7 * (weeks - 1));
  const out = new Array<number>(weeks).fill(0);
  for (const t of entries) {
    if (!t.billable || t.status === 'radie' || t.date < start0 || t.date > today) continue;
    const i = Math.floor((Date.parse(t.date) - Date.parse(start0)) / (7 * 86_400_000));
    if (i >= 0 && i < weeks) out[i] += t.minutes / 60;
  }
  return out;
}

export interface MonthToDate {
  hours: number;
  previousHours: number;
  /** Variation relative (0,08 = +8 %) ; null si le mois précédent est vide. */
  change: number | null;
}

/** Heures facturables du 1er à aujourd'hui, comparées au même nombre de jours le mois précédent. */
export function billableMonthToDate(entries: TimeEntry[], today: IsoDate): MonthToDate {
  const from = `${today.slice(0, 7)}-01`;
  const prevFrom = addMonths(from, -1);
  const day = Number(today.slice(8, 10));
  const prevTo = addMonths(today, -1) < prevFrom ? prevFrom : addDays(prevFrom, day - 1);
  const sum = (a: IsoDate, b: IsoDate) =>
    entries.filter((t) => t.billable && t.status !== 'radie' && t.date >= a && t.date <= b).reduce((s, t) => s + t.minutes, 0) / 60;
  const hours = sum(from, today);
  const previousHours = sum(prevFrom, prevTo);
  return { hours, previousHours, change: previousHours > 0 ? hours / previousHours - 1 : null };
}
