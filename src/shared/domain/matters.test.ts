import { describe, expect, it } from 'vitest';
import { buildDeadline, nextMatterNumber, partyKindFor } from './matters';
import { initialConflictStatus, searchConflicts, toCheckHits } from './conflicts';
import { buildDemoSnapshot } from '../seed';

const s = buildDemoSnapshot('2026-10-06');

describe('ouverture de dossier et échéances', () => {
  it('numérote séquentiellement par année', () => {
    expect(nextMatterNumber([], '2026')).toBe('2026-0001');
    expect(nextMatterNumber([{ number: '2026-0114' }, { number: '2025-0900' }, { number: 'X' }], '2026')).toBe('2026-0115');
  });

  it('devine personne ou entreprise', () => {
    expect(partyKindFor('Béton Laurentides ltée')).toBe('entreprise');
    expect(partyKindFor('Groupe ABC')).toBe('entreprise');
    expect(partyKindFor('Marie Gagnon')).toBe('personne');
  });

  it('conflits selon le rôle : client récurrent clair, adversaire devenu client = conflit', () => {
    const asClient = (n: string) => initialConflictStatus(toCheckHits(searchConflicts(n, s)), 'client');
    const asAdverse = (n: string) => initialConflictStatus(toCheckHits(searchConflicts(n, s)), 'adverse');
    expect(asClient('Construction Rive-Nord inc.')).toBe('clair'); // client récurrent
    expect(asClient('Béton Laurentides')).toBe('potentiel'); // partie adverse ailleurs
    expect(asAdverse('Construction Rive-Nord')).toBe('potentiel'); // on agirait contre notre client
    expect(asAdverse('Béton Laurentides')).toBe('clair'); // déjà affronté : pas un conflit en soi
    expect(asClient('Zzyx Qwerty')).toBe('clair');
  });

  it('échéance par règle : date brute (prudente) et fondement', () => {
    // m-002 : QC ; 15 jours depuis le 9 juin 2026 → 24 juin (Fête nationale), date brute retenue.
    const d = buildDeadline({ matterId: 'm-002', assignedTo: 'st-02', ruleId: 'QC_REPONSE_ASSIGNATION', triggerDate: '2026-06-09' }, s, 'd-x');
    expect(d).toMatchObject({ dueDate: '2026-06-24', legalBasis: 'art. 145 C.p.c.', ruleId: 'QC_REPONSE_ASSIGNATION', kind: 'procedure' });
    expect(() => buildDeadline({ matterId: 'm-002', assignedTo: 'st-02', ruleId: 'ON_DEFENCE_20D', triggerDate: '2026-06-09' }, s, 'd')).toThrow(/ressort/);
    expect(() => buildDeadline({ matterId: 'm-002', assignedTo: 'st-02', title: 'X', kind: 'interne', dueDate: '2026-13-01x' }, s, 'd')).toThrow();
    expect(buildDeadline({ matterId: 'm-002', assignedTo: 'st-02', title: 'Appel client', kind: 'interne', dueDate: '2026-10-09' }, s, 'd').ruleId).toBeNull();
  });
});
