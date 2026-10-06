/**
 * Disposition du campus : fonction pure qui place bâtiments, dossiers et nœuds externes.
 *
 *   Bâtiment (pôle)
 *   ┌────────┐
 *   │        │
 *   └────────┘
 *   ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢   ← « quai » de pipeline : une plateforme par étape,
 *   ●     ●   ●          les dossiers s'empilent devant la plateforme de leur étape.
 */
import { PIPELINE_STAGES, type FirmSnapshot, type Id } from '@shared/types';

export type Vec3 = [number, number, number];

export const CAMPUS_SPACING = 11;
export const BUILDING_SIZE = 4.2;
export const PAD_GAP = 1.15;
const LANE_OFFSET = BUILDING_SIZE / 2 + 1.4;

export interface CampusLayout {
  areas: Map<Id, { center: Vec3; door: Vec3; height: number }>;
  pads: Map<string, Vec3>;
  matters: Map<Id, Vec3>;
  /** Rang du dossier dans la pile de sa plateforme (0 = devant) : sert à étager les étiquettes. */
  stack: Map<Id, number>;
  parties: Map<Id, Vec3>;
  bounds: number;
}

export function padKey(areaId: Id, stageIndex: number) {
  return `${areaId}:${stageIndex}`;
}

export function computeLayout(s: FirmSnapshot): CampusLayout {
  const areas = new Map<Id, { center: Vec3; door: Vec3; height: number }>();
  const pads = new Map<string, Vec3>();
  const matters = new Map<Id, Vec3>();
  const stack = new Map<Id, number>();

  for (const area of s.practiceAreas) {
    const cx = area.gridX * CAMPUS_SPACING;
    const cz = area.gridZ * CAMPUS_SPACING;
    const active = s.matters.filter((m) => m.practiceAreaId === area.id && m.status !== 'ferme');
    // La hauteur reflète le volume de dossiers actifs.
    areas.set(area.id, { center: [cx, 0, cz], door: [cx, 0, cz + BUILDING_SIZE / 2 + 0.6], height: 2.2 + active.length * 0.55 });

    PIPELINE_STAGES.forEach((stage, i) => {
      const px = cx + (i - (PIPELINE_STAGES.length - 1) / 2) * PAD_GAP;
      const pz = cz + LANE_OFFSET;
      pads.set(padKey(area.id, i), [px, 0, pz]);
      active
        .filter((m) => m.stage === stage)
        .forEach((m, k) => {
          matters.set(m.id, [px, 0, pz + 0.95 + k * 1.4]);
          stack.set(m.id, k);
        });
    });
  }

  // Nœuds externes : tribunaux à l'est, clients à l'ouest, parties adverses au nord.
  const parties = new Map<Id, Vec3>();
  const ring = (ids: Id[], fixed: 'x' | 'z', value: number, spread: number) =>
    ids.forEach((id, i) => {
      const t = ids.length === 1 ? 0 : i / (ids.length - 1) - 0.5;
      parties.set(id, fixed === 'x' ? [value, 0, t * spread] : [t * spread, 0, value]);
    });
  const roleOf = (id: Id) => s.matterParties.find((mp) => mp.partyId === id)?.role;
  const linked = s.parties.filter((p) => roleOf(p.id));
  ring(linked.filter((p) => p.kind === 'tribunal').map((p) => p.id), 'x', 2.4 * CAMPUS_SPACING, 3 * CAMPUS_SPACING);
  ring(linked.filter((p) => roleOf(p.id) === 'client').map((p) => p.id), 'x', -2.3 * CAMPUS_SPACING, 3.4 * CAMPUS_SPACING);
  ring(linked.filter((p) => p.kind !== 'tribunal' && roleOf(p.id) !== 'client').map((p) => p.id), 'z', -2.2 * CAMPUS_SPACING, 3.4 * CAMPUS_SPACING);

  return { areas, pads, matters, stack, parties, bounds: 3 * CAMPUS_SPACING };
}
