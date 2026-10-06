import { BUILDING_SIZE } from './layout';

function Box({ p, size, color }: { p: [number, number, number]; size: [number, number, number]; color: string }) {
  return <mesh position={p} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.65} /></mesh>;
}

/** Locally built furniture; exposed in the architectural cutaway view. */
export function OfficeInterior({ accent }: { accent: string }) {
  const s = BUILDING_SIZE;
  return <group>
    <Box p={[0, 0.08, 0]} size={[s, 0.16, s]} color="#c7ae89" />
    <Box p={[0, 0.8, -s / 2]} size={[s, 1.6, 0.12]} color="#e9e1d4" />
    <Box p={[-s / 2, 0.8, 0]} size={[0.12, 1.6, s]} color="#e9e1d4" />
    <Box p={[0, 0.17, 1.25]} size={[2.2, 0.015, 1.4]} color="#d2c0a3" />
    {[-1, 1].map((x, i) => <group key={x} position={[x, 0, -0.55]}>
      <Box p={[0, 0.7, 0]} size={[1.45, 0.09, 0.7]} color="#9b7050" />
      {[-0.6, 0.6].map(k => <Box key={k} p={[k, 0.35, 0]} size={[0.06, 0.7, 0.55]} color="#334155" />)}
      <Box p={[0, 0.99, -0.14]} size={[0.55, 0.36, 0.06]} color="#243249" />
      <mesh position={[0, 0.99, -0.102]}><planeGeometry args={[0.46, 0.27]} /><meshStandardMaterial color="#b4d9ee" emissive="#82bddc" emissiveIntensity={0.35} /></mesh>
      <Box p={[0, 0.76, 0.1]} size={[0.4, 0.025, 0.15]} color="#c4cbd4" />
      <Box p={[0.5, 0.78, 0.05]} size={[0.18, 0.07, 0.25]} color={accent} />
      <Box p={[0, 0.43, 0.7]} size={[0.5, 0.1, 0.48]} color={accent} />
      <Box p={[0, 0.66, 0.94]} size={[0.5, 0.5, 0.08]} color={accent} />
      <Box p={[0, 0.2, 0.7]} size={[0.08, 0.4, 0.08]} color="#334155" />
      <mesh position={[i ? 0.6 : -0.6, 0.8, 0.2]}><cylinderGeometry args={[0.05, 0.04, 0.12, 10]} /><meshStandardMaterial color="#f3eee4" /></mesh>
    </group>)}
    <Box p={[-1.8, 0.6, -1.25]} size={[0.3, 1.2, 1.15]} color="#8d6448" />
    {[0, 1, 2, 3, 4, 5].map(i => <Box key={i} p={[-1.62, 0.8, -1.7 + i * 0.16]} size={[0.12, 0.36, 0.1]} color={['#304867', accent, '#bc9362'][i % 3]} />)}
    <Box p={[0, 0.38, 1.65]} size={[1.5, 0.55, 0.6]} color="#3f5969" />
    <Box p={[0, 0.75, 1.9]} size={[1.5, 0.4, 0.12]} color="#3f5969" />
    <Box p={[0, 0.35, 1]} size={[0.85, 0.08, 0.4]} color="#9b7050" />
    <mesh position={[1.7, 0.25, 1.6]} castShadow><cylinderGeometry args={[0.2, 0.15, 0.4, 12]} /><meshStandardMaterial color="#dfd4bf" /></mesh>
    <mesh position={[1.7, 0.72, 1.6]} castShadow><icosahedronGeometry args={[0.35, 1]} /><meshStandardMaterial color="#527d58" /></mesh>
    <Box p={[0, 1.1, -s / 2 + 0.08]} size={[0.7, 0.45, 0.03]} color={accent} />
  </group>;
}
