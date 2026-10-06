/**
 * Processus principal Electron — CaseForge.
 * Toutes les données vivent dans `userData/caseforge.sqlite` sur le poste de l'utilisateur.
 */
import { app, BrowserWindow, dialog } from 'electron';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { localToday } from '@shared/domain/dates';
import { dailyBackup, openDatabase } from './db/connection';
import { Repository } from './db/repository';
import { registerIpc } from './ipc';
import { DeadlineNotifier } from './notifier';
import { hardenSession, hardenWebContents } from './security';
import { describeStartupError } from './startupErrors';

// Dossier de données personnalisable (tests, installation portable, poste partagé).
if (process.env.CASEFORGE_DATA_DIR) {
  mkdirSync(process.env.CASEFORGE_DATA_DIR, { recursive: true });
  app.setPath('userData', process.env.CASEFORGE_DATA_DIR);
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#e9eef5',
    title: 'CaseForge',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });
  hardenWebContents(win.webContents);
  win.once('ready-to-show', () => win.show());

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
  return win;
}

// Une seule instance : évite deux écrivains concurrents sur la même base.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });

  app.whenReady().then(async () => {
    hardenSession();
    // Toute fenêtre (y compris la fenêtre cachée de génération PDF) est durcie.
    app.on('web-contents-created', (_e, contents) => hardenWebContents(contents));

    const userData = app.getPath('userData');
    const dbPath = join(userData, 'caseforge.sqlite');
    let db: ReturnType<typeof openDatabase>;
    let repo: Repository;
    try {
      db = openDatabase(dbPath);
      repo = new Repository(db);
      if (repo.isEmpty()) repo.seed(localToday()); // première ouverture : cabinet de démonstration
    } catch (err) {
      // Message clair plutôt qu'une fenêtre blanche ou une pile d'appels.
      const e = describeStartupError(err, dbPath);
      console.error(`[CaseForge] ${e.title}\n${e.message}`);
      // Boîte modale pour l'utilisateur ; en test automatisé, la sortie d'erreur suffit.
      if (!process.env.CASEFORGE_E2E) dialog.showErrorBox(e.title, e.message);
      app.exit(1);
      return;
    }
    console.log(`[CaseForge] Données locales : ${dbPath}`);
    await dailyBackup(db, join(userData, 'sauvegardes'), localToday()).catch((err) =>
      console.error('[CaseForge] Échec de la sauvegarde locale', err),
    );

    const notifier = new DeadlineNotifier(repo, () => mainWindow);
    registerIpc(repo, () => notifier.check());

    mainWindow = createWindow();
    mainWindow.on('closed', () => (mainWindow = null));
    notifier.start();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
    });
    app.on('will-quit', () => {
      notifier.stop();
      db.close();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
