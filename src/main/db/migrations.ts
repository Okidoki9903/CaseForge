/**
 * Migrations du schéma SQLite local.
 * Versionnées via `PRAGMA user_version` : chaque migration s'exécute une seule fois, dans une
 * transaction. Ne jamais modifier une migration publiée — en ajouter une nouvelle.
 */
export const MIGRATIONS: string[] = [
  /* v1 — schéma initial */ `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Pôles / départements (bâtiments du campus)
  CREATE TABLE practice_areas (
    id      TEXT PRIMARY KEY,
    code    TEXT NOT NULL UNIQUE,
    name    TEXT NOT NULL,
    color   TEXT NOT NULL,
    grid_x  REAL NOT NULL,
    grid_z  REAL NOT NULL
  );

  -- Collaborateurs
  CREATE TABLE staff (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    initials           TEXT NOT NULL,
    role               TEXT NOT NULL CHECK (role IN ('associe','avocat','stagiaire','parajuriste','adjoint')),
    practice_area_id   TEXT NOT NULL REFERENCES practice_areas(id),
    hourly_rate_cents  INTEGER NOT NULL CHECK (hourly_rate_cents >= 0),
    cost_rate_cents    INTEGER NOT NULL CHECK (cost_rate_cents >= 0),
    target_hours_week  REAL NOT NULL DEFAULT 35,
    active             INTEGER NOT NULL DEFAULT 1
  );

  -- Toutes les personnes et entités connues (base de la vérification de conflits)
  CREATE TABLE parties (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    kind          TEXT NOT NULL CHECK (kind IN ('personne','entreprise','tribunal')),
    aliases_json  TEXT NOT NULL DEFAULT '[]'
  );
  CREATE INDEX idx_parties_name ON parties(name COLLATE NOCASE);

  -- Dossiers
  CREATE TABLE matters (
    id                 TEXT PRIMARY KEY,
    number             TEXT NOT NULL UNIQUE,
    title              TEXT NOT NULL,
    client_id          TEXT NOT NULL REFERENCES parties(id),
    practice_area_id   TEXT NOT NULL REFERENCES practice_areas(id),
    responsible_id     TEXT NOT NULL REFERENCES staff(id),
    stage              TEXT NOT NULL CHECK (stage IN ('ouverture','conflits','recherche','redaction','revision','depot','audience','cloture')),
    status             TEXT NOT NULL DEFAULT 'actif' CHECK (status IN ('actif','en_attente','ferme')),
    jurisdiction       TEXT NOT NULL,
    court              TEXT,
    court_file_number  TEXT,
    fee_arrangement    TEXT NOT NULL CHECK (fee_arrangement IN ('horaire','forfait','contingence')),
    budget_cents       INTEGER NOT NULL DEFAULT 0,
    opened_at          TEXT NOT NULL
  );
  CREATE INDEX idx_matters_area ON matters(practice_area_id, status);

  CREATE TABLE matter_team (
    matter_id  TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    staff_id   TEXT NOT NULL REFERENCES staff(id),
    PRIMARY KEY (matter_id, staff_id)
  );

  CREATE TABLE matter_parties (
    matter_id  TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    party_id   TEXT NOT NULL REFERENCES parties(id),
    role       TEXT NOT NULL CHECK (role IN ('client','adverse','liee','avocat_adverse','tribunal')),
    PRIMARY KEY (matter_id, party_id, role)
  );
  CREATE INDEX idx_matter_parties_party ON matter_parties(party_id);

  -- Échéances (prescriptions, délais de procédure, audiences, délais internes)
  CREATE TABLE deadlines (
    id               TEXT PRIMARY KEY,
    matter_id        TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    kind             TEXT NOT NULL CHECK (kind IN ('prescription','procedure','audience','interne')),
    title            TEXT NOT NULL,
    due_date         TEXT NOT NULL,
    legal_basis      TEXT,
    rule_id          TEXT,
    trigger_date     TEXT,
    assigned_to      TEXT NOT NULL REFERENCES staff(id),
    status           TEXT NOT NULL DEFAULT 'ouvert' CHECK (status IN ('ouvert','complete','annule')),
    acknowledged_at  TEXT,
    acknowledged_by  TEXT,
    completed_at     TEXT
  );
  CREATE INDEX idx_deadlines_open ON deadlines(status, due_date);

  -- Saisie de temps (minutes, taux figé au moment de la saisie)
  CREATE TABLE time_entries (
    id           TEXT PRIMARY KEY,
    matter_id    TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    staff_id     TEXT NOT NULL REFERENCES staff(id),
    date         TEXT NOT NULL,
    minutes      INTEGER NOT NULL CHECK (minutes > 0),
    rate_cents   INTEGER NOT NULL CHECK (rate_cents >= 0),
    billable     INTEGER NOT NULL DEFAULT 1,
    description  TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'wip' CHECK (status IN ('wip','facture','radie'))
  );
  CREATE INDEX idx_time_matter ON time_entries(matter_id);
  CREATE INDEX idx_time_staff_date ON time_entries(staff_id, date);

  CREATE TABLE invoices (
    id                     TEXT PRIMARY KEY,
    matter_id              TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    number                 TEXT NOT NULL UNIQUE,
    issued_at              TEXT NOT NULL,
    standard_value_cents   INTEGER NOT NULL,
    amount_cents           INTEGER NOT NULL,
    paid_cents             INTEGER NOT NULL DEFAULT 0
  );

  -- Pièces et documents : seulement des références vers des fichiers locaux
  CREATE TABLE documents (
    id         TEXT PRIMARY KEY,
    matter_id  TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    category   TEXT NOT NULL CHECK (category IN ('procedure','piece','correspondance','note','jugement')),
    exhibit    TEXT,
    file_path  TEXT,
    added_at   TEXT NOT NULL
  );
  CREATE INDEX idx_documents_matter ON documents(matter_id);

  -- Trace des vérifications de conflits (preuve de diligence)
  CREATE TABLE conflict_checks (
    id            TEXT PRIMARY KEY,
    query         TEXT NOT NULL,
    performed_by  TEXT NOT NULL,
    performed_at  TEXT NOT NULL,
    results_json  TEXT NOT NULL
  );

  -- Journal d'audit (accusés de réception, changements d'étape…)
  CREATE TABLE audit_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    at            TEXT NOT NULL,
    actor         TEXT NOT NULL,
    action        TEXT NOT NULL,
    entity        TEXT NOT NULL,
    entity_id     TEXT NOT NULL,
    details_json  TEXT NOT NULL DEFAULT '{}'
  );
  `,
];
