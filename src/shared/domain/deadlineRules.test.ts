import { describe, expect, it } from 'vitest';
import { computeDeadline, findRule } from './deadlineRules';
import { addMonths } from './dates';

const rule = (id: string) => {
  const r = findRule(id);
  if (!r) throw new Error(id);
  return r;
};

describe('calcul des délais', () => {
  it('QC — 30 jours pour l’appel, jour du point de départ exclu', () => {
    const c = computeDeadline(rule('QC_APPEL'), '2026-03-02');
    expect(c.rawDate).toBe('2026-04-01');
    expect(c.dueDate).toBe('2026-04-01');
  });

  it('QC — échéance un jour férié reportée au jour juridique suivant', () => {
    // 2026-06-24 (mercredi, Fête nationale) → 25 juin
    const c = computeDeadline(rule('QC_REPONSE_ASSIGNATION'), '2026-06-09');
    expect(c.rawDate).toBe('2026-06-24');
    expect(c.dueDate).toBe('2026-06-25');
    expect(c.reasoning.join(' ')).toContain('Fête nationale');
  });

  it('QC — prescription de 3 ans tombant un jour férié', () => {
    const c = computeDeadline(rule('QC_PRESCRIPTION_3ANS'), '2023-10-12');
    expect(c.rawDate).toBe('2026-10-12'); // lundi de l’Action de grâces
    expect(c.dueDate).toBe('2026-10-13');
  });

  it('QC — prescription de 3 ans tombant un samedi', () => {
    const c = computeDeadline(rule('QC_PRESCRIPTION_3ANS'), '2023-10-10');
    expect(c.rawDate).toBe('2026-10-10');
    expect(c.dueDate).toBe('2026-10-13'); // samedi, dimanche, Action de grâces
  });

  it('ON — délai de 20 jours pour la défense', () => {
    const c = computeDeadline(rule('ON_DEFENCE_20D'), '2026-07-24');
    expect(c.rawDate).toBe('2026-08-13');
  });

  it('mois : 31 janvier + 6 mois = 31 juillet ; 31 août + 6 mois = fin février', () => {
    expect(addMonths('2026-01-31', 6)).toBe('2026-07-31');
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
  });

  it('FED — contrôle judiciaire 30 jours', () => {
    const c = computeDeadline(rule('FED_JUDICIAL_REVIEW'), '2026-09-01');
    expect(c.rawDate).toBe('2026-10-01');
    expect(c.reasoning.at(-1)).toContain('18.1(2)');
  });
});
