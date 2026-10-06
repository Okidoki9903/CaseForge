import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import type { CampusLayout } from './layout';

function Bench() {
  return <group>
    {[0, 1, 2].map(i => <mesh key={i} position={[0, 0.42, i * 0.13]} castShadow><boxGeometry args={[1.3, 0.06, 0.1]} /><meshStandardMaterial color="#986e4b" /></mesh>)}
    <mesh position={[0, 0.7, -0.05]} castShadow><boxGeometry args={[1.3, 0.35, 0.06]} /><meshStandardMaterial color="#986e4b" /></mesh>
    {[-0.48, 0.48].map(x => <mesh key={x} position={[x, 0.22, 0.1]} castShadow><boxGeometry args={[0.08, 0.44, 0.45]} /><meshStandardMaterial color="#34434e" /></mesh>)}
  </group>;
}

function Lamp() {
  return <group>
    <mesh position-y={0.9} castShadow><cylinderGeometry args={[0.035, 0.06, 1.8, 8]} /><meshStandardMaterial color="#34434e" /></mesh>
    <mesh position-y={1.88}><boxGeometry args={[0.3, 0.18, 0.3]} /><meshStandardMaterial color="#ffe2aa" emissive="#ffc876" emissiveIntensity={1.4} /></mesh>
    <mesh position-y={2.01} castShadow><boxGeometry args={[0.4, 0.07, 0.4]} /><meshStandardMaterial color="#34434e" /></mesh>
  </group>;
}

function WaterRipples() {
  const water = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (water.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 1.5) * 0.09;
      water.current.scale.set(s, s, s);
    }
  });
  return <group position-y={0.265} rotation-x={-Math.PI / 2}>
    <mesh ref={water}><ringGeometry args={[1.45, 1.48, 64]} /><meshBasicMaterial color="#d3f0ed" transparent opacity={0.65} /></mesh>
    <mesh><ringGeometry args={[2.05, 2.075, 64]} /><meshBasicMaterial color="#d3f0ed" transparent opacity={0.45} /></mesh>
  </group>;
}

/** Street furniture stays outside the matter pipeline and staff paths. */
export function CampusLife({ layout }: { layout: CampusLayout }) {
  return <group>
    <WaterRipples />
    {[...layout.areas.entries()].map(([id, { center: [x, , z] }]) => <group key={id} position={[x, 0, z]}>
      {[-1, 1].map(side => <group key={side}>
        <group position={[side * 3.4, 0.15, 0.8]} rotation-y={side * Math.PI / 2}><Bench /></group>
        <group position={[side * 4.5, 0.15, 2.7]}><Lamp /></group>
        <mesh position={[side * 3.5, 0.3, -2.7]} castShadow receiveShadow><boxGeometry args={[1.6, 0.4, 0.6]} /><meshStandardMaterial color="#b6a68e" /></mesh>
        {[0, 1, 2, 3].map(i => <mesh key={i} position={[side * 3.5 - 0.6 + i * 0.4, 0.65, -2.7]} castShadow><icosahedronGeometry args={[0.28, 1]} /><meshStandardMaterial color={i % 2 ? '#71905d' : '#587a50'} /></mesh>)}
      </group>)}
      <mesh position={[2.8, 0.4, 1.8]} castShadow><cylinderGeometry args={[0.17, 0.17, 0.5, 12]} /><meshStandardMaterial color="#3e5960" roughness={0.5} /></mesh>
      <mesh position={[2.8, 0.67, 1.8]}><cylinderGeometry args={[0.19, 0.19, 0.05, 12]} /><meshStandardMaterial color="#263641" /></mesh>
    </group>)}
  </group>;
}
