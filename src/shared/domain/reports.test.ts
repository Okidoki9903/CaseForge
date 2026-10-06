import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '../seed';
import { buildAlerts } from './alerts';
import { criticalAlerts, deadlinesToCsv, escapeHtml, hoursReport, hoursReportToCsv, periodRange, printableHtml } from './reports';
import { timeEntriesToCsv } from './time';

const TODAY = '2026-10-06'; // mardi
const s = buildDemoSnapshot(TODAY);

describe('rapports', () => {
  it('périodes : semaine du lundi au dimanche, mois civil', () => {
    expect(periodRange('semaine', TODAY)).toEqual({ from: '2026-10-05', to: '2026-10-11', workdays: 5 });
    expect(periodRange('semaine', '2026-10-11')).toMatchObject({ from: '2026-10-05' }); // dimanche
    expect(periodRange('mois', TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-31', workdays: 22 });
    expect(periodRange('mois', '2028-02-10').to).toBe('2028-02-29');
  });

  it('heures par collaborateur : radiées exclues, totaux cohérents, objectif proratisé', () => {
    const r = hoursReport(s, 'semaine', TODAY);
    const inWeek = s.timeEntries.filter((t) => t.date >= '2026-10-05' && t.date <= '2026-10-11' && t.status !== 'radie');
    expect(r.totals.minutes).toBe(inWeek.reduce((a, t) => a + t.minutes, 0));
    expect(r.totals.billableMinutes + r.totals.nonBillableMinutes).toBe(r.totals.minutes);
    const hb = r.rows.find((x) => x.staff.initials === 'HB')!;
    expect(hb.targetHours).toBe(32); // 32 h/sem × 5/5
    // Tri par heures facturables décroissantes.
    expect(r.rows.map((x) => x.billableMinutes)).toEqual([...r.rows.map((x) => x.billableMinutes)].sort((a, b) => b - a));
    const csv = hoursReportToCsv(r, 'excel-fr');
    expect(csv.split('\r\n')[0]).toContain('periode_du;periode_au;collaborateur');
    expect(csv).toMatch(/;\d+,\d;/); // virgule décimale
  });

  it('échéances critiques : dépassées et critiques, urgentes en option', () => {
    const alerts = buildAlerts(s.deadlines, s.matters, TODAY);
    const crit = criticalAlerts(alerts);
    expect(crit.every((a) => a.level === 'depasse' || a.level === 'critique')).toBe(true);
    expect(criticalAlerts(alerts, true).length).toBeGreaterThan(crit.length);
    const csv = deadlinesToCsv(crit, s);
    expect(csv.trim().split('\r\n')).toHaveLength(crit.length + 1);
    expect(csv).toContain('depasse,-1,');
  });

  it('CSV temps : format Excel français (point-virgule, virgule décimale)', () => {
    const e = { ...s.timeEntries[0], description: 'Lettre; urgente', minutes: 90, rateCents: 32550 };
    const csv = timeEntriesToCsv([e], s, 'excel-fr');
    const line = csv.trim().split('\r\n')[1];
    expect(line).toContain(';90;1,5;325,50;488,25;');
    expect(line).toContain('"Lettre; urgente"');
  });

  it('PDF : HTML autonome, échappé, sans ressource externe ni script', () => {
    const html = printableHtml({ title: 'T <script>', subtitle: 's', firmName: 'A & B', generatedAt: 'x', headers: ['Nom', 'h Total'], rows: [['<img src=x>', '1,0']] });
    expect(html).not.toMatch(/<script|<img|<link|@import|url\(/i);
    expect(html).toContain('T &lt;script&gt;');
    expect(html).toContain('A &amp; B');
    expect(escapeHtml(`"'`)).toBe('&quot;&#39;');
  });
});
