import { describe, expect, it } from 'vitest';
import { nameSimilarity, normalizeName, searchConflicts } from './conflicts';
import { buildDemoSnapshot } from '../seed';

describe('vérification de conflits', () => {
  it('normalise accents et formes juridiques', () => {
    expect(normalizeName('Béton Laurentides Ltée')).toEqual(['beton', 'laurentides']);
    expect(normalizeName('Cliniques Horizon S.E.N.C.R.L.')).toEqual(['cliniques', 'horizon']);
  });

  it('reconnaît une variante de raison sociale', () => {
    expect(nameSimilarity('BETON LAURENTIDES INC.', 'Béton Laurentides ltée')).toBeGreaterThan(0.9);
    expect(nameSimilarity('Techno Boréal', 'Studio Aurore')).toBeLessThan(0.4);
  });

  it('trouve une partie adverse et ses dossiers, y compris par ancien nom', () => {
    const s = buildDemoSnapshot('2026-10-06');
    const hits = searchConflicts('Beton Laurentides', s);
    expect(hits[0].party.name).toBe('Béton Laurentides ltée');
    expect(hits[0].roles[0].role).toBe('adverse');
    const alias = searchConflicts('Batiments Rive Nord', s);
    expect(alias[0].party.name).toBe('Construction Rive-Nord inc.');
  });
});
