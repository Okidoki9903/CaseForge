/**
 * Ouverture d'un dossier. La vérification de conflits est affichée en direct pendant la
 * saisie, puis refaite et enregistrée par la couche de données à la création.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { initialConflictStatus, searchConflicts, toCheckHits } from '@shared/domain/conflicts';
import type { FeeArrangement, Jurisdiction } from '@shared/types';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { Icon, IconButton } from './primitives';
import { dollarsToCents, inputClass } from './StaffForm';
import { CONFLICT_COLORS } from './conflictStyles';

export function NewMatter({ derived }: { derived: Derived }) {
  const open = useFirm((s) => s.newMatterOpen);
  // Formulaire monté à l'ouverture seulement : valeurs initiales toujours à jour (session, ressorts).
  return open ? <NewMatterForm derived={derived} /> : null;
}

function NewMatterForm({ derived }: { derived: Derived }) {
  const { t } = useTranslation();
  const setOpen = useFirm((s) => s.setNewMatterOpen);
  const createMatter = useFirm((s) => s.createMatter);
  const currentStaffId = useFirm((s) => s.currentStaffId);
  const { snapshot, activeStaff } = derived;
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [adverse, setAdverse] = useState('');
  const [areaId, setAreaId] = useState(snapshot.practiceAreas[0]?.id ?? '');
  const [responsibleId, setResponsibleId] = useState(currentStaffId);
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>(snapshot.settings.jurisdictions[0] ?? 'QC');
  const [fee, setFee] = useState<FeeArrangement>('horaire');
  const [budget, setBudget] = useState('10000');

  const adverseNames = adverse.split(',').map((s) => s.trim()).filter(Boolean);
  const preview = useMemo(
    () =>
      [
        ...(client.trim().length >= 3 ? [{ name: client.trim(), as: 'client' as const }] : []),
        ...adverseNames.filter((n) => n.length >= 3).map((name) => ({ name, as: 'adverse' as const })),
      ].map((c) => {
        const hits = toCheckHits(searchConflicts(c.name, snapshot));
        return { ...c, hits, status: initialConflictStatus(hits, c.as) };
      }),
    [client, adverse, snapshot],
  );
  const matterById = new Map(snapshot.matters.map((m) => [m.id, m]));

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-slate-900/25 p-4 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={t('newMatter.title')}
        className="glass animate-panel w-[min(640px,100%)] space-y-3 rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await createMatter({
            title, clientName: client, adverseNames, practiceAreaId: areaId, responsibleId,
            jurisdiction, feeArrangement: fee, budgetCents: dollarsToCents(budget),
          });
          if (ok) {
            setTitle('');
            setClient('');
            setAdverse('');
          }
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('newMatter.title')}</h2>
          <IconButton onClick={() => setOpen(false)} title={t('actions.close')}><Icon.close /></IconButton>
        </div>
        <label className="block text-[11px] text-[var(--color-muted)]">
          {t('newMatter.matterTitle')}
          <input autoFocus className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-[var(--color-muted)]">
            {t('newMatter.client')}
            <input className={inputClass} value={client} onChange={(e) => setClient(e.target.value)} maxLength={160} />
          </label>
          <label className="text-[11px] text-[var(--color-muted)]">
            {t('newMatter.adverse')}
            <input className={inputClass} value={adverse} onChange={(e) => setAdverse(e.target.value)} />
          </label>
        </div>

        {preview.length > 0 && (
          <div className="rounded-xl border border-[var(--color-line)] bg-white/80 p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">{t('newMatter.conflictPreview')}</div>
            <ul className="space-y-1">
              {preview.map((c) => (
                <li key={`${c.as}-${c.name}`} className="text-xs">
                  <span className="mr-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase text-white" style={{ background: CONFLICT_COLORS[c.status] }}>
                    {t(`conflicts.status.${c.status}`)}
                  </span>
                  <b>{c.name}</b> <span className="text-[var(--color-muted)]">{c.as === 'client' ? t('newMatter.asClient') : t('newMatter.asAdverse')}</span>
                  {c.hits.length === 0 ? (
                    <span className="text-[var(--color-muted)]"> — {t('newMatter.noConflict')}</span>
                  ) : (
                    <span className="text-[var(--color-muted)]">
                      {' — '}
                      {c.hits.flatMap((h) => h.roles.map((r) => `${t(`partyRole.${r.role}`)} ${matterById.get(r.matterId)?.number ?? ''}`)).join(' · ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <label className="text-[11px] text-[var(--color-muted)]">
            {t('newMatter.area')}
            <select className={inputClass} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              {snapshot.practiceAreas.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-[var(--color-muted)]">
            {t('newMatter.responsible')}
            <select className={inputClass} value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
              {activeStaff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-[var(--color-muted)]">
            {t('newMatter.jurisdiction')}
            <select className={inputClass} value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value as Jurisdiction)}>
              {snapshot.settings.jurisdictions.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-[var(--color-muted)]">
            {t('newMatter.fee')}
            <select className={inputClass} value={fee} onChange={(e) => setFee(e.target.value as FeeArrangement)}>
              {(['horaire', 'forfait', 'contingence'] as const).map((f) => <option key={f} value={f}>{t(`fee.${f}`)}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-[var(--color-muted)]">
            {t('newMatter.budget')}
            <input className={`${inputClass} tabular`} inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </label>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="h-9 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-bold text-white">{t('newMatter.create')}</button>
        </div>
      </form>
    </div>
  );
}

/** État vide du campus (cabinet sans dossier). */
export function EmptyFirmHint({ derived }: { derived: Derived }) {
  const { t } = useTranslation();
  const setOpen = useFirm((s) => s.setNewMatterOpen);
  if (derived.snapshot.matters.length > 0 || !derived.snapshot.settings.onboarded) return null;
  return (
    <div className="glass pointer-events-auto absolute left-1/2 top-1/2 z-20 w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 text-center">
      <div className="text-3xl" aria-hidden>📂</div>
      <h2 className="mt-1 text-base font-bold">{t('newMatter.emptyTitle')}</h2>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{t('newMatter.emptyBody')}</p>
      <button type="button" onClick={() => setOpen(true)} className="mt-3 h-9 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-bold text-white">
        ＋ {t('newMatter.title')}
      </button>
    </div>
  );
}
