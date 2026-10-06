/**
 * Carte isométrique principale du cabinet.
 */
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { computeLayout } from './layout';
import { MatterUnit } from './MatterUnit';
import { SCENE_COLORS } from './palette';
import { SelectionLinks } from './SelectionLinks';
import { StaffUnit } from './StaffUnit';
import { CampusLife } from './CampusLife';
import { OfficeRoster } from './OfficeRoster';
import { buildStaffRoute, type RouteStop } from './staffNavigation';
import { StaffTraffic, type StaffMotion } from './StaffTraffic';

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
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const { snapshot, today, alerts, alertsByMatter, matterLevel, loads, areaById, conflicts } = derived;
  const select = useFirm((s) => s.select);
  const [interiorId, setInteriorId] = useState<string | null>(null);
  const traffic = useMemo(() => new Map<string, StaffMotion>(), []);
  const layout = useMemo(() => computeLayout(snapshot), [snapshot]);
  // Conteneur DOM des étiquettes, superposé au canvas.
  const labels = useRef<HTMLDivElement>(null!);
  // Résolution adaptative : baisse automatiquement sur les postes modestes.
  const [dpr, setDpr] = useState(1.5);
  // Effets cinématiques (occlusion ambiante, halo) : coupés si la machine peine.
  const [effects, setEffects] = useState(true);
  const [view, setView] = useState<'campus' | 'street' | 'plan' | 'office'>('campus');

  const stats = useMemo(
    () => new Map(snapshot.practiceAreas.map((a) => [a.id, areaStats(a, snapshot, today, alerts)])),
    [snapshot, today, alerts],
  );

  const staffSeats = useMemo(() => {
    const seats = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const p of derived.activeStaff) {
      seats.set(p.id, counts.get(p.practiceAreaId) ?? 0);
      counts.set(p.practiceAreaId, (counts.get(p.practiceAreaId) ?? 0) + 1);
    }
    return seats;
  }, [derived.activeStaff]);
  const staffPaths = useMemo(() => {
    const paths = new Map<string, RouteStop[]>();
    for (const p of derived.activeStaff) {
      const stops = snapshot.matters
        .filter(m => m.status === 'actif' && (m.responsibleId === p.id || m.teamIds.includes(p.id)) && layout.matters.has(m.id))
        .map(m => ({ areaId: m.practiceAreaId, position: layout.matters.get(m.id)! }));
      const seed = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0);
      paths.set(p.id, buildStaffRoute(layout, p.practiceAreaId, staffSeats.get(p.id) ?? 0, stops, seed));
    }
    return paths;
  }, [snapshot, layout, derived.activeStaff, staffSeats]);
  const openInterior = (id: string) => { setInteriorId(id); select({ kind: 'area', id }); };
  const closeInterior = () => { setInteriorId(null); setView('campus'); select(null); };
  const interiorArea = snapshot.practiceAreas.find(a => a.id === interiorId);

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
      <StaffTraffic.Provider value={traffic}>
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
      <CampusLife layout={layout} />

      {snapshot.practiceAreas.map((area) => (
        <Building key={area.id} area={area} stats={stats.get(area.id)!} layout={layout} overloaded={overloaded.get(area.id)}
          staffCount={staffCount.get(area.id) ?? 0}
          variant={snapshot.practiceAreas.indexOf(area)} cutaway={view === 'office' || interiorId === area.id} onEnter={() => openInterior(area.id)}
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
        <StaffUnit key={p.id} staff={p} load={loads.get(p.id)!} route={staffPaths.get(p.id) ?? []} center={layout.areas.get(p.practiceAreaId)?.center ?? [0, 0, 0]} interiorVisible={view === 'office' || interiorId === p.practiceAreaId} seat={staffSeats.get(p.id) ?? 0} />
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
        minPolarAngle={0.15}
        maxPolarAngle={1.35}
        minDistance={interiorId ? 10 : 28}
        maxDistance={230}
        screenSpacePanning={false}
      />
      <CameraRig layout={layout} view={view} interiorId={interiorId} />
      <EffectComposer multisampling={effects ? 4 : 2} enableNormalPass={false}>
        <N8AO enabled={effects} halfRes aoRadius={2.2} distanceFalloff={1.2} intensity={2.4} quality="medium" color="#2a3350" />
        <Bloom luminanceThreshold={0.92} luminanceSmoothing={0.2} intensity={effects ? 0.45 : 0} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
      </StaffTraffic.Provider>
      </LabelPortal.Provider>
    </Canvas>
    <div className="absolute bottom-20 left-4 z-10 rounded-2xl border border-white/70 bg-white/90 p-2 shadow-xl backdrop-blur-md" role="group" aria-label={en ? 'Campus views' : 'Vues du campus'}>
      <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{en ? 'Explore the firm' : 'Explorer le cabinet'}</div>
      <div className="flex flex-wrap gap-1">
        {([['campus', 'Campus'], ['street', en ? 'Stroll' : 'Promenade'], ['plan', en ? 'Top view' : 'Plan'], ['office', en ? 'Offices' : 'Bureaux']] as const).map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => { setInteriorId(null); select(null); setView(id); }} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${view === id ? 'bg-[#263b55] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}
      </div>
      <div className="px-2 pt-1 text-[10px] text-slate-500">{en ? 'Drag to explore · Scroll to zoom' : 'Glisser pour explorer · Molette pour zoomer'}</div>
    </div>
    {interiorArea && <div className="absolute left-4 top-[calc(var(--hud-top)+64px)] z-30 max-h-[calc(100%-var(--hud-top)-240px)] max-w-[300px] overflow-y-auto rounded-2xl border border-white/80 bg-white/95 p-3 shadow-xl">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{en ? 'Inside the building' : 'À l’intérieur du bâtiment'}</div>
      <div className="mt-1 text-sm font-bold text-slate-800">{interiorArea.name}</div>
      <p className="mt-1 text-xs text-slate-500">{en ? 'The team works here and uses the entrance to collect assigned files.' : 'L’équipe travaille ici et passe par l’entrée pour récupérer ses dossiers.'}</p>
      <OfficeRoster staff={derived.activeStaff.filter(p => p.practiceAreaId === interiorId)} traffic={traffic} en={en} onSelect={id => select({ kind: 'staff', id })} />
      <button onClick={closeInterior} className="mt-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white">{en ? 'Back to campus' : 'Retour au campus'}</button>
    </div>}
    <div className="absolute bottom-44 left-4 z-10">
      {!interiorArea && <select aria-label={en ? 'Visit a building' : 'Visiter un bâtiment'} value="" onChange={e => { if (e.target.value) openInterior(e.target.value); }} className="max-w-[310px] rounded-xl border border-white bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg">
        <option value="">{en ? 'Enter a building…' : 'Entrer dans un bâtiment…'}</option>
        {snapshot.practiceAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>}
    </div>
    <div ref={labels} className="pointer-events-none absolute inset-0 overflow-hidden" />
    </div>
  );
}
