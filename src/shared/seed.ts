/**
 * Données de démonstration (entièrement fictives), générées relativement à « aujourd'hui »
 * pour que les alertes soient toujours pertinentes à l'ouverture de l'application.
 * Générateur déterministe : mêmes données pour une même date.
 */
import type {
  AuditEntry, ConflictCheck, ConflictStatus, Deadline, DeadlineKind, FirmSnapshot, Invoice, Jurisdiction, Matter, MatterDocument, MatterParty, Party,
  PartyRole, PipelineStage, PracticeArea, Staff, TimeEntry,
} from './types';
import { addDays, addYears } from './domain/dates';
import { nextJuridicalDay } from './domain/calendar';
import { searchConflicts, toCheckHits } from './domain/conflicts';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AREAS: PracticeArea[] = [
  { id: 'pa-lit', code: 'LIT', name: 'Litige civil et commercial', color: '#4f6bed', gridX: -1, gridZ: -1 },
  { id: 'pa-aff', code: 'AFF', name: 'Droit des affaires', color: '#0e9f8f', gridX: 1, gridZ: -1 },
  { id: 'pa-trv', code: 'TRV', name: 'Droit du travail', color: '#d9822b', gridX: -1, gridZ: 1 },
  { id: 'pa-fam', code: 'FAM', name: 'Droit de la famille', color: '#c2417d', gridX: 1, gridZ: 1 },
  { id: 'pa-pi', code: 'PI', name: 'Propriété intellectuelle', color: '#7c4dcc', gridX: 0, gridZ: 2.6 },
];

const STAFF: Staff[] = [
  { id: 'st-01', name: 'Me Hélène Bouchard', initials: 'HB', role: 'associe', practiceAreaId: 'pa-lit', hourlyRateCents: 52500, costRateCents: 19000, targetHoursWeek: 32 },
  { id: 'st-02', name: 'Me Karim Haddad', initials: 'KH', role: 'avocat', practiceAreaId: 'pa-lit', hourlyRateCents: 32500, costRateCents: 11500, targetHoursWeek: 34 },
  { id: 'st-03', name: 'Me Sophie Lavoie', initials: 'SL', role: 'associe', practiceAreaId: 'pa-aff', hourlyRateCents: 55000, costRateCents: 20000, targetHoursWeek: 30 },
  { id: 'st-04', name: 'Me Daniel O’Connor', initials: 'DO', role: 'avocat', practiceAreaId: 'pa-aff', hourlyRateCents: 34000, costRateCents: 12000, targetHoursWeek: 34 },
  { id: 'st-05', name: 'Me Isabelle Tremblay', initials: 'IT', role: 'avocat', practiceAreaId: 'pa-trv', hourlyRateCents: 31000, costRateCents: 11000, targetHoursWeek: 33 },
  { id: 'st-06', name: 'Me Marc-André Gagnon', initials: 'MG', role: 'associe', practiceAreaId: 'pa-fam', hourlyRateCents: 39500, costRateCents: 15000, targetHoursWeek: 30 },
  { id: 'st-07', name: 'Me Priya Natarajan', initials: 'PN', role: 'avocat', practiceAreaId: 'pa-pi', hourlyRateCents: 36500, costRateCents: 12500, targetHoursWeek: 34 },
  { id: 'st-08', name: 'Léa Fortin', initials: 'LF', role: 'stagiaire', practiceAreaId: 'pa-lit', hourlyRateCents: 15500, costRateCents: 5500, targetHoursWeek: 35 },
  { id: 'st-09', name: 'Julien Côté', initials: 'JC', role: 'parajuriste', practiceAreaId: 'pa-aff', hourlyRateCents: 14000, costRateCents: 5000, targetHoursWeek: 35 },
  { id: 'st-10', name: 'Amélie Roy', initials: 'AR', role: 'parajuriste', practiceAreaId: 'pa-fam', hourlyRateCents: 13500, costRateCents: 4800, targetHoursWeek: 35 },
];

const PARTIES: Party[] = [
  // Clients
  { id: 'p-c01', name: 'Construction Rive-Nord inc.', kind: 'entreprise', aliases: ['Bâtiments Rive-Nord ltée'] },
  { id: 'p-c02', name: 'Groupe Alimentaire Saint-Laurent inc.', kind: 'entreprise', aliases: [] },
  { id: 'p-c03', name: 'Nadia Belhumeur', kind: 'personne', aliases: [] },
  { id: 'p-c04', name: 'Techno Boréal inc.', kind: 'entreprise', aliases: ['Boreal Tech Inc.'] },
  { id: 'p-c05', name: 'Syndicat des employés de Laval-Est', kind: 'entreprise', aliases: [] },
  { id: 'p-c06', name: 'François Pelletier', kind: 'personne', aliases: [] },
  { id: 'p-c07', name: 'Cliniques Vétérinaires Horizon s.e.n.c.r.l.', kind: 'entreprise', aliases: [] },
  { id: 'p-c08', name: 'Maple Ridge Logistics Ltd.', kind: 'entreprise', aliases: [] },
  { id: 'p-c09', name: 'Studio Aurore inc.', kind: 'entreprise', aliases: [] },
  { id: 'p-c10', name: 'Valérie Dumont', kind: 'personne', aliases: ['Valérie Dumont-Leclerc'] },
  { id: 'p-c11', name: 'Marc Tessier', kind: 'personne', aliases: [] },
  // Parties adverses / liées
  { id: 'p-a01', name: 'Béton Laurentides ltée', kind: 'entreprise', aliases: [] },
  { id: 'p-a02', name: 'Assurances Mutuelle du Fleuve', kind: 'entreprise', aliases: [] },
  { id: 'p-a03', name: 'Distribution Gagné & Fils inc.', kind: 'entreprise', aliases: [] },
  { id: 'p-a04', name: 'Patrick Belhumeur', kind: 'personne', aliases: [] },
  { id: 'p-a05', name: 'Ville de Laval-Est', kind: 'entreprise', aliases: [] },
  { id: 'p-a06', name: 'Northshore Freight Corp.', kind: 'entreprise', aliases: [] },
  { id: 'p-a07', name: 'Aurora Studios LLC', kind: 'entreprise', aliases: [] },
  { id: 'p-a08', name: 'Éric Leclerc', kind: 'personne', aliases: [] },
  { id: 'p-a09', name: 'Lakeshore Hospitality Inc.', kind: 'entreprise', aliases: ['Lakeshore Hotels Ltd.'] },
  { id: 'p-a10', name: 'Harbourfront Properties Ltd.', kind: 'entreprise', aliases: [] },
  // Tribunaux
  { id: 'p-t01', name: 'Cour supérieure du Québec', kind: 'tribunal', aliases: [] },
  { id: 'p-t02', name: 'Tribunal administratif du travail', kind: 'tribunal', aliases: [] },
  { id: 'p-t03', name: 'Cour supérieure de justice de l’Ontario', kind: 'tribunal', aliases: [] },
  { id: 'p-t04', name: 'Cour fédérale', kind: 'tribunal', aliases: [] },
  { id: 'p-t05', name: 'Cour du Québec', kind: 'tribunal', aliases: [] },
];

interface MatterSpec {
  title: string;
  client: string;
  area: string;
  resp: string;
  team: string[];
  stage: PipelineStage;
  juris: Jurisdiction;
  court: string | null;
  fee: Matter['feeArrangement'];
  budget: number;
  openedDaysAgo: number;
  adverse: string[];
  /** Parties liées (actionnaires, cautions…). */
  related?: string[];
  /** [type, titre, décalage en jours depuis aujourd'hui, fondement, assigné, accusé?] */
  deadlines: [DeadlineKind, string, number, string | null, string, boolean?][];
}

/**
 * 14 dossiers : 9 au Québec, 3 en Ontario, 2 devant les Cours fédérales.
 * Décalages d'échéance en jours civils depuis aujourd'hui (reportés au jour juridique suivant).
 */
const MATTERS: MatterSpec[] = [
  // ── Litige (QC + ON) ────────────────────────────────────────────────────
  { title: 'Vices cachés — entrepôt Mirabel', client: 'p-c01', area: 'pa-lit', resp: 'st-01', team: ['st-02', 'st-08'], stage: 'audience', juris: 'QC', court: 'p-t01', fee: 'horaire', budget: 8_500_000, openedDaysAgo: 520, adverse: ['p-a01', 'p-a02'],
    deadlines: [['audience', 'Instruction au fond — salle 2.08', 3, null, 'st-01'], ['procedure', 'Liste des pièces et témoins', 1, 'art. 248 C.p.c. (à confirmer)', 'st-02']] },
  { title: 'Recouvrement — Distribution Gagné', client: 'p-c02', area: 'pa-lit', resp: 'st-02', team: ['st-08'], stage: 'depot', juris: 'QC', court: 'p-t05', fee: 'horaire', budget: 2_200_000, openedDaysAgo: 140, adverse: ['p-a03'],
    deadlines: [['procedure', 'Dépôt du protocole de l’instance', -1, 'art. 149 C.p.c.', 'st-02'], ['procedure', 'Mise en état — inscription pour instruction', 120, 'art. 173 C.p.c. (délai de rigueur)', 'st-02']] },
  { title: 'Diffamation — publication en ligne', client: 'p-c06', area: 'pa-lit', resp: 'st-01', team: ['st-08'], stage: 'recherche', juris: 'QC', court: null, fee: 'horaire', budget: 3_000_000, openedDaysAgo: 21, adverse: ['p-a08'],
    deadlines: [['prescription', 'Prescription d’un an — diffamation', 9, 'art. 2929 C.c.Q.', 'st-01']] },
  { title: 'Rupture de contrat — Northshore Freight', client: 'p-c08', area: 'pa-lit', resp: 'st-02', team: ['st-01'], stage: 'redaction', juris: 'ON', court: 'p-t03', fee: 'horaire', budget: 6_000_000, openedDaysAgo: 75, adverse: ['p-a06'],
    deadlines: [['prescription', 'Limitation period — 2 ans (découverte)', 24, 'Loi de 2002 sur la prescription des actions, art. 4', 'st-02'], ['interne', 'Projet de déclaration au client', 4, null, 'st-02']] },
  // ── Affaires (QC + ON) ──────────────────────────────────────────────────
  { title: 'Acquisition Techno Boréal — série B', client: 'p-c04', area: 'pa-aff', resp: 'st-03', team: ['st-04', 'st-09'], stage: 'revision', juris: 'QC', court: null, fee: 'horaire', budget: 12_000_000, openedDaysAgo: 60, adverse: [],
    deadlines: [['interne', 'Clôture — signature des conventions', 6, null, 'st-03'], ['interne', 'Vérification diligente — rapport final', 2, null, 'st-04', true]] },
  { title: 'Convention entre actionnaires — Horizon', client: 'p-c07', area: 'pa-aff', resp: 'st-04', team: ['st-09'], stage: 'conflits', juris: 'QC', court: null, fee: 'forfait', budget: 1_200_000, openedDaysAgo: 3, adverse: [], related: ['p-a04'],
    deadlines: [['interne', 'Vérification de conflits à compléter', 1, null, 'st-04']] },
  { title: 'Bail commercial — Maple Ridge (Toronto)', client: 'p-c08', area: 'pa-aff', resp: 'st-04', team: ['st-03'], stage: 'redaction', juris: 'ON', court: 'p-t03', fee: 'horaire', budget: 2_800_000, openedDaysAgo: 24, adverse: ['p-a10'],
    deadlines: [['procedure', 'Défense — action du locateur', 2, 'Règles de procédure civile, r. 18.01', 'st-04']] },
  // ── Travail (QC + ON) ───────────────────────────────────────────────────
  { title: 'Grief — congédiement déguisé', client: 'p-c05', area: 'pa-trv', resp: 'st-05', team: [], stage: 'audience', juris: 'QC', court: 'p-t02', fee: 'horaire', budget: 2_800_000, openedDaysAgo: 210, adverse: ['p-a05'],
    deadlines: [['audience', 'Audience au TAT', 8, null, 'st-05'], ['procedure', 'Communication de la preuve documentaire', 2, null, 'st-05']] },
  { title: 'Plainte harcèlement psychologique', client: 'p-c09', area: 'pa-trv', resp: 'st-05', team: [], stage: 'recherche', juris: 'QC', court: 'p-t02', fee: 'horaire', budget: 1_500_000, openedDaysAgo: 18, adverse: [],
    deadlines: [['prescription', 'Délai de plainte — 2 ans', 45, 'art. 123.7 L.n.t.', 'st-05']] },
  { title: 'Congédiement injustifié — Lakeshore Hospitality', client: 'p-c11', area: 'pa-trv', resp: 'st-05', team: ['st-02'], stage: 'redaction', juris: 'ON', court: 'p-t03', fee: 'contingence', budget: 3_000_000, openedDaysAgo: 40, adverse: ['p-a09'],
    deadlines: [['procedure', 'Réponse à la défense', 5, 'Règles de procédure civile, r. 25.04 (à confirmer)', 'st-05'], ['prescription', 'Limitation period — 2 ans', 70, 'Loi de 2002 sur la prescription des actions, art. 4', 'st-05']] },
  // ── Famille (QC) ────────────────────────────────────────────────────────
  { title: 'Divorce — Belhumeur c. Belhumeur', client: 'p-c03', area: 'pa-fam', resp: 'st-06', team: ['st-10'], stage: 'depot', juris: 'QC', court: 'p-t01', fee: 'horaire', budget: 2_500_000, openedDaysAgo: 160, adverse: ['p-a04'],
    deadlines: [['procedure', 'Mise en état — matière familiale', 5, 'art. 173 C.p.c. (délai de rigueur)', 'st-06'], ['procedure', 'Formulaire III — revenus', 11, null, 'st-10']] },
  { title: 'Garde d’enfants — Dumont', client: 'p-c10', area: 'pa-fam', resp: 'st-06', team: ['st-10'], stage: 'revision', juris: 'QC', court: 'p-t01', fee: 'horaire', budget: 1_800_000, openedDaysAgo: 80, adverse: ['p-a08'],
    deadlines: [['audience', 'Conférence de règlement à l’amiable', 18, null, 'st-06']] },
  // ── Propriété intellectuelle (FED) ──────────────────────────────────────
  { title: 'Opposition de marque — AURORE', client: 'p-c09', area: 'pa-pi', resp: 'st-07', team: [], stage: 'redaction', juris: 'FED', court: 'p-t04', fee: 'horaire', budget: 2_000_000, openedDaysAgo: 50, adverse: ['p-a07'],
    deadlines: [['procedure', 'Contrôle judiciaire — décision COMC', 3, 'Loi sur les Cours fédérales, par. 18.1(2)', 'st-07']] },
  { title: 'Contrefaçon de brevet — capteur boréal', client: 'p-c04', area: 'pa-pi', resp: 'st-07', team: ['st-09'], stage: 'recherche', juris: 'FED', court: 'p-t04', fee: 'horaire', budget: 4_500_000, openedDaysAgo: 30, adverse: [],
    deadlines: [['procedure', 'Affidavits et pièces du demandeur', 16, 'Règles des Cours fédérales, r. 306', 'st-07']] },
];

/** Intensité de travail par collaborateur : probabilité de saisie quotidienne par dossier et durée des entrées. */
const WORKLOAD: Record<string, number> = {
  'st-01': 0.8, 'st-02': 0.95, 'st-03': 0.55, 'st-04': 0.9, 'st-05': 0.95,
  'st-06': 0.75, 'st-07': 0.25, 'st-08': 0.7, 'st-09': 0.45, 'st-10': 0.5,
};

/** Numéro de cour selon le ressort (formats indicatifs). */
function courtFileNumber(juris: Jurisdiction, i: number, year: string): string {
  const n = String(100000 + i * 7919).slice(0, 6);
  if (juris === 'ON') return `CV-${year.slice(2)}-00${n}-0000`;
  if (juris === 'FED') return `T-${n.slice(0, 4)}-${year.slice(2)}`;
  return `500-17-${n}-${year.slice(2)}`;
}

const DESCRIPTIONS = [
  'Analyse et recherche jurisprudentielle', 'Rédaction de procédure', 'Appel avec le client', 'Révision des pièces',
  'Préparation de témoin', 'Correspondance avec l’avocat adverse', 'Réunion d’équipe', 'Rédaction de mémoire',
];

export function buildDemoSnapshot(today: string): FirmSnapshot {
  const rand = mulberry32(Number(today.replace(/-/g, '')));
  const staffById = new Map(STAFF.map((s) => [s.id, s]));
  const year = today.slice(0, 4);
  const matters: Matter[] = [];
  const matterParties: MatterParty[] = [];
  const deadlines: Deadline[] = [];
  const timeEntries: TimeEntry[] = [];
  const invoices: Invoice[] = [];
  const documents: MatterDocument[] = [];

  MATTERS.forEach((spec, i) => {
    const id = `m-${String(i + 1).padStart(3, '0')}`;
    const matter: Matter = {
      id,
      number: `${year}-${String(i + 101).padStart(4, '0')}`,
      title: spec.title,
      clientId: spec.client,
      practiceAreaId: spec.area,
      responsibleId: spec.resp,
      teamIds: spec.team,
      stage: spec.stage,
      status: 'actif',
      jurisdiction: spec.juris,
      court: spec.court ? PARTIES.find((p) => p.id === spec.court)!.name : null,
      courtFileNumber: spec.court ? courtFileNumber(spec.juris, i, year) : null,
      feeArrangement: spec.fee,
      budgetCents: spec.budget,
      openedAt: addDays(today, -spec.openedDaysAgo),
    };
    matters.push(matter);

    const push = (partyId: string, role: PartyRole) => matterParties.push({ matterId: id, partyId, role });
    push(spec.client, 'client');
    spec.adverse.forEach((p) => push(p, 'adverse'));
    spec.related?.forEach((p) => push(p, 'liee'));
    if (spec.court) push(spec.court, 'tribunal');

    spec.deadlines.forEach(([kind, title, offset, basis, assignee, acked], j) => {
      // Les échéances tombent toujours sur un jour juridique (sauf les dépassées, conservées telles quelles).
      const due = offset < 0 ? addDays(today, offset) : nextJuridicalDay(addDays(today, offset), spec.juris);
      deadlines.push({
        id: `d-${id}-${j}`,
        matterId: id,
        kind,
        title,
        dueDate: due,
        legalBasis: basis,
        ruleId: null,
        triggerDate: kind === 'prescription' ? addYears(due, basis?.includes('2929') ? -1 : -2) : null,
        assignedTo: assignee,
        status: 'ouvert',
        acknowledgedAt: acked ? new Date(Date.parse(today) - 3_600_000).toISOString() : null,
        acknowledgedBy: acked ? staffById.get(assignee)!.initials : null,
        completedAt: null,
      });
    });

    // Temps travaillé sur les 60 derniers jours, au prorata de l'ancienneté du dossier.
    const team = [spec.resp, ...spec.team];
    const days = Math.min(60, spec.openedDaysAgo);
    for (let d = 0; d <= days; d++) {
      const date = addDays(today, -d);
      const wd = new Date(date).getUTCDay();
      if (wd === 0 || wd === 6) continue;
      for (const sid of team) {
        if (rand() > (WORKLOAD[sid] ?? 0.5)) continue;
        const staff = staffById.get(sid)!;
        const minutes = Math.round((0.3 + rand() * 2.6) * (0.5 + (WORKLOAD[sid] ?? 0.5)) * 10) * 6; // incréments de 0,1 h
        timeEntries.push({
          id: `t-${id}-${d}-${sid}`,
          matterId: id,
          staffId: sid,
          date,
          minutes,
          rateCents: staff.hourlyRateCents,
          billable: rand() > 0.08,
          description: DESCRIPTIONS[Math.floor(rand() * DESCRIPTIONS.length)],
          status: d > 30 ? 'facture' : 'wip',
        });
      }
    }

    // Une facture pour les dossiers ouverts depuis plus d'un mois.
    // Pas de facture intérimaire pour un mandat à pourcentage.
    if (spec.openedDaysAgo > 30 && spec.fee !== 'contingence') {
      const billedValue = timeEntries
        .filter((t) => t.matterId === id && t.status === 'facture' && t.billable)
        .reduce((a, t) => a + Math.round((t.minutes / 60) * t.rateCents), 0);
      const realization = 0.82 + rand() * 0.16;
      const amount = Math.round(billedValue * realization);
      invoices.push({
        id: `i-${id}`,
        matterId: id,
        number: `F-${year}-${String(300 + i)}`,
        issuedAt: addDays(today, -28),
        standardValueCents: billedValue,
        amountCents: amount,
        paidCents: Math.round(amount * (rand() > 0.35 ? 1 : 0.4 + rand() * 0.4)),
      });
    }

    // Quelques pièces au dossier (références locales uniquement).
    const docs: [string, MatterDocument['category'], string | null][] = [
      ['Lettre de mandat signée', 'correspondance', null],
      ['Note de recherche initiale', 'note', null],
    ];
    if (spec.court) docs.push(['Demande introductive d’instance', 'procedure', null], ['Contrat litigieux', 'piece', 'P-1'], ['Échanges courriels', 'piece', 'P-2']);
    docs.forEach(([title, category, exhibit], k) =>
      documents.push({ id: `doc-${id}-${k}`, matterId: id, title, category, exhibit, filePath: null, addedAt: addDays(today, -Math.max(1, spec.openedDaysAgo - k * 5)) }),
    );
  });

  const snapshot: FirmSnapshot = {
    firmName: 'Cabinet Démo s.e.n.c.r.l.',
    practiceAreas: AREAS,
    staff: STAFF,
    parties: PARTIES,
    matters,
    matterParties,
    deadlines,
    timeEntries,
    invoices,
    documents,
    conflictChecks: [],
    auditLog: [],
  };

  // Vérifications de conflits déjà effectuées (correspondances calculées sur les données ci-dessus).
  const at = (daysAgo: number, hour: number) => `${addDays(today, -daysAgo)}T${String(hour).padStart(2, '0')}:15:00.000Z`;
  const checks: [string, string, ConflictStatus, string | null, string][] = [
    // Nouveau mandat Horizon : un actionnaire est la partie adverse de notre cliente en divorce.
    ['Patrick Belhumeur', 'SL', 'potentiel', 'm-006', at(2, 14)],
    // Bail Maple Ridge : le locateur est-il lié à Northshore ? Vérification en cours.
    ['Harbourfront Properties', 'DO', 'en_cours', 'm-007', at(1, 15)],
    // Mandat refusé : Aurora Studios voulait nous confier un dossier alors qu'elle est partie adverse.
    ['Aurora Studios', 'PN', 'confirme', null, at(9, 13)],
    ['Boulangerie Saint-Jérôme inc.', 'HB', 'clair', null, at(5, 16)],
  ];
  snapshot.conflictChecks = checks
    .map(([query, who, status, matterId, when], i): ConflictCheck => ({
      id: `cc-demo-${i + 1}`,
      query,
      performedBy: who,
      performedAt: when,
      status,
      matterId,
      hits: toCheckHits(searchConflicts(query, snapshot)),
      updatedAt: status === 'confirme' ? at(8, 10) : null,
      updatedBy: status === 'confirme' ? 'HB' : null,
    }))
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt));

  // Quelques changements d'étape récents, pour illustrer l'historique.
  const audit: Omit<AuditEntry, 'id'>[] = [
    { at: at(6, 14), actor: 'KH', action: 'set_stage', entity: 'matter', entityId: 'm-002', details: { from: 'redaction', to: 'revision' } },
    { at: at(3, 18), actor: 'HB', action: 'set_stage', entity: 'matter', entityId: 'm-002', details: { from: 'revision', to: 'depot' } },
    { at: at(4, 13), actor: 'IT', action: 'set_stage', entity: 'matter', entityId: 'm-008', details: { from: 'depot', to: 'audience' } },
    { at: at(2, 17), actor: 'PN', action: 'set_stage', entity: 'matter', entityId: 'm-013', details: { from: 'recherche', to: 'redaction' } },
  ];
  snapshot.auditLog = audit
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((a, i, arr) => ({ ...a, id: arr.length - i }));

  return snapshot;
}
