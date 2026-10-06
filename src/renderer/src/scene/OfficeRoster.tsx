import { useEffect, useState } from 'react';
import type { Staff } from '@shared/types';
import type { StaffMotion } from './StaffTraffic';
import type { Activity } from './staffNavigation';

export function OfficeRoster({ staff, traffic, en, onSelect }: { staff: Staff[]; traffic: Map<string, StaffMotion>; en: boolean; onSelect: (id: string) => void }) {
  const [states, setStates] = useState<Map<string, Activity>>(new Map());
  useEffect(() => {
    const refresh = () => setStates(new Map(staff.map(p => [p.id, traffic.get(p.id)?.activity ?? 'working'])));
    refresh();
    const timer = window.setInterval(refresh, 750);
    return () => window.clearInterval(timer);
  }, [staff, traffic]);
  const label = (state: Activity | undefined) => state === 'walking' ? (en ? 'On assignment' : 'En déplacement') : state === 'collecting' ? (en ? 'Collecting a file' : 'Récupère un dossier') : (en ? 'At work' : 'Au travail');
  return <div className="mt-2 space-y-1 border-t border-slate-200 pt-2">
    {staff.length === 0 && <p className="text-xs text-slate-500">{en ? 'No active staff in this area' : 'Aucun collaborateur actif dans ce pôle'}</p>}
    {staff.map(p => <button key={p.id} onClick={() => onSelect(p.id)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-slate-100">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-700">{p.initials}</span>
      <span className="min-w-0"><span className="block truncate text-[11px] font-semibold text-slate-700">{p.name}</span><span className="block text-[10px] text-slate-500">{label(states.get(p.id))}</span></span>
      <span className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${states.get(p.id) === 'working' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
    </button>)}
  </div>;
}
