import { useState } from 'react';
import { MapLabel } from './MapLabel';
import type { Party, PartyRole } from '@shared/types';
import { useFirm } from '../store/useFirm';
import { SCENE_COLORS } from './palette';
import type { Vec3 } from './layout';

/** Nœud externe : tribunal (palais de justice), client (pylône bleu) ou partie adverse (prisme rouge). */
export function ExternalNode({ party, role, position }: { party: Party; role: PartyRole; position: Vec3 }) {
  const select = useFirm((s) => s.select);
  const selected = useFirm((s) => s.selection?.kind === 'party' && s.selection.id === party.id);
  const [hovered, setHovered] = useState(false);
  const isCourt = party.kind === 'tribunal';
  const color = isCourt ? '#475569' : role === 'client' ? '#3b82f6' : '#dc4c64';

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: 'party', id: party.id });
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
      {isCourt ? <Courthouse highlight={hovered || selected} /> : (
        <>
          <mesh position-y={0.06} receiveShadow>
            <cylinderGeometry args={[0.7, 0.8, 0.12, 24]} />
            <meshStandardMaterial color={selected ? '#e0e7ff' : '#f8fafc'} />
          </mesh>
          <mesh position-y={0.75} castShadow rotation-y={Math.PI / 4}>
            {role === 'client' ? <cylinderGeometry args={[0.28, 0.36, 1.3, 6]} /> : <octahedronGeometry args={[0.5]} />}
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered ? 0.35 : 0.08} />
          </mesh>
        </>
      )}
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
          <ringGeometry args={[isCourt ? 2.4 : 0.95, isCourt ? 2.55 : 1.05, 48]} />
          <meshBasicMaterial color={SCENE_COLORS.selection} />
        </mesh>
      )}
      {(isCourt || hovered || selected) && (
        <MapLabel position={[0, isCourt ? 3.2 : 1.8, 0]}>
          <div className="map-label" style={{ borderLeft: `3px solid ${color}` }}>{party.name}</div>
        </MapLabel>
      )}
    </group>
  );
}

function Courthouse({ highlight }: { highlight: boolean }) {
  const stone = highlight ? '#ffffff' : '#eef1f6';
  return (
    <group>
      <mesh position-y={0.15} receiveShadow castShadow>
        <boxGeometry args={[4, 0.3, 2.8]} />
        <meshStandardMaterial color="#d7dee8" />
      </mesh>
      <mesh position-y={0.4} receiveShadow castShadow>
        <boxGeometry args={[3.6, 0.2, 2.4]} />
        <meshStandardMaterial color={stone} />
      </mesh>
      {[-1.35, -0.45, 0.45, 1.35].map((x) => (
        <mesh key={x} position={[x, 1.25, 0.9]} castShadow>
          <cylinderGeometry args={[0.14, 0.16, 1.5, 12]} />
          <meshStandardMaterial color={stone} />
        </mesh>
      ))}
      <mesh position={[0, 1.2, -0.2]} castShadow>
        <boxGeometry args={[3.2, 1.6, 1.4]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      {/* Fronton */}
      <mesh position-y={2.25} rotation-y={Math.PI / 4} scale={[1.45, 1, 1]} castShadow>
        <coneGeometry args={[2.4, 0.8, 4]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
    </group>
  );
}
