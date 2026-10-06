/**
 * Tiroir « Temps et travaux en cours » : toutes les entrées du cabinet, filtrables,
 * regroupées par dossier, avec facturation groupée et export CSV.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { entryValueCents } from '@shared/domain/time';
import type { TimeEntry, TimeEntryStatus } from '@shared/types';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { hours, money } from '../lib/format';
import { Icon, IconButton } from './primitives';
import { TimeRow } from './TimePanel';

type Filter = TimeEntryStatus | 'all';

export function TimeDrawer({ derived }: { derived: Derived }) {
  const { t } = useTranslation();
  const open = useFirm((s) => s.timeDrawerOpen);
  const setOpen = useFirm((s) => s.setTimeDrawerOpen);
  const setTimeStatus = useFirm((s) => s.setTimeStatus);
  const exportCsv = useFirm((s) => s.exportCsv);
  const select = useFirm((s) => s.select);
  const currentStaffId = useFirm((s) => s.currentStaffId);
  const [filter, setFilter] = useState<Filter>('wip');
  const [mine, setMine] = useState(false);

  const entries = useMemo(
    () =>
      derived.snapshot.timeEntries
        .filter((e) => (filter === 'all' || e.status === filter) && (!mine || e.staffId === currentStaffId))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [derived.snapshot.timeEntries, filter, mine, currentStaffId],
  );
  const groups = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    for (const e of entries) map.set(e.matterId, [...(map.get(e.matterId) ?? []), e]);
    return [...map.entries()]
      .map(([matterId, list]) => ({
        matter: derived.snapshot.matters.find((m) => m.id === matterId)!,
        list,
        minutes: list.reduce((a, e) => a + e.minutes, 0),
        value: list.reduce((a, e) => a + (e.billable ? entryValueCents(e) : 0), 0),
      }))
      .filter((g) => g.matter)
      .sort((a, b) => b.value - a.value);
  }, [entries, derived.snapshot.matters]);

  if (!open) return null;
  const totalMinutes = entries.reduce((a, e) => a + e.minutes, 0);
  const totalValue = entries.reduce((a, e) => a + (e.billable ? entryValueCents(e) : 0), 0);
  const filters: Filter[] = ['wip', 'facture', 'radie', 'all'];

  return (
    <aside className="glass animate-panel pointer-events-auto absolute bottom-3 right-3 top-[var(--hud-top)] z-40 flex w-[460px] flex-col overflow-hidden rounded-2xl">
      <header className="px-4 pb-2 pt-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold">{t('time.drawerTitle')}</h2>
            <p className="text-[11px] text-[var(--color-muted)]">{t('time.drawerSubtitle')}</p>
          </div>
          <IconButton onClick={() => setOpen(false)} title={t('actions.close')}><Icon.close /></IconButton>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${filter === f ? 'bg-[var(--color-ink)] text-white' : 'bg-white text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
            >
              {f === 'all' ? t('time.all') : t(`time.status.${f}`)}
            </button>
          ))}
          <label className="ml-1 flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> {t('time.mine')}
          </label>
          <button
            type="button"
            onClick={() => void exportCsv(entries, filter)}
            disabled={entries.length === 0}
            className="ml-auto flex h-7 items-center gap-1 rounded-md bg-[var(--color-brand)] px-2.5 text-[11px] font-semibold text-white disabled:opacity-40"
          >
            <Icon.file /> {t('time.exportCsv')} ({entries.length})
          </button>
        </div>
        <div className="tabular mt-2 text-xs font-semibold">{t('time.total', { hours: hours(totalMinutes / 60), amount: money(totalValue) })}</div>
      </header>
      <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {groups.length === 0 && <p className="p-6 text-center text-sm text-[var(--color-muted)]">{t('time.noEntries')}</p>}
        {groups.map((g) => (
          <section key={g.matter.id} className="rounded-xl border border-white bg-white/90 p-2 shadow-sm">
            <div className="flex items-center gap-2 px-1">
              <button type="button" onClick={() => select({ kind: 'matter', id: g.matter.id })} className="min-w-0 flex-1 truncate text-left text-xs hover:underline">
                <b>{g.matter.number}</b> {g.matter.title}
              </button>
              <span className="tabular shrink-0 text-[11px] font-semibold">{t('time.total', { hours: hours(g.minutes / 60), amount: money(g.value, true) })}</span>
              {filter === 'wip' && (
                <button
                  type="button"
                  onClick={async () => {
                    for (const e of g.list) await setTimeStatus(e.id, 'facture');
                  }}
                  className="shrink-0 rounded-md border border-[var(--color-line)] px-2 py-0.5 text-[10px] font-semibold hover:border-emerald-400 hover:text-emerald-700"
                >
                  {t('time.billAll')}
                </button>
              )}
            </div>
            <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto">
              {g.list.map((e) => <TimeRow key={e.id} entry={e} derived={derived} />)}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
