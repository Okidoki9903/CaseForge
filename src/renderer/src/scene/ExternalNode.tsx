import { useState } from 'react';
import { ExtrudeGeometry, Shape } from 'three';
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
  const color = isCourt ? '#3a4fd8' : role === 'client' ? '#3b82f6' : '#dc4c64';

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
            <meshStandardMaterial color={selected ? '#e0e7ff' : SCENE_COLORS.concrete} roughness={0.6} />
          </mesh>
          <mesh position-y={0.75} castShadow rotation-y={Math.PI / 4}>
            {role === 'client' ? <cylinderGeometry args={[0.28, 0.36, 1.3, 6]} /> : <octahedronGeometry args={[0.5]} />}
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered ? 0.35 : 0.08} metalness={0.25} roughness={0.25} />
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
          <div
            className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-white/95 py-1 pl-1 pr-2.5 text-[11px] font-semibold text-[#1f2a44] shadow-[0_8px_22px_-12px_rgba(30,41,80,0.5)]"
            style={{ pointerEvents: 'none' }}
          >
            <span className="grid h-5 w-5 place-items-center rounded-md text-[11px]" style={{ background: `${color}1f`, color }}>
              {isCourt ? '⚖' : role === 'client' ? '●' : '◆'}
            </span>
            {party.name}
          </div>
        </MapLabel>
      )}
    </group>
  );
}

/** Fronton triangulaire extrudé (une seule géométrie partagée). */
const PEDIMENT = (() => {
  const shape = new Shape();
  shape.moveTo(-2.05, 0);
  shape.lineTo(2.05, 0);
  shape.lineTo(0, 0.72);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
  geometry.translate(0, 0, -0.25);
  return geometry;
})();

/** Palais de justice néoclassique : emmarchement, colonnade, entablement, fronton, toit. */
function Courthouse({ highlight }: { highlight: boolean }) {
  const stone = highlight ? '#ffffff' : '#f3f1ec';
  const shade = '#dcd7cd';
  return (
    <group>
      {/* Emmarchement en gradins */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position-y={0.07 + i * 0.14} receiveShadow castShadow>
          <boxGeometry args={[4.4 - i * 0.25, 0.14, 3.2 - i * 0.25]} />
          <meshStandardMaterial color={i === 0 ? shade : stone} roughness={0.65} />
        </mesh>
      ))}
      {/* Cella avec portes éclairées */}
      <mesh position={[0, 1.22, -0.3]} castShadow receiveShadow>
        <boxGeometry args={[3.3, 1.6, 1.7]} />
        <meshStandardMaterial color={shade} roughness={0.7} />
      </mesh>
      {[-0.9, 0, 0.9].map((x) => (
        <mesh key={x} position={[x, 0.95, 0.56]}>
          <planeGeometry args={[0.42, 0.85]} />
          <meshStandardMaterial color={SCENE_COLORS.warmLight} emissive={SCENE_COLORS.warmLight} emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      ))}
      {/* Colonnade */}
      {[-1.6, -0.96, -0.32, 0.32, 0.96, 1.6].map((x) => (
        <group key={x} position={[x, 0, 1.0]}>
          <mesh position-y={1.22} castShadow>
            <cylinderGeometry args={[0.12, 0.14, 1.6, 16]} />
            <meshStandardMaterial color={stone} roughness={0.5} />
          </mesh>
          <mesh position-y={2.05}>
            <boxGeometry args={[0.34, 0.08, 0.34]} />
            <meshStandardMaterial color={stone} />
          </mesh>
        </group>
      ))}
      {/* Entablement et toit */}
      <mesh position={[0, 2.18, 0.2]} castShadow>
        <boxGeometry args={[4.1, 0.22, 2.4]} />
        <meshStandardMaterial color={stone} roughness={0.5} />
      </mesh>
      <mesh geometry={PEDIMENT} position={[0, 2.29, 1.12]} castShadow>
        <meshStandardMaterial color={stone} roughness={0.5} />
      </mesh>
      <mesh position={[0, 2.45, -0.2]} castShadow>
        <boxGeometry args={[3.9, 0.3, 1.6]} />
        <meshStandardMaterial color="#8a93a6" metalness={0.3} roughness={0.45} />
      </mesh>
    </group>
  );
}
