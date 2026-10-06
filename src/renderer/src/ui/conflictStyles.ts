import type { ConflictStatus } from '@shared/types';

/** Couleurs des statuts de conflit (violet = conflit, distinct du rouge des échéances). */
export const CONFLICT_COLORS: Record<ConflictStatus, string> = {
  en_cours: '#64748b',
  clair: '#2f9e6e',
  potentiel: '#8e4ec6',
  confirme: '#6b21a8',
};
