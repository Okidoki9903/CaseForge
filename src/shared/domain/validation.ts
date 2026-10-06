/**
 * Validations partagées entre SQLite (Electron) et IndexedDB (démo) :
 * une même règle métier ne doit jamais diverger d'un moteur de stockage à l'autre.
 */

/** Initiales nominatives : 2 à 4 lettres (accents permis), normalisées en majuscules. */
export function normalizeInitials(raw: unknown): string {
  const who = String(raw ?? '').trim().toUpperCase();
  if (!/^[A-ZÀ-ÖØ-Ý]{2,4}$/.test(who)) throw new Error('Initiales invalides (2 à 4 lettres).');
  return who;
}
