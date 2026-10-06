import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type AmbientLight, type DirectionalLight, type HemisphereLight } from 'three';
import { useFirm } from '../store/useFirm';
import { SCENE_COLORS } from './palette';

const NORMAL = { ambient: 0.12, hemi: 0.32, sun: 1.9, env: 0.55, fog: new Color(SCENE_COLORS.background) };
/** Mode focus : la carte s'assombrit légèrement autour du dossier sélectionné. */
const FOCUS = { ambient: 0.06, hemi: 0.18, sun: 1.1, env: 0.32, fog: new Color('#d3d9e3') };

/** Éclairage chaud et doux (soleil de fin d'après-midi), avec transition vers le mode focus. */
export function FocusLighting() {
  const focus = useFirm((s) => s.selection?.kind === 'matter');
  const ambient = useRef<AmbientLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const sun = useRef<DirectionalLight>(null);

  useFrame(({ scene }, dt) => {
    const target = focus ? FOCUS : NORMAL;
    const k = 1 - Math.exp(-dt * 6);
    if (ambient.current) ambient.current.intensity += (target.ambient - ambient.current.intensity) * k;
    if (hemi.current) hemi.current.intensity += (target.hemi - hemi.current.intensity) * k;
    if (sun.current) sun.current.intensity += (target.sun - sun.current.intensity) * k;
    scene.environmentIntensity += (target.env - scene.environmentIntensity) * k;
    if (scene.fog && 'color' in scene.fog) (scene.fog.color as Color).lerp(target.fog, k);
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={NORMAL.ambient} />
      <hemisphereLight ref={hemi} args={['#fff6ea', '#b7c3d6', NORMAL.hemi]} />
      <directionalLight
        ref={sun}
        castShadow
        color="#ffe9cf"
        position={[-38, 52, 30]}
        intensity={NORMAL.sun}
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-far={200}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
        shadow-radius={6}
      />
    </>
  );
}
