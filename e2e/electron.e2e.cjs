/**
 * Test de bout en bout de l'application Electron réelle (pas le mode navigateur).
 *
 *   npm run test:e2e        (Linux : lancé sous xvfb-run)
 *
 * Vérifie : démarrage, SQLite, écran d'accueil, notifications système, export CSV et PDF
 * via la boîte de dialogue native (simulée pour choisir l'emplacement), blocage réseau,
 * persistance après redémarrage et sauvegarde quotidienne. Données dans un dossier jetable.
 */
const { _electron: electron } = require('playwright');
const { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const executablePath = require(join(root, 'node_modules/electron'));
const dataDir = mkdtempSync(join(tmpdir(), 'caseforge-e2e-'));
const outDir = process.env.CASEFORGE_E2E_OUT || dataDir;
const logFile = join(dataDir, 'e2e.log');
const readLog = () => (existsSync(logFile) ? readFileSync(logFile, 'utf8') : '');
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function launch(logs) {
  const app = await electron.launch({
    executablePath,
    args: [root, '--no-sandbox'],
    env: { ...process.env, CASEFORGE_E2E: '1', CASEFORGE_DATA_DIR: dataDir, CASEFORGE_E2E_LOG: logFile },
  });
  app.process().stdout.on('data', (d) => logs.push(String(d)));
  app.process().stderr.on('data', (d) => logs.push(String(d)));
  // Boîte de dialogue d'enregistrement : on choisit l'emplacement à la place de l'utilisateur.
  await app.evaluate(({ dialog }, dir) => {
    dialog.showSaveDialog = async (...args) => {
      const opts = args.length > 1 ? args[1] : args[0];
      const ext = opts.filters?.[0]?.extensions?.[0] ?? 'bin';
      return { canceled: false, filePath: `${dir}/export-${Date.now()}.${ext}` };
    };
  }, outDir);
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  return { app, win };
}

(async () => {
  const logs = [];
  let { app, win } = await launch(logs);
  await win.waitForTimeout(4000);

  check('Fenêtre ouverte', (await win.title()) === 'CaseForge');
  check('Stockage SQLite (pas le mode démo navigateur)', (await win.evaluate(() => window.caseforge?.storage)) === 'sqlite');
  check('Écran d’accueil au premier lancement', await win.getByText('100 % local, par conception').isVisible());
  await win.screenshot({ path: join(outDir, 'electron-01-accueil.png') });

  await win.getByRole('button', { name: 'Passer' }).click();
  await win.getByRole('button', { name: /Commencer avec la démo/ }).click();
  await win.waitForTimeout(2500);
  await win.screenshot({ path: join(outDir, 'electron-02-campus.png') });

  const notifications = readLog().split('\n').filter((l) => l.includes('[notification]'));
  check('Notifications système des échéances critiques', notifications.length >= 4, `${notifications.length} émises`);
  check('Bannière d’alerte affichée', await win.getByText(/ÉCHÉANCES CRITIQUES EXIGENT/i).isVisible());

  // Blocage réseau : toute requête sortante du renderer doit échouer.
  const net = await win.evaluate(async () => {
    try {
      await fetch('https://example.com/');
      return 'ok';
    } catch (e) {
      return 'bloqué';
    }
  });
  check('Requête réseau du renderer bloquée (CSP + filtre)', net === 'bloqué', net);
  // Deuxième couche : même une fenêtre sans CSP ne peut rien charger de distant.
  const nav = await app.evaluate(async ({ BrowserWindow }) => {
    const w = new BrowserWindow({ show: false });
    try {
      await w.loadURL('https://example.com/');
      return 'chargé';
    } catch (e) {
      return String(e.message || e).includes('ERR_BLOCKED_BY_CLIENT') ? 'bloqué' : String(e.message || e);
    } finally {
      w.destroy();
    }
  });
  check('Navigation distante bloquée par le processus principal', nav === 'bloqué', nav);

  // Export CSV (tiroir WIP) via la boîte de dialogue native.
  const before = new Set(readdirSync(outDir));
  await win.getByRole('button', { name: /WIP non facturé/ }).click();
  await win.getByRole('button', { name: /Exporter CSV \(/ }).click();
  await win.waitForTimeout(800);
  const csv = readdirSync(outDir).find((f) => f.endsWith('.csv') && !before.has(f));
  const csvText = csv ? readFileSync(join(outDir, csv), 'utf8') : '';
  check('Export CSV écrit sur disque', Boolean(csv) && csvText.startsWith('﻿date,no_dossier'), csv ?? 'aucun fichier');

  // Export PDF (rapport d'heures).
  await win.getByRole('button', { name: 'Rapports et exports' }).click();
  await win.getByRole('button', { name: 'PDF' }).click();
  await win.waitForTimeout(3000);
  const pdf = readdirSync(outDir).find((f) => f.endsWith('.pdf'));
  const pdfHead = pdf ? readFileSync(join(outDir, pdf)).subarray(0, 5).toString() : '';
  check('Export PDF généré localement', pdfHead === '%PDF-', pdf ?? 'aucun fichier');

  // Accusé de réception nominatif, puis redémarrage : la donnée doit persister.
  await win.getByRole('button', { name: 'Fermer' }).last().click();
  await win.getByRole('button', { name: /Traiter maintenant/ }).click();
  await win.getByRole('button', { name: 'Accuser réception' }).first().click();
  await win.getByLabel('Initiales').fill('HB');
  await win.getByRole('button', { name: 'Confirmer' }).click();
  await win.waitForTimeout(800);
  await win.screenshot({ path: join(outDir, 'electron-03-accuse.png') });
  await app.close();

  ({ app, win } = await launch(logs));
  await win.waitForTimeout(3500);
  const acked = await win.evaluate(async () => (await window.caseforge.getSnapshot()).deadlines.filter((d) => d.acknowledgedBy === 'HB').length);
  check('Persistance SQLite après redémarrage', acked >= 1, `${acked} accusé(s) HB`);
  check('Accueil non réaffiché après le premier lancement', !(await win.getByText('100 % local, par conception').isVisible()));
  const backups = existsSync(join(dataDir, 'sauvegardes')) ? readdirSync(join(dataDir, 'sauvegardes')) : [];
  check('Sauvegarde quotidienne créée', backups.some((f) => /^caseforge-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)), backups.join(', '));
  const blockedLog = readLog().includes('[réseau bloqué] https://example.com/');
  check('Blocage réseau consigné dans le journal local', blockedLog);
  await app.close();

  if (!process.env.CASEFORGE_E2E_OUT) rmSync(dataDir, { recursive: true, force: true });
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} vérifications réussies`);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
