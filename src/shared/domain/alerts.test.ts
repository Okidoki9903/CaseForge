import { describe, expect, it } from 'vitest';
import { alertLevel, buildAlerts } from './alerts';
import { buildDemoSnapshot } from '../seed';

describe('alertes', () => {
  it('niveaux selon le type de délai', () => {
    expect(alertLevel(-1, 'procedure')).toBe('depasse');
    expect(alertLevel(2, 'procedure')).toBe('critique');
    expect(alertLevel(4, 'procedure')).toBe('urgent');
    // Une prescription à 8 jours juridiques est déjà critique.
    expect(alertLevel(8, 'prescription')).toBe('critique');
    expect(alertLevel(60, 'prescription')).toBe('attention');
    expect(alertLevel(200, 'prescription')).toBe('ok');
  });

  it('la démo contient des alertes critiques non accusées, triées par gravité', () => {
    const today = '2026-10-06';
    const s = buildDemoSnapshot(today);
    const alerts = buildAlerts(s.deadlines, s.matters, today);
    expect(alerts[0].level).toBe('depasse');
    expect(alerts.some((a) => a.requiresAcknowledgement)).toBe(true);
    // Une alerte accusée ne réclame plus d'accusé de réception.
    const acked = alerts.find((a) => a.deadline.acknowledgedAt);
    expect(acked?.requiresAcknowledgement).toBe(false);
  });

  it('ignore les échéances complétées', () => {
    const s = buildDemoSnapshot('2026-10-06');
    s.deadlines.forEach((d) => (d.status = 'complete'));
    expect(buildAlerts(s.deadlines, s.matters, '2026-10-06')).toHaveLength(0);
  });
});
