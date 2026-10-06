import { describe, expect, it } from 'vitest';
import { computeDeadline, findRule, type DeadlineRule } from './deadlineRules';
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
    expect(c.reasoning.join(' ')).toContain('18.1(2)');
  });

  it('FED — r. 6(3) : les vacances de Noël ne sont pas comptées (r. 306)', () => {
    // 11–20 déc. = 10 jours ; 21 déc.–7 janv. suspendus ; 8–27 janv. = 20 jours
    const c = computeDeadline(rule('FED_AFFIDAVITS_DEMANDEUR'), '2026-12-10');
    expect(c.rawDate).toBe('2027-01-27');
    expect(c.reasoning.join(' ')).toContain('18 jour(s)');
  });

  it('ON — r. 3.01(1)(b) : délai de 7 jours ou moins, jours fériés non comptés', () => {
    const seven: DeadlineRule = { id: 'T7', jurisdiction: 'ON', kind: 'procedure', label: 'Test', trigger: 'Test', amount: 7, unit: 'jours', legalBasis: 'test' };
    // Ven. 31 juil. 2026 : congé civique (3 août) et fin de semaine exclus → 4,5,6,7,10,11,12 août
    expect(computeDeadline(seven, '2026-07-31').rawDate).toBe('2026-08-12');
    // 8 jours : décompte civil ordinaire
    expect(computeDeadline({ ...seven, amount: 8 }, '2026-07-31').rawDate).toBe('2026-08-08');
  });

  it('FED — contrôle judiciaire (délai statutaire) : la r. 6(3) ne s’applique pas', () => {
    const c = computeDeadline(rule('FED_JUDICIAL_REVIEW'), '2026-12-10');
    expect(c.rawDate).toBe('2027-01-09'); // samedi
    expect(c.dueDate).toBe('2027-01-11');
  });

  it('QC — art. 173 : délai de rigueur de 6 mois, validé', () => {
    const r = rule('QC_MISE_EN_ETAT');
    expect(r.strict && r.validated).toBe(true);
    const c = computeDeadline(r, '2026-04-15');
    expect(c.rawDate).toBe('2026-10-15');
    expect(c.reasoning.join(' ')).toContain('Délai de rigueur');
    expect(c.reasoning.join(' ')).not.toContain('à faire valider');
  });

  it('QC — la période estivale de non-siège ne suspend pas le délai (art. 83)', () => {
    const c = computeDeadline(rule('QC_REPONSE_ASSIGNATION'), '2026-07-02');
    expect(c.rawDate).toBe('2026-07-17');
    expect(c.dueDate).toBe('2026-07-17');
  });
});
