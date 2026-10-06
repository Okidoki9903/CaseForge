import { ALERT_COLORS } from '@shared/domain/alerts';
import type { StaffRole } from '@shared/types';

export { ALERT_COLORS };

export const SCENE_COLORS = {
  background: '#eef1f6',
  fog: '#eef1f6',
  ground: '#e7e3db',
  paving: '#efece6',
  plot: '#f4f2ed',
  lawn: '#9fbb8c',
  lawnDark: '#86a676',
  hedge: '#6f9161',
  concrete: '#f2f0eb',
  concreteShade: '#e3e0d9',
  glass: '#6f8aa6',
  glassDark: '#4f6a86',
  warmLight: '#ffd7a1',
  water: '#9cc9e4',
  lane: '#3b4256',
  path: '#f3f1ec',
  window: '#b9c7da',
  selection: '#3a4fd8',
};

/** Dégradé du pipeline : de l'ouverture (froid) à la clôture (vert). */
export const STAGE_COLORS = ['#94a3b8', '#a78bfa', '#60a5fa', '#38bdf8', '#2dd4bf', '#fbbf24', '#fb7185', '#34d399'];

export const ROLE_COLORS: Record<StaffRole, string> = {
  associe: '#1f2a44',
  avocat: '#33427a',
  stagiaire: '#2f6f86',
  parajuriste: '#5b4fa8',
  adjoint: '#5d6878',
};

export const LOAD_COLORS = { sain: '#2f9e6e', eleve: '#f5b100', surcharge: '#e5484d' } as const;
