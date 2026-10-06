import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useFirm } from '../store/useFirm';
import type { CampusLayout } from './layout';

/**
 * Recentre doucement la caméra sur l'élément sélectionné (comme un jeu de stratégie),
 * sans bloquer le déplacement manuel une fois l'animation terminée.
 */
export function CameraRig({ layout }: { layout: CampusLayout }) {
  const selection = useFirm((s) => s.selection);
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null;
  const camera = useThree((s) => s.camera);
  const goal = useRef<Vector3 | null>(null);

  useEffect(() => {
    if (!selection) return;
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
    camera.position.add(delta);
    controls.update();
    if (goal.current.distanceTo(controls.target) < 0.02) goal.current = null;
  });
  return null;
}
