/**
 * Moteur de calcul des délais.
 *
 * Chaque règle décrit un délai type (prescription, délai de procédure) à partir d'une date
 * déclencheuse. Le calcul applique les règles générales de computation du ressort :
 *
 *  - QC (art. 83 C.p.c. ; art. 2879 C.c.Q. pour la prescription) : le jour du point de départ
 *    n'est pas compté, celui de l'échéance l'est ; si le dernier jour est non juridique,
 *    le délai est prorogé au premier jour juridique suivant.
 *  - ON (r. 3.01) : idem, et pour un délai de moins de 7 jours les jours fériés ne sont pas comptés.
 *  - FED (Règles des Cours fédérales, r. 6) : principe semblable. ⚠️ La période du 21 décembre
 *    au 7 janvier exclue pour certains actes (r. 6(3)) n'est PAS modélisée.
 *
 * Le moteur retourne aussi la date « brute » (avant report) : l'interface alerte toujours sur
 * la date la plus prudente (la plus tôt).
 *
 * ⚠️ Catalogue à faire valider par un avocat du ressort avant mise en production.
 */
import type { DeadlineKind, IsoDate, Jurisdiction } from '../types';
import { addDays, addMonths, addYears } from './dates';
import { holidayOn, isNonJuridicalDay, nextJuridicalDay } from './calendar';

export type DurationUnit = 'jours' | 'mois' | 'ans';

export interface DeadlineRule {
  id: string;
  jurisdiction: Jurisdiction;
  kind: DeadlineKind;
  /** Libellé (clé i18n possible plus tard ; français par défaut). */
  label: string;
  /** Événement déclencheur à saisir. */
  trigger: string;
  amount: number;
  unit: DurationUnit;
  legalBasis: string;
}

export const DEADLINE_RULES: DeadlineRule[] = [
  // ── Québec ────────────────────────────────────────────────────────────
  { id: 'QC_PRESCRIPTION_3ANS', jurisdiction: 'QC', kind: 'prescription', label: 'Prescription extinctive (droit commun)', trigger: 'Connaissance du préjudice', amount: 3, unit: 'ans', legalBasis: 'art. 2925 C.c.Q.' },
  { id: 'QC_PRESCRIPTION_DIFFAMATION', jurisdiction: 'QC', kind: 'prescription', label: 'Prescription — diffamation', trigger: 'Connaissance de la diffamation', amount: 1, unit: 'ans', legalBasis: 'art. 2929 C.c.Q.' },
  { id: 'QC_REPONSE_ASSIGNATION', jurisdiction: 'QC', kind: 'procedure', label: 'Réponse à l’assignation', trigger: 'Signification de la demande', amount: 15, unit: 'jours', legalBasis: 'art. 145 C.p.c.' },
  { id: 'QC_PROTOCOLE_INSTANCE', jurisdiction: 'QC', kind: 'procedure', label: 'Dépôt du protocole de l’instance', trigger: 'Signification de la demande', amount: 45, unit: 'jours', legalBasis: 'art. 149 C.p.c.' },
  { id: 'QC_MISE_EN_ETAT', jurisdiction: 'QC', kind: 'procedure', label: 'Mise en état du dossier', trigger: 'Protocole présumé accepté / établi', amount: 6, unit: 'mois', legalBasis: 'art. 173 C.p.c.' },
  { id: 'QC_MISE_EN_ETAT_FAMILLE', jurisdiction: 'QC', kind: 'procedure', label: 'Mise en état — matière familiale', trigger: 'Protocole présumé accepté / établi', amount: 1, unit: 'ans', legalBasis: 'art. 173 C.p.c.' },
  { id: 'QC_APPEL', jurisdiction: 'QC', kind: 'procedure', label: 'Déclaration d’appel', trigger: 'Avis du jugement / date du jugement', amount: 30, unit: 'jours', legalBasis: 'art. 360 C.p.c.' },
  // ── Ontario ───────────────────────────────────────────────────────────
  { id: 'ON_LIMITATION_2Y', jurisdiction: 'ON', kind: 'prescription', label: 'Délai de prescription de base', trigger: 'Découverte de la réclamation', amount: 2, unit: 'ans', legalBasis: 'Loi de 2002 sur la prescription des actions, art. 4' },
  { id: 'ON_ULTIMATE_15Y', jurisdiction: 'ON', kind: 'prescription', label: 'Délai de prescription ultime', trigger: 'Acte ou omission', amount: 15, unit: 'ans', legalBasis: 'Loi de 2002 sur la prescription des actions, art. 15' },
  { id: 'ON_DEFENCE_20D', jurisdiction: 'ON', kind: 'procedure', label: 'Défense (signifiée en Ontario)', trigger: 'Signification de la déclaration', amount: 20, unit: 'jours', legalBasis: 'Règles de procédure civile, r. 18.01' },
  { id: 'ON_APPEAL_30D', jurisdiction: 'ON', kind: 'procedure', label: 'Avis d’appel', trigger: 'Date de l’ordonnance', amount: 30, unit: 'jours', legalBasis: 'Règles de procédure civile, r. 61.04' },
  { id: 'ON_DISMISSAL_5Y', jurisdiction: 'ON', kind: 'procedure', label: 'Inscription pour instruction (rejet pour retard)', trigger: 'Introduction de l’action', amount: 5, unit: 'ans', legalBasis: 'Règles de procédure civile, r. 48.14' },
  // ── Fédéral ───────────────────────────────────────────────────────────
  { id: 'FED_JUDICIAL_REVIEW', jurisdiction: 'FED', kind: 'procedure', label: 'Demande de contrôle judiciaire', trigger: 'Communication de la décision', amount: 30, unit: 'jours', legalBasis: 'Loi sur les Cours fédérales, par. 18.1(2)' },
];

export function rulesFor(jurisdiction: Jurisdiction): DeadlineRule[] {
  return DEADLINE_RULES.filter((r) => r.jurisdiction === jurisdiction);
}

export function findRule(id: string): DeadlineRule | undefined {
  return DEADLINE_RULES.find((r) => r.id === id);
}

export interface ComputedDeadline {
  rule: DeadlineRule;
  triggerDate: IsoDate;
  /** Échéance arithmétique, avant report. */
  rawDate: IsoDate;
  /** Échéance après report au premier jour juridique suivant. */
  dueDate: IsoDate;
  /** Explications lisibles, à afficher pour que l'avocat vérifie le raisonnement. */
  reasoning: string[];
}

/** Ontario r. 3.01(1)(b) : délai de moins de 7 jours → jours fériés non comptés. */
function countJuridicalDaysOnly(jurisdiction: Jurisdiction, amount: number, unit: DurationUnit): boolean {
  return jurisdiction === 'ON' && unit === 'jours' && amount < 7;
}

export function computeDeadline(rule: DeadlineRule, triggerDate: IsoDate, extraHolidays: IsoDate[] = []): ComputedDeadline {
  const reasoning: string[] = [];
  let raw: IsoDate;

  if (rule.unit === 'jours') {
    if (countJuridicalDaysOnly(rule.jurisdiction, rule.amount, rule.unit)) {
      // Seuls les jours juridiques sont comptés.
      let cur = triggerDate;
      let counted = 0;
      while (counted < rule.amount) {
        cur = addDays(cur, 1);
        if (!isNonJuridicalDay(cur, rule.jurisdiction, extraHolidays)) counted++;
      }
      raw = cur;
      reasoning.push(`Délai de moins de 7 jours : seuls les jours juridiques sont comptés (${rule.amount}).`);
    } else {
      // Jour du point de départ exclu, jour d'échéance inclus.
      raw = addDays(triggerDate, rule.amount);
      reasoning.push(`${rule.amount} jours à compter du ${triggerDate} (jour du point de départ exclu).`);
    }
  } else if (rule.unit === 'mois') {
    raw = addMonths(triggerDate, rule.amount);
    reasoning.push(`${rule.amount} mois à compter du ${triggerDate}.`);
  } else {
    raw = addYears(triggerDate, rule.amount);
    reasoning.push(`${rule.amount} an(s) à compter du ${triggerDate}.`);
  }

  const due = nextJuridicalDay(raw, rule.jurisdiction, extraHolidays);
  if (due !== raw) {
    const h = holidayOn(raw, rule.jurisdiction);
    reasoning.push(
      `Le ${raw} est un jour non juridique${h ? ` (${h.name})` : ''} : report au ${due}. ` +
        'Par prudence, CaseForge retient la date brute comme échéance d’alerte.',
    );
  }
  reasoning.push(`Fondement : ${rule.legalBasis}.`);
  return { rule, triggerDate, rawDate: raw, dueDate: due, reasoning };
}
