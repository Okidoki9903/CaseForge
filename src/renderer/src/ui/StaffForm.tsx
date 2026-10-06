/**
 * Formulaire de collaborateur (accueil et paramètres). Les validations définitives sont
 * faites par la couche de données (domaine partagé `firm.ts`).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STAFF_ROLES } from '@shared/domain/firm';
import type { PracticeArea, StaffInput, StaffRole } from '@shared/types';

export interface StaffDraft {
  name: string;
  initials: string;
  role: StaffRole;
  practiceAreaId: string;
  rate: string;
  target: string;
}

export const toDraft = (s: Partial<StaffInput>, defaultRateCents: number, areaId: string): StaffDraft => ({
  name: s.name ?? '',
  initials: s.initials ?? '',
  role: s.role ?? 'avocat',
  practiceAreaId: s.practiceAreaId ?? areaId,
  rate: String((s.hourlyRateCents ?? defaultRateCents) / 100),
  target: String(s.targetHoursWeek ?? 32),
});

/** Montant en dollars saisi (« 325 », « 325,50 ») → cents ; NaN si invalide. */
export const dollarsToCents = (v: string) => Math.round(Number(v.replace(/\s/g, '').replace(',', '.')) * 100);

export const fromDraft = (d: StaffDraft, id?: string): StaffInput => ({
  id,
  name: d.name,
  initials: d.initials,
  role: d.role,
  practiceAreaId: d.practiceAreaId,
  hourlyRateCents: dollarsToCents(d.rate),
  targetHoursWeek: Number(d.target.replace(',', '.')),
});

export const inputClass =
  'h-8 w-full rounded-md border border-[var(--color-line)] bg-white px-2 text-xs outline-none focus:border-[var(--color-brand)]';

export function StaffFields({
  draft, onChange, areas, compact = false,
}: { draft: StaffDraft; onChange: (d: StaffDraft) => void; areas?: PracticeArea[]; compact?: boolean }) {
  const { t } = useTranslation();
  const set = (patch: Partial<StaffDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-6'}`}>
      <label className={`text-[11px] text-[var(--color-muted)] ${compact ? 'col-span-2' : 'col-span-2'}`}>
        {t('settings.name')}
        <input className={inputClass} value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} />
      </label>
      <label className="text-[11px] text-[var(--color-muted)]">
        {t('settings.initials')}
        <input className={`${inputClass} font-bold uppercase`} value={draft.initials} onChange={(e) => set({ initials: e.target.value.toUpperCase().slice(0, 4) })} />
      </label>
      <label className="text-[11px] text-[var(--color-muted)]">
        {t('settings.role')}
        <select className={inputClass} value={draft.role} onChange={(e) => set({ role: e.target.value as StaffRole })}>
          {STAFF_ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
        </select>
      </label>
      {areas && (
        <label className="text-[11px] text-[var(--color-muted)]">
          {t('settings.area')}
          <select className={inputClass} value={draft.practiceAreaId} onChange={(e) => set({ practiceAreaId: e.target.value })}>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </label>
      )}
      <label className="text-[11px] text-[var(--color-muted)]">
        {t('settings.rate')}
        <input className={`${inputClass} tabular`} inputMode="decimal" value={draft.rate} onChange={(e) => set({ rate: e.target.value })} />
      </label>
      {!compact && (
        <label className="text-[11px] text-[var(--color-muted)]">
          {t('settings.target')}
          <input className={`${inputClass} tabular`} inputMode="decimal" value={draft.target} onChange={(e) => set({ target: e.target.value })} />
        </label>
      )}
    </div>
  );
}

export function useStaffDraft(initial: StaffDraft) {
  return useState<StaffDraft>(initial);
}
