import { useTranslation } from 'react-i18next';
import { ALERT_COLORS } from '@shared/domain/alerts';
import { wipSummary } from '@shared/domain/time';
import { api } from '../api';
import { LANGUAGES, setLanguage, type Language } from '../i18n';
import { hours, money, percent } from '../lib/format';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { Icon, IconButton } from './primitives';

function Kpi({ label, value, sub, tone, onClick, pulse, className = '' }: { label: string; value: string; sub?: string; tone?: string; onClick?: () => void; pulse?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`glass flex min-w-[96px] flex-col items-start whitespace-nowrap rounded-xl px-2.5 py-2 text-left 2xl:min-w-[112px] 2xl:px-3 transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-lg ${className}`}
      style={tone ? { boxShadow: `inset 0 -3px 0 ${tone}` } : undefined}
    >
      <span className="text-[11px] font-medium text-[var(--color-muted)]">{label}</span>
      <span className={`tabular text-lg font-bold leading-tight 2xl:text-xl ${pulse ? 'animate-alert' : ''}`} style={tone ? { color: tone } : undefined}>
        {value}
      </span>
      {sub && <span className="text-[10px] text-[var(--color-muted)]">{sub}</span>}
    </button>
  );
}

export function TopBar({ derived }: { derived: Derived }) {
  const { t, i18n } = useTranslation();
  const { kpis, snapshot } = derived;
  const setAlertCenterOpen = useFirm((s) => s.setAlertCenterOpen);
  const setConflictOpen = useFirm((s) => s.setConflictOpen);
  const setTimeDrawerOpen = useFirm((s) => s.setTimeDrawerOpen);
  const wip = wipSummary(snapshot.timeEntries);
  const currentStaffId = useFirm((s) => s.currentStaffId);
  const setCurrentStaff = useFirm((s) => s.setCurrentStaff);
  const setSettingsOpen = useFirm((s) => s.setSettingsOpen);
  const setNewMatterOpen = useFirm((s) => s.setNewMatterOpen);
  const setReportsOpen = useFirm((s) => s.setReportsOpen);
  const criticalTone = kpis.criticalDeadlines > 0 ? ALERT_COLORS.critique : ALERT_COLORS.ok;

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-4 p-3">
      <div className="pointer-events-auto glass flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-brand)] text-lg font-black text-white shadow-md">C</div>
        <div>
          <div className="text-sm font-extrabold tracking-tight">CaseForge</div>
          <div className="max-w-[150px] truncate text-[11px] text-[var(--color-muted)]">{snapshot.settings.firmName}</div>
        </div>
      </div>

      <div className="pointer-events-auto flex min-w-0 justify-center gap-1.5">
        <Kpi label={t('kpi.activeMatters')} value={String(kpis.activeMatters)} />
        <Kpi
          label={t('kpi.critical')}
          value={String(kpis.criticalDeadlines)}
          tone={criticalTone}
          pulse={kpis.unacknowledged > 0}
          onClick={() => setAlertCenterOpen(true, 'critical')}
        />
        <Kpi label={t('kpi.billable')} value={hours(kpis.billableHoursMonth)} />
        <Kpi
          label={t('kpi.wip')}
          value={money(wip.valueCents, true)}
          sub={t('time.wipHours', { hours: hours(wip.minutes / 60), count: wip.matters })}
          onClick={() => setTimeDrawerOpen(true)}
        />
        <Kpi
          className="hidden xl:flex"
          label={t('kpi.realization')}
          value={percent(kpis.realizationRate)}
          sub={t('kpi.collection', { rate: percent(kpis.collectionRate) })}
          tone={kpis.realizationRate >= 0.9 ? ALERT_COLORS.ok : ALERT_COLORS.attention}
        />
      </div>

      <div className="pointer-events-auto glass flex shrink-0 items-center gap-1 rounded-xl p-1.5">
        <span
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700"
          title={t('app.localHint', { storage: api.storage === 'sqlite' ? 'SQLite' : 'IndexedDB' })}
        >
          <Icon.lock /> {t('app.local')}
        </span>
        <select
          aria-label={t('app.session')}
          value={currentStaffId}
          onChange={(e) => setCurrentStaff(e.target.value)}
          className="h-8 max-w-[96px] rounded-lg 2xl:max-w-[130px] bg-transparent px-1 text-xs font-medium outline-none hover:bg-white/80"
        >
          {derived.activeStaff.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <IconButton onClick={() => setNewMatterOpen(true)} title={t('newMatter.title')}>
          <span className="text-xs font-semibold">＋<span className="hidden 2xl:inline"> {t('newMatter.button')}</span></span>
        </IconButton>
        <IconButton onClick={() => setConflictOpen(true)} title={`${t('conflicts.title')} (Ctrl+K)`}>
          <Icon.search /> <span className="hidden text-xs 2xl:inline">{t('actions.search')}</span>
        </IconButton>
        <IconButton onClick={() => setReportsOpen(true)} title={t('reports.title')}>
          <Icon.file />
        </IconButton>
        <IconButton onClick={() => setAlertCenterOpen(true)} title={t('alerts.title')} className="relative">
          <Icon.bell />
          {kpis.unacknowledged > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--color-critique)] px-1 text-[10px] font-bold text-white">
              {kpis.unacknowledged}
            </span>
          )}
        </IconButton>
        <select
          aria-label="Langue / Language"
          value={i18n.language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="h-8 rounded-lg bg-transparent px-1 text-xs font-semibold uppercase outline-none hover:bg-white/80"
        >
          {Object.entries(LANGUAGES).map(([code, name]) => (
            <option key={code} value={code} title={name}>{code.toUpperCase()}</option>
          ))}
        </select>
        <IconButton onClick={() => setSettingsOpen(true)} title={t('actions.settings')}>
          <Icon.gear />
        </IconButton>
      </div>
    </header>
  );
}
