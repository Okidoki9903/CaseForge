/**
 * Pont IPC : seules ces opérations sont exposées au renderer, avec validation des entrées.
 */
import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import { writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { IPC } from '@shared/api';
import type {
  ConflictStatus, FirmSettings, NewFirmInput, NewTimeEntry, PipelineStage, StaffInput, TimeEntryStatus,
} from '@shared/types';
import { localToday } from '@shared/domain/dates';
import type { NewDeadlineInput, NewMatterInput } from '@shared/domain/matters';
import type { Repository } from './db/repository';

const str = (v: unknown, name: string): string => {
  if (typeof v !== 'string' || v.length === 0 || v.length > 500) throw new Error(`Paramètre invalide : ${name}`);
  return v;
};

export function registerIpc(repo: Repository, onDataChanged: () => void): void {
  ipcMain.handle(IPC.getSnapshot, () => repo.getSnapshot());

  ipcMain.handle(IPC.acknowledgeDeadline, (_e, id: unknown, initials: unknown) => {
    repo.acknowledgeDeadline(str(id, 'id'), str(initials, 'initials'));
    onDataChanged();
  });

  ipcMain.handle(IPC.completeDeadline, (_e, id: unknown, initials: unknown) => {
    repo.completeDeadline(str(id, 'id'), str(initials, 'initials'));
    onDataChanged();
  });

  ipcMain.handle(IPC.setMatterStage, (_e, id: unknown, stage: unknown, actor: unknown) => {
    repo.setMatterStage(str(id, 'id'), str(stage, 'stage') as PipelineStage, str(actor, 'actor'));
  });

  ipcMain.handle(IPC.addTimeEntry, (_e, entry: NewTimeEntry) => {
    if (!entry || typeof entry !== 'object') throw new Error('Saisie de temps invalide.');
    return repo.addTimeEntry({
      matterId: str(entry.matterId, 'matterId'),
      staffId: str(entry.staffId, 'staffId'),
      date: /^\d{4}-\d{2}-\d{2}$/.test(entry.date) ? entry.date : localToday(),
      minutes: Number(entry.minutes),
      billable: Boolean(entry.billable),
      description: String(entry.description ?? '').slice(0, 2000),
    });
  });

  ipcMain.handle(IPC.setTimeEntryStatus, (_e, id: unknown, status: unknown, actor: unknown) => {
    const st = str(status, 'status');
    if (!['wip', 'facture', 'radie'].includes(st)) throw new Error('Statut invalide.');
    repo.setTimeEntryStatus(str(id, 'id'), st as TimeEntryStatus, str(actor, 'actor'));
  });

  // Écriture d'un fichier choisi par l'utilisateur via la boîte de dialogue native : le
  // renderer ne peut jamais écrire ailleurs que là où l'utilisateur l'a explicitement décidé.
  ipcMain.handle(IPC.saveTextFile, async (e, name: unknown, content: unknown) => {
    if (typeof content !== 'string' || content.length > 50_000_000) throw new Error('Contenu invalide.');
    const safeName = basename(str(name, 'name')).replace(/[^\w.\-]+/g, '_');
    const win = BrowserWindow.fromWebContents(e.sender);
    const options = {
      defaultPath: join(app.getPath('documents'), safeName),
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    };
    const res = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (res.canceled || !res.filePath) return false;
    await writeFile(res.filePath, content, 'utf8');
    return true;
  });

  // PDF : le HTML (autonome, sans script) est rendu dans une fenêtre cachée, sans JavaScript,
  // dans la même session (donc soumise au blocage réseau), puis converti par Chromium.
  ipcMain.handle(IPC.savePdf, async (e, name: unknown, html: unknown) => {
    if (typeof html !== 'string' || html.length > 20_000_000) throw new Error('Document invalide.');
    const safeName = basename(str(name, 'name')).replace(/[^\w.\-]+/g, '_');
    const parent = BrowserWindow.fromWebContents(e.sender);
    const options = { defaultPath: join(app.getPath('documents'), safeName), filters: [{ name: 'PDF', extensions: ['pdf'] }] };
    const res = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options);
    if (res.canceled || !res.filePath) return false;
    const win = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true, contextIsolation: true } });
    try {
      await win.loadURL(`data:text/html;charset=utf-8;base64,${Buffer.from(html, 'utf8').toString('base64')}`);
      const pdf = await win.webContents.printToPDF({ pageSize: 'Letter', landscape: true, printBackground: true });
      await writeFile(res.filePath, pdf);
    } finally {
      win.destroy();
    }
    return true;
  });

  ipcMain.handle(IPC.recordConflictCheck, (_e, query: unknown, actor: unknown, matterId: unknown) =>
    repo.recordConflictCheck(str(query, 'query'), str(actor, 'actor'), matterId ? str(matterId, 'matterId') : null),
  );

  ipcMain.handle(IPC.updateConflictCheck, (_e, id: unknown, patch: unknown, actor: unknown) => {
    if (!patch || typeof patch !== 'object') throw new Error('Modification invalide.');
    const p = patch as { status?: unknown; matterId?: unknown };
    repo.updateConflictCheck(
      str(id, 'id'),
      {
        status: p.status === undefined ? undefined : (str(p.status, 'status') as ConflictStatus),
        matterId: p.matterId === undefined ? undefined : p.matterId === null ? null : str(p.matterId, 'matterId'),
      },
      str(actor, 'actor'),
    );
  });

  ipcMain.handle(IPC.updateSettings, (_e, patch: unknown, actor: unknown) => {
    if (!patch || typeof patch !== 'object') throw new Error('Paramètres invalides.');
    repo.updateSettings(patch as Partial<FirmSettings>, actor == null ? null : str(actor, 'actor'));
  });

  ipcMain.handle(IPC.saveStaff, (_e, input: unknown, actor: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Collaborateur invalide.');
    return repo.saveStaff(input as StaffInput, str(actor, 'actor'));
  });

  ipcMain.handle(IPC.setStaffActive, (_e, id: unknown, active: unknown, actor: unknown) => {
    repo.setStaffActive(str(id, 'id'), Boolean(active), str(actor, 'actor'));
  });

  ipcMain.handle(IPC.createEmptyFirm, (_e, input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Cabinet invalide.');
    const owner = repo.createEmptyFirm(input as NewFirmInput);
    onDataChanged();
    return owner;
  });

  ipcMain.handle(IPC.createMatter, (_e, input: unknown, actor: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Dossier invalide.');
    const m = repo.createMatter(input as NewMatterInput, str(actor, 'actor'));
    onDataChanged();
    return m;
  });

  ipcMain.handle(IPC.addDeadline, (_e, input: unknown, actor: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Échéance invalide.');
    const d = repo.addDeadline(input as NewDeadlineInput, str(actor, 'actor'));
    onDataChanged();
    return d;
  });

  ipcMain.handle(IPC.resetDemoData, () => {
    repo.seed(localToday(), { onboarded: true });
    onDataChanged();
  });
}
