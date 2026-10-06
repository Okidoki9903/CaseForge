/**
 * Rapports rapides : heures par collaborateur (semaine / mois) et échéances critiques,
 * exportables en CSV (deux formats) ou en PDF, générés localement.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ALERT_COLORS } from '@shared/domain/alerts';
import { criticalAlerts, deadlinesToCsv, hoursReport, hoursReportToCsv, printableHtml, type ReportPeriod } from '@shared/domain/reports';
import type { CsvDialect } from '@shared/domain/time';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { formatWhen, hours, longDate, money, percent } from '../lib/format';
import { Countdown, Icon, IconButton, LevelBadge } from './primitives';

type Tab = 'hours' | 'deadlines';

export function ReportsDrawer({ derived }: { derived: Derived }) {
  const { t } = useTranslation();
  const open = useFirm((s) => s.reportsOpen);
  const setOpen = useFirm((s) => s.setReportsOpen);
  const dialect = useFirm((s) => s.csvDialect);
  const setDialect = useFirm((s) => s.setCsvDialect);
  const saveFile = useFirm((s) => s.saveFile);
  const [tab, setTab] = useState<Tab>('hours');
  const [period, setPeriod] = useState<ReportPeriod>('semaine');
  const [includeUrgent, setIncludeUrgent] = useState(false);
  const { snapshot, today } = derived;
  const report = useMemo(() => hoursReport(snapshot, period, today), [snapshot, period, today]);
  const deadlines = useMemo(() => criticalAlerts(derived.alerts, includeUrgent), [derived.alerts, includeUrgent]);
  if (!open) return null;

  const generatedAt = formatWhen(new Date().toISOString());
  const firmName = snapshot.settings.firmName;
  const stamp = `${today}`;

  const exportHours = (kind: 'csv' | 'pdf') => {
    if (kind === 'csv') return saveFile('csv', `caseforge-heures-${period}-${stamp}.csv`, hoursReportToCsv(report, dialect));
    const headers = [t('settings.name'), t('settings.role'), 'h ' + t('reports.total'), 'h ' + t('reports.billable'), 'h ' + t('reports.nonBillable'), '$ ' + t('reports.value'), 'h ' + t('reports.target'), '% ' + t('reports.utilization')];
    const rows = report.rows.map((r) => [
      `${r.staff.name} (${r.staff.initials})`, t(`role.${r.staff.role}`), hours(r.minutes / 60), hours(r.billableMinutes / 60),
      hours(r.nonBillableMinutes / 60), money(r.valueCents), hours(r.targetHours), percent(r.utilization),
    ]);
    const tot = report.totals;
    rows.push([t('reports.total'), '', hours(tot.minutes / 60), hours(tot.billableMinutes / 60), hours(tot.nonBillableMinutes / 60), money(tot.valueCents), hours(tot.targetHours), percent(tot.utilization)]);
    return saveFile('pdf', `caseforge-heures-${period}-${stamp}.pdf`, printableHtml({
      title: t('reports.pdfHoursTitle'),
      subtitle: t('reports.period', { from: longDate(report.range.from), to: longDate(report.range.to), days: report.range.workdays }),
      firmName, generatedAt, headers, rows, rowClasses: rows.map((_, i) => (i === rows.length - 1 ? 'total' : '')),
    }));
  };

  const exportDeadlines = (kind: 'csv' | 'pdf') => {
    if (kind === 'csv') return saveFile('csv', `caseforge-echeances-critiques-${stamp}.csv`, deadlinesToCsv(deadlines, snapshot, dialect));
    const headers = [t('reports.colLevel'), t('reports.colDaysLeft'), t('newDeadline.due'), t('newDeadline.title'), t('reports.colMatter'), t('alerts.basis'), t('alerts.assigned'), t('reports.colAckBy')];
    const rows = deadlines.map((a) => [
      t(`level.${a.level}`), String(a.daysLeft), longDate(a.deadline.dueDate), a.deadline.title, `${a.matter.number} · ${a.matter.title} (${a.matter.jurisdiction})`,
      a.deadline.legalBasis ?? '—', derived.staffById.get(a.deadline.assignedTo)?.name ?? '—', a.deadline.acknowledgedBy ?? '—',
    ]);
    return saveFile('pdf', `caseforge-echeances-critiques-${stamp}.pdf`, printableHtml({
      title: t('reports.pdfDeadlinesTitle'),
      subtitle: t('alerts.subtitle'),
      firmName, generatedAt, headers, rows, rowClasses: deadlines.map((a) => a.level),
    }));
  };

  const ExportButtons = ({ onExport, disabled }: { onExport: (k: 'csv' | 'pdf') => void; disabled?: boolean }) => (
    <div className="flex gap-1">
      {(['csv', 'pdf'] as const).map((k) => (
        <button
          key={k}
          type="button"
          disabled={disabled}
          onClick={() => onExport(k)}
          className="flex h-7 items-center gap-1 rounded-md bg-[var(--color-brand)] px-2.5 text-[11px] font-semibold text-white disabled:opacity-40"
        >
          <Icon.file /> {t(`reports.${k}`)}
        </button>
      ))}
    </div>
  );

  return (
    <aside className="glass animate-panel pointer-events-auto absolute bottom-3 right-3 top-[86px] z-40 flex w-[520px] flex-col overflow-hidden rounded-2xl">
      <header className="px-4 pb-2 pt-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold">{t('reports.title')}</h2>
            <p className="text-[11px] text-[var(--color-muted)]">{t('reports.subtitle')}</p>
          </div>
          <IconButton onClick={() => setOpen(false)} title={t('actions.close')}><Icon.close /></IconButton>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1" role="tablist">
          {(['hours', 'deadlines'] as Tab[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${tab === k ? 'bg-[var(--color-ink)] text-white' : 'bg-white text-[var(--color-muted)]'}`}
            >
              {t(`reports.${k}`)}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1 whitespace-nowrap text-[10px] text-[var(--color-muted)]">
            {t('reports.dialect')}
            <select value={dialect} onChange={(e) => setDialect(e.target.value as CsvDialect)} className="h-6 rounded border border-[var(--color-line)] bg-white px-1 text-[10px] outline-none">
              {(['facturation', 'excel-fr'] as const).map((d) => <option key={d} value={d}>{t(`reports.dialects.${d}`)}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-4">
        {tab === 'hours' ? (
          <>
            <div className="mb-2 flex items-center gap-1">
              {(['semaine', 'mois'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={period === p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold ${period === p ? 'bg-white shadow' : 'text-[var(--color-muted)]'}`}
                >
                  {p === 'semaine' ? t('reports.week') : t('reports.month')}
                </button>
              ))}
              <span className="ml-auto"><ExportButtons onExport={(k) => void exportHours(k)} /></span>
            </div>
            <p className="mb-2 text-[11px] text-[var(--color-muted)]">
              {t('reports.period', { from: longDate(report.range.from), to: longDate(report.range.to), days: report.range.workdays })}
            </p>
            <table className="w-full text-xs">
              <thead className="text-[9px] uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="py-1 text-left">{t('settings.name')}</th>
                  <th className="text-right">{t('reports.billable')}</th>
                  <th className="text-right">{t('reports.nonBillable')}</th>
                  <th className="text-right">{t('reports.value')}</th>
                  <th className="w-24 text-right">{t('reports.utilization')}</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {report.rows.map((r) => (
                  <tr key={r.staff.id} className="border-t border-[var(--color-line)]">
                    <td className="py-1.5">
                      <b>{r.staff.initials}</b> <span className="text-[var(--color-muted)]">{r.staff.name.replace(/^Me /, '')}</span>
                    </td>
                    <td className="text-right font-semibold">{hours(r.billableMinutes / 60)}</td>
                    <td className="text-right text-[var(--color-muted)]">{hours(r.nonBillableMinutes / 60)}</td>
                    <td className="text-right">{money(r.valueCents, true)}</td>
                    <td className="pl-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.utilization * 100)}%`, background: r.utilization > 1.1 ? ALERT_COLORS.critique : r.utilization > 0.85 ? ALERT_COLORS.attention : ALERT_COLORS.ok }} />
                        </div>
                        <span className="w-9 text-right">{percent(r.utilization)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[var(--color-ink)] font-bold">
                  <td className="py-1.5">{t('reports.total')}</td>
                  <td className="text-right">{hours(report.totals.billableMinutes / 60)}</td>
                  <td className="text-right">{hours(report.totals.nonBillableMinutes / 60)}</td>
                  <td className="text-right">{money(report.totals.valueCents, true)}</td>
                  <td className="text-right">{percent(report.totals.utilization)}</td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
                <input type="checkbox" checked={includeUrgent} onChange={(e) => setIncludeUrgent(e.target.checked)} /> {t('reports.includeUrgent')}
              </label>
              <span className="ml-auto"><ExportButtons onExport={(k) => void exportDeadlines(k)} disabled={deadlines.length === 0} /></span>
            </div>
            {deadlines.length === 0 && <p className="p-6 text-center text-sm text-[var(--color-muted)]">{t('reports.none')}</p>}
            <ul className="space-y-1.5">
              {deadlines.map((a) => (
                <li key={a.deadline.id} className="rounded-lg bg-white/90 p-2 text-xs" style={{ borderLeft: `4px solid ${ALERT_COLORS[a.level]}` }}>
                  <div className="flex items-center gap-2">
                    <LevelBadge level={a.level} />
                    <span className="font-semibold">{a.deadline.title}</span>
                    <span className="tabular ml-auto text-[11px] font-bold" style={{ color: ALERT_COLORS[a.level] }}><Countdown daysLeft={a.daysLeft} /></span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                    {longDate(a.deadline.dueDate)} · {a.matter.number} {a.matter.title} · {a.matter.jurisdiction}
                    {a.deadline.acknowledgedBy && ` · ✓ ${a.deadline.acknowledgedBy}`}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}
