import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ALERT_COLORS, type DeadlineAlert } from '@shared/domain/alerts';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { longDate } from '../lib/format';
import { Countdown, Icon, IconButton, LevelBadge } from './primitives';

/** Tiroir listant toutes les échéances ouvertes, de la plus grave à la moins grave. */
export function AlertCenter({ derived }: { derived: Derived }) {
  const { t } = useTranslation();
  const open = useFirm((s) => s.alertCenterOpen);
  const setOpen = useFirm((s) => s.setAlertCenterOpen);
  if (!open) return null;
  const { alerts } = derived;

  return (
    <aside className="glass animate-panel pointer-events-auto absolute bottom-3 right-3 top-[86px] z-40 flex w-[420px] flex-col overflow-hidden rounded-2xl">
      <header className="flex items-start justify-between px-4 pb-2 pt-3">
        <div>
          <h2 className="text-base font-bold">{t('alerts.title')}</h2>
          <p className="text-[11px] text-[var(--color-muted)]">{t('alerts.subtitle')}</p>
        </div>
        <IconButton onClick={() => setOpen(false)} title={t('actions.close')}><Icon.close /></IconButton>
      </header>
      <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {alerts.length === 0 && <p className="p-6 text-center text-sm text-[var(--color-muted)]">{t('alerts.empty')}</p>}
        {alerts.map((a) => (
          <AlertCard key={a.deadline.id} alert={a} derived={derived} />
        ))}
      </div>
    </aside>
  );
}

export function AlertCard({ alert: a, derived, compact = false }: { alert: DeadlineAlert; derived: Derived; compact?: boolean }) {
  const { t } = useTranslation();
  const acknowledge = useFirm((s) => s.acknowledge);
  const complete = useFirm((s) => s.complete);
  const select = useFirm((s) => s.select);
  const currentStaffId = useFirm((s) => s.currentStaffId);
  const [acking, setAcking] = useState(false);
  const [initials, setInitials] = useState(derived.staffById.get(currentStaffId)?.initials ?? '');
  const assignee = derived.staffById.get(a.deadline.assignedTo);
  const color = ALERT_COLORS[a.level];

  return (
    <article className="rounded-xl border border-white bg-white/90 p-3 shadow-sm" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="flex items-center justify-between gap-2">
        <LevelBadge level={a.level} pulse={a.requiresAcknowledgement} />
        <span className="tabular text-xs font-bold" style={{ color }}>
          <Countdown daysLeft={a.daysLeft} />
        </span>
      </div>
      <h4 className="mt-1.5 text-sm font-semibold leading-snug">{a.deadline.title}</h4>
      {!compact && (
        <button type="button" onClick={() => select({ kind: 'matter', id: a.matter.id })} className="text-left text-xs text-[var(--color-brand)] hover:underline">
          {a.matter.number} · {a.matter.title}
        </button>
      )}
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px] text-[var(--color-muted)]">
        <dt>📅</dt>
        <dd className="font-medium text-[var(--color-ink)]">{longDate(a.deadline.dueDate)} · {t(`kind.${a.deadline.kind}`)} · {a.matter.jurisdiction}</dd>
        {a.deadline.legalBasis && (<><dt>§</dt><dd>{a.deadline.legalBasis}</dd></>)}
        <dt>👤</dt>
        <dd>{t('alerts.assigned')} : {assignee?.name ?? '—'}</dd>
      </dl>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {a.deadline.acknowledgedBy ? (
          <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] text-[var(--color-muted)]">
            <Icon.check /> {t('alerts.acknowledged', { who: a.deadline.acknowledgedBy })}
          </span>
        ) : acking ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              void acknowledge(a.deadline.id, initials).then(() => setAcking(false));
            }}
          >
            <input
              autoFocus
              value={initials}
              onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 4))}
              placeholder={t('alerts.initials')}
              aria-label={t('alerts.initials')}
              className="h-7 w-16 rounded-md border border-[var(--color-line)] px-2 text-xs font-bold uppercase outline-none focus:border-[var(--color-brand)]"
            />
            <button type="submit" className="h-7 rounded-md px-2 text-xs font-bold text-white" style={{ background: color }}>
              {t('alerts.confirm')}
            </button>
          </form>
        ) : (
          (a.level === 'critique' || a.level === 'depasse' || a.level === 'urgent') && (
            <button type="button" onClick={() => setAcking(true)} className="h-7 rounded-md px-2.5 text-xs font-bold text-white" style={{ background: color }}>
              {t('alerts.acknowledge')}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => void complete(a.deadline.id)}
          className="h-7 rounded-md border border-[var(--color-line)] bg-white px-2.5 text-xs font-semibold hover:border-emerald-400 hover:text-emerald-700"
        >
          {t('alerts.complete')}
        </button>
        {!compact && (
          <button
            type="button"
            onClick={() => select({ kind: 'matter', id: a.matter.id })}
            className="ml-auto flex h-7 items-center gap-1 rounded-md px-2 text-xs text-[var(--color-muted)] hover:bg-slate-100"
          >
            <Icon.pin /> {t('alerts.locate')}
          </button>
        )}
      </div>
    </article>
  );
}
