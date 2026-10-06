import { BUILDING_SIZE } from './layout';

function Box({ p, size, color }: { p: [number, number, number]; size: [number, number, number]; color: string }) {
  return <mesh position={p} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.65} /></mesh>;
}

/** Locally built furniture; exposed in the architectural cutaway view. */
export function OfficeInterior({ accent, code }: { accent: string; code: string }) {
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
    <Box p={[-1.25, 0.38, 1.65]} size={[1.15, 0.55, 0.6]} color="#3f5969" />
    <Box p={[-1.25, 0.75, 1.9]} size={[1.15, 0.4, 0.12]} color="#3f5969" />
    <Box p={[-1.25, 0.35, 1.15]} size={[0.7, 0.08, 0.3]} color="#9b7050" />
    <mesh position={[-1.8, 0.25, 0.65]} castShadow><cylinderGeometry args={[0.2, 0.15, 0.4, 12]} /><meshStandardMaterial color="#dfd4bf" /></mesh>
    <mesh position={[-1.8, 0.72, 0.65]} castShadow><icosahedronGeometry args={[0.35, 1]} /><meshStandardMaterial color="#527d58" /></mesh>
    <Box p={[1.5, 0.7, 0.8]} size={[0.7, 0.08, 0.4]} color="#9b7050" />
    <Box p={[1.5, 0.4, 0.8]} size={[0.12, 0.7, 0.28]} color="#334155" />
    <Box p={[1.5, 0.78, 0.8]} size={[0.3, 0.05, 0.22]} color={accent} />
    {/* Each practice area has its own working environment. */}
    {code === 'LIT' && <group>
      <Box p={[0, 1.05, -1.99]} size={[1.3, 0.65, 0.035]} color="#354758" />
      {[-0.4, 0, 0.4].map(x => <Box key={x} p={[x, 1.12, -1.96]} size={[0.26, 0.3, 0.02]} color="#ead9b6" />)}
      <Box p={[1.82, 0.55, -1.35]} size={[0.35, 1.1, 1.1]} color="#74563f" />
      {[0.35, 0.7, 1.05].map(y => <Box key={y} p={[1.61, y, -1.35]} size={[0.04, 0.05, 1]} color="#d0ac79" />)}
    </group>}
    {code === 'AFF' && <group>
      <Box p={[0, 1.08, -1.99]} size={[1.25, 0.65, 0.035]} color="#213f47" />
      {[0, 1, 2, 3, 4].map(i => <Box key={i} p={[-0.45 + i * 0.22, 0.92 + i * 0.05, -1.96]} size={[0.12, 0.12 + i * 0.1, 0.02]} color={i % 2 ? '#88bea7' : '#e3c182'} />)}
      <Box p={[1.82, 0.5, -1.35]} size={[0.35, 1, 1.1]} color="#738e91" />
    </group>}
    {code === 'TRV' && <group>
      <Box p={[0, 1.1, -1.99]} size={[1.25, 0.65, 0.035]} color="#b18d60" />
      {[-0.35, 0, 0.35].map((x, i) => <Box key={x} p={[x, 1.1 + (i % 2) * 0.07, -1.96]} size={[0.25, 0.32, 0.02]} color={i ? '#f4edd9' : accent} />)}
      {[0, 1, 2].map(i => <Box key={i} p={[1.83, 0.65, -1.7 + i * 0.4]} size={[0.3, 1.3, 0.37]} color={i % 2 ? '#77868d' : '#89999b'} />)}
    </group>}
    {code === 'FAM' && <group>
      <Box p={[0, 1.1, -1.99]} size={[1.1, 0.65, 0.035]} color="#d4bca4" />
      <mesh position={[0, 1.15, -1.95]}><circleGeometry args={[0.2, 24]} /><meshStandardMaterial color="#dda785" /></mesh>
      <Box p={[1.83, 0.38, -1.3]} size={[0.35, 0.75, 1.15]} color="#c3ad93" />
      {[0, 1, 2].map(i => <mesh key={i} position={[1.8, 0.83, -1.65 + i * 0.35]} castShadow><icosahedronGeometry args={[0.13, 0]} /><meshStandardMaterial color={['#93ad88', '#dcb886', '#b59ab1'][i]} /></mesh>)}
    </group>}
    {code === 'PI' && <group>
      <Box p={[0, 1.1, -1.99]} size={[1.25, 0.65, 0.04]} color="#262d46" />
      <mesh position={[0, 1.1, -1.95]}><torusGeometry args={[0.19, 0.025, 8, 24]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.45} /></mesh>
      {[0, 1].map(i => <group key={i} position={[1.8, 0, -1.55 + i * 0.65]}>
        <Box p={[0, 0.3, 0]} size={[0.4, 0.6, 0.4]} color="#dedce7" />
        <mesh position-y={0.83} castShadow><icosahedronGeometry args={[0.21, i]} /><meshStandardMaterial color={accent} metalness={0.35} roughness={0.3} /></mesh>
      </group>)}
    </group>}
    {!['LIT', 'AFF', 'TRV', 'FAM', 'PI'].includes(code) && <Box p={[0, 1.1, -1.99]} size={[1.1, 0.55, 0.03]} color={accent} />}
    <mesh position={[0, 1.6, -1.99]}><circleGeometry args={[0.12, 20]} /><meshStandardMaterial color="#f5f0e5" /></mesh>
    <Box p={[0, 1.62, -1.95]} size={[0.015, 0.09, 0.015]} color="#334155" />
    <Box p={[0.035, 1.6, -1.95]} size={[0.08, 0.015, 0.015]} color="#334155" />
  </group>;
}
