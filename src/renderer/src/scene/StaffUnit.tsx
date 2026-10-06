import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { MapLabel } from './MapLabel';
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
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const seed = [...staff.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const skin = ['#deb08b', '#a97652', '#edc9a7', '#80543e'][seed % 4];
  const hair = ['#35291f', '#75523b', '#252733', '#a79173'][seed % 4];
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
    const stride = dist > 0.05 ? Math.sin(clock.elapsedTime * 9 + seed) * 0.5 : Math.sin(clock.elapsedTime * 1.8 + seed) * 0.035;
    if (leftLeg.current) leftLeg.current.rotation.x = stride;
    if (rightLeg.current) rightLeg.current.rotation.x = -stride;
    if (leftArm.current) leftArm.current.rotation.x = -stride * 0.65;
    if (rightArm.current) rightArm.current.rotation.x = stride * 0.65;
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
      <group scale={1.35}>
        {[[-0.095, leftLeg], [0.095, rightLeg]].map(([x, ref], i) => <group key={i} ref={ref as typeof leftLeg} position={[x as number, 0.28, 0]}>
          <mesh position-y={-0.12} castShadow><capsuleGeometry args={[0.065, 0.18, 4, 8]} /><meshStandardMaterial color="#283747" /></mesh>
          <mesh position={[0, -0.25, 0.035]} castShadow><boxGeometry args={[0.13, 0.08, 0.22]} /><meshStandardMaterial color="#21282e" /></mesh>
        </group>)}
        <mesh position-y={0.46} castShadow><capsuleGeometry args={[0.17, 0.2, 6, 12]} /><meshStandardMaterial color={ROLE_COLORS[staff.role]} roughness={0.85} /></mesh>
        <mesh position={[0, 0.5, 0.153]}><boxGeometry args={[0.08, 0.22, 0.022]} /><meshStandardMaterial color="#f4eee1" /></mesh>
        <mesh position={[0, 0.51, 0.17]}><boxGeometry args={[0.025, 0.15, 0.015]} /><meshStandardMaterial color="#bc9560" /></mesh>
        {[[-0.2, leftArm], [0.2, rightArm]].map(([x, ref], i) => <group key={i} ref={ref as typeof leftArm} position={[x as number, 0.57, 0]}>
          <mesh position-y={-0.12} castShadow><capsuleGeometry args={[0.055, 0.18, 4, 8]} /><meshStandardMaterial color={ROLE_COLORS[staff.role]} /></mesh>
          <mesh position-y={-0.26}><sphereGeometry args={[0.057, 8, 8]} /><meshStandardMaterial color={skin} /></mesh>
          {i === 1 && <group position={[0, -0.36, 0]}>
            <mesh castShadow><boxGeometry args={[0.09, 0.2, 0.26]} /><meshStandardMaterial color="#76513a" /></mesh>
            <mesh position-y={0.12}><torusGeometry args={[0.04, 0.01, 4, 8]} /><meshStandardMaterial color="#c3a577" /></mesh>
          </group>}
        </group>)}
        <mesh position-y={0.79} castShadow><sphereGeometry args={[0.14, 16, 12]} /><meshStandardMaterial color={skin} roughness={0.85} /></mesh>
        <mesh position={[0, 0.845, -0.015]} castShadow><sphereGeometry args={[0.143, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58]} /><meshStandardMaterial color={hair} /></mesh>
        {[-0.05, 0.05].map(x => <mesh key={x} position={[x, 0.8, 0.127]}><sphereGeometry args={[0.014, 6, 6]} /><meshStandardMaterial color="#26313d" /></mesh>)}
      </group>
      {(hovered || selected) && (
        <MapLabel position={[0, 1, 0]}>
          <div className="map-label" style={load.level === 'surcharge' ? { color: LOAD_COLORS.surcharge } : undefined}>
            {staff.name}
          </div>
        </MapLabel>
      )}
    </group>
  );
}
