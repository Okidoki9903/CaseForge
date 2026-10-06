import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useFirm } from '../store/useFirm';
import type { CampusLayout } from './layout';

/**
 * Recentre doucement la caméra sur l'élément sélectionné (comme un jeu de stratégie),
 * sans bloquer le déplacement manuel une fois l'animation terminée.
 */
export function CameraRig({ layout, view }: { layout: CampusLayout; view: 'campus' | 'street' | 'plan' | 'office' }) {
  const selection = useFirm((s) => s.selection);
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void; addEventListener: (event: 'start', listener: () => void) => void; removeEventListener: (event: 'start', listener: () => void) => void } | null;
  const camera = useThree((s) => s.camera);
  const goal = useRef<Vector3 | null>(null);
  const cameraGoal = useRef<Vector3 | null>(null);
  useEffect(() => {
    if (!controls) return;
    const cancel = () => { goal.current = null; cameraGoal.current = null; };
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);
  useEffect(() => {
    const positions = { campus: [51, 64, 60], street: [31, 20, 38], plan: [0, 85, 5], office: [26, 32, 35] };
    cameraGoal.current = new Vector3(...positions[view] as [number, number, number]);
    goal.current = new Vector3(-1, 0, 3);
  }, [view]);

  useEffect(() => {
    if (!selection) return;
    cameraGoal.current = null;
    const p =
      selection.kind === 'matter' ? layout.matters.get(selection.id)
      : selection.kind === 'area' ? layout.areas.get(selection.id)?.center
      : selection.kind === 'party' ? layout.parties.get(selection.id)
      : null; // les collaborateurs se déplacent : pas de recentrage
    // Décalage vers la droite de l'écran pour laisser la place au panneau de détail.
    goal.current = p ? new Vector3(p[0] + 4.5, 0, p[2] - 4) : null;
  }, [selection, layout]);

  useFrame((_, dt) => {
    if (!goal.current || !controls) return;
    const delta = goal.current.clone().sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 5));
    controls.target.add(delta);
    if (cameraGoal.current) {
      camera.position.lerp(cameraGoal.current, 1 - Math.exp(-dt * 4));
      if (camera.position.distanceTo(cameraGoal.current) < 0.05) cameraGoal.current = null;
    } else camera.position.add(delta);
    controls.update();
    if (!cameraGoal.current && goal.current.distanceTo(controls.target) < 0.02) goal.current = null;
  });
  return null;
}
