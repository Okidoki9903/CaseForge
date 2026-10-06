import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from './seed';
import { buildAlerts } from './domain/alerts';
import { flaggedMatters } from './domain/conflicts';
import { staffLoad } from './domain/metrics';

const TODAY = '2026-10-06';

describe('données de démonstration', () => {
  const s = buildDemoSnapshot(TODAY);
  const alerts = buildAlerts(s.deadlines, s.matters, TODAY);

  it('12 à 15 dossiers mixtes QC / ON / FED', () => {
    expect(s.matters.length).toBeGreaterThanOrEqual(12);
    expect(s.matters.length).toBeLessThanOrEqual(15);
    const juris = new Set(s.matters.map((m) => m.jurisdiction));
    expect([...juris].sort()).toEqual(['FED', 'ON', 'QC']);
  });

  it('plusieurs échéances critiques proches', () => {
    const critical = alerts.filter((a) => a.level === 'critique' || a.level === 'depasse');
    expect(critical.length).toBeGreaterThanOrEqual(4);
  });

  it('des conflits potentiels signalés sur des dossiers', () => {
    const flagged = flaggedMatters(s.conflictChecks);
    expect(s.conflictChecks.map((c) => c.status).sort()).toEqual(['clair', 'confirme', 'en_cours', 'potentiel']);
    expect(flagged.get('m-006')?.status).toBe('potentiel');
    // La correspondance porte sur la partie adverse du divorce Belhumeur.
    const horizon = s.conflictChecks.find((c) => c.matterId === 'm-006')!;
    expect(horizon.hits[0].roles).toEqual(expect.arrayContaining([{ matterId: 'm-011', role: 'adverse' }]));
  });

  it('charges de travail variées', () => {
    const levels = new Set(s.staff.map((p) => staffLoad(p, s, TODAY, alerts).level));
    expect(levels.size).toBeGreaterThanOrEqual(2);
    expect(levels.has('surcharge')).toBe(true);
  });

  it('est déterministe pour une même date', () => {
    expect(buildDemoSnapshot(TODAY)).toEqual(buildDemoSnapshot(TODAY));
  });
});
