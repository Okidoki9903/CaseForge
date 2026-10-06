/**
 * Panneau contextuel : s'ouvre au clic sur un dossier, un pôle, un collaborateur ou un nœud externe.
 */
import { useState, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PIPELINE_STAGES, type Matter, type Party, type PracticeArea, type Staff } from '@shared/types';
import { ALERT_COLORS } from '@shared/domain/alerts';
import { areaStats, matterFinancials } from '@shared/domain/metrics';
import { calendarStatus } from '@shared/domain/calendar';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { formatWhen, hours, longDate, money, moneyWhole, percent } from '../lib/format';
import { LOAD_COLORS, ROLE_COLORS, STAGE_COLORS } from '../scene/palette';
import { AlertCard } from './AlertCenter';
import { TimePanel } from './TimePanel';
import { NewDeadline } from './NewDeadline';
import { History } from './ConflictSearch';
import { CONFLICT_COLORS } from './conflictStyles';
import { MATTER_DND_TYPE } from '../lib/dnd';
import { Bar, Countdown, Icon, IconButton, LevelBadge, Section, Stat } from './primitives';

export function DetailPanel({ derived }: { derived: Derived }) {
  const { t } = useTranslation();
  const selection = useFirm((s) => s.selection);
  const select = useFirm((s) => s.select);
  if (!selection) return null;
  const { snapshot } = derived;

  let body: ReactElement | null = null;
  if (selection.kind === 'matter') {
    const m = snapshot.matters.find((x) => x.id === selection.id);
    if (m) body = <MatterDetail matter={m} derived={derived} />;
  } else if (selection.kind === 'area') {
    const a = derived.areaById.get(selection.id);
    if (a) body = <AreaDetail area={a} derived={derived} />;
  } else if (selection.kind === 'staff') {
    const p = derived.staffById.get(selection.id);
    if (p) body = <StaffDetail staff={p} derived={derived} />;
  } else {
    const p = derived.partyById.get(selection.id);
    if (p) body = <PartyDetail party={p} derived={derived} />;
  }
  if (!body) return null;

  return (
    <aside
      key={`${selection.kind}-${selection.id}`}
      className="card animate-panel pointer-events-auto absolute bottom-3 right-4 top-[var(--hud-top)] z-30 flex w-[400px] flex-col overflow-hidden rounded-3xl"
    >
      <div className="absolute right-2 top-2 z-10 rounded-lg bg-white/90 shadow-sm backdrop-blur">
        <IconButton onClick={() => select(null)} title={t('actions.close')}><Icon.close /></IconButton>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto">{body}</div>
    </aside>
  );
}

function Header({ eyebrow, title, color, children }: { eyebrow: string; title: string; color: string; children?: ReactNode }) {
  return (
    <header className="px-4 pb-3 pt-4" style={{ boxShadow: `inset 4px 0 0 ${color}` }}>
      <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>{eyebrow}</div>
      <h2 className="pr-8 text-lg font-bold leading-tight">{title}</h2>
      {children}
    </header>
  );
}

/* ─────────────────────────── Dossier ─────────────────────────── */

type MatterTab = 'overview' | 'tasks' | 'time' | 'documents';

/** Ligne « argent » : libellé, montant en gros, détail. */
function MoneyLine({ label, value, detail, tone, strong }: { label: string; value: string; detail?: ReactNode; tone?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[12px] text-slate-500">{label}</span>
      <span className="text-right">
        <span className={`tabular font-extrabold tracking-tight ${strong ? 'text-[22px]' : 'text-[15px]'}`} style={{ color: tone ?? 'var(--color-ink)' }}>{value}</span>
        {detail && <span className="block text-[10px] text-[var(--color-muted)]">{detail}</span>}
      </span>
    </div>
  );
}

function MatterDetail({ matter: m, derived }: { matter: Matter; derived: Derived }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<MatterTab>('overview');
  const [addingDeadline, setAddingDeadline] = useState(false);
  const setStage = useFirm((s) => s.setStage);
  const select = useFirm((s) => s.select);
  const { snapshot } = derived;
  const area = derived.areaById.get(m.practiceAreaId)!;
  const client = derived.partyById.get(m.clientId);
  const responsible = derived.staffById.get(m.responsibleId);
  const fin = matterFinancials(m, snapshot);
  const alerts = derived.alertsByMatter.get(m.id) ?? [];
  const next = alerts.reduce<(typeof alerts)[number] | undefined>((best, a) => (!best || a.daysLeft < best.daysLeft ? a : best), undefined);
  const stageIndex = PIPELINE_STAGES.indexOf(m.stage);
  const docs = snapshot.documents.filter((d) => d.matterId === m.id);
  const team = [m.responsibleId, ...m.teamIds].map((id) => derived.staffById.get(id)).filter((p): p is Staff => Boolean(p));
  const marginTone = fin.marginRate >= 0.35 ? ALERT_COLORS.ok : fin.marginRate >= 0.15 ? ALERT_COLORS.attention : ALERT_COLORS.critique;
  const flag = derived.conflicts.get(m.id);
  const tabs: { id: MatterTab; label: string; badge?: number }[] = [
    { id: 'overview', label: t('panel.overview') },
    { id: 'tasks', label: t('panel.tasks'), badge: alerts.length },
    { id: 'time', label: t('panel.time') },
    { id: 'documents', label: t('panel.documents'), badge: docs.length },
  ];

  return (
    <>
      <header className="px-5 pb-3 pt-4">
        <div className="flex items-center gap-2 pr-8 text-[11px] font-semibold">
          <span className="rounded-md px-1.5 py-0.5" style={{ background: `${area.color}1a`, color: area.color }}>{area.name}</span>
          <span className="tabular text-[var(--color-muted)]">{m.number}</span>
        </div>
        <h2 className="mt-1.5 pr-8 text-[19px] font-extrabold leading-tight tracking-tight text-[#1f2a44]">{m.title}</h2>
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(MATTER_DND_TYPE, m.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          title={t('matter.dragHint')}
          className="mt-1.5 inline-flex cursor-grab items-center gap-1.5 rounded-full border border-dashed border-[var(--color-line)] bg-white px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted)] active:cursor-grabbing"
        >
          ⠿ {t('matter.dragHint')}
        </div>
        {flag && (
          <div className="mt-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white" style={{ background: CONFLICT_COLORS[flag.status] }}>
            <Icon.alert /> {t('conflicts.flagged')} — {t(`conflicts.status.${flag.status}`)}
          </div>
        )}
        <div className="mt-3 flex gap-1 rounded-xl bg-slate-100/80 p-1" role="tablist">
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setTab(x.id)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[12px] font-semibold transition ${
                tab === x.id ? 'bg-white text-[#1f2a44] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {x.label}
              {x.badge ? <span className="tabular rounded-full bg-slate-200 px-1.5 text-[10px] text-slate-600">{x.badge}</span> : null}
            </button>
          ))}
        </div>
      </header>

      {tab === 'overview' && (
        <>
          <div className="space-y-3 px-5 pb-4">
            <dl className="grid grid-cols-[96px_1fr] items-center gap-y-2 text-[12px]">
              <dt className="text-slate-500">{t('matter.client')}</dt>
              <dd>
                <button type="button" className="font-semibold text-[#1f2a44] hover:underline" onClick={() => client && select({ kind: 'party', id: client.id })}>
                  {client?.name}
                </button>
              </dd>
              <dt className="text-slate-500">{t('panel.responsible')}</dt>
              <dd>
                {responsible && (
                  <button type="button" onClick={() => select({ kind: 'staff', id: responsible.id })} className="flex items-center gap-1.5 font-semibold hover:underline">
                    <span className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: ROLE_COLORS[responsible.role] }}>{responsible.initials}</span>
                    {responsible.name.replace(/^Me /, '')}
                  </button>
                )}
              </dd>
              <dt className="text-slate-500">{t('panel.stage')}</dt>
              <dd>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${STAGE_COLORS[stageIndex]}26`, color: '#1f2a44' }}>
                  {stageIndex + 1}/{PIPELINE_STAGES.length} · {t(`stage.${m.stage}`)}
                </span>
              </dd>
              {m.court && (
                <>
                  <dt className="text-slate-500">{t('matter.court')}</dt>
                  <dd>{m.court}{m.courtFileNumber && <span className="text-[var(--color-muted)]"> · {m.courtFileNumber}</span>}</dd>
                </>
              )}
              <dt className="text-slate-500">{t('panel.mandate')}</dt>
              <dd>
                {t(`fee.${m.feeArrangement}`)} · {m.jurisdiction}{' '}
                <span
                  className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    calendarStatus(m.jurisdiction) === 'valide' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {t(`calendar.${calendarStatus(m.jurisdiction)}`)}
                </span>
              </dd>
            </dl>

            {/* Prochaine échéance */}
            <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm" style={next ? { borderLeft: `4px solid ${ALERT_COLORS[next.level]}` } : undefined}>
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {t('panel.nextDeadline')}
                {next && (
                  <span className="tabular rounded-full px-2 py-0.5 text-[11px] font-bold normal-case tracking-normal text-white" style={{ background: ALERT_COLORS[next.level] }}>
                    <Countdown daysLeft={next.daysLeft} />
                  </span>
                )}
              </div>
              {next ? (
                <button type="button" onClick={() => setTab('tasks')} className="mt-1 block w-full text-left">
                  <div className="text-[14px] font-bold text-[#1f2a44]">{next.deadline.title}</div>
                  <div className="text-[11px] text-[var(--color-muted)]">{longDate(next.deadline.dueDate)}{next.deadline.legalBasis && ` · ${next.deadline.legalBasis}`}</div>
                </button>
              ) : (
                <p className="mt-1 text-xs text-[var(--color-muted)]">{t('matter.noDeadlines')}</p>
              )}
            </div>

            {/* Argent du dossier */}
            <div className="space-y-2 rounded-2xl bg-gradient-to-br from-[#eef0ff] to-[#f6f3ff] p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#3a4fd8]">{t('panel.money')}</div>
              <MoneyLine
                label={t('panel.wipLeft')}
                value={moneyWhole(fin.wipCents)}
                tone="#1f2a6b"
                strong
              />
              <MoneyLine
                label={t('panel.timeLogged')}
                value={`${hours(fin.hours)} h`}
                detail={t('panel.timeValue', { amount: moneyWhole(fin.workValueCents) })}
              />
              <MoneyLine label={t('matter.billed')} value={moneyWhole(fin.billedCents)} detail={`${t('matter.collected')} ${moneyWhole(fin.collectedCents)}`} />
              <MoneyLine label={t('matter.margin')} value={percent(fin.marginRate)} tone={marginTone} />
              <div className="pt-1">
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="text-slate-500">{t('matter.budget')}</span>
                  <span className="tabular font-semibold">{percent(fin.budgetUsed)} · {moneyWhole(m.budgetCents)}</span>
                </div>
                <Bar value={fin.budgetUsed} color={fin.budgetUsed > 0.9 ? ALERT_COLORS.critique : fin.budgetUsed > 0.7 ? ALERT_COLORS.attention : ALERT_COLORS.ok} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTab('time')}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#3a4fd8] to-[#5b4fe0] text-[12px] font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:brightness-110 active:scale-95"
              >
                <Icon.clock /> {t('panel.logTime')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('tasks');
                  setAddingDeadline(true);
                }}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-[#1f2a44] transition hover:border-[#3a4fd8]/40 active:scale-95"
              >
                <Icon.calendar /> {t('panel.addDeadline')}
              </button>
            </div>
          </div>

          <Section title={t('matter.team')}>
            <div className="flex flex-wrap gap-1.5">
              {team.map((p) => {
                const load = derived.loads.get(p.id)!;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => select({ kind: 'staff', id: p.id })}
                    className="flex items-center gap-1.5 rounded-full border bg-white py-0.5 pl-0.5 pr-2.5 text-xs hover:shadow"
                    style={{ borderColor: LOAD_COLORS[load.level] }}
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: ROLE_COLORS[p.role] }}>{p.initials}</span>
                    {p.name.replace(/^Me /, '')}
                  </button>
                );
              })}
            </div>
          </Section>
          <MatterConflicts matterId={m.id} derived={derived} />
          <MatterHistory matterId={m.id} derived={derived} />
        </>
      )}

      {tab === 'tasks' && (
        <>
          <Section title={t('matter.pipeline')}>
            <div className="flex items-center gap-1">
              <IconButton title={t('matter.prev')} onClick={() => stageIndex > 0 && void setStage(m.id, PIPELINE_STAGES[stageIndex - 1])}><Icon.left /></IconButton>
              <ol className="flex flex-1 items-center">
                {PIPELINE_STAGES.map((s, i) => (
                  <li key={s} className="flex flex-1 items-center" title={t(`stage.${s}`)}>
                    <button
                      type="button"
                      onClick={() => void setStage(m.id, s)}
                      className="h-3 w-3 shrink-0 rounded-full border-2 transition hover:scale-125"
                      style={{ background: i <= stageIndex ? STAGE_COLORS[i] : 'white', borderColor: STAGE_COLORS[i], transform: i === stageIndex ? 'scale(1.35)' : undefined }}
                    />
                    {i < PIPELINE_STAGES.length - 1 && <span className="h-0.5 flex-1" style={{ background: i < stageIndex ? STAGE_COLORS[i] : '#e2e8f0' }} />}
                  </li>
                ))}
              </ol>
              <IconButton title={t('matter.next')} onClick={() => stageIndex < PIPELINE_STAGES.length - 1 && void setStage(m.id, PIPELINE_STAGES[stageIndex + 1])}><Icon.right /></IconButton>
            </div>
            <div className="mt-1 text-center text-xs font-semibold" style={{ color: STAGE_COLORS[stageIndex] }}>
              {stageIndex + 1}/{PIPELINE_STAGES.length} · {t(`stage.${m.stage}`)}
            </div>
          </Section>

          <Section
            title={t('matter.deadlines')}
            aside={
              !addingDeadline && (
                <button type="button" onClick={() => setAddingDeadline(true)} className="text-[11px] font-semibold text-[var(--color-brand)] hover:underline">
                  ＋ {t('newDeadline.button')}
                </button>
              )
            }
          >
            {addingDeadline && (
              <div className="mb-2">
                <NewDeadline matter={m} derived={derived} onDone={() => setAddingDeadline(false)} />
              </div>
            )}
            {alerts.length === 0 ? (
              <p className="text-xs text-[var(--color-muted)]">{t('matter.noDeadlines')}</p>
            ) : (
              <div className="space-y-2">{alerts.map((a) => <AlertCard key={a.deadline.id} alert={a} derived={derived} compact />)}</div>
            )}
          </Section>
        </>
      )}

      {tab === 'time' && (
        <>
          <div className="mx-5 mb-1 grid grid-cols-3 gap-2 rounded-2xl bg-gradient-to-br from-[#eef0ff] to-[#f6f3ff] p-3">
            <Stat label={t('panel.timeLogged')} value={`${hours(fin.hours)} h`} />
            <Stat label={t('matter.workValue')} value={moneyWhole(fin.workValueCents)} />
            <Stat label={t('panel.wipLeft')} value={moneyWhole(fin.wipCents)} tone="#1f2a6b" />
          </div>
          <TimePanel matter={m} derived={derived} />
        </>
      )}

      {tab === 'documents' && (
        <Section title={`${t('matter.documents')} (${docs.length})`}>
          {docs.length === 0 && <p className="text-xs text-[var(--color-muted)]">—</p>}
          <ul className="space-y-1">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-xs hover:bg-slate-50">
                <span className="text-[var(--color-muted)]"><Icon.file /></span>
                {d.exhibit && <span className="rounded bg-slate-800 px-1.5 text-[10px] font-bold text-white">{d.exhibit}</span>}
                <span className="flex-1 truncate">{d.title}</span>
                <span className="tabular text-[10px] text-[var(--color-muted)]">{d.addedAt}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

/** Journal d'audit du dossier et de ses échéances : qui a fait quoi, quand. */
function MatterHistory({ matterId, derived }: { matterId: string; derived: Derived }) {
  const { t } = useTranslation();
  const deadlineIds = new Set(derived.snapshot.deadlines.filter((d) => d.matterId === matterId).map((d) => d.id));
  const entries = derived.snapshot.auditLog
    .filter((a) => (a.entity === 'matter' && a.entityId === matterId) || (a.entity === 'deadline' && deadlineIds.has(a.entityId)))
    .slice(0, 20);
  const label = (a: (typeof entries)[number]) => {
    if (a.action === 'set_stage') {
      return t('audit.set_stage', { from: t(`stage.${String(a.details.from)}`), to: t(`stage.${String(a.details.to)}`) });
    }
    return t(`audit.${a.action}`, { defaultValue: a.action });
  };
  return (
    <Section title={t('audit.title')}>
      {entries.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)]">{t('audit.empty')}</p>
      ) : (
        <ol className="space-y-1">
          {entries.map((a) => (
            <li key={a.id} className="flex items-baseline gap-2 text-xs">
              <span className="grid h-5 w-7 shrink-0 place-items-center rounded bg-slate-200 text-[9px] font-bold">{a.actor}</span>
              <span className="flex-1">{label(a)}</span>
              <span className="shrink-0 text-[10px] text-[var(--color-muted)]">{formatWhen(a.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

/** Vérifications de conflits visant ce dossier ou mentionnant une de ses parties. */
function MatterConflicts({ matterId, derived }: { matterId: string; derived: Derived }) {
  const { t } = useTranslation();
  const setConflictOpen = useFirm((s) => s.setConflictOpen);
  const related = derived.snapshot.conflictChecks.filter(
    (c) => c.matterId === matterId || c.hits.some((h) => h.roles.some((r) => r.matterId === matterId)),
  );
  if (related.length === 0) return null;
  return (
    <Section
      title={t('conflicts.section')}
      aside={
        <button type="button" onClick={() => setConflictOpen(true)} className="text-[11px] font-semibold text-[var(--color-brand)] hover:underline">
          Ctrl+K
        </button>
      }
    >
      <History checks={related} derived={derived} limit={8} />
    </Section>
  );
}

/* ─────────────────────────── Pôle ─────────────────────────── */

function MatterRow({ matter, derived }: { matter: Matter; derived: Derived }) {
  const { t } = useTranslation();
  const select = useFirm((s) => s.select);
  const level = derived.matterLevel(matter.id);
  return (
    <li>
      <button type="button" onClick={() => select({ kind: 'matter', id: matter.id })} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-xs hover:bg-white">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ALERT_COLORS[level] }} />
        <span className="flex-1 truncate"><b>{matter.number}</b> {matter.title}</span>
        <span className="text-[10px] text-[var(--color-muted)]">{t(`stage.${matter.stage}`)}</span>
      </button>
    </li>
  );
}

function AreaDetail({ area, derived }: { area: PracticeArea; derived: Derived }) {
  const { t } = useTranslation();
  const select = useFirm((s) => s.select);
  const { snapshot, today, alerts } = derived;
  const stats = areaStats(area, snapshot, today, alerts);
  const matters = snapshot.matters.filter((m) => m.practiceAreaId === area.id && m.status !== 'ferme');
  const people = derived.activeStaff.filter((p) => p.practiceAreaId === area.id);
  return (
    <>
      <Header eyebrow={area.code} title={area.name} color={area.color} />
      <Section title="Vue d’ensemble">
        <div className="grid grid-cols-4 gap-2">
          <Stat label={t('area.matters')} value={stats.activeMatters} />
          <Stat label={t('area.hoursMonth')} value={hours(stats.hoursMonth)} />
          <Stat label={t('area.margin')} value={percent(stats.marginRate)} />
          <Stat label={t('area.alerts')} value={stats.alertCount} tone={ALERT_COLORS[stats.worst]} />
        </div>
      </Section>
      <Section title={t('area.staff')}>
        <ul className="space-y-2">
          {people.map((p) => {
            const load = derived.loads.get(p.id)!;
            return (
              <li key={p.id}>
                <button type="button" onClick={() => select({ kind: 'staff', id: p.id })} className="w-full text-left">
                  <div className="flex justify-between text-xs"><span className="font-medium">{p.name}</span><span className="tabular text-[var(--color-muted)]">{percent(load.utilization)}</span></div>
                  <Bar value={load.utilization} max={1.3} color={LOAD_COLORS[load.level]} />
                </button>
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title={t('area.matters')}>
        <ul>{matters.map((m) => <MatterRow key={m.id} matter={m} derived={derived} />)}</ul>
      </Section>
    </>
  );
}

/* ─────────────────────────── Collaborateur ─────────────────────────── */

function StaffDetail({ staff: p, derived }: { staff: Staff; derived: Derived }) {
  const { t } = useTranslation();
  const load = derived.loads.get(p.id)!;
  const area = derived.areaById.get(p.practiceAreaId)!;
  const matters = derived.snapshot.matters.filter((m) => m.status !== 'ferme' && (m.responsibleId === p.id || m.teamIds.includes(p.id)));
  const mine = derived.alerts.filter((a) => a.deadline.assignedTo === p.id);
  return (
    <>
      <Header eyebrow={`${t(`role.${p.role}`)} · ${area.name}`} title={p.name} color={ROLE_COLORS[p.role]}>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: LOAD_COLORS[load.level] }}>
          {t(`load.${load.level}`)}
        </span>
      </Header>
      <Section title="Charge">
        <div className="grid grid-cols-3 gap-2">
          <Stat label={t('staff.rate')} value={`${money(p.hourlyRateCents, true)}/h`} />
          <Stat label={t('staff.utilization')} value={`${hours(load.hoursLast7)} h`} />
          <Stat label={t('staff.matters')} value={load.activeMatters} />
        </div>
        <div className="mt-3 space-y-2 text-[11px]">
          <div>
            <div className="mb-1 flex justify-between"><span className="text-[var(--color-muted)]">{t('staff.utilization')}</span><span className="tabular font-semibold">{percent(load.utilization)}</span></div>
            <Bar value={load.utilization} max={1.3} color={LOAD_COLORS[load.level]} />
          </div>
          <div>
            <div className="mb-1 flex justify-between"><span className="text-[var(--color-muted)]">{t('staff.stress')}</span><span className="tabular font-semibold">{load.stress}/100</span></div>
            <Bar value={load.stress} max={100} color={LOAD_COLORS[load.level]} />
          </div>
        </div>
      </Section>
      <Section title={t('staff.upcoming')}>
        {mine.length === 0 ? <p className="text-xs text-[var(--color-muted)]">—</p> : (
          <ul className="space-y-1.5">
            {mine.map((a) => (
              <li key={a.deadline.id} className="flex items-center gap-2 text-xs">
                <LevelBadge level={a.level} />
                <span className="flex-1 truncate">{a.deadline.title}</span>
                <span className="tabular text-[10px] text-[var(--color-muted)]">{a.deadline.dueDate}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t('staff.matters')}>
        <ul>{matters.map((m) => <MatterRow key={m.id} matter={m} derived={derived} />)}</ul>
      </Section>
    </>
  );
}

/* ─────────────────────────── Nœud externe ─────────────────────────── */

function PartyDetail({ party, derived }: { party: Party; derived: Derived }) {
  const { t } = useTranslation();
  const links = derived.snapshot.matterParties.filter((mp) => mp.partyId === party.id);
  const roles = [...new Set(links.map((l) => l.role))];
  return (
    <>
      <Header eyebrow={roles.map((r) => t(`partyRole.${r}`)).join(' · ')} title={party.name} color={party.kind === 'tribunal' ? '#475569' : roles.includes('client') ? '#3b82f6' : '#dc4c64'}>
        {party.aliases.length > 0 && <p className="mt-1 text-[11px] text-[var(--color-muted)]">aka {party.aliases.join(', ')}</p>}
      </Header>
      <Section title={t('party.linked')}>
        <ul>
          {links.map((l) => {
            const m = derived.snapshot.matters.find((x) => x.id === l.matterId);
            return m ? <MatterRow key={`${l.matterId}-${l.role}`} matter={m} derived={derived} /> : null;
          })}
        </ul>
      </Section>
    </>
  );
}
