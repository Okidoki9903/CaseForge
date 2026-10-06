/**
 * Carte isométrique principale du cabinet.
 */
import { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Lightformer, MapControls, PerformanceMonitor } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { areaStats } from '@shared/domain/metrics';
import { severityRank } from '@shared/domain/alerts';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { Building } from './Building';
import { CameraRig } from './CameraRig';
import { ExternalNode } from './ExternalNode';
import { FocusLighting } from './FocusLighting';
import { LabelPortal } from './MapLabel';
import { Ground } from './Ground';
import { computeLayout, type Vec3 } from './layout';
import { MatterUnit } from './MatterUnit';
import { SCENE_COLORS } from './palette';
import { SelectionLinks } from './SelectionLinks';
import { StaffUnit } from './StaffUnit';

/** Angle polaire de la vue « maquette » : légèrement plus rasant que l'isométrique pur. */
const VIEW_POLAR = 0.88;
const TARGET: [number, number, number] = [-1, 0, 3];
const DISTANCE = 100;
const AZIMUTH = Math.atan2(48, 54);
const CAMERA_POSITION: [number, number, number] = [
  TARGET[0] + DISTANCE * Math.sin(VIEW_POLAR) * Math.sin(AZIMUTH),
  DISTANCE * Math.cos(VIEW_POLAR),
  TARGET[2] + DISTANCE * Math.sin(VIEW_POLAR) * Math.cos(AZIMUTH),
];

/**
 * Éclairage d'ambiance « studio » entièrement généré localement (aucun fichier HDR téléchargé) :
 * reflets doux sur les vitrages et lumière chaude de fin de journée.
 */
function LocalEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffe2bd" position={[-14, 4, 10]} rotation-y={Math.PI / 3} scale={[18, 5, 1]} />
      <Lightformer form="rect" intensity={1.1} color="#c9d6ff" position={[14, 5, -10]} rotation-y={-Math.PI / 1.5} scale={[18, 6, 1]} />
      <Lightformer form="ring" intensity={1.4} color="#fff3e0" position={[8, 9, 12]} scale={5} />
    </Environment>
  );
}

export function CampusScene({ derived }: { derived: Derived }) {
  const { snapshot, today, alerts, alertsByMatter, matterLevel, loads, areaById, conflicts } = derived;
  const select = useFirm((s) => s.select);
  const layout = useMemo(() => computeLayout(snapshot), [snapshot]);
  // Conteneur DOM des étiquettes, superposé au canvas.
  const labels = useRef<HTMLDivElement>(null!);
  // Résolution adaptative : baisse automatiquement sur les postes modestes.
  const [dpr, setDpr] = useState(1.5);
  // Effets cinématiques (occlusion ambiante, halo) : coupés si la machine peine.
  const [effects, setEffects] = useState(true);

  const stats = useMemo(
    () => new Map(snapshot.practiceAreas.map((a) => [a.id, areaStats(a, snapshot, today, alerts)])),
    [snapshot, today, alerts],
  );

  const staffPaths = useMemo(() => {
    const paths = new Map<string, Vec3[]>();
    for (const p of derived.activeStaff) {
      const door = layout.areas.get(p.practiceAreaId)?.door;
      const stops = snapshot.matters
        .filter((m) => m.status === 'actif' && (m.responsibleId === p.id || m.teamIds.includes(p.id)))
        .map((m) => layout.matters.get(m.id))
        .filter((v): v is Vec3 => Boolean(v));
      paths.set(p.id, door ? [door, ...stops] : stops);
    }
    return paths;
  }, [snapshot, layout, derived.activeStaff]);

  /** Par pôle, le dossier à étiqueter en vue d'ensemble : alerte la plus grave, puis la plus proche. */
  const featured = useMemo(() => {
    const best = new Map<string, { id: string; rank: number; days: number }>();
    for (const m of snapshot.matters) {
      const first = (alertsByMatter.get(m.id) ?? [])[0];
      const level = matterLevel(m.id);
      const hasConflict = conflicts.has(m.id);
      if (!first && !hasConflict) continue;
      if (level === 'ok' || level === 'attention') {
        if (!hasConflict) continue;
      }
      const rank = level === 'ok' || level === 'attention' ? 9 : severityRank(level);
      const days = first?.daysLeft ?? 9999;
      const cur = best.get(m.practiceAreaId);
      if (!cur || rank < cur.rank || (rank === cur.rank && days < cur.days)) best.set(m.practiceAreaId, { id: m.id, rank, days });
    }
    return new Set([...best.values()].map((b) => b.id));
  }, [snapshot, alertsByMatter, matterLevel, conflicts]);

  const overloaded = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of derived.activeStaff) {
      if (loads.get(p.id)?.level !== 'surcharge') continue;
      map.set(p.practiceAreaId, [...(map.get(p.practiceAreaId) ?? []), p.initials]);
    }
    return map;
  }, [derived.activeStaff, loads]);

  const staffCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of derived.activeStaff) map.set(p.practiceAreaId, (map.get(p.practiceAreaId) ?? 0) + 1);
    return map;
  }, [derived.activeStaff]);

  const partyRoles = useMemo(() => {
    const roles = new Map<string, (typeof snapshot.matterParties)[number]['role']>();
    for (const mp of snapshot.matterParties) if (!roles.has(mp.partyId)) roles.set(mp.partyId, mp.role);
    return roles;
  }, [snapshot]);

  return (
    <div className="relative h-full w-full bg-[linear-gradient(180deg,#dfe7f3_0%,#eef1f6_45%,#f4f1ea_100%)]">
    <Canvas
      shadows="soft"
      dpr={dpr}
      gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
      camera={{ position: CAMERA_POSITION, fov: 30, near: 1, far: 900 }}
      onPointerMissed={() => select(null)}
    >
      <LabelPortal.Provider value={labels}>
      <PerformanceMonitor
        onDecline={() => { setDpr(1); setEffects(false); }}
        onIncline={() => setDpr(1.5)}
        flipflops={3}
        onFallback={() => { setDpr(1); setEffects(false); }}
      />
      <fog attach="fog" args={[SCENE_COLORS.background, 210, 460]} />
      <LocalEnvironment />
      <FocusLighting />

      <Ground layout={layout} />

      {snapshot.practiceAreas.map((area) => (
        <Building key={area.id} area={area} stats={stats.get(area.id)!} layout={layout} overloaded={overloaded.get(area.id)}
          staffCount={staffCount.get(area.id) ?? 0}
          variant={snapshot.practiceAreas.indexOf(area)}
        />
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
              stackIndex={layout.stack.get(m.id)}
              featured={featured.has(m.id)}
            />
          );
        })}

      {derived.activeStaff.map((p) => (
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
        target={TARGET}
        enableDamping
        dampingFactor={0.12}
        minPolarAngle={VIEW_POLAR}
        maxPolarAngle={VIEW_POLAR}
        minDistance={28}
        maxDistance={230}
        screenSpacePanning={false}
      />
      <CameraRig layout={layout} />
      <EffectComposer multisampling={effects ? 4 : 2} enableNormalPass={false}>
        <N8AO enabled={effects} halfRes aoRadius={2.2} distanceFalloff={1.2} intensity={2.4} quality="medium" color="#2a3350" />
        <Bloom luminanceThreshold={0.92} luminanceSmoothing={0.2} intensity={effects ? 0.45 : 0} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
      </LabelPortal.Provider>
    </Canvas>
    <div ref={labels} className="pointer-events-none absolute inset-0 overflow-hidden" />
    </div>
  );
}
