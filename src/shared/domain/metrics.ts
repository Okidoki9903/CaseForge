/**
 * Indicateurs métier : charge, rentabilité, facturation.
 * Fonctions pures, calculées à la volée sur l'instantané local.
 */
import type { FirmSnapshot, Id, IsoDate, Matter, PracticeArea, Staff } from '../types';
import { addDays } from './dates';
import { type DeadlineAlert, type AlertLevel, worstLevel } from './alerts';

export interface FirmKpis {
  activeMatters: number;
  criticalDeadlines: number;
  unacknowledged: number;
  billableHoursMonth: number;
  wipCents: number;
  /** Valeur facturée / valeur au taux standard (0–1). */
  realizationRate: number;
  /** Montant encaissé / montant facturé (0–1). */
  collectionRate: number;
}

const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);

export function firmKpis(s: FirmSnapshot, today: IsoDate, alerts: DeadlineAlert[]): FirmKpis {
  const month = today.slice(0, 7);
  let billableMinutes = 0;
  let wipCents = 0;
  for (const t of s.timeEntries) {
    if (!t.billable) continue;
    if (t.date.startsWith(month)) billableMinutes += t.minutes;
    if (t.status === 'wip') wipCents += Math.round((t.minutes / 60) * t.rateCents);
  }
  const standard = s.invoices.reduce((a, i) => a + i.standardValueCents, 0);
  const billed = s.invoices.reduce((a, i) => a + i.amountCents, 0);
  const paid = s.invoices.reduce((a, i) => a + i.paidCents, 0);
  return {
    activeMatters: s.matters.filter((m) => m.status === 'actif').length,
    criticalDeadlines: alerts.filter((a) => a.level === 'critique' || a.level === 'depasse').length,
    unacknowledged: alerts.filter((a) => a.requiresAcknowledgement).length,
    billableHoursMonth: billableMinutes / 60,
    wipCents,
    realizationRate: ratio(billed, standard),
    collectionRate: ratio(paid, billed),
  };
}

export type LoadLevel = 'sain' | 'eleve' | 'surcharge';

export interface StaffLoad {
  staff: Staff;
  hoursLast7: number;
  utilization: number;
  activeMatters: number;
  criticalAssigned: number;
  /** Indice de pression 0–100 (charge + échéances urgentes). */
  stress: number;
  level: LoadLevel;
}

export function staffLoad(staff: Staff, s: FirmSnapshot, today: IsoDate, alerts: DeadlineAlert[]): StaffLoad {
  const since = addDays(today, -7);
  const minutes = s.timeEntries
    .filter((t) => t.staffId === staff.id && t.date > since && t.date <= today)
    .reduce((a, t) => a + t.minutes, 0);
  const hoursLast7 = minutes / 60;
  const utilization = ratio(hoursLast7, staff.targetHoursWeek);
  const mine = alerts.filter((a) => a.deadline.assignedTo === staff.id);
  const critical = mine.filter((a) => a.level === 'critique' || a.level === 'depasse').length;
  const urgent = mine.filter((a) => a.level === 'urgent').length;
  const activeMatters = s.matters.filter(
    (m) => m.status === 'actif' && (m.responsibleId === staff.id || m.teamIds.includes(staff.id)),
  ).length;
  // Pondération empirique : au-delà de 110 % d'utilisation la pression croît vite.
  const stress = Math.min(
    100,
    Math.round(Math.max(0, utilization - 0.6) * 110 + critical * 14 + urgent * 6 + Math.max(0, activeMatters - 6) * 4),
  );
  const level: LoadLevel = stress >= 70 ? 'surcharge' : stress >= 45 ? 'eleve' : 'sain';
  return { staff, hoursLast7, utilization, activeMatters, criticalAssigned: critical, stress, level };
}

export interface MatterFinancials {
  workValueCents: number;
  wipCents: number;
  billedCents: number;
  collectedCents: number;
  costCents: number;
  /** Revenus attendus : facturé + en-cours (ou forfait). */
  expectedRevenueCents: number;
  marginCents: number;
  marginRate: number;
  /** Consommation du budget (valeur du travail / budget). */
  budgetUsed: number;
  hours: number;
}

export function matterFinancials(m: Matter, s: FirmSnapshot): MatterFinancials {
  const staffById = new Map(s.staff.map((p) => [p.id, p]));
  let workValue = 0;
  let wip = 0;
  let cost = 0;
  let minutes = 0;
  for (const t of s.timeEntries) {
    if (t.matterId !== m.id) continue;
    minutes += t.minutes;
    const value = Math.round((t.minutes / 60) * t.rateCents);
    if (t.billable) workValue += value;
    if (t.billable && t.status === 'wip') wip += value;
    cost += Math.round((t.minutes / 60) * (staffById.get(t.staffId)?.costRateCents ?? 0));
  }
  const inv = s.invoices.filter((i) => i.matterId === m.id);
  const billed = inv.reduce((a, i) => a + i.amountCents, 0);
  const collected = inv.reduce((a, i) => a + i.paidCents, 0);
  const expected = m.feeArrangement === 'forfait' ? m.budgetCents : billed + wip;
  return {
    workValueCents: workValue,
    wipCents: wip,
    billedCents: billed,
    collectedCents: collected,
    costCents: cost,
    expectedRevenueCents: expected,
    marginCents: expected - cost,
    marginRate: ratio(expected - cost, expected),
    budgetUsed: ratio(workValue, m.budgetCents),
    hours: minutes / 60,
  };
}

export interface AreaStats {
  area: PracticeArea;
  activeMatters: number;
  hoursMonth: number;
  marginRate: number;
  worst: AlertLevel;
  alertCount: number;
}

export function areaStats(area: PracticeArea, s: FirmSnapshot, today: IsoDate, alerts: DeadlineAlert[]): AreaStats {
  const matters = s.matters.filter((m) => m.practiceAreaId === area.id && m.status !== 'ferme');
  const ids = new Set<Id>(matters.map((m) => m.id));
  const month = today.slice(0, 7);
  const hoursMonth =
    s.timeEntries.filter((t) => ids.has(t.matterId) && t.date.startsWith(month)).reduce((a, t) => a + t.minutes, 0) / 60;
  let expected = 0;
  let cost = 0;
  for (const m of matters) {
    const f = matterFinancials(m, s);
    expected += f.expectedRevenueCents;
    cost += f.costCents;
  }
  const areaAlerts = alerts.filter((a) => ids.has(a.matter.id) && a.level !== 'ok');
  return {
    area,
    activeMatters: matters.length,
    hoursMonth,
    marginRate: ratio(expected - cost, expected),
    worst: worstLevel(areaAlerts),
    alertCount: areaAlerts.length,
  };
}
