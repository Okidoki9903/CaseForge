/**
 * Étiquette DOM ancrée dans la scène 3D.
 *
 * Toutes les étiquettes sont rendues dans un conteneur DOM explicite (superposé au canvas) :
 * sans cela, drei <Html> choisit son conteneur au premier rendu et la toute première
 * étiquette pouvait ne jamais être attachée au document.
 */
import { createContext, useContext, type MutableRefObject, type ReactNode } from 'react';
import { Html } from '@react-three/drei';

export const LabelPortal = createContext<MutableRefObject<HTMLElement> | null>(null);

export function MapLabel({ position, children }: { position: [number, number, number]; children: ReactNode }) {
  const portal = useContext(LabelPortal);
  return (
    <Html position={position} center zIndexRange={[20, 0]} portal={portal ?? undefined}>
      {children}
    </Html>
  );
}
