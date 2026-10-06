/**
 * Calendriers judiciaires canadiens : jours fériés / jours non juridiques par ressort.
 *
 * Les jours fixés par proclamation (ex. funérailles nationales) s'ajoutent via `extraHolidays`.
 *
 *  - QC (validé) : art. 82 C.p.c. — samedis, jours fériés de l'art. 61 de la Loi
 *    d'interprétation (dont le dimanche, et le 2 juillet si le 1er tombe un dimanche),
 *    plus le 26 décembre et le 2 janvier. Le calcul des délais relève de l'art. 83 C.p.c.
 *    Les périodes où les tribunaux de première instance ne sont pas tenus de siéger
 *    (30 juin–1er sept., 20 déc.–7 janv.) ne suspendent PAS les délais : voir `courtRecess`.
 *  - ON (validé) : Rules of Civil Procedure, r. 1.03 « holiday » (dont Civic Holiday et
 *    Remembrance Day) ; computation r. 3.01.
 *  - FED (validé) : Loi d'interprétation, art. 35 ; vacances judiciaires du 21 déc. au
 *    7 janv. (Règles des Cours fédérales, r. 6(3)) : voir `isFederalChristmasRecess`.
 *  - BC, AB : modélisés d'après les lois d'interprétation provinciales, À VALIDER.
 *  - Autres provinces : socle national seulement.
 */
import type { IsoDate, Jurisdiction } from '../types';
import { addDays, easterSunday, nthWeekdayOfMonth, weekday, weekdayBefore, ymd } from './dates';

export interface Holiday {
  date: IsoDate;
  name: string;
}

/**
 * État de validation du calendrier d'un ressort :
 *  - `valide`    : liste confirmée par un avocat du ressort ;
 *  - `a_valider` : modélisée à partir des textes, en attente de confirmation ;
 *  - `socle`     : jours fériés nationaux + fins de semaine seulement.
 */
export type CalendarStatus = 'valide' | 'a_valider' | 'socle';

export function calendarStatus(jurisdiction: Jurisdiction): CalendarStatus {
  if (jurisdiction === 'QC' || jurisdiction === 'ON' || jurisdiction === 'FED') return 'valide';
  if (jurisdiction === 'BC' || jurisdiction === 'AB') return 'a_valider';
  return 'socle';
}

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
    case 'BC':
      // Interpretation Act (B.C.), art. 29 « holiday » — À VALIDER.
      list.push(
        { date: nthWeekdayOfMonth(year, 2, 1, 3), name: 'Family Day' },
        { date: addDays(easter, 1), name: 'Lundi de Pâques' },
        { date: mondayBeforeMay25(year), name: 'Fête de Victoria' },
        { date: nthWeekdayOfMonth(year, 8, 1, 1), name: 'British Columbia Day' },
        { date: ymd(year, 9, 30), name: 'Journée nationale de la vérité et de la réconciliation' },
        { date: nthWeekdayOfMonth(year, 10, 1, 2), name: 'Action de grâces' },
        { date: ymd(year, 11, 11), name: 'Jour du Souvenir' },
        { date: ymd(year, 12, 26), name: 'Lendemain de Noël' },
      );
      break;
    case 'AB':
      // Interpretation Act (Alberta), art. 28 « holiday » — À VALIDER.
      list.push(
        { date: nthWeekdayOfMonth(year, 2, 1, 3), name: 'Alberta Family Day' },
        { date: addDays(easter, 1), name: 'Lundi de Pâques' },
        { date: mondayBeforeMay25(year), name: 'Fête de Victoria' },
        { date: nthWeekdayOfMonth(year, 10, 1, 2), name: 'Action de grâces' },
        { date: ymd(year, 11, 11), name: 'Jour du Souvenir' },
        { date: ymd(year, 12, 26), name: 'Lendemain de Noël' },
      );
      break;
    default:
      // Socle national uniquement.
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

/**
 * Périodes où les tribunaux de première instance du Québec ne sont pas tenus de siéger
 * (art. 82 C.p.c.). Information seulement : les délais continuent de courir (art. 83).
 * Sert à signaler une audience ou un dépôt prévu pendant ces périodes.
 */
export type CourtRecess = 'ete' | 'fetes';

export function courtRecess(jurisdiction: Jurisdiction, iso: IsoDate): CourtRecess | null {
  if (jurisdiction !== 'QC') return null;
  const md = iso.slice(5);
  if (md >= '06-30' && md <= '09-01') return 'ete'; // 30 juin – 1er septembre
  if (md >= '12-20' || md <= '01-07') return 'fetes'; // 20 décembre – 7 janvier
  return null;
}

/**
 * Vacances judiciaires de Noël des Cours fédérales : du 21 décembre au 7 janvier inclusivement.
 * Ces jours ne sont pas comptés dans le calcul des délais fixés par les Règles pour déposer,
 * modifier, transmettre ou signifier un document (r. 6(3)), sauf directive contraire de la Cour.
 */
export function isFederalChristmasRecess(iso: IsoDate): boolean {
  const md = iso.slice(5);
  return md >= '12-21' || md <= '01-07';
}
