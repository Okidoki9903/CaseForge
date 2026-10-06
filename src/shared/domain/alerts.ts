/**
 * Système d'alertes d'échéances — la fonctionnalité qui justifie l'achat.
 *
 * Principes :
 *  1. Le niveau dépend des JOURS JURIDIQUES restants (un vendredi avant un long congé
 *     est plus urgent qu'il n'y paraît).
 *  2. Les prescriptions ont des seuils plus larges : les manquer éteint le droit du client
 *     et constitue la première cause de réclamation en responsabilité professionnelle.
 *  3. Une alerte « critique » ou « dépassée » reste affichée tant qu'elle n'a pas fait
 *     l'objet d'un accusé de réception nominatif (journalisé), puis tant que l'échéance
 *     n'est pas marquée complétée.
 */
import type { Deadline, DeadlineKind, IsoDate, Matter } from '../types';
import { juridicalDaysUntil } from './calendar';

export const ALERT_LEVELS = ['depasse', 'critique', 'urgent', 'attention', 'ok'] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

/** Seuils en jours juridiques restants (inclus). */
export const ALERT_THRESHOLDS: Record<DeadlineKind | 'default', { critique: number; urgent: number; attention: number }> = {
  prescription: { critique: 10, urgent: 30, attention: 90 },
  procedure: { critique: 2, urgent: 5, attention: 20 },
  audience: { critique: 2, urgent: 5, attention: 15 },
  interne: { critique: 1, urgent: 3, attention: 10 },
  default: { critique: 2, urgent: 5, attention: 20 },
};

export const ALERT_COLORS: Record<AlertLevel, string> = {
  depasse: '#b4161b',
  critique: '#e5484d',
  urgent: '#f76b15',
  attention: '#f5b100',
  ok: '#2f9e6e',
};

export function alertLevel(daysLeft: number, kind: DeadlineKind): AlertLevel {
  const t = ALERT_THRESHOLDS[kind] ?? ALERT_THRESHOLDS.default;
  if (daysLeft < 0) return 'depasse';
  if (daysLeft <= t.critique) return 'critique';
  if (daysLeft <= t.urgent) return 'urgent';
  if (daysLeft <= t.attention) return 'attention';
  return 'ok';
}

export function severityRank(level: AlertLevel): number {
  return ALERT_LEVELS.indexOf(level);
}

export interface DeadlineAlert {
  deadline: Deadline;
  matter: Matter;
  level: AlertLevel;
  /** Jours juridiques restants (négatif = jours civils de retard). */
  daysLeft: number;
  /** Doit bloquer l'attention (bannière persistante) tant que non accusée. */
  requiresAcknowledgement: boolean;
}

export function buildAlerts(deadlines: Deadline[], matters: Matter[], today: IsoDate): DeadlineAlert[] {
  const byId = new Map(matters.map((m) => [m.id, m]));
  const alerts: DeadlineAlert[] = [];
  for (const deadline of deadlines) {
    if (deadline.status !== 'ouvert') continue;
    const matter = byId.get(deadline.matterId);
    if (!matter || matter.status === 'ferme') continue;
    const daysLeft = juridicalDaysUntil(today, deadline.dueDate, matter.jurisdiction);
    const level = alertLevel(daysLeft, deadline.kind);
    alerts.push({
      deadline,
      matter,
      level,
      daysLeft,
      // Seul un accusé NOMINATIF (date + initiales) lève l'obligation.
      requiresAcknowledgement: (level === 'depasse' || level === 'critique') && !(deadline.acknowledgedAt && deadline.acknowledgedBy),
    });
  }
  return alerts.sort(
    (a, b) => severityRank(a.level) - severityRank(b.level) || a.deadline.dueDate.localeCompare(b.deadline.dueDate),
  );
}

/** Niveau le plus grave d'une liste (ok si vide). */
export function worstLevel(alerts: { level: AlertLevel }[]): AlertLevel {
  return alerts.reduce<AlertLevel>((w, a) => (severityRank(a.level) < severityRank(w) ? a.level : w), 'ok');
}
