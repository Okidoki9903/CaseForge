import { parseIsoDate } from '@shared/domain/dates';
import type { IsoDate } from '@shared/types';
import { intlLocale } from '../i18n';

export const money = (cents: number, compact = false) =>
  new Intl.NumberFormat(intlLocale(), {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact && Math.abs(cents) >= 10_000_000 ? 'compact' : 'standard',
  }).format(cents / 100);

export const hours = (h: number) =>
  new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(h);

export const percent = (r: number) =>
  new Intl.NumberFormat(intlLocale(), { style: 'percent', maximumFractionDigits: 0 }).format(r);

/** « lun. 12 oct. 2026 » — format sans conversion de fuseau. */
export const longDate = (iso: IsoDate) =>
  new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    parseIsoDate(iso),
  );

/** Horodatage lisible (« 6 oct. 2026, 06 h 33 »), dans le fuseau du poste. */
export const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
