import { describe, expect, it } from 'vitest';
import { assertStatusTransition, csvCell, parseDuration, roundBillableMinutes, timeEntriesToCsv, wipSummary } from './time';
import { buildDemoSnapshot } from '../seed';
import type { TimeEntry } from '../types';

describe('saisie de temps', () => {
  it('arrondit au dixième d’heure supérieur (6 min)', () => {
    expect(roundBillableMinutes(0.2)).toBe(6);
    expect(roundBillableMinutes(6)).toBe(6);
    expect(roundBillableMinutes(6.01)).toBe(12);
    expect(roundBillableMinutes(17)).toBe(18);
    expect(roundBillableMinutes(60)).toBe(60);
    expect(() => roundBillableMinutes(0)).toThrow();
    expect(() => roundBillableMinutes(-5)).toThrow();
    expect(() => roundBillableMinutes(25 * 60)).toThrow();
  });

  it('interprète les durées saisies', () => {
    expect(parseDuration('0,5')).toBe(30);
    expect(parseDuration('1.25')).toBe(75);
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('1h30')).toBe(90);
    expect(parseDuration('2h')).toBe(120);
    expect(parseDuration('45m')).toBe(45);
    expect(parseDuration('45 min')).toBe(45);
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('')).toBeNull();
  });

  it('contrôle les transitions de statut', () => {
    expect(() => assertStatusTransition('wip', 'facture')).not.toThrow();
    expect(() => assertStatusTransition('wip', 'radie')).not.toThrow();
    expect(() => assertStatusTransition('facture', 'wip')).not.toThrow();
    expect(() => assertStatusTransition('facture', 'radie')).toThrow();
    expect(() => assertStatusTransition('wip', 'wip')).toThrow();
  });

  it('calcule le WIP (facturable, non facturé, non radié)', () => {
    const base: TimeEntry = { id: 'a', matterId: 'm1', staffId: 's', date: '2026-10-01', minutes: 60, rateCents: 30000, billable: true, description: '', status: 'wip' };
    const w = wipSummary([
      base,
      { ...base, id: 'b', status: 'facture' },
      { ...base, id: 'c', status: 'radie' },
      { ...base, id: 'd', billable: false },
      { ...base, id: 'e', matterId: 'm2', minutes: 30 },
    ]);
    expect(w).toEqual({ minutes: 90, valueCents: 45000, entries: 2, matters: 2 });
  });

  it('échappe correctement les cellules CSV et neutralise les formules', () => {
    expect(csvCell('simple')).toBe('simple');
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('dit "oui"')).toBe('"dit ""oui"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell(-12)).toBe('-12');
  });

  it('exporte un CSV avec en-tête, BOM et montants', () => {
    const s = buildDemoSnapshot('2026-10-06');
    const entries = s.timeEntries.slice(0, 3);
    const csv = timeEntriesToCsv(entries, s);
    expect(csv.startsWith('﻿date,no_dossier,')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(4);
    const first = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0];
    expect(lines[1]).toContain(first.id);
    expect(lines[1]).toContain((first.minutes / 60).toFixed(1));
  });
});
