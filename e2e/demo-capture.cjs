/**
 * Scénario de démonstration « idéal » (60–90 s), joué automatiquement sur le build web.
 * Produit des captures propres (docs/captures/demo-*.png) et une vidéo (.webm).
 *
 *   npm run build:web
 *   npx vite preview --config vite.web.config.ts --port 4173 &
 *   npm run demo:capture            (Linux : sous xvfb-run si aucun écran)
 *
 * Variables : CASEFORGE_DEMO_URL (défaut http://127.0.0.1:4173/), CASEFORGE_DEMO_VIDEO (dossier vidéo).
 */
const { chromium } = require('playwright');
const { mkdirSync } = require('node:fs');
const { join, resolve } = require('node:path');

const url = process.env.CASEFORGE_DEMO_URL || 'http://127.0.0.1:4173/';
const shots = resolve(__dirname, '../docs/captures');
const videoDir = process.env.CASEFORGE_DEMO_VIDEO;
mkdirSync(shots, { recursive: true });
const viewport = { width: 1440, height: 900 };
const pause = (page, ms) => page.waitForTimeout(ms);

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1.5,
    locale: 'fr-CA',
    ...(videoDir ? { recordVideo: { dir: videoDir, size: viewport } } : {}),
  });
  const page = await context.newPage();
  const shot = (name) => page.screenshot({ path: join(shots, `demo-${name}.png`) });
  const external = [];
  page.on('request', (r) => { if (!/^(http:\/\/127\.0\.0\.1|data:|blob:)/.test(r.url())) external.push(r.url()); });

  // 0. Premier lancement : accueil, puis la démo.
  await page.goto(url);
  await pause(page, 2500);
  await shot('0-accueil');
  await page.getByRole('button', { name: 'Passer' }).click();
  await pause(page, 600);
  await page.getByRole('button', { name: /Commencer avec la démo/ }).click();
  await pause(page, 3500);

  // 1. Ouvrir l'app → voir les alertes critiques.
  await shot('1-alertes');
  await page.getByRole('button', { name: /Échéances critiques/ }).click();
  await pause(page, 1500);

  // 2. Accuser réception d'une échéance (initiales nominatives).
  await page.getByRole('button', { name: 'Accuser réception' }).first().click();
  await pause(page, 500);
  await page.getByLabel('Initiales').fill('HB');
  await pause(page, 500);
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await pause(page, 1200);
  await shot('2-accuse');

  // 3. Saisir du temps sur un dossier.
  await page.getByRole('button', { name: /Voir sur la carte/ }).first().click();
  await page.getByRole('button', { name: 'Fermer' }).last().click();
  await pause(page, 1800);
  const panel = page.locator('aside').first();
  await page.getByLabel('Description du travail').scrollIntoViewIfNeeded();
  await page.getByLabel('Description du travail').pressSequentially('Révision du protocole de l’instance', { delay: 25 });
  await page.getByLabel('Durée', { exact: true }).pressSequentially('0,35', { delay: 80 });
  await pause(page, 900);
  await shot('3-temps');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await pause(page, 1200);

  // 4. Recherche de conflit (Ctrl+K) — enregistrée automatiquement.
  await page.keyboard.press('Control+k');
  await pause(page, 400);
  await page.keyboard.type('Patrick Belhumeur', { delay: 60 });
  await pause(page, 2200);
  await shot('4-conflit');
  await page.keyboard.press('Escape');
  await pause(page, 600);

  // 5. Changer l'étape d'un dossier (glisser-déposer vers le pipeline).
  await panel.evaluate((el) => (el.querySelector('.overflow-y-auto').scrollTop = 0));
  const stages = page.locator('nav[aria-label="Pipeline de production"] button');
  await page.getByTitle('Glisser vers une étape du pipeline').dragTo(stages.nth(6));
  await pause(page, 1500);
  await panel.evaluate((el) => (el.querySelector('.overflow-y-auto').scrollTop = 99999));
  await pause(page, 1200);
  await shot('5-pipeline');

  // Bonus (hors vidéo de 90 s) : rapports et paramètres.
  await page.getByRole('button', { name: 'Fermer' }).first().click();
  await page.getByRole('button', { name: 'Rapports et exports' }).click();
  await pause(page, 1200);
  await shot('6-rapports');
  await page.getByRole('button', { name: 'Fermer' }).last().click();
  await page.getByRole('button', { name: 'Paramètres' }).click();
  await page.getByRole('tab', { name: 'Collaborateurs' }).click();
  await pause(page, 800);
  await shot('7-parametres');

  await context.close();
  await browser.close();
  console.log(`Captures : ${shots}${videoDir ? `\nVidéo : ${videoDir}` : ''}`);
  console.log(external.length ? `⚠ Requêtes externes : ${external.join(', ')}` : '✔ Aucune requête externe');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
