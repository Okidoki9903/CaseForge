import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type AmbientLight, type DirectionalLight, type HemisphereLight, type Scene } from 'three';
import { useFirm } from '../store/useFirm';
import { SCENE_COLORS } from './palette';

const NORMAL = { ambient: 0.6, hemi: 0.6, sun: 1.7, bg: new Color(SCENE_COLORS.background) };
/** Mode focus : la carte s'assombrit légèrement autour du dossier sélectionné. */
const FOCUS = { ambient: 0.28, hemi: 0.3, sun: 0.95, bg: new Color('#c9d1dc') };

/** Éclairage de la scène, avec transition douce vers le mode focus. */
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
    const bg = (scene as Scene).background;
    if (bg instanceof Color) bg.lerp(target.bg, k);
    if (scene.fog && 'color' in scene.fog) (scene.fog.color as Color).lerp(target.bg, k);
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={NORMAL.ambient} />
      <hemisphereLight ref={hemi} args={['#ffffff', '#b9c6d8', NORMAL.hemi]} />
      <directionalLight
        ref={sun}
        castShadow
        position={[30, 60, 20]}
        intensity={NORMAL.sun}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-bias={-0.0004}
      />
    </>
  );
}
