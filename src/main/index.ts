/**
 * Processus principal Electron — CaseForge.
 * Toutes les données vivent dans `userData/caseforge.sqlite` sur le poste de l'utilisateur.
 */
import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { localToday } from '@shared/domain/dates';
import { dailyBackup, openDatabase } from './db/connection';
import { Repository } from './db/repository';
import { registerIpc } from './ipc';
import { DeadlineNotifier } from './notifier';
import { hardenSession, hardenWebContents } from './security';

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

    const userData = app.getPath('userData');
    const db = openDatabase(join(userData, 'caseforge.sqlite'));
    const repo = new Repository(db);
    if (repo.isEmpty()) repo.seed(localToday()); // première ouverture : cabinet de démonstration
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
