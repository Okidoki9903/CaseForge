/**
 * Barre du haut, en deux étages :
 *  1. marque, recherche (Ctrl+K), actions et session ;
 *  2. cartes d'indicateurs — l'argent d'abord : le WIP non facturé est l'indicateur le plus visible.
 */
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ALERT_COLORS } from '@shared/domain/alerts';
import { wipSummary } from '@shared/domain/time';
import { billableMonthToDate, weekStart, weeklyBillableHours, wipAddedThisWeek, wipBuildUp } from '@shared/domain/trends';
import { addDays } from '@shared/domain/dates';
import { api } from '../api';
import { LANGUAGES, setLanguage, type Language } from '../i18n';
import { hours, moneyWhole, percent, signedPercent, todayLong } from '../lib/format';
import { ROLE_COLORS } from '../scene/palette';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { Icon, IconButton } from './primitives';
import { Sparkline } from './Sparkline';

const INDIGO = '#3a4fd8';

function KpiCard({
  icon, tile, label, value, valueClass = 'text-[26px]', valueColor, sub, spark, onClick, className = '', pulse,
}: {
  icon: ReactNode; tile: string; label: string; value: string; valueClass?: string; valueColor?: string;
  sub?: ReactNode; spark?: ReactNode; onClick?: () => void; className?: string; pulse?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`card flex min-w-0 items-center gap-3 rounded-2xl px-4 py-3 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-xl ${className}`}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${tile}14`, color: tile }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-slate-600">{label}</span>
        <span className={`tabular block font-extrabold leading-tight tracking-tight ${valueClass} ${pulse ? 'animate-alert' : ''}`} style={{ color: valueColor ?? 'var(--color-ink)' }}>
          {value}
        </span>
        {sub && <span className="block truncate text-[11px] text-[var(--color-muted)]">{sub}</span>}
      </span>
      {spark && <span className="hidden self-end xl:block">{spark}</span>}
    </button>
  );
}

export function TopBar({ derived }: { derived: Derived }) {
  const { t, i18n } = useTranslation();
  const { kpis, snapshot, today } = derived;
  const setAlertCenterOpen = useFirm((s) => s.setAlertCenterOpen);
  const setConflictOpen = useFirm((s) => s.setConflictOpen);
  const setTimeDrawerOpen = useFirm((s) => s.setTimeDrawerOpen);
  const currentStaffId = useFirm((s) => s.currentStaffId);
  const setCurrentStaff = useFirm((s) => s.setCurrentStaff);
  const setSettingsOpen = useFirm((s) => s.setSettingsOpen);
  const setNewMatterOpen = useFirm((s) => s.setNewMatterOpen);
  const setReportsOpen = useFirm((s) => s.setReportsOpen);
  const me = derived.staffById.get(currentStaffId);

  const fin = useMemo(() => {
    const entries = snapshot.timeEntries;
    return {
      wip: wipSummary(entries),
      wipSeries: wipBuildUp(entries, today, 8),
      wipWeek: wipAddedThisWeek(entries, today),
      billable: billableMonthToDate(entries, today),
      // Semaines complètes seulement : une semaine en cours ferait croire à une chute.
      hoursSeries: weeklyBillableHours(entries, addDays(weekStart(today), -1), 8),
    };
  }, [snapshot.timeEntries, today]);
  const critical = kpis.criticalDeadlines > 0;

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-3">
      {/* Étage 1 : marque, recherche, actions */}
      <div className="flex items-center gap-3">
        <div className="pointer-events-auto flex shrink-0 items-center gap-2.5 pr-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#3a4fd8] to-[#7c5cf0] text-lg font-black text-white shadow-lg shadow-indigo-500/30">C</div>
          <div className="leading-tight">
            <div className="text-[17px] font-extrabold tracking-tight text-[#1f2a6b]">CaseForge</div>
            <div className="max-w-[180px] truncate text-[11px] text-[var(--color-muted)]">{snapshot.settings.firmName}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setConflictOpen(true)}
          title={`${t('conflicts.title')} (Ctrl+K)`}
          aria-label={t('conflicts.title')}
          className="card pointer-events-auto flex h-10 min-w-0 max-w-[460px] flex-1 items-center gap-2 rounded-xl px-3 text-left text-[13px] text-slate-500 hover:text-slate-700"
        >
          <Icon.search />
          <span className="flex-1 truncate">{t('hud.search')}</span>
          <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-semibold text-slate-500">Ctrl K</kbd>
        </button>

        <span
          className="pointer-events-auto hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 lg:flex"
          title={t('app.localHint', { storage: api.storage === 'sqlite' ? 'SQLite' : 'IndexedDB' })}
        >
          <Icon.lock /> {t('app.local')}
        </span>

        <div className="pointer-events-auto ml-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setNewMatterOpen(true)}
            title={t('newMatter.title')}
            aria-label={t('newMatter.title')}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#3a4fd8] to-[#5b4fe0] px-4 text-[13px] font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-110 active:scale-95"
          >
            <Icon.plus /> <span className="hidden xl:inline">{t('hud.newMatter')}</span>
          </button>
          <div className="card flex items-center gap-0.5 rounded-xl p-1">
            <IconButton onClick={() => setReportsOpen(true)} title={t('reports.title')}><Icon.file /></IconButton>
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
              className="h-8 rounded-lg bg-transparent px-1 text-xs font-semibold uppercase outline-none hover:bg-slate-50"
            >
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <option key={code} value={code} title={name}>{code.toUpperCase()}</option>
              ))}
            </select>
            <IconButton onClick={() => setSettingsOpen(true)} title={t('actions.settings')}><Icon.gear /></IconButton>
          </div>
          <label className="card flex h-10 items-center gap-2 rounded-xl py-1 pl-1.5 pr-1" title={t('app.session')}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: me ? ROLE_COLORS[me.role] : '#64748b' }}>
              {me?.initials}
            </span>
            <span className="hidden leading-tight 2xl:block">
              <span className="block max-w-[130px] truncate text-[12px] font-semibold">{me?.name.replace(/^Me /, '')}</span>
              <span className="block text-[10px] text-[var(--color-muted)]">{me && t(`role.${me.role}`)}</span>
            </span>
            <select
              aria-label={t('app.session')}
              value={currentStaffId}
              onChange={(e) => setCurrentStaff(e.target.value)}
              className="h-7 w-5 cursor-pointer appearance-auto bg-transparent text-xs outline-none 2xl:w-5"
            >
              {derived.activeStaff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Étage 2 : indicateurs — l'argent d'abord */}
      <div className="pointer-events-auto mt-3 grid grid-cols-[1.35fr_1fr_1fr] gap-3 xl:grid-cols-[1.45fr_1.1fr_1fr_1fr]">
        <KpiCard
          icon={<Icon.briefcase />}
          tile={INDIGO}
          label={t('hud.wip')}
          value={moneyWhole(fin.wip.valueCents)}
          valueClass="text-[30px]"
          valueColor="#1f2a6b"
          sub={
            <>
              {fin.wipWeek > 0 && <span className="font-semibold text-emerald-600">▲ {t('hud.wipWeek', { amount: moneyWhole(fin.wipWeek) })}</span>}
              {fin.wipWeek > 0 && ' · '}
              {t('hud.wipDetail', { hours: hours(fin.wip.minutes / 60), count: fin.wip.matters })}
            </>
          }
          spark={<Sparkline values={fin.wipSeries} color={INDIGO} />}
          onClick={() => setTimeDrawerOpen(true)}
        />
        <KpiCard
          icon={<Icon.clock />}
          tile="#5b4fe0"
          label={t('hud.billable')}
          value={`${hours(fin.billable.hours)} h`}
          sub={
            fin.billable.change === null ? t('hud.billableSubNone') : (
              <>
                <span className={`font-semibold ${fin.billable.change >= 0 ? 'text-emerald-600' : 'text-[var(--color-critique)]'}`}>
                  {fin.billable.change >= 0 ? '▲' : '▼'} {signedPercent(fin.billable.change)}
                </span>{' '}
                {t('hud.billableSub')}
              </>
            )
          }
          spark={<Sparkline values={fin.hoursSeries} color="#5b4fe0" />}
        />
        <KpiCard
          icon={<Icon.warning />}
          tile={critical ? ALERT_COLORS.critique : ALERT_COLORS.ok}
          label={t('hud.critical')}
          value={String(kpis.criticalDeadlines)}
          valueColor={critical ? ALERT_COLORS.critique : ALERT_COLORS.ok}
          pulse={kpis.unacknowledged > 0}
          sub={kpis.unacknowledged > 0 ? <span className="font-semibold text-[var(--color-critique)]">{t('hud.toAck', { count: kpis.unacknowledged })}</span> : t('hud.allAck')}
          onClick={() => setAlertCenterOpen(true, 'critical')}
          className={critical ? 'ring-1 ring-red-100' : ''}
        />
        <KpiCard
          className="hidden xl:flex"
          icon={<Icon.calendar />}
          tile="#64748b"
          label={t('hud.today')}
          value={todayLong(today)}
          valueClass="text-[17px]"
          sub={t('hud.todaySub', { count: kpis.activeMatters, rate: percent(kpis.realizationRate) })}
        />
      </div>
    </header>
  );
}
