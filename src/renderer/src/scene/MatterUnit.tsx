import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { MapLabel } from './MapLabel';
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial, Vector3 } from 'three';
import { useTranslation } from 'react-i18next';
import type { ConflictStatus, Matter } from '@shared/types';
import type { AlertLevel, DeadlineAlert } from '@shared/domain/alerts';
import { useFirm } from '../store/useFirm';
import { ALERT_COLORS, SCENE_COLORS } from './palette';
import type { Vec3 } from './layout';

interface Props {
  matter: Matter;
  color: string;
  target: Vec3;
  level: AlertLevel;
  nextAlert: DeadlineAlert | undefined;
  /** Vérification de conflits non résolue visant ce dossier. */
  conflict?: ConflictStatus;
  /** Rang dans la pile de la plateforme : les étiquettes sont étagées pour ne pas se chevaucher. */
  stackIndex?: number;
  /** Dossier le plus urgent de son pôle : seul à afficher son étiquette en vue d'ensemble. */
  featured?: boolean;
}

const CONFLICT_COLOR = { potentiel: '#8e4ec6', confirme: '#6b21a8' } as const;

const tmp = new Vector3();

/**
 * Un dossier = une unité sur le quai de son pôle.
 * Il glisse vers la plateforme de son étape quand celle-ci change.
 */
export function MatterUnit({ matter, color, target, level, nextAlert, conflict, stackIndex = 0, featured = false }: Props) {
  const { t } = useTranslation();
  const group = useRef<Group>(null);
  const select = useFirm((s) => s.select);
  const hover = useFirm((s) => s.hover);
  const selected = useFirm((s) => s.selection?.kind === 'matter' && s.selection.id === matter.id);
  const dimmed = useFirm((s) => s.stageFilter !== null && s.stageFilter !== matter.stage);
  // Mode focus : un autre dossier est sélectionné → celui-ci passe au second plan.
  const unfocused = useFirm((s) => s.selection?.kind === 'matter' && s.selection.id !== matter.id);
  const [hovered, setHovered] = useState(false);
  const phase = useRef(Math.random() * Math.PI * 2);
  const alarming = level === 'depasse' || level === 'critique';
  const unacknowledged = nextAlert?.requiresAcknowledgement ?? false;
  const conflictOpen = conflict === 'potentiel' || conflict === 'confirme';
  const showCountdown = Boolean(nextAlert) && (alarming || level === 'urgent');
  // Mode focus : seules les étiquettes du dossier sélectionné restent (plus aucun chevauchement).
  // Vue d'ensemble : une seule étiquette par pôle (le dossier le plus urgent) ; les autres au survol.
  // Mode focus : seules les étiquettes du dossier sélectionné restent.
  const showLabel = !dimmed && (selected || hovered || (!unfocused && featured && (showCountdown || conflictOpen)));

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    // Glissement amorti vers la position cible.
    tmp.set(target[0], 0.3, target[2]);
    g.position.lerp(tmp, 1 - Math.exp(-dt * 4));
    const lift = selected ? 0.35 : hovered ? 0.18 : 0;
    g.position.y = 0.3 + lift + Math.sin(clock.elapsedTime * 2 + phase.current) * 0.04;
    const s = selected ? 1.22 : 1;
    g.scale.lerp(tmp.set(s, s, s), 1 - Math.exp(-dt * 10));
  });

  return (
    <group ref={group} position={[target[0], 0.3, target[2]]}>
      <group
        onClick={(e) => {
          e.stopPropagation();
          select({ kind: 'matter', id: matter.id });
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          hover({ kind: 'matter', id: matter.id });
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          hover(null);
          document.body.style.cursor = '';
        }}
      >
        {/* Boîte de dossier */}
        <RoundedBox args={[0.66, 0.42, 0.62]} radius={0.06} position-y={0.21} castShadow>
          <meshStandardMaterial
            color={color}
            transparent
            opacity={dimmed ? 0.2 : unfocused ? 0.45 : 1}
            emissive={color}
            emissiveIntensity={selected ? 0.45 : 0}
          />
        </RoundedBox>
        {/* Projecteur sur le dossier sélectionné */}
        {selected && <pointLight position={[0, 2.2, 0]} intensity={14} distance={7} color="#ffffff" />}
        {/* Bande d'état d'échéance */}
        <mesh position-y={0.44}>
          <boxGeometry args={[0.68, 0.06, 0.64]} />
          <meshStandardMaterial
            color={ALERT_COLORS[level]}
            emissive={ALERT_COLORS[level]}
            emissiveIntensity={alarming ? 0.6 : 0.15}
            transparent
            opacity={dimmed ? 0.2 : 1}
          />
        </mesh>
        {/* Anneau de sélection */}
        {(selected || hovered) && (
          <mesh rotation-x={-Math.PI / 2} position-y={-0.27}>
            <ringGeometry args={[0.52, 0.62, 40]} />
            <meshBasicMaterial color={selected ? SCENE_COLORS.selection : '#64748b'} />
          </mesh>
        )}
      </group>

      {alarming && !dimmed && <DeadlineBeacon color={ALERT_COLORS[level]} strong={unacknowledged} />}

      {/* Conflit d'intérêts potentiel / confirmé : anneau violet et pastille ⚖ */}
      {conflictOpen && !dimmed && (
        <>
          <mesh rotation-x={-Math.PI / 2} position-y={-0.26}>
            <ringGeometry args={[0.66, 0.78, 40]} />
            <meshBasicMaterial color={CONFLICT_COLOR[conflict as keyof typeof CONFLICT_COLOR]} />
          </mesh>
        </>
      )}

      {showLabel && (
        <MapLabel position={[0, 1.05 + (selected || hovered ? 0.3 : stackIndex * 0.6), 0]}>
          <div className="pointer-events-none flex items-center gap-1 whitespace-nowrap">
            {conflictOpen && (
              <span className="map-label" style={{ background: CONFLICT_COLOR[conflict as keyof typeof CONFLICT_COLOR], color: '#fff' }} title={t(`conflicts.status.${conflict}`)}>
                ⚖ {t('conflicts.badge')}
              </span>
            )}
            {(hovered || selected) && <span className="map-label">{matter.number} · {matter.title}</span>}
            {showCountdown && nextAlert && (
              <span className={`map-label ${unacknowledged ? 'animate-alert' : ''}`} style={{ background: ALERT_COLORS[level], color: '#fff' }}>
                {nextAlert.daysLeft < 0
                  ? `⛔ ${t('level.depasse')}`
                  : nextAlert.daysLeft === 0
                    ? t('countdown.today')
                    : t('countdown.short', { count: nextAlert.daysLeft })}
              </span>
            )}
          </div>
        </MapLabel>
      )}
    </group>
  );
}

/**
 * Colonne de lumière + onde au sol : impossible à manquer, même dézoomé.
 * `strong` = alerte non encore accusée (pulsation plus rapide et plus haute).
 */
function DeadlineBeacon({ color, strong }: { color: string; strong: boolean }) {
  const pillar = useRef<Mesh>(null);
  const wave = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * (strong ? 1.6 : 0.9);
    if (pillar.current) {
      (pillar.current.material as MeshBasicMaterial).opacity = 0.18 + 0.14 * Math.sin(t * 4);
    }
    if (wave.current) {
      const k = t % 1;
      wave.current.scale.setScalar(0.6 + k * 2.4);
      (wave.current.material as MeshBasicMaterial).opacity = (1 - k) * 0.7;
    }
  });
  const h = strong ? 7 : 4.5;
  return (
    <group>
      <mesh ref={pillar} position-y={h / 2}>
        <cylinderGeometry args={[0.22, 0.34, h, 20, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={wave} rotation-x={-Math.PI / 2} position-y={-0.26}>
        <ringGeometry args={[0.45, 0.55, 48]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}
