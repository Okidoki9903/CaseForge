import { describe, expect, it } from 'vitest';
import { flaggedMatters, initialConflictStatus, nameSimilarity, normalizeName, normalizedQuery, searchConflicts, toCheckHits } from './conflicts';
import type { ConflictCheck } from '../types';
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

  it('statut initial et dossiers signalés', () => {
    const s = buildDemoSnapshot('2026-10-06');
    const hits = toCheckHits(searchConflicts('Beton Laurentides', s));
    expect(initialConflictStatus(hits)).toBe('potentiel');
    expect(initialConflictStatus([])).toBe('clair');
    const base: ConflictCheck = { id: 'c', query: 'q', performedBy: 'HB', performedAt: '', status: 'potentiel', matterId: 'm-x', hits, updatedAt: null, updatedBy: null };
    const flagged = flaggedMatters([base, { ...base, id: 'd', status: 'clair', matterId: 'm-y' }, { ...base, id: 'e', status: 'confirme', hits: [] }]);
    expect(flagged.get('m-x')?.status).toBe('confirme');
    expect(flagged.get('m-x')?.checks).toHaveLength(2);
    expect(flagged.has(hits[0].roles[0].matterId)).toBe(true);
    expect(flagged.has('m-y')).toBe(false);
  });

  it('normalise la requête pour éviter les doublons', () => {
    expect(normalizedQuery('  Béton  LAURENTIDES ltée ')).toBe(normalizedQuery('beton laurentides'));
  });
});
