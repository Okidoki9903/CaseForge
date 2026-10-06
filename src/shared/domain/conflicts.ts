/**
 * Vérification de conflits d'intérêts — recherche floue sur toutes les parties connues
 * (clients, parties adverses, parties liées), y compris leurs noms antérieurs.
 *
 * La normalisation retire accents, ponctuation et formes juridiques (inc., ltée,
 * s.e.n.c.r.l., LLP…) pour que « Groupe Tremblay Ltée » trouve « GROUPE TREMBLAY INC. ».
 */
import type { FirmSnapshot, Matter, Party, PartyRole } from '../types';

const LEGAL_FORMS = new Set([
  'inc', 'incorporee', 'incorporated', 'ltee', 'limitee', 'ltd', 'limited', 'corp', 'corporation', 'cie', 'co',
  'senc', 'sencrl', 'srl', 'llp', 'lp', 'sa', 'societe', 'enr', 'the', 'le', 'la', 'les', 'de', 'du', 'des', 'et', 'and',
]);

export function normalizeName(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t && !LEGAL_FORMS.has(t));
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** Similarité 0–1 : maximum entre Dice sur trigrammes et recouvrement de jetons. */
export function nameSimilarity(a: string, b: string): number {
  const ta = normalizeName(a);
  const tb = normalizeName(b);
  if (!ta.length || !tb.length) return 0;
  const ga = trigrams([...ta].sort().join(' '));
  const gb = trigrams([...tb].sort().join(' '));
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter++;
  const dice = (2 * inter) / (ga.size + gb.size);
  const setB = new Set(tb);
  const shared = ta.filter((t) => setB.has(t)).length;
  const overlap = shared / Math.min(ta.length, tb.length);
  return Math.max(dice, overlap * 0.95);
}

export interface ConflictHit {
  party: Party;
  matchedName: string;
  score: number;
  roles: { matter: Matter; role: PartyRole }[];
}

export function searchConflicts(query: string, s: FirmSnapshot, threshold = 0.6): ConflictHit[] {
  if (normalizeName(query).length === 0) return [];
  const mattersById = new Map(s.matters.map((m) => [m.id, m]));
  const hits: ConflictHit[] = [];
  for (const party of s.parties) {
    let best = 0;
    let matchedName = party.name;
    for (const name of [party.name, ...party.aliases]) {
      const score = nameSimilarity(query, name);
      if (score > best) {
        best = score;
        matchedName = name;
      }
    }
    if (best < threshold) continue;
    const roles = s.matterParties
      .filter((mp) => mp.partyId === party.id)
      .map((mp) => ({ matter: mattersById.get(mp.matterId)!, role: mp.role }))
      .filter((r) => r.matter);
    hits.push({ party, matchedName, score: best, roles });
  }
  return hits.sort((a, b) => b.score - a.score);
}
