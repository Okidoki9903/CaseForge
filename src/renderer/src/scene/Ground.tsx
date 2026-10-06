/**
 * Sol du campus : dalles de pierre claire (texture procédurale générée localement), pelouses,
 * haies, arbres, allées et fontaine centrale. Aucune ressource externe.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { CanvasTexture, Color, InstancedMesh, Object3D, RepeatWrapping, SRGBColorSpace } from 'three';
import { useFirm } from '../store/useFirm';
import { SCENE_COLORS } from './palette';
import { BUILDING_SIZE, type CampusLayout } from './layout';

/** Texture de dallage dessinée sur un canvas local. */
function usePavingTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = SCENE_COLORS.paving;
    g.fillRect(0, 0, 256, 256);
    // Légères variations de teinte entre les dalles.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const v = 203 + Math.floor(rnd() * 14);
        g.fillStyle = `rgb(${v},${v - 3},${v - 9})`;
        g.fillRect(x * 64 + 1, y * 64 + 1, 62, 62);
      }
    }
    g.strokeStyle = 'rgba(160,150,135,0.35)';
    g.lineWidth = 1.5;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke();
    }
    const tex = new CanvasTexture(c);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(110, 110);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, []);
}

/** Arbres en instances (tronc + houppier) : élégants et peu coûteux. */
function Trees({ spots }: { spots: [number, number, number][] }) {
  const trunks = useRef<InstancedMesh>(null);
  const crowns = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new Object3D();
    const greens = ['#7fa36e', '#6f955f', '#8db07a', '#76996a'].map((c) => new Color(c));
    spots.forEach(([x, z, s], i) => {
      o.position.set(x, 0.55 * s, z);
      o.scale.set(s, s, s);
      o.updateMatrix();
      trunks.current?.setMatrixAt(i, o.matrix);
      o.position.set(x, 1.55 * s, z);
      o.scale.set(s * 1.05, s * 1.25, s * 1.05);
      o.updateMatrix();
      crowns.current?.setMatrixAt(i, o.matrix);
      crowns.current?.setColorAt(i, greens[i % greens.length]);
    });
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true;
    if (crowns.current) {
      crowns.current.instanceMatrix.needsUpdate = true;
      if (crowns.current.instanceColor) crowns.current.instanceColor.needsUpdate = true;
    }
  }, [spots]);
  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, spots.length]} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 1.1, 8]} />
        <meshStandardMaterial color="#8a7460" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, spots.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[0.62, 2]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
    </group>
  );
}

function Fountain() {
  return (
    <group position={[0, 0, 0]}>
      <mesh position-y={0.12} receiveShadow castShadow>
        <cylinderGeometry args={[2.6, 2.75, 0.24, 64]} />
        <meshStandardMaterial color={SCENE_COLORS.concrete} roughness={0.6} />
      </mesh>
      <mesh position-y={0.25} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[2.4, 64]} />
        <meshStandardMaterial color={SCENE_COLORS.water} metalness={0.3} roughness={0.08} emissive="#bfe3f6" emissiveIntensity={0.25} />
      </mesh>
      <mesh position-y={0.45} castShadow>
        <cylinderGeometry args={[0.55, 0.7, 0.4, 32]} />
        <meshStandardMaterial color={SCENE_COLORS.concrete} roughness={0.5} />
      </mesh>
      <mesh position-y={0.95}>
        <cylinderGeometry args={[0.05, 0.12, 0.8, 12]} />
        <meshStandardMaterial color="#e6f4fb" transparent opacity={0.7} emissive="#e6f4fb" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

export function Ground({ layout }: { layout: CampusLayout }) {
  const select = useFirm((s) => s.select);
  const paving = usePavingTexture();
  const areas = [...layout.areas.values()];

  // Arbres disposés de façon déterministe autour des parcelles et le long des allées.
  const trees = useMemo(() => {
    const spots: [number, number, number][] = [];
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const { center } of areas) {
      const [cx, , cz] = center;
      const r = BUILDING_SIZE / 2 + 2.6;
      for (const [dx, dz] of [[-r - 1.2, -r + 0.5], [-r - 1.2, r + 3], [r + 1.4, -r + 0.8], [r + 1.4, r + 2.4], [-1.5, -r - 1.4], [1.8, -r - 1.6]]) {
        spots.push([cx + dx + (rnd() - 0.5) * 0.8, cz + dz + (rnd() - 0.5) * 0.8, 0.85 + rnd() * 0.4]);
      }
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      spots.push([Math.cos(a) * 5.2, Math.sin(a) * 5.2, 0.7 + rnd() * 0.25]);
    }
    return spots;
  }, [areas.length]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow onClick={() => select(null)}>
        <planeGeometry args={[420, 420]} />
        <meshStandardMaterial map={paving} roughness={0.92} />
      </mesh>

      {/* Allées vers la place centrale */}
      {areas.map(({ center }, i) => {
        const [x, , z] = center;
        const len = Math.hypot(x, z);
        return (
          <mesh key={i} position={[x / 2, 0.006, z / 2]} rotation={[-Math.PI / 2, 0, -Math.atan2(z, x)]} receiveShadow>
            <planeGeometry args={[len, 1.6]} />
            <meshStandardMaterial color={SCENE_COLORS.path} roughness={0.8} />
          </mesh>
        );
      })}

      {/* Pelouses et haies autour de chaque parcelle */}
      {areas.map(({ center }, i) => {
        const [cx, , cz] = center;
        return (
          <group key={`l-${i}`} position={[cx, 0, cz + 2.2]}>
            <mesh rotation-x={-Math.PI / 2} position-y={0.012} receiveShadow>
              <planeGeometry args={[14.5, 15]} />
              <meshStandardMaterial color={SCENE_COLORS.lawn} roughness={0.95} />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 6.9, 0.22, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.45, 0.44, 13.2]} />
                <meshStandardMaterial color={SCENE_COLORS.hedge} roughness={0.9} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Place centrale et fontaine */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.008} receiveShadow>
        <circleGeometry args={[6.4, 64]} />
        <meshStandardMaterial color={SCENE_COLORS.path} roughness={0.75} />
      </mesh>
      <Fountain />
      <Trees spots={trees} />
    </group>
  );
}
