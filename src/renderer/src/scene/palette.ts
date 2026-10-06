import { ALERT_COLORS } from '@shared/domain/alerts';
import type { StaffRole } from '@shared/types';

export { ALERT_COLORS };

export const SCENE_COLORS = {
  background: '#e9eef5',
  ground: '#dde5ef',
  plot: '#f7f9fc',
  lane: '#cfd8e5',
  path: '#eef2f8',
  window: '#b9c7da',
  selection: '#3b5bdb',
};

/** Dégradé du pipeline : de l'ouverture (froid) à la clôture (vert). */
export const STAGE_COLORS = ['#94a3b8', '#a78bfa', '#60a5fa', '#38bdf8', '#2dd4bf', '#fbbf24', '#fb7185', '#34d399'];

export const ROLE_COLORS: Record<StaffRole, string> = {
  associe: '#1e293b',
  avocat: '#334e9e',
  stagiaire: '#0e7490',
  parajuriste: '#7c3aed',
  adjoint: '#64748b',
};

export const LOAD_COLORS = { sain: '#2f9e6e', eleve: '#f5b100', surcharge: '#e5484d' } as const;
