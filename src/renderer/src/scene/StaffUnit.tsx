import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { type Group, Vector3 } from 'three';
import type { Staff } from '@shared/types';
import type { StaffLoad } from '@shared/domain/metrics';
import { useFirm } from '../store/useFirm';
import { LOAD_COLORS, ROLE_COLORS, SCENE_COLORS } from './palette';
import type { Vec3 } from './layout';

interface Props {
  staff: Staff;
  load: StaffLoad;
  /** Points de passage : porte du pôle puis dossiers assignés. */
  waypoints: Vec3[];
}

const SPEED = 1.8;
const PAUSE = 1.8;

/** Collaborateur : unité qui circule entre son bureau et ses dossiers. */
export function StaffUnit({ staff, load, waypoints }: Props) {
  const group = useRef<Group>(null);
  const select = useFirm((s) => s.select);
  const selected = useFirm((s) => s.selection?.kind === 'staff' && s.selection.id === staff.id);
  const [hovered, setHovered] = useState(false);
  // Décalage latéral propre à chaque personne pour éviter les superpositions.
  const offset = useMemo(() => {
    const h = [...staff.id].reduce((a, c) => a + c.charCodeAt(0), 0);
    return new Vector3(Math.cos(h) * 0.55, 0, Math.sin(h) * 0.55);
  }, [staff.id]);
  const state = useRef({ index: 0, wait: Math.random() * PAUSE });
  const dest = useMemo(() => new Vector3(), []);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g || waypoints.length === 0) return;
    const st = state.current;
    const wp = waypoints[st.index % waypoints.length];
    dest.set(wp[0], 0.25, wp[2]).add(offset);
    const dist = g.position.distanceTo(dest);
    if (dist < 0.05) {
      st.wait -= dt;
      if (st.wait <= 0) {
        st.index = (st.index + 1) % waypoints.length;
        st.wait = PAUSE;
      }
      g.position.y = 0.25;
    } else {
      const step = Math.min(dist, SPEED * dt);
      const dir = dest.clone().sub(g.position).normalize();
      g.position.addScaledVector(dir, step);
      g.rotation.y = Math.atan2(dir.x, dir.z);
      // Petit rebond de marche
      g.position.y = 0.25 + Math.abs(Math.sin(clock.elapsedTime * 10)) * 0.05;
    }
  });

  const start = waypoints[0] ?? [0, 0, 0];
  return (
    <group
      ref={group}
      position={[start[0] + offset.x, 0.25, start[2] + offset.z]}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: 'staff', id: staff.id });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = '';
      }}
    >
      {/* Anneau de charge (vert / ambre / rouge) */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.2}>
        <ringGeometry args={[0.2, 0.3, 32]} />
        <meshBasicMaterial color={selected ? SCENE_COLORS.selection : LOAD_COLORS[load.level]} />
      </mesh>
      <mesh position-y={0.18} castShadow>
        <capsuleGeometry args={[0.15, 0.28, 6, 12]} />
        <meshStandardMaterial color={ROLE_COLORS[staff.role]} />
      </mesh>
      <mesh position-y={0.55} castShadow>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshStandardMaterial color="#f1d3b6" />
      </mesh>
      {(hovered || selected || load.level === 'surcharge') && (
        <Html position={[0, 1, 0]} center zIndexRange={[20, 0]}>
          <div className="map-label" style={load.level === 'surcharge' ? { color: LOAD_COLORS.surcharge } : undefined}>
            {hovered || selected ? staff.name : `${staff.initials} 🔥`}
          </div>
        </Html>
      )}
    </group>
  );
}
