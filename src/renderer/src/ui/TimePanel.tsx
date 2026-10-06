/**
 * Section « Temps » du panneau d'un dossier : chronomètre, saisie manuelle rapide,
 * liste des entrées et changement de statut (facturé / radié).
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { entryValueCents, parseDuration, roundBillableMinutes, wipSummary } from '@shared/domain/time';
import type { Matter, TimeEntry } from '@shared/types';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { hours, money } from '../lib/format';
import { Icon, Section } from './primitives';

export function TimePanel({ matter, derived }: { matter: Matter; derived: Derived }) {
  const { t } = useTranslation();
  const timer = useFirm((s) => s.timer);
  const startTimer = useFirm((s) => s.startTimer);
  const stopTimer = useFirm((s) => s.stopTimer);
  const logMinutes = useFirm((s) => s.logMinutes);
  const exportCsv = useFirm((s) => s.exportCsv);
  const currentStaffId = useFirm((s) => s.currentStaffId);
  const running = timer?.matterId === matter.id;
  const elapsed = useElapsed(running ? timer!.startedAt : null);

  const [timerNote, setTimerNote] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [billable, setBillable] = useState(true);

  const entries = useMemo(
    () => derived.snapshot.timeEntries.filter((e) => e.matterId === matter.id).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [derived.snapshot.timeEntries, matter.id],
  );
  const wip = wipSummary(entries);
  const rate = derived.staffById.get(currentStaffId)?.hourlyRateCents ?? 0;
  const raw = parseDuration(duration);
  let rounded: number | null = null;
  try {
    rounded = raw === null ? null : roundBillableMinutes(raw);
  } catch {
    rounded = null;
  }
  const canAdd = rounded !== null && description.trim().length > 0;

  const submit = async () => {
    if (!canAdd || raw === null) return;
    if (await logMinutes(matter.id, raw, description, billable)) {
      setDescription('');
      setDuration('');
      setBillable(true);
    }
  };

  return (
    <Section
      title={t('time.title')}
      aside={
        <button type="button" onClick={() => void exportCsv(entries, matter.number)} className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-brand)] hover:underline">
          <Icon.file /> {t('time.exportCsv')}
        </button>
      }
    >
      {/* Chronomètre */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (running) {
              void stopTimer(timerNote).then(() => setTimerNote(''));
            } else startTimer(matter.id);
          }}
          className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-white shadow active:scale-95 ${running ? 'bg-[var(--color-critique)]' : 'bg-[var(--color-brand)]'}`}
        >
          {running ? <Icon.stop /> : <Icon.play />}
          {running ? <span className="tabular">{elapsed}</span> : t('matter.start')}
        </button>
        {running ? (
          <input
            value={timerNote}
            onChange={(e) => setTimerNote(e.target.value)}
            placeholder={t('time.timerDescription')}
            className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--color-line)] bg-white px-2 text-xs outline-none focus:border-[var(--color-brand)]"
          />
        ) : (
          <span className="text-[11px] text-[var(--color-muted)]">{t('matter.timer')} · {hours(0.1)} h</span>
        )}
      </div>

      {/* Saisie manuelle */}
      <form
        className="mt-2.5 space-y-1.5 rounded-xl border border-[var(--color-line)] bg-white/70 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('time.description')}
          aria-label={t('time.description')}
          maxLength={2000}
          className="h-8 w-full rounded-md border border-[var(--color-line)] bg-white px-2 text-xs outline-none focus:border-[var(--color-brand)]"
        />
        <div className="flex items-center gap-1.5">
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder={t('time.durationHint')}
            aria-label={t('time.duration')}
            className={`tabular h-8 w-24 rounded-md border bg-white px-2 text-xs outline-none ${duration && rounded === null ? 'border-[var(--color-critique)]' : 'border-[var(--color-line)] focus:border-[var(--color-brand)]'}`}
          />
          <label className="flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
            <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> {t('time.billable')}
          </label>
          <button type="submit" disabled={!canAdd} className="ml-auto h-8 rounded-md bg-[var(--color-brand)] px-3 text-xs font-semibold text-white disabled:opacity-40">
            {t('time.add')}
          </button>
        </div>
        <div className="tabular h-4 text-[10px] text-[var(--color-muted)]">
          {duration && rounded === null
            ? <span className="text-[var(--color-critique)]">{t('time.invalidDuration')}</span>
            : rounded !== null && t('time.preview', { hours: hours(rounded / 60), amount: money(billable ? entryValueCents({ minutes: rounded, rateCents: rate }) : 0) })}
        </div>
      </form>

      {/* Entrées */}
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-[var(--color-muted)]">{t('time.entries')} ({entries.length})</span>
        <span className="tabular">{t('time.total', { hours: hours(wip.minutes / 60), amount: money(wip.valueCents) })} · {t('time.status.wip')}</span>
      </div>
      <ul className="scrollbar-thin mt-1 max-h-56 space-y-1 overflow-y-auto pr-1">
        {entries.length === 0 && <li className="text-xs text-[var(--color-muted)]">{t('time.noEntries')}</li>}
        {entries.slice(0, 60).map((e) => <TimeRow key={e.id} entry={e} derived={derived} />)}
      </ul>
    </Section>
  );
}

const STATUS_STYLE: Record<TimeEntry['status'], string> = {
  wip: 'bg-amber-50 text-amber-700',
  facture: 'bg-emerald-50 text-emerald-700',
  radie: 'bg-slate-100 text-slate-500 line-through',
};

export function TimeRow({ entry: e, derived, showMatter = false }: { entry: TimeEntry; derived: Derived; showMatter?: boolean }) {
  const { t } = useTranslation();
  const setTimeStatus = useFirm((s) => s.setTimeStatus);
  const person = derived.staffById.get(e.staffId);
  const matter = showMatter ? derived.snapshot.matters.find((m) => m.id === e.matterId) : undefined;
  const action = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className="rounded px-1 text-[10px] font-semibold text-[var(--color-brand)] hover:bg-white">
      {label}
    </button>
  );
  return (
    <li className="group rounded-lg px-1.5 py-1 text-xs hover:bg-white">
      <div className="flex items-center gap-1.5">
        <span className="tabular w-[68px] shrink-0 text-[10px] text-[var(--color-muted)]">{e.date}</span>
        <span className="grid h-5 w-6 shrink-0 place-items-center rounded bg-slate-200 text-[9px] font-bold">{person?.initials}</span>
        <span className="min-w-0 flex-1 truncate" title={e.description}>
          {matter && <b>{matter.number} </b>}
          {e.description}
        </span>
        <span className="tabular shrink-0 font-semibold">{hours(e.minutes / 60)} h</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap pl-1">
        <span className={`shrink-0 rounded px-1.5 text-[9px] font-bold uppercase ${STATUS_STYLE[e.status]}`}>{t(`time.status.${e.status}`)}</span>
        <span className="tabular truncate text-[10px] text-[var(--color-muted)]">
          {e.billable ? `${money(entryValueCents(e))} @ ${money(e.rateCents, true)}/h` : t('time.nonBillable')}
        </span>
        <span className="ml-auto flex shrink-0 gap-0.5 opacity-60 group-hover:opacity-100">
          {e.status === 'wip' ? (
            <>
              {action(t('time.markBilled'), () => void setTimeStatus(e.id, 'facture'))}
              {action(t('time.writeOff'), () => void setTimeStatus(e.id, 'radie'))}
            </>
          ) : (
            action(t('time.reopen'), () => void setTimeStatus(e.id, 'wip'))
          )}
        </span>
      </div>
    </li>
  );
}

function useElapsed(since: number | null): string {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (since === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since]);
  if (since === null) return '';
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
