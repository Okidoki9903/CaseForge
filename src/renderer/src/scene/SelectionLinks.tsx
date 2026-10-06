import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { QuadraticBezierLine } from '@react-three/drei';
import type { Id } from '@shared/types';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import type { CampusLayout, Vec3 } from './layout';

interface Link {
  key: string;
  from: Vec3;
  to: Vec3;
  color: string;
}

/** Arcs animés reliant l'élément sélectionné (ou survolé) à ses dossiers / parties. */
export function SelectionLinks({ layout, derived }: { layout: CampusLayout; derived: Derived }) {
  const selection = useFirm((s) => s.selection);
  const hovered = useFirm((s) => s.hovered);
  const focus = selection ?? (hovered?.kind === 'matter' ? hovered : null);
  if (!focus) return null;

  const { snapshot, loads } = derived;
  const links: Link[] = [];
  const matterLinks = (matterId: Id) => {
    const from = layout.matters.get(matterId);
    if (!from) return;
    for (const mp of snapshot.matterParties.filter((x) => x.matterId === matterId)) {
      const to = layout.parties.get(mp.partyId);
      if (!to) continue;
      links.push({
        key: `${matterId}-${mp.partyId}-${mp.role}`,
        from,
        to,
        color: mp.role === 'client' ? '#3b82f6' : mp.role === 'tribunal' ? '#475569' : '#dc4c64',
      });
    }
  };

  if (focus.kind === 'matter') matterLinks(focus.id);
  if (focus.kind === 'party') {
    for (const mp of snapshot.matterParties.filter((x) => x.partyId === focus.id)) {
      const from = layout.matters.get(mp.matterId);
      const to = layout.parties.get(focus.id);
      if (from && to) links.push({ key: mp.matterId, from, to, color: '#3b5bdb' });
    }
  }
  if (focus.kind === 'staff' && loads.has(focus.id)) {
    const area = layout.areas.get(loads.get(focus.id)!.staff.practiceAreaId);
    for (const m of snapshot.matters.filter((x) => x.responsibleId === focus.id || x.teamIds.includes(focus.id))) {
      const to = layout.matters.get(m.id);
      if (area && to) links.push({ key: m.id, from: area.door, to, color: '#3b5bdb' });
    }
  }
  return (
    <>
      {links.map((l) => (
        <AnimatedArc key={l.key} from={l.from} to={l.to} color={l.color} />
      ))}
    </>
  );
}

function AnimatedArc({ from, to, color }: Omit<Link, 'key'>) {
  const ref = useRef<any>(null);
  useFrame((_, dt) => {
    if (ref.current?.material) ref.current.material.dashOffset -= dt * 2;
  });
  const mid: Vec3 = [(from[0] + to[0]) / 2, 4 + Math.hypot(to[0] - from[0], to[2] - from[2]) * 0.18, (from[2] + to[2]) / 2];
  return (
    <QuadraticBezierLine
      ref={ref}
      start={[from[0], 0.6, from[2]]}
      end={[to[0], 0.6, to[2]]}
      mid={mid}
      color={color}
      lineWidth={2}
      dashed
      dashSize={0.6}
      gapSize={0.35}
      transparent
      opacity={0.85}
    />
  );
}
