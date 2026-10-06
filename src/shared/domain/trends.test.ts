import { describe, expect, it } from 'vitest';
import { billableMonthToDate, weekStart, weeklyBillableHours, wipAddedThisWeek, wipBuildUp } from './trends';
import type { TimeEntry } from '../types';

const e = (date: string, minutes: number, extra: Partial<TimeEntry> = {}): TimeEntry => ({
  id: date + minutes, matterId: 'm', staffId: 's', date, minutes, rateCents: 30000, billable: true, description: '', status: 'wip', ...extra,
});
const TODAY = '2026-10-07'; // mercredi

describe('tendances', () => {
  it('lundi de la semaine', () => {
    expect(weekStart('2026-10-07')).toBe('2026-10-05');
    expect(weekStart('2026-10-11')).toBe('2026-10-05'); // dimanche
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
  });

  it('constitution du WIP : cumul croissant, finit au WIP actuel', () => {
    const entries = [e('2026-09-01', 60), e('2026-09-29', 60), e('2026-10-06', 60), e('2026-10-06', 60, { status: 'facture' }), e('2026-10-06', 60, { billable: false })];
    const s = wipBuildUp(entries, TODAY, 3);
    expect(s).toEqual([30000, 60000, 90000]); // fin 27 sept., fin 4 oct., aujourd'hui
    expect(wipAddedThisWeek(entries, TODAY)).toBe(30000);
  });

  it('heures facturables par semaine', () => {
    const s = weeklyBillableHours([e('2026-10-05', 120), e('2026-10-01', 60), e('2026-10-01', 60, { status: 'radie' })], TODAY, 2);
    expect(s).toEqual([1, 2]);
  });

  it('mois à date comparé au même nombre de jours du mois précédent', () => {
    const r = billableMonthToDate([e('2026-10-02', 120), e('2026-09-03', 60), e('2026-09-20', 600)], TODAY);
    expect(r).toEqual({ hours: 2, previousHours: 1, change: 1 });
    expect(billableMonthToDate([e('2026-10-02', 60)], TODAY).change).toBeNull();
  });
});
