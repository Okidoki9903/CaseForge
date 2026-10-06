/**
 * Paramètres du cabinet : nom, ressorts, taux par défaut, collaborateurs et données.
 * Tout est persisté localement (table `settings` et `staff`, ou IndexedDB en démo).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_PRACTICE_AREAS } from '@shared/domain/firm';
import type { Jurisdiction, Staff } from '@shared/types';
import { api } from '../api';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { money } from '../lib/format';
import { ROLE_COLORS } from '../scene/palette';
import { Icon, IconButton } from './primitives';
import { JurisdictionPicker } from './JurisdictionPicker';
import { dollarsToCents, fromDraft, inputClass, StaffFields, toDraft, type StaffDraft } from './StaffForm';
import { CreateFirmForm } from './Onboarding';

type Tab = 'firm' | 'staff' | 'data';

export function Settings({ derived }: { derived: Derived }) {
  const { t } = useTranslation();
  const open = useFirm((s) => s.settingsOpen);
  const setOpen = useFirm((s) => s.setSettingsOpen);
  const [tab, setTab] = useState<Tab>('firm');
  if (!open) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-slate-900/25 p-4 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.title')}
        className="glass animate-panel flex max-h-[86vh] w-[min(860px,100%)] flex-col overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 pb-2 pt-4">
          <div>
            <h2 className="text-lg font-bold">{t('settings.title')}</h2>
            {derived.snapshot.settings.demo && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{t('settings.demoBadge')}</span>
            )}
          </div>
          <IconButton onClick={() => setOpen(false)} title={t('actions.close')}><Icon.close /></IconButton>
        </header>
        <nav className="flex gap-1 border-b border-[var(--color-line)] px-5" role="tablist">
          {(['firm', 'staff', 'data'] as Tab[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === k ? 'border-[var(--color-brand)] text-[var(--color-ink)]' : 'border-transparent text-[var(--color-muted)]'}`}
            >
              {t(`settings.tabs.${k}`)}
            </button>
          ))}
        </nav>
        <div className="scrollbar-thin flex-1 overflow-y-auto p-5">
          {tab === 'firm' && <FirmTab derived={derived} />}
          {tab === 'staff' && <StaffTab derived={derived} />}
          {tab === 'data' && <DataTab />}
        </div>
      </div>
    </div>
  );
}

function FirmTab({ derived }: { derived: Derived }) {
  const { t } = useTranslation();
  const update = useFirm((s) => s.updateSettings);
  const current = derived.snapshot.settings;
  const [firmName, setFirmName] = useState(current.firmName);
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>(current.jurisdictions);
  const [rate, setRate] = useState(String(current.defaultRateCents / 100));
  const [saved, setSaved] = useState(false);
  useEffect(() => setSaved(false), [firmName, jurisdictions, rate]);

  return (
    <form
      className="max-w-xl space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(await update({ firmName, jurisdictions, defaultRateCents: dollarsToCents(rate) }));
      }}
    >
      <label className="block text-xs font-semibold">
        {t('settings.firmName')}
        <input className={`${inputClass} mt-1 h-9 text-sm`} value={firmName} onChange={(e) => setFirmName(e.target.value)} maxLength={120} />
      </label>
      <div>
        <div className="text-xs font-semibold">{t('settings.jurisdictions')}</div>
        <p className="mb-2 text-[11px] text-[var(--color-muted)]">{t('settings.jurisdictionsHint')}</p>
        <JurisdictionPicker value={jurisdictions} onChange={setJurisdictions} />
        <p className="mt-2 flex gap-3 text-[10px] text-[var(--color-muted)]">
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />{t('calendar.valide')}</span>
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />{t('calendar.a_valider')}</span>
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-slate-300" />{t('calendar.socle')}</span>
        </p>
      </div>
      <label className="block text-xs font-semibold">
        {t('settings.defaultRate')}
        <input className={`${inputClass} tabular mt-1 h-9 w-40 text-sm`} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        <span className="mt-1 block text-[11px] font-normal text-[var(--color-muted)]">{t('settings.defaultRateHint')}</span>
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="h-9 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-bold text-white">{t('settings.save')}</button>
        {saved && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700"><Icon.check /> {t('settings.saved')}</span>}
      </div>
    </form>
  );
}

function StaffTab({ derived }: { derived: Derived }) {
  const { t } = useTranslation();
  const saveStaff = useFirm((s) => s.saveStaff);
  const setStaffActive = useFirm((s) => s.setStaffActive);
  const { snapshot } = derived;
  const areas = snapshot.practiceAreas.length ? snapshot.practiceAreas : DEFAULT_PRACTICE_AREAS;
  const [editing, setEditing] = useState<{ id?: string; draft: StaffDraft } | null>(null);
  const staff = [...snapshot.staff].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  const startEdit = (p?: Staff) =>
    setEditing({ id: p?.id, draft: toDraft(p ?? {}, snapshot.settings.defaultRateCents, areas[0].id) });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-[var(--color-muted)]">{t('settings.rateNote')}</p>
        <button type="button" onClick={() => startEdit()} className="h-8 shrink-0 rounded-lg bg-[var(--color-brand)] px-3 text-xs font-bold text-white">
          ＋ {t('settings.addStaff')}
        </button>
      </div>

      {editing && (
        <form
          className="rounded-xl border border-[var(--color-brand)] bg-white p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await saveStaff(fromDraft(editing.draft, editing.id))) setEditing(null);
          }}
        >
          <StaffFields draft={editing.draft} onChange={(d) => setEditing({ ...editing, draft: d })} areas={areas} />
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">{t('settings.initialsNote')}</p>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} className="h-8 rounded-lg px-3 text-xs font-semibold text-[var(--color-muted)] hover:bg-slate-100">
              {t('settings.cancel')}
            </button>
            <button type="submit" className="h-8 rounded-lg bg-[var(--color-brand)] px-4 text-xs font-bold text-white">{t('settings.save')}</button>
          </div>
        </form>
      )}

      <table className="w-full text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          <tr>
            <th className="py-1.5">{t('settings.name')}</th>
            <th>{t('settings.role')}</th>
            <th>{t('settings.area')}</th>
            <th className="text-right">{t('settings.rate')}</th>
            <th className="text-right">{t('settings.target')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {staff.map((p) => (
            <tr key={p.id} className={`border-t border-[var(--color-line)] ${p.active ? '' : 'opacity-50'}`}>
              <td className="py-2">
                <span className="mr-2 inline-grid h-6 w-7 place-items-center rounded text-[10px] font-bold text-white" style={{ background: ROLE_COLORS[p.role] }}>
                  {p.initials}
                </span>
                {p.name}
                {!p.active && <span className="ml-2 text-[10px] text-[var(--color-muted)]">({t('settings.inactive')})</span>}
              </td>
              <td>{t(`role.${p.role}`)}</td>
              <td>{derived.areaById.get(p.practiceAreaId)?.code ?? '—'}</td>
              <td className="tabular text-right">{money(p.hourlyRateCents)}</td>
              <td className="tabular text-right">{p.targetHoursWeek}</td>
              <td className="whitespace-nowrap pl-3 text-right">
                <button type="button" onClick={() => startEdit(p)} className="rounded px-1.5 text-[11px] font-semibold text-[var(--color-brand)] hover:bg-slate-100">
                  {t('settings.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => void setStaffActive(p.id, !p.active)}
                  className="rounded px-1.5 text-[11px] font-semibold text-[var(--color-muted)] hover:bg-slate-100"
                >
                  {p.active ? t('settings.deactivate') : t('settings.reactivate')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DataTab() {
  const { t } = useTranslation();
  const update = useFirm((s) => s.updateSettings);
  const resetDemo = useFirm((s) => s.resetDemo);
  const setOpen = useFirm((s) => s.setSettingsOpen);
  const [confirming, setConfirming] = useState<'demo' | 'empty' | null>(null);
  const [checked, setChecked] = useState(false);
  const [creating, setCreating] = useState(false);

  const run = async () => {
    if (confirming === 'demo') {
      await resetDemo();
      setOpen(false);
    } else if (confirming === 'empty') {
      setCreating(true);
    }
    setConfirming(null);
    setChecked(false);
  };

  if (creating) return <CreateFirmForm onCancel={() => setCreating(false)} />;

  return (
    <div className="max-w-xl space-y-4">
      <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
        <Icon.lock /> {t('settings.dataLocal', { storage: api.storage === 'sqlite' ? 'SQLite' : 'IndexedDB' })}
      </p>
      <button
        type="button"
        onClick={async () => {
          await update({ onboarded: false });
          setOpen(false);
        }}
        className="block text-sm font-semibold text-[var(--color-brand)] hover:underline"
      >
        {t('settings.showOnboarding')}
      </button>
      <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/60 p-3">
        <p className="text-xs font-semibold text-red-800">{t('settings.destructive')}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setConfirming('demo')} className="h-8 rounded-lg border border-red-300 bg-white px-3 text-xs font-semibold text-red-700">
            {t('settings.loadDemo')}
          </button>
          <button type="button" onClick={() => setConfirming('empty')} className="h-8 rounded-lg border border-red-300 bg-white px-3 text-xs font-semibold text-red-700">
            {t('settings.newFirm')}
          </button>
        </div>
        {confirming && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> {t('settings.confirmCheck')}
            </label>
            <button type="button" disabled={!checked} onClick={() => void run()} className="h-8 rounded-lg bg-red-600 px-3 text-xs font-bold text-white disabled:opacity-40">
              {t('settings.confirm')} — {confirming === 'demo' ? t('settings.loadDemo') : t('settings.newFirm')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
