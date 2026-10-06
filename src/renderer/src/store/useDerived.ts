/**
 * Valeurs dérivées mémoïsées (alertes, indicateurs) à partir de l'instantané.
 */
import { useMemo } from 'react';
import { buildAlerts, type DeadlineAlert, worstLevel } from '@shared/domain/alerts';
import { firmKpis, staffLoad, type StaffLoad } from '@shared/domain/metrics';
import { flaggedMatters } from '@shared/domain/conflicts';
import type { Id } from '@shared/types';
import { useFirm } from './useFirm';

export function useDerived() {
  const snapshot = useFirm((s) => s.snapshot);
  const today = useFirm((s) => s.today);

  return useMemo(() => {
    if (!snapshot) return null;
    const alerts = buildAlerts(snapshot.deadlines, snapshot.matters, today);
    const alertsByMatter = new Map<Id, DeadlineAlert[]>();
    for (const a of alerts) alertsByMatter.set(a.matter.id, [...(alertsByMatter.get(a.matter.id) ?? []), a]);
    const matterLevel = (id: Id) => worstLevel(alertsByMatter.get(id) ?? []);
    const activeStaff = snapshot.staff.filter((p) => p.active);
    const loads = new Map<Id, StaffLoad>(snapshot.staff.map((p) => [p.id, staffLoad(p, snapshot, today, alerts)]));
    return {
      snapshot,
      today,
      alerts,
      alertsByMatter,
      matterLevel,
      loads,
      kpis: firmKpis(snapshot, today, alerts),
      /** Dossiers visés par une vérification de conflits potentielle ou confirmée. */
      conflicts: flaggedMatters(snapshot.conflictChecks),
      staffById: new Map(snapshot.staff.map((p) => [p.id, p])),
      /** Collaborateurs actifs (les anciens restent visibles dans l'historique et les entrées de temps). */
      activeStaff,
      partyById: new Map(snapshot.parties.map((p) => [p.id, p])),
      areaById: new Map(snapshot.practiceAreas.map((a) => [a.id, a])),
    };
  }, [snapshot, today]);
}

export type Derived = NonNullable<ReturnType<typeof useDerived>>;
