/**
 * Bâtiment d'un pôle — architecture contemporaine : socle en béton clair, mur-rideau en verre
 * réfléchissant, dalles d'étage et ailettes verticales, fenêtres éclairées chaudes, toit-terrasse
 * végétalisé, auvent d'entrée au liseré de la couleur du pôle. Plus son quai de pipeline.
 */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { Color, InstancedMesh, Object3D, type Mesh, type MeshBasicMaterial } from 'three';
import { PIPELINE_STAGES, type PracticeArea } from '@shared/types';
import type { AreaStats } from '@shared/domain/metrics';
import { useTranslation } from 'react-i18next';
import { useFirm } from '../store/useFirm';
import { ALERT_COLORS, SCENE_COLORS, STAGE_COLORS } from './palette';
import { BUILDING_SIZE, PAD_GAP, padKey, type CampusLayout } from './layout';
import { MapLabel } from './MapLabel';
import { OfficeInterior } from './OfficeInterior';

interface Props {
  area: PracticeArea;
  stats: AreaStats;
  layout: CampusLayout;
  /** Initiales des collaborateurs du pôle en surcharge. */
  overloaded?: string[];
  /** Nombre de collaborateurs actifs du pôle. */
  staffCount?: number;
  /** Variante architecturale (proportions, toit). */
  variant?: number;
  cutaway?: boolean;
}

const FLOOR_H = 0.62;

/** Pictogrammes des pôles (SVG, aucune police d'icônes externe). */
const AREA_ICONS: Record<string, ReactNode> = {
  LIT: <path d="M12 3v18M5 7h14M7 7l-3 6a3 3 0 0 0 6 0L7 7Zm10 0-3 6a3 3 0 0 0 6 0l-3-6ZM8 21h8" />,
  AFF: <><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M11 21v-3h2v3" /></>,
  TRV: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5h6v2M3 13h18" /></>,
  FAM: <><circle cx="8" cy="7" r="2.5" /><circle cx="16" cy="7" r="2.5" /><path d="M3 20c0-3 2.2-5.5 5-5.5s5 2.5 5 5.5M11 20c0-3 2.2-5.5 5-5.5s5 2.5 5 5.5" /></>,
  PI: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3Z" /></>,
};
const FALLBACK_ICON = <rect x="4" y="4" width="16" height="16" rx="2" />;

/** Ailettes verticales et fenêtres chaudes en instances (une seule passe de rendu chacune). */
function Facade({ w, d, h, seed }: { w: number; d: number; h: number; seed: number }) {
  const fins = useRef<InstancedMesh>(null);
  const lit = useRef<InstancedMesh>(null);
  const { finCount, litPanels } = useMemo(() => {
    const spacing = 0.42;
    const front = Math.floor(w / spacing);
    const side = Math.floor(d / spacing);
    const floors = Math.max(1, Math.floor(h / FLOOR_H));
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const panels: [number, number, number, number][] = []; // x, y, z, rotY
    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < front; i++) if (rnd() < 0.2) panels.push([-w / 2 + (i + 0.5) * spacing, f * FLOOR_H + FLOOR_H / 2, d / 2 + 0.012, 0]);
      for (let i = 0; i < side; i++) if (rnd() < 0.2) panels.push([w / 2 + 0.012, f * FLOOR_H + FLOOR_H / 2, -d / 2 + (i + 0.5) * spacing, Math.PI / 2]);
    }
    return { finCount: front + 1 + side + 1, litPanels: panels };
  }, [w, d, h, seed]);

  useLayoutEffect(() => {
    const o = new Object3D();
    const spacing = 0.42;
    const front = Math.floor(w / spacing);
    let k = 0;
    for (let i = 0; i <= front; i++) {
      o.position.set(-w / 2 + i * (w / front), h / 2, d / 2 + 0.05);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      fins.current?.setMatrixAt(k++, o.matrix);
    }
    const side = finCount - front - 1;
    for (let i = 0; i < side; i++) {
      o.position.set(w / 2 + 0.05, h / 2, -d / 2 + i * (d / (side - 1 || 1)));
      o.rotation.set(0, Math.PI / 2, 0);
      o.updateMatrix();
      fins.current?.setMatrixAt(k++, o.matrix);
    }
    if (fins.current) fins.current.instanceMatrix.needsUpdate = true;
    litPanels.forEach(([x, y, z, r], i) => {
      o.position.set(x, y, z);
      o.rotation.set(0, r, 0);
      o.updateMatrix();
      lit.current?.setMatrixAt(i, o.matrix);
    });
    if (lit.current) lit.current.instanceMatrix.needsUpdate = true;
  }, [w, d, h, finCount, litPanels]);

  return (
    <>
      <instancedMesh ref={fins} args={[undefined, undefined, finCount]} castShadow>
        <boxGeometry args={[0.05, h, 0.1]} />
        <meshStandardMaterial color={SCENE_COLORS.concrete} roughness={0.55} />
      </instancedMesh>
      {litPanels.length > 0 && (
        <instancedMesh ref={lit} args={[undefined, undefined, litPanels.length]}>
          <planeGeometry args={[0.34, FLOOR_H * 0.72]} />
          <meshStandardMaterial color={SCENE_COLORS.warmLight} emissive={SCENE_COLORS.warmLight} emissiveIntensity={0.8} toneMapped={false} />
        </instancedMesh>
      )}
    </>
  );
}

/** Volume vitré avec dalles d'étage. */
function GlassVolume({ w, d, h, seed }: { w: number; d: number; h: number; seed: number }) {
  const floors = Math.max(1, Math.floor(h / FLOOR_H));
  return (
    <group>
      <mesh position-y={h / 2} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={SCENE_COLORS.glass} metalness={0.75} roughness={0.12} envMapIntensity={1.4} />
      </mesh>
      {Array.from({ length: floors + 1 }, (_, f) => (
        <mesh key={f} position-y={f * FLOOR_H} castShadow receiveShadow>
          <boxGeometry args={[w + 0.14, 0.07, d + 0.14]} />
          <meshStandardMaterial color={SCENE_COLORS.concrete} roughness={0.5} />
        </mesh>
      ))}
      <Facade w={w} d={d} h={h} seed={seed} />
    </group>
  );
}

/** Toit-terrasse végétalisé avec jardinières. */
function GreenRoof({ w, d }: { w: number; d: number }) {
  return (
    <group>
      <mesh position-y={0.06} receiveShadow>
        <boxGeometry args={[w - 0.2, 0.08, d - 0.2]} />
        <meshStandardMaterial color={SCENE_COLORS.lawn} roughness={0.95} />
      </mesh>
      {[[-w / 2 + 0.45, -d / 2 + 0.45], [w / 2 - 0.45, -d / 2 + 0.45], [-w / 2 + 0.45, d / 2 - 0.45]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.32, z]} castShadow>
          <icosahedronGeometry args={[0.32, 1]} />
          <meshStandardMaterial color={i % 2 ? '#7fa36e' : '#6f955f'} roughness={0.85} />
        </mesh>
      ))}
      {/* Terrasse de travail, mobilier en bois et panneaux solaires. */}
      <mesh position={[w * 0.15, 0.23, d * 0.1]} castShadow>
        <cylinderGeometry args={[0.38, 0.38, 0.07, 16]} />
        <meshStandardMaterial color="#9d7653" roughness={0.7} />
      </mesh>
      <mesh position={[w * 0.15, 0.13, d * 0.1]} castShadow>
        <cylinderGeometry args={[0.04, 0.08, 0.2, 8]} />
        <meshStandardMaterial color="#34434e" />
      </mesh>
      {[-1, 1].map(side => <mesh key={side} position={[w * 0.15 + side * 0.55, 0.17, d * 0.1]} castShadow>
        <boxGeometry args={[0.3, 0.12, 0.35]} />
        <meshStandardMaterial color="#a88a62" />
      </mesh>)}
      {[0, 1].map(i => <group key={i} position={[-w * 0.19 + i * 0.62, 0.18, -d * 0.25]} rotation-x={-0.16}>
        <mesh castShadow><boxGeometry args={[0.54, 0.045, 0.64]} /><meshStandardMaterial color="#233d59" metalness={0.45} roughness={0.28} /></mesh>
        {[-0.16, 0, 0.16].map(x => <mesh key={x} position={[x, 0.025, 0]}><boxGeometry args={[0.008, 0.004, 0.6]} /><meshStandardMaterial color="#7e9db7" /></mesh>)}
      </group>)}
      {/* Garde-corps vitré */}
      <mesh position-y={0.22}>
        <boxGeometry args={[w + 0.02, 0.3, d + 0.02]} />
        <meshStandardMaterial color="#cfe0ee" transparent opacity={0.18} metalness={0.2} roughness={0.05} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Bâtiment complet : socle, 1 ou 2 volumes vitrés en gradins, toit végétalisé, entrée. */
function ModernBuilding({ height, accent, variant, alarmColor }: { height: number; accent: string; variant: number; alarmColor: string | null }) {
  const S = BUILDING_SIZE;
  const halo = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!halo.current) return;
    const m = halo.current.material as MeshBasicMaterial;
    m.opacity = alarmColor ? 0.45 + 0.35 * Math.sin(clock.elapsedTime * 4) : 0;
  });
  // Proportions variées selon le pôle : tour, barre, volumes en gradins.
  const v = variant % 4;
  const lowerH = v === 1 ? height * 0.55 : v === 3 ? height * 0.45 : height * 0.62;
  const upper = { w: v === 1 ? S * 0.62 : S * 0.72, d: v === 2 ? S * 0.6 : S * 0.7, h: height - lowerH };
  const upperX = v === 2 ? -S * 0.12 : v === 3 ? S * 0.1 : 0;
  return (
    <group>
      {/* Socle */}
      <RoundedBox args={[S + 0.5, 0.28, S + 0.5]} radius={0.06} position-y={0.14} castShadow receiveShadow>
        <meshStandardMaterial color={SCENE_COLORS.concreteShade} roughness={0.7} />
      </RoundedBox>
      <group position-y={0.28}>
        <GlassVolume w={S} d={S} h={lowerH} seed={variant * 97 + 13} />
        <group position={[0, lowerH + 0.04, 0]}>
          {upper.h > 0.8 ? (
            <>
              <group position={[upperX, 0, -S * 0.08]}>
                <GlassVolume w={upper.w} d={upper.d} h={upper.h} seed={variant * 31 + 7} />
                <group position-y={upper.h + 0.04}>
                  <GreenRoof w={upper.w} d={upper.d} />
                </group>
              </group>
              {/* Terrasse végétalisée sur le volume bas */}
              <mesh position={[0, 0.05, S * 0.36]} receiveShadow>
                <boxGeometry args={[S - 0.3, 0.06, S * 0.22]} />
                <meshStandardMaterial color={SCENE_COLORS.lawn} roughness={0.95} />
              </mesh>
            </>
          ) : (
            <GreenRoof w={S} d={S} />
          )}
        </group>
        {/* Auvent d'entrée et liseré à la couleur du pôle */}
        <mesh position={[0, 0.95, S / 2 + 0.45]} castShadow>
          <boxGeometry args={[1.8, 0.06, 0.9]} />
          <meshStandardMaterial color={SCENE_COLORS.concrete} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.98, S / 2 + 0.905]}>
          <boxGeometry args={[1.8, 0.1, 0.02]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, 0.45, S / 2 + 0.02]}>
          <planeGeometry args={[1.1, 0.85]} />
          <meshStandardMaterial color={SCENE_COLORS.warmLight} emissive={SCENE_COLORS.warmLight} emissiveIntensity={0.9} toneMapped={false} />
        </mesh>
      </group>
      {/* Halo d'alerte discret au pied du bâtiment */}
      <mesh ref={halo} rotation-x={-Math.PI / 2} position-y={0.03}>
        <ringGeometry args={[S * 0.78, S * 0.86, 64]} />
        <meshBasicMaterial color={alarmColor ?? '#ffffff'} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Bâtiment d'un pôle + son quai de pipeline. */
export function Building({ area, stats, layout, overloaded = [], staffCount = 0, variant = 0, cutaway = false }: Props) {
  const { t } = useTranslation();
  const select = useFirm((s) => s.select);
  const hover = useFirm((s) => s.hover);
  const selected = useFirm((s) => s.selection?.kind === 'area' && s.selection.id === area.id);
  const stageFilter = useFirm((s) => s.stageFilter);
  const [hovered, setHovered] = useState(false);
  const { center, height } = layout.areas.get(area.id)!;
  const [cx, , cz] = center;
  const alarming = stats.worst === 'depasse' || stats.worst === 'critique';
  const dot = alarming ? ALERT_COLORS[stats.worst] : stats.worst === 'urgent' ? ALERT_COLORS.urgent : '#3a4fd8';
  const laneZ = layout.pads.get(padKey(area.id, 0))![2];
  const showStages = selected || hovered;
  const towerH = 2.6 + (height - 2.2) * 0.9;
  const accent = useMemo(() => new Color(area.color).getStyle(), [area.color]);

  return (
    <group>
      {/* Parcelle pavée */}
      <RoundedBox args={[PIPELINE_STAGES.length * PAD_GAP + 2.2, 0.12, BUILDING_SIZE + 7.4]} radius={0.05} position={[cx, 0.06, cz + 2.2]} receiveShadow>
        <meshStandardMaterial color={selected ? '#eef0ff' : SCENE_COLORS.plot} roughness={0.85} />
      </RoundedBox>

      <group
        position={[cx, 0.12, cz]}
        onClick={(e) => {
          e.stopPropagation();
          select({ kind: 'area', id: area.id });
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          hover({ kind: 'area', id: area.id });
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          hover(null);
          document.body.style.cursor = '';
        }}
      >
        <group scale={cutaway ? 1.35 : 1}>
          {cutaway ? <OfficeInterior accent={accent} /> : <ModernBuilding height={towerH} accent={accent} variant={variant} alarmColor={alarming ? ALERT_COLORS[stats.worst] : null} />}
        </group>
        <MapLabel position={[0, towerH + 1.6, 0]}>
          <div
            className={`flex items-center gap-2.5 rounded-2xl bg-white/95 py-1.5 pl-1.5 pr-3 shadow-[0_10px_28px_-12px_rgba(30,41,80,0.45)] ring-1 transition ${
              selected || hovered ? 'ring-[#3a4fd8]/40' : 'ring-white'
            }`}
            style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: `${area.color}1a`, color: area.color }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {AREA_ICONS[area.code] ?? FALLBACK_ICON}
              </svg>
            </span>
            <span className="leading-tight">
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#1f2a44]">
                {area.name}
                <span className={`h-2 w-2 rounded-full ${alarming ? 'animate-alert' : ''}`} style={{ background: dot }} />
              </span>
              <span className="block text-[11px] text-slate-500">
                {t('scene.areaMeta', { matters: stats.activeMatters, staff: staffCount })}
                {stats.alertCount > 0 && (
                  <span className="font-semibold" style={{ color: ALERT_COLORS[stats.worst] }}> · {t('scene.alerts', { count: stats.alertCount })}</span>
                )}
                {overloaded.length > 0 && <span className="font-semibold text-[var(--color-critique)]"> · 🔥 {overloaded.join(' ')}</span>}
              </span>
            </span>
          </div>
        </MapLabel>
      </group>

      {/* Quai de pipeline : bande sombre et plateformes par étape */}
      <mesh position={[cx, 0.15, laneZ]} receiveShadow>
        <boxGeometry args={[PIPELINE_STAGES.length * PAD_GAP + 0.3, 0.04, 0.95]} />
        <meshStandardMaterial color={SCENE_COLORS.lane} metalness={0.4} roughness={0.35} />
      </mesh>
      {PIPELINE_STAGES.map((stage, i) => {
        const [px, , pz] = layout.pads.get(padKey(area.id, i))!;
        const dim = stageFilter && stageFilter !== stage;
        return (
          <group key={stage} position={[px, 0.19, pz]}>
            <mesh receiveShadow>
              <boxGeometry args={[PAD_GAP - 0.2, 0.04, 0.72]} />
              <meshStandardMaterial color={STAGE_COLORS[i]} emissive={STAGE_COLORS[i]} emissiveIntensity={0.25} transparent opacity={dim ? 0.2 : 0.95} roughness={0.3} />
            </mesh>
            {showStages && (
              <MapLabel position={[0, 0.1, 0.55]}>
                <div className="pointer-events-none -rotate-12 text-[9px] font-semibold text-[var(--color-muted)]">{t(`stage.${stage}`)}</div>
              </MapLabel>
            )}
          </group>
        );
      })}
    </group>
  );
}
