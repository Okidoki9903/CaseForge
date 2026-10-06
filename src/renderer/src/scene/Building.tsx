import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import type { Mesh, MeshStandardMaterial } from 'three';
import { PIPELINE_STAGES, type PracticeArea } from '@shared/types';
import type { AreaStats } from '@shared/domain/metrics';
import { useTranslation } from 'react-i18next';
import { useFirm } from '../store/useFirm';
import { ALERT_COLORS, SCENE_COLORS, STAGE_COLORS } from './palette';
import { BUILDING_SIZE, PAD_GAP, padKey, type CampusLayout } from './layout';

interface Props {
  area: PracticeArea;
  stats: AreaStats;
  layout: CampusLayout;
}

/** Bâtiment d'un pôle + son quai de pipeline. */
export function Building({ area, stats, layout }: Props) {
  const { t } = useTranslation();
  const select = useFirm((s) => s.select);
  const hover = useFirm((s) => s.hover);
  const selected = useFirm((s) => s.selection?.kind === 'area' && s.selection.id === area.id);
  const stageFilter = useFirm((s) => s.stageFilter);
  const [hovered, setHovered] = useState(false);
  const beacon = useRef<Mesh>(null);
  const { center, height } = layout.areas.get(area.id)!;
  const [cx, , cz] = center;
  const alarming = stats.worst === 'depasse' || stats.worst === 'critique';
  const floors = Math.floor(height / 0.9);

  // Gyrophare sur le toit : pulse si une échéance critique est en cours dans ce pôle.
  useFrame(({ clock }) => {
    if (!beacon.current) return;
    const mat = beacon.current.material as MeshStandardMaterial;
    const pulse = alarming ? 0.5 + 0.5 * Math.sin(clock.elapsedTime * 5) : 0.25;
    mat.emissiveIntensity = 0.4 + pulse * 1.6;
    beacon.current.scale.setScalar(alarming ? 1 + pulse * 0.25 : 1);
  });

  const laneZ = layout.pads.get(padKey(area.id, 0))![2];
  const showStages = selected || hovered;

  return (
    <group>
      {/* Parcelle */}
      <RoundedBox args={[PIPELINE_STAGES.length * PAD_GAP + 1.6, 0.22, BUILDING_SIZE + 7.2]} radius={0.1} position={[cx, 0.11, cz + 2.2]} receiveShadow>
        <meshStandardMaterial color={selected ? '#eef2ff' : SCENE_COLORS.plot} />
      </RoundedBox>

      {/* Corps du bâtiment */}
      <group
        position={[cx, 0.22, cz]}
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
        <RoundedBox args={[BUILDING_SIZE, height, BUILDING_SIZE]} radius={0.12} position-y={height / 2} castShadow receiveShadow>
          <meshStandardMaterial color={hovered || selected ? '#ffffff' : '#f3f6fb'} roughness={0.7} />
        </RoundedBox>
        {/* Bandeaux de fenêtres */}
        {Array.from({ length: floors }, (_, i) => (
          <mesh key={i} position-y={0.55 + i * 0.9}>
            <boxGeometry args={[BUILDING_SIZE + 0.02, 0.32, BUILDING_SIZE + 0.02]} />
            <meshStandardMaterial color={SCENE_COLORS.window} roughness={0.25} metalness={0.2} />
          </mesh>
        ))}
        {/* Toit aux couleurs du pôle */}
        <RoundedBox args={[BUILDING_SIZE + 0.3, 0.3, BUILDING_SIZE + 0.3]} radius={0.08} position-y={height + 0.1} castShadow>
          <meshStandardMaterial color={area.color} />
        </RoundedBox>
        {/* Porte */}
        <mesh position={[0, 0.5, BUILDING_SIZE / 2 + 0.01]}>
          <planeGeometry args={[1.1, 1]} />
          <meshStandardMaterial color={area.color} />
        </mesh>
        {/* Gyrophare d'alerte */}
        <mesh ref={beacon} position-y={height + 0.6}>
          <sphereGeometry args={[0.32, 24, 16]} />
          <meshStandardMaterial color={ALERT_COLORS[stats.worst]} emissive={ALERT_COLORS[stats.worst]} />
        </mesh>
        <Html position={[0, height + 1.5, 0]} center zIndexRange={[20, 0]}>
          <div className="map-label flex items-center gap-1.5" style={{ borderTop: `3px solid ${area.color}` }}>
            <span style={{ color: area.color }}>{area.code}</span>
            <span className="font-medium text-[var(--color-muted)]">{area.name}</span>
            {stats.alertCount > 0 && (
              <span className="rounded-full px-1.5 text-[10px] text-white" style={{ background: ALERT_COLORS[stats.worst] }}>
                {stats.alertCount}
              </span>
            )}
          </div>
        </Html>
      </group>

      {/* Quai de pipeline : une plateforme par étape */}
      <mesh position={[cx, 0.24, laneZ]} receiveShadow>
        <boxGeometry args={[PIPELINE_STAGES.length * PAD_GAP + 0.3, 0.05, 0.9]} />
        <meshStandardMaterial color={SCENE_COLORS.lane} />
      </mesh>
      {PIPELINE_STAGES.map((stage, i) => {
        const [px, , pz] = layout.pads.get(padKey(area.id, i))!;
        const dim = stageFilter && stageFilter !== stage;
        return (
          <group key={stage} position={[px, 0.28, pz]}>
            <mesh receiveShadow>
              <boxGeometry args={[PAD_GAP - 0.15, 0.08, 0.7]} />
              <meshStandardMaterial color={STAGE_COLORS[i]} transparent opacity={dim ? 0.25 : 0.9} />
            </mesh>
            {showStages && (
              <Html position={[0, 0.1, 0.55]} center zIndexRange={[20, 0]}>
                <div className="pointer-events-none -rotate-12 text-[9px] font-semibold text-[var(--color-muted)]">
                  {t(`stage.${stage}`)}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
