import { describe, expect, it } from 'vitest';
import { easterSunday } from './dates';
import {
  calendarStatus, courtRecess, holidaysFor, isFederalChristmasRecess, isNonJuridicalDay, juridicalDaysUntil, nextJuridicalDay,
} from './calendar';

describe('calendrier judiciaire', () => {
  it('calcule Pâques', () => {
    expect(easterSunday(2025)).toBe('2025-04-20');
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
  });

  it('Québec 2026 : jours non juridiques de l’art. 82 C.p.c.', () => {
    const dates = holidaysFor('QC', 2026).map((h) => h.date);
    expect(dates).toEqual(
      expect.arrayContaining([
        '2026-01-01', '2026-01-02', '2026-04-03', '2026-04-06', '2026-05-18', '2026-06-24',
        '2026-07-01', '2026-09-07', '2026-10-12', '2026-12-25', '2026-12-26',
      ]),
    );
    expect(dates).not.toContain('2026-08-03'); // pas de congé civique au Québec
  });

  it('Ontario 2026 : Jour de la Famille et congé civique', () => {
    const dates = holidaysFor('ON', 2026).map((h) => h.date);
    expect(dates).toContain('2026-02-16');
    expect(dates).toContain('2026-08-03');
    expect(dates).not.toContain('2026-06-24');
  });

  it('1er juillet un dimanche → reporté au 2 juillet', () => {
    // 2029-07-01 est un dimanche
    expect(holidaysFor('QC', 2029).map((h) => h.date)).toContain('2029-07-02');
  });

  it('fin de semaine et fériés sont non juridiques', () => {
    expect(isNonJuridicalDay('2026-10-10', 'QC')).toBe(true); // samedi
    expect(isNonJuridicalDay('2026-10-12', 'QC')).toBe(true); // Action de grâces
    expect(isNonJuridicalDay('2026-10-13', 'QC')).toBe(false);
  });

  it('report au premier jour juridique suivant', () => {
    // Vendredi 24 juin 2022 (Fête nationale, QC) → lundi 27 juin
    expect(nextJuridicalDay('2022-06-24', 'QC')).toBe('2022-06-27');
    expect(nextJuridicalDay('2022-06-24', 'ON')).toBe('2022-06-24');
  });

  it('compte les jours juridiques restants', () => {
    // Du vendredi 9 oct. 2026 au mardi 13 oct. 2026 (lundi 12 = Action de grâces) → 1 jour juridique
    expect(juridicalDaysUntil('2026-10-09', '2026-10-13', 'QC')).toBe(1);
    expect(juridicalDaysUntil('2026-10-13', '2026-10-13', 'QC')).toBe(0);
    expect(juridicalDaysUntil('2026-10-14', '2026-10-13', 'QC')).toBe(-1);
  });

  it('Ontario : Civic Holiday et Remembrance Day sont des « holidays » (r. 1.03)', () => {
    expect(isNonJuridicalDay('2026-08-03', 'ON')).toBe(true);
    expect(isNonJuridicalDay('2026-11-11', 'ON')).toBe(true);
  });

  it('Québec : périodes de non-siège signalées sans être des jours non juridiques', () => {
    expect(courtRecess('QC', '2026-07-15')).toBe('ete');
    expect(courtRecess('QC', '2027-01-05')).toBe('fetes');
    expect(courtRecess('QC', '2026-09-02')).toBeNull();
    expect(courtRecess('ON', '2026-07-15')).toBeNull();
    expect(isNonJuridicalDay('2026-07-15', 'QC')).toBe(false);
  });

  it('Fédéral : vacances de Noël du 21 déc. au 7 janv. inclusivement', () => {
    expect(isFederalChristmasRecess('2026-12-20')).toBe(false);
    expect(isFederalChristmasRecess('2026-12-21')).toBe(true);
    expect(isFederalChristmasRecess('2027-01-07')).toBe(true);
    expect(isFederalChristmasRecess('2027-01-08')).toBe(false);
  });

  it('C.-B. et Alberta : calendriers modélisés, à valider', () => {
    expect(holidaysFor('BC', 2026).map((h) => h.date)).toEqual(expect.arrayContaining(['2026-08-03', '2026-09-30', '2026-02-16']));
    expect(holidaysFor('AB', 2026).map((h) => h.date)).toContain('2026-02-16');
    expect(calendarStatus('BC')).toBe('a_valider');
    expect(calendarStatus('QC')).toBe('valide');
    expect(calendarStatus('MB')).toBe('socle');
  });
});
