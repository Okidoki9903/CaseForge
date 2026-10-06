/**
 * Calendriers judiciaires canadiens : jours fériés / jours non juridiques par ressort.
 *
 * ⚠️ Les listes ci-dessous reflètent notre compréhension des textes cités et DOIVENT être
 * validées par un avocat du ressort avant usage en production. Les jours fixés par
 * proclamation (ex. funérailles nationales) s'ajoutent via `extraHolidays`.
 *
 *  - QC : art. 82 C.p.c. (samedis, dimanches, 1er et 2 janvier, Vendredi saint, lundi de
 *    Pâques, Journée nationale des patriotes, 24 juin, 1er juillet (2 juillet si dimanche),
 *    fête du Travail, Action de grâces, 25 et 26 décembre).
 *  - ON : Règles de procédure civile, r. 1.03 (définition de « jour férié »).
 *  - FED : Loi d'interprétation, art. 35 (+ Journée nationale de la vérité et de la réconciliation).
 *  - Autres provinces : socle national seulement → signalé comme « non vérifié ».
 */
import type { IsoDate, Jurisdiction } from '../types';
import { addDays, easterSunday, nthWeekdayOfMonth, weekday, weekdayBefore, ymd } from './dates';

export interface Holiday {
  date: IsoDate;
  name: string;
}

/** Ressorts dont le calendrier a été modélisé à partir des textes. */
export const VERIFIED_CALENDARS: ReadonlySet<Jurisdiction> = new Set(['QC', 'ON', 'FED']);

/** Si le jour tombe un dimanche, la loi reporte souvent au lundi. */
function sundayToMonday(iso: IsoDate): IsoDate {
  return weekday(iso) === 0 ? addDays(iso, 1) : iso;
}

/** Lundi qui précède le 25 mai (fête de Victoria / Journée nationale des patriotes). */
function mondayBeforeMay25(year: number): IsoDate {
  return weekdayBefore(ymd(year, 5, 25), 1);
}

function nationalCore(year: number): Holiday[] {
  const easter = easterSunday(year);
  return [
    { date: ymd(year, 1, 1), name: 'Jour de l’An' },
    { date: addDays(easter, -2), name: 'Vendredi saint' },
    { date: sundayToMonday(ymd(year, 7, 1)), name: 'Fête du Canada' },
    { date: nthWeekdayOfMonth(year, 9, 1, 1), name: 'Fête du Travail' },
    { date: ymd(year, 12, 25), name: 'Noël' },
  ];
}

const cache = new Map<string, Holiday[]>();

export function holidaysFor(jurisdiction: Jurisdiction, year: number): Holiday[] {
  const key = `${jurisdiction}-${year}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const easter = easterSunday(year);
  const list = nationalCore(year);
  switch (jurisdiction) {
    case 'QC':
      list.push(
        { date: ymd(year, 1, 2), name: 'Lendemain du jour de l’An' },
        { date: addDays(easter, 1), name: 'Lundi de Pâques' },
        { date: mondayBeforeMay25(year), name: 'Journée nationale des patriotes' },
        { date: ymd(year, 6, 24), name: 'Fête nationale du Québec' },
        { date: nthWeekdayOfMonth(year, 10, 1, 2), name: 'Action de grâces' },
        { date: ymd(year, 12, 26), name: 'Lendemain de Noël' },
      );
      break;
    case 'ON':
      list.push(
        { date: nthWeekdayOfMonth(year, 2, 1, 3), name: 'Jour de la Famille' },
        { date: addDays(easter, 1), name: 'Lundi de Pâques' },
        { date: mondayBeforeMay25(year), name: 'Fête de Victoria' },
        { date: nthWeekdayOfMonth(year, 8, 1, 1), name: 'Congé civique' },
        { date: nthWeekdayOfMonth(year, 10, 1, 2), name: 'Action de grâces' },
        { date: ymd(year, 11, 11), name: 'Jour du Souvenir' },
        { date: ymd(year, 12, 26), name: 'Lendemain de Noël' },
      );
      break;
    case 'FED':
      list.push(
        { date: addDays(easter, 1), name: 'Lundi de Pâques' },
        { date: mondayBeforeMay25(year), name: 'Fête de Victoria' },
        { date: ymd(year, 9, 30), name: 'Journée nationale de la vérité et de la réconciliation' },
        { date: nthWeekdayOfMonth(year, 10, 1, 2), name: 'Action de grâces' },
        { date: ymd(year, 11, 11), name: 'Jour du Souvenir' },
        { date: ymd(year, 12, 26), name: 'Lendemain de Noël' },
      );
      break;
    default:
      // Socle national uniquement (calendrier non vérifié).
      break;
  }
  list.sort((a, b) => a.date.localeCompare(b.date));
  cache.set(key, list);
  return list;
}

export function holidayOn(iso: IsoDate, jurisdiction: Jurisdiction): Holiday | undefined {
  return holidaysFor(jurisdiction, Number(iso.slice(0, 4))).find((h) => h.date === iso);
}

/** Jour non juridique : samedi, dimanche ou jour férié du ressort. */
export function isNonJuridicalDay(iso: IsoDate, jurisdiction: Jurisdiction, extraHolidays: IsoDate[] = []): boolean {
  const wd = weekday(iso);
  return wd === 0 || wd === 6 || extraHolidays.includes(iso) || holidayOn(iso, jurisdiction) !== undefined;
}

/** Premier jour juridique à partir de `iso` (inclus). */
export function nextJuridicalDay(iso: IsoDate, jurisdiction: Jurisdiction, extraHolidays: IsoDate[] = []): IsoDate {
  let cur = iso;
  while (isNonJuridicalDay(cur, jurisdiction, extraHolidays)) cur = addDays(cur, 1);
  return cur;
}

/**
 * Nombre de jours juridiques entre aujourd'hui (exclu) et l'échéance (incluse).
 * 0 = l'échéance est aujourd'hui ; négatif = dépassée (en jours civils).
 */
export function juridicalDaysUntil(today: IsoDate, due: IsoDate, jurisdiction: Jurisdiction): number {
  if (due < today) {
    return -Math.round((Date.parse(today) - Date.parse(due)) / 86_400_000);
  }
  let count = 0;
  let cur = today;
  while (cur < due) {
    cur = addDays(cur, 1);
    if (!isNonJuridicalDay(cur, jurisdiction)) count++;
  }
  return count;
}
