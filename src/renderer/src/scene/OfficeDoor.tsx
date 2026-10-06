import { useContext, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { StaffTraffic } from './StaffTraffic';
import type { Vec3 } from './layout';

/** Sliding entrance reacts to actual staff positions, including return journeys. */
export function OfficeDoor({ center }: { center: Vec3 }) {
  const traffic = useContext(StaffTraffic);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const opening = useRef(0);
  useFrame((_, dt) => {
    let near = false;
    for (const { position } of traffic.values()) {
      if (Math.abs(position.x - center[0]) < 0.8 && Math.abs(position.z - center[2] - 2.1) < 1) { near = true; break; }
    }
    opening.current += ((near ? 0.55 : 0) - opening.current) * (1 - Math.exp(-dt * 10));
    if (left.current) left.current.position.x = -0.29 - opening.current;
    if (right.current) right.current.position.x = 0.29 + opening.current;
  });
  return <group position={[0, 0, 2.135]}>
    <mesh position={[0, 0.72, -0.01]}><boxGeometry args={[1.25, 1.35, 0.035]} /><meshStandardMaterial color="#e4c696" emissive="#d5ab65" emissiveIntensity={0.25} /></mesh>
    {[left, right].map((ref, i) => <group key={i} ref={ref} position={[i ? 0.29 : -0.29, 0, 0]}>
      <mesh position-y={0.72} castShadow><boxGeometry args={[0.56, 1.3, 0.05]} /><meshStandardMaterial color="#79a6b6" transparent opacity={0.55} metalness={0.25} roughness={0.18} /></mesh>
      <mesh position-y={0.72}><boxGeometry args={[0.025, 1.3, 0.07]} /><meshStandardMaterial color="#263e4c" /></mesh>
    </group>)}
    <mesh position-y={1.4}><boxGeometry args={[1.3, 0.08, 0.1]} /><meshStandardMaterial color="#263e4c" /></mesh>
    <mesh position-y={0.16} receiveShadow><boxGeometry args={[1.4, 0.04, 0.7]} /><meshStandardMaterial color="#5a6870" /></mesh>
  </group>;
}
