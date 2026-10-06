/**
 * Carte isométrique principale du cabinet.
 */
import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import { areaStats } from '@shared/domain/metrics';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { Building } from './Building';
import { CameraRig } from './CameraRig';
import { ExternalNode } from './ExternalNode';
import { FocusLighting } from './FocusLighting';
import { Ground } from './Ground';
import { computeLayout, type Vec3 } from './layout';
import { MatterUnit } from './MatterUnit';
import { SCENE_COLORS } from './palette';
import { SelectionLinks } from './SelectionLinks';
import { StaffUnit } from './StaffUnit';

/** Angle polaire isométrique « vrai » : arctan(√2) ≈ 54,7°. */
const ISO_POLAR = Math.atan(Math.SQRT2);

export function CampusScene({ derived }: { derived: Derived }) {
  const { snapshot, today, alerts, alertsByMatter, matterLevel, loads, areaById, conflicts } = derived;
  const select = useFirm((s) => s.select);
  const layout = useMemo(() => computeLayout(snapshot), [snapshot]);

  const stats = useMemo(
    () => new Map(snapshot.practiceAreas.map((a) => [a.id, areaStats(a, snapshot, today, alerts)])),
    [snapshot, today, alerts],
  );

  const staffPaths = useMemo(() => {
    const paths = new Map<string, Vec3[]>();
    for (const p of snapshot.staff) {
      const door = layout.areas.get(p.practiceAreaId)?.door;
      const stops = snapshot.matters
        .filter((m) => m.status === 'actif' && (m.responsibleId === p.id || m.teamIds.includes(p.id)))
        .map((m) => layout.matters.get(m.id))
        .filter((v): v is Vec3 => Boolean(v));
      paths.set(p.id, door ? [door, ...stops] : stops);
    }
    return paths;
  }, [snapshot, layout]);

  const partyRoles = useMemo(() => {
    const roles = new Map<string, (typeof snapshot.matterParties)[number]['role']>();
    for (const mp of snapshot.matterParties) if (!roles.has(mp.partyId)) roles.set(mp.partyId, mp.role);
    return roles;
  }, [snapshot]);

  return (
    <Canvas
      shadows
      orthographic
      dpr={[1, 2]}
      camera={{ position: [48, 48, 54], zoom: 15, near: -500, far: 2000 }}
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={[SCENE_COLORS.background]} />
      <fog attach="fog" args={[SCENE_COLORS.background, 160, 320]} />
      <FocusLighting />

      <Ground layout={layout} />

      {snapshot.practiceAreas.map((area) => (
        <Building key={area.id} area={area} stats={stats.get(area.id)!} layout={layout} />
      ))}

      {snapshot.matters
        .filter((m) => m.status !== 'ferme' && layout.matters.has(m.id))
        .map((m) => {
          const pending = (alertsByMatter.get(m.id) ?? [])[0];
          return (
            <MatterUnit
              key={m.id}
              matter={m}
              color={areaById.get(m.practiceAreaId)?.color ?? '#94a3b8'}
              target={layout.matters.get(m.id)!}
              level={matterLevel(m.id)}
              nextAlert={pending}
              conflict={conflicts.get(m.id)?.status}
            />
          );
        })}

      {snapshot.staff.map((p) => (
        <StaffUnit key={p.id} staff={p} load={loads.get(p.id)!} waypoints={staffPaths.get(p.id) ?? []} />
      ))}

      {snapshot.parties
        .filter((p) => layout.parties.has(p.id))
        .map((p) => (
          <ExternalNode key={p.id} party={p} role={partyRoles.get(p.id) ?? 'liee'} position={layout.parties.get(p.id)!} />
        ))}

      <SelectionLinks layout={layout} derived={derived} />

      <MapControls
        makeDefault
        target={[0, 0, 6]}
        enableDamping
        dampingFactor={0.12}
        minPolarAngle={ISO_POLAR}
        maxPolarAngle={ISO_POLAR}
        minZoom={6}
        maxZoom={60}
        screenSpacePanning={false}
      />
      <CameraRig layout={layout} />
    </Canvas>
  );
}
