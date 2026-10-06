/**
 * Rapports rapides : échéances critiques et heures par collaborateur.
 * Sorties CSV et HTML imprimable (converti en PDF localement).
 */
import type { FirmSnapshot, IsoDate, Staff } from '../types';
import type { DeadlineAlert } from './alerts';
import { addDays, parseIsoDate, weekday } from './dates';
import { buildCsv, entryValueCents, type CsvDialect } from './time';

/* ─────────────── Échéances ─────────────── */

/** Échéances à exporter : dépassées + critiques (+ urgentes si demandé), de la plus grave à la moins grave. */
export function criticalAlerts(alerts: DeadlineAlert[], includeUrgent = false): DeadlineAlert[] {
  return alerts.filter((a) => a.level === 'depasse' || a.level === 'critique' || (includeUrgent && a.level === 'urgent'));
}

export const DEADLINE_CSV_COLUMNS = [
  'niveau', 'jours_juridiques_restants', 'echeance', 'type', 'intitule', 'no_dossier', 'dossier', 'ressort',
  'fondement', 'responsable', 'accuse_par', 'accuse_le',
] as const;

export function deadlinesToCsv(alerts: DeadlineAlert[], s: FirmSnapshot, dialect: CsvDialect = 'facturation'): string {
  const staff = new Map(s.staff.map((p) => [p.id, p]));
  return buildCsv(
    DEADLINE_CSV_COLUMNS,
    alerts.map((a) => [
      a.level, a.daysLeft, a.deadline.dueDate, a.deadline.kind, a.deadline.title, a.matter.number, a.matter.title,
      a.matter.jurisdiction, a.deadline.legalBasis ?? '', staff.get(a.deadline.assignedTo)?.name ?? '',
      a.deadline.acknowledgedBy ?? '', a.deadline.acknowledgedAt ?? '',
    ]),
    dialect,
  );
}

/* ─────────────── Heures par collaborateur ─────────────── */

export type ReportPeriod = 'semaine' | 'mois';

export interface PeriodRange {
  from: IsoDate;
  to: IsoDate;
  /** Nombre de jours ouvrables (lun.–ven.) de la période, pour proratiser l'objectif. */
  workdays: number;
}

/** Semaine du lundi au dimanche contenant `today`, ou mois civil de `today`. */
export function periodRange(period: ReportPeriod, today: IsoDate): PeriodRange {
  let from: IsoDate;
  let to: IsoDate;
  if (period === 'semaine') {
    from = addDays(today, -((weekday(today) + 6) % 7));
    to = addDays(from, 6);
  } else {
    const d = parseIsoDate(today);
    from = `${today.slice(0, 7)}-01`;
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    to = `${today.slice(0, 7)}-${String(last).padStart(2, '0')}`;
  }
  let workdays = 0;
  for (let cur = from; cur <= to; cur = addDays(cur, 1)) if (weekday(cur) % 6 !== 0) workdays++;
  return { from, to, workdays };
}

export interface HoursRow {
  staff: Staff;
  minutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  valueCents: number;
  /** Objectif proratisé sur la période (heures). */
  targetHours: number;
  /** Heures facturables / objectif. */
  utilization: number;
}

export interface HoursReport {
  period: ReportPeriod;
  range: PeriodRange;
  rows: HoursRow[];
  totals: Omit<HoursRow, 'staff' | 'utilization' | 'targetHours'> & { targetHours: number; utilization: number };
}

export function hoursReport(s: FirmSnapshot, period: ReportPeriod, today: IsoDate): HoursReport {
  const range = periodRange(period, today);
  const entries = s.timeEntries.filter((t) => t.date >= range.from && t.date <= range.to && t.status !== 'radie');
  const staffIds = new Set(entries.map((t) => t.staffId));
  const rows = s.staff
    .filter((p) => p.active || staffIds.has(p.id))
    .map((p): HoursRow => {
      const mine = entries.filter((t) => t.staffId === p.id);
      const billable = mine.filter((t) => t.billable);
      const billableMinutes = billable.reduce((a, t) => a + t.minutes, 0);
      const minutes = mine.reduce((a, t) => a + t.minutes, 0);
      const targetHours = Math.round((p.targetHoursWeek / 5) * range.workdays * 10) / 10;
      return {
        staff: p,
        minutes,
        billableMinutes,
        nonBillableMinutes: minutes - billableMinutes,
        valueCents: billable.reduce((a, t) => a + entryValueCents(t), 0),
        targetHours,
        utilization: targetHours > 0 ? billableMinutes / 60 / targetHours : 0,
      };
    })
    .sort((a, b) => b.billableMinutes - a.billableMinutes);
  const sum = (k: 'minutes' | 'billableMinutes' | 'nonBillableMinutes' | 'valueCents' | 'targetHours') => rows.reduce((a, r) => a + r[k], 0);
  const targetHours = Math.round(sum('targetHours') * 10) / 10;
  return {
    period,
    range,
    rows,
    totals: {
      minutes: sum('minutes'),
      billableMinutes: sum('billableMinutes'),
      nonBillableMinutes: sum('nonBillableMinutes'),
      valueCents: sum('valueCents'),
      targetHours,
      utilization: targetHours > 0 ? sum('billableMinutes') / 60 / targetHours : 0,
    },
  };
}

export const HOURS_CSV_COLUMNS = [
  'periode_du', 'periode_au', 'collaborateur', 'initiales', 'role', 'heures_totales', 'heures_facturables',
  'heures_non_facturables', 'valeur_facturable', 'objectif_heures', 'utilisation_pct',
] as const;

export function hoursReportToCsv(r: HoursReport, dialect: CsvDialect = 'facturation'): string {
  const h = (m: number) => ({ n: m / 60, digits: 1 });
  return buildCsv(
    HOURS_CSV_COLUMNS,
    r.rows.map((row) => [
      r.range.from, r.range.to, row.staff.name, row.staff.initials, row.staff.role, h(row.minutes), h(row.billableMinutes),
      h(row.nonBillableMinutes), { n: row.valueCents / 100, digits: 2 }, { n: row.targetHours, digits: 1 }, Math.round(row.utilization * 100),
    ]),
    dialect,
  );
}

/* ─────────────── HTML imprimable (→ PDF local) ─────────────── */

export const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Document HTML autonome : aucune ressource externe (polices système, styles en ligne,
 * aucun script). Converti en PDF par Electron (printToPDF) ou imprimé par le navigateur.
 */
export function printableHtml(opts: { title: string; subtitle: string; firmName: string; generatedAt: string; headers: string[]; rows: string[][]; footer?: string; rowClasses?: string[] }): string {
  const { title, subtitle, firmName, generatedAt, headers, rows, footer, rowClasses } = opts;
  return `<!doctype html><html lang="fr-CA"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page { size: Letter landscape; margin: 14mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f1b2d; font-size: 10.5px; margin: 0; }
header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #3b5bdb; padding-bottom: 8px; margin-bottom: 12px; }
h1 { font-size: 18px; margin: 0; } .sub { color: #5b6b82; margin-top: 2px; } .firm { text-align: right; color: #5b6b82; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: #5b6b82; border-bottom: 1px solid #dbe3ee; padding: 5px 6px; }
td { padding: 5px 6px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
tr.depasse td:first-child { border-left: 4px solid #b4161b; } tr.critique td:first-child { border-left: 4px solid #e5484d; } tr.urgent td:first-child { border-left: 4px solid #f76b15; }
tr.total td { font-weight: 700; border-top: 2px solid #0f1b2d; }
footer { margin-top: 12px; color: #5b6b82; font-size: 9px; }
</style></head><body>
<header><div><h1>${escapeHtml(title)}</h1><div class="sub">${escapeHtml(subtitle)}</div></div>
<div class="firm"><strong>${escapeHtml(firmName)}</strong><br>${escapeHtml(generatedAt)}</div></header>
<table><thead><tr>${headers.map((h) => `<th${/^(h|\$|%|nb|j)/i.test(h) ? ' class="num"' : ''}>${escapeHtml(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r, i) => `<tr class="${escapeHtml(rowClasses?.[i] ?? '')}">${r.map((c, j) => `<td${/^(h|\$|%|nb|j)/i.test(headers[j]) ? ' class="num"' : ''}>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
<footer>${escapeHtml(footer ?? 'Document généré localement par CaseForge — aucune donnée transmise.')}</footer>
</body></html>`;
}
