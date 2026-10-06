/**
 * Utilitaires de dates « calendrier » (AAAA-MM-JJ), indépendants du fuseau horaire.
 * Toute l'arithmétique se fait en UTC pour éviter les sauts d'heure avancée.
 */
import type { IsoDate } from '../types';

const DAY_MS = 86_400_000;

export function parseIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Date invalide : ${iso}`);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/** Date locale du poste (et non UTC) : « aujourd'hui » pour l'avocat. */
export function localToday(now: Date = new Date()): IsoDate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return toIsoDate(new Date(parseIsoDate(iso).getTime() + days * DAY_MS));
}

/**
 * Ajoute des mois en conservant le quantième ; si le mois d'arrivée est plus court
 * (ex. 31 janvier + 1 mois), on retient le dernier jour du mois.
 */
export function addMonths(iso: IsoDate, months: number): IsoDate {
  const d = parseIsoDate(iso);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return toIsoDate(target);
}

export function addYears(iso: IsoDate, years: number): IsoDate {
  return addMonths(iso, years * 12);
}

/** Nombre de jours civils de `from` à `to` (négatif si `to` est antérieur). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS);
}

/** 0 = dimanche … 6 = samedi */
export function weekday(iso: IsoDate): number {
  return parseIsoDate(iso).getUTCDay();
}

export function ymd(year: number, month: number, day: number): IsoDate {
  return toIsoDate(new Date(Date.UTC(year, month - 1, day)));
}

/** n-ième jour de semaine `wd` du mois (n ≥ 1). */
export function nthWeekdayOfMonth(year: number, month: number, wd: number, n: number): IsoDate {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = 1 + ((wd - first + 7) % 7) + (n - 1) * 7;
  return ymd(year, month, day);
}

/** Dernier jour de semaine `wd` strictement avant la date donnée. */
export function weekdayBefore(iso: IsoDate, wd: number): IsoDate {
  let cur = addDays(iso, -1);
  while (weekday(cur) !== wd) cur = addDays(cur, -1);
  return cur;
}

/** Dimanche de Pâques (algorithme grégorien anonyme / Meeus). */
export function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(year, month, day);
}
