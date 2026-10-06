import { Grid } from '@react-three/drei';
import { useFirm } from '../store/useFirm';
import { SCENE_COLORS } from './palette';
import type { CampusLayout } from './layout';

/** Sol du campus, grille discrète et allées reliant chaque pôle à la place centrale. */
export function Ground({ layout }: { layout: CampusLayout }) {
  const select = useFirm((s) => s.select);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow onClick={() => select(null)}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color={SCENE_COLORS.ground} />
      </mesh>
      <Grid
        position-y={0}
        args={[200, 200]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#cbd5e1"
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor="#b8c4d6"
        fadeDistance={140}
        fadeStrength={1.5}
        infiniteGrid
      />
      {/* Place centrale */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.005} receiveShadow>
        <circleGeometry args={[3.2, 48]} />
        <meshStandardMaterial color={SCENE_COLORS.path} />
      </mesh>
      {/* Allées vers chaque bâtiment */}
      {[...layout.areas.values()].map(({ center }, i) => {
        const [x, , z] = center;
        const len = Math.hypot(x, z);
        return (
          <mesh key={i} position={[x / 2, 0.004, z / 2]} rotation={[-Math.PI / 2, 0, -Math.atan2(z, x)]} receiveShadow>
            <planeGeometry args={[len, 1.1]} />
            <meshStandardMaterial color={SCENE_COLORS.path} />
          </mesh>
        );
      })}
    </group>
  );
}
