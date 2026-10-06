import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { MapLabel } from './MapLabel';
import { type Group, Vector3 } from 'three';
import type { Staff } from '@shared/types';
import type { StaffLoad } from '@shared/domain/metrics';
import { useFirm } from '../store/useFirm';
import { LOAD_COLORS, ROLE_COLORS, SCENE_COLORS } from './palette';
import type { RouteStop } from './staffNavigation';
import { StaffTraffic } from './StaffTraffic';
import { useTranslation } from 'react-i18next';

interface Props {
  staff: Staff;
  load: StaffLoad;
  /** Points de passage : porte du pôle puis dossiers assignés. */
  route: RouteStop[];
  center: [number, number, number];
  interiorVisible: boolean;
  seat: number;
}

const SPEED = 1.8;


/** Collaborateur : unité qui circule entre son bureau et ses dossiers. */
export function StaffUnit({ staff, load, route, center, interiorVisible, seat }: Props) {
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
  const traffic = useContext(StaffTraffic);
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const [activity, setActivity] = useState('working');
  const state = useRef({ index: 0, wait: -1, activity: 'working' });
  const dest = useMemo(() => new Vector3(), []);
  const direction = useMemo(() => new Vector3(), []);
  useEffect(() => {
    state.current = { index: 0, wait: -1, activity: 'working' };
    if (group.current && route[0]) group.current.position.set(...route[0].position);
  }, [route]);
  useEffect(() => () => { traffic.delete(staff.id); }, [staff.id, traffic]);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g || !route.length) return;
    const st = state.current;
    const stop = route[st.index % route.length];
    dest.set(...stop.position);
    direction.copy(dest).sub(g.position);
    const dist = direction.length();
    const moving = dist > 0.025;
    const nextActivity = moving ? 'walking' : stop.activity;
    if (nextActivity !== st.activity) { st.activity = nextActivity; setActivity(nextActivity); }
    const inside = Math.abs(g.position.x - center[0]) < 2.1 && g.position.z < center[2] + 2.05 && g.position.z > center[2] - 2.1;
    g.visible = !inside || interiorVisible;
    traffic.set(staff.id, { areaId: staff.practiceAreaId, position: g.position, activity: nextActivity });
    const stride = moving ? Math.sin(clock.elapsedTime * 9 + seed) * 0.45 : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = nextActivity === 'working' && seat % 3 !== 2 ? -1.2 : stride;
    if (rightLeg.current) rightLeg.current.rotation.x = nextActivity === 'working' && seat % 3 !== 2 ? -1.2 : -stride;
    const typing = Math.sin(clock.elapsedTime * 5 + seed) * 0.07;
    if (leftArm.current) leftArm.current.rotation.x = nextActivity === 'working' ? -0.8 + typing : -stride * 0.65;
    if (rightArm.current) rightArm.current.rotation.x = nextActivity === 'working' ? -0.8 - typing : stride * 0.65;
    if (moving) {
      g.position.addScaledVector(direction.normalize(), Math.min(dist, SPEED * Math.min(dt, 0.1)));
      g.rotation.y = Math.atan2(direction.x, direction.z);
      st.wait = -1;
    } else {
      g.position.copy(dest);
      if (stop.facing !== undefined) g.rotation.y = stop.facing;
      if (st.wait < 0) st.wait = stop.wait;
      st.wait -= Math.min(dt, 0.1);
      if (st.wait <= 0 && route.length > 1) { st.index = (st.index + 1) % route.length; st.wait = -1; }
    }
  });

  const start = route[0]?.position ?? center;
  return (
    <group
      ref={group}
      position={start}
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
          {i === 1 && activity !== 'working' && <group position={[0, -0.36, 0]}>
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
            {staff.name}<span className="block text-[10px] font-normal">{activity === 'working' ? (en ? 'Working at the office' : 'Travaille au bureau') : activity === 'collecting' ? (en ? 'Collecting a file' : 'Récupère un dossier') : (en ? 'On assignment' : 'En déplacement')}</span>
          </div>
        </MapLabel>
      )}
    </group>
  );
}
