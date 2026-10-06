/**
 * Pont IPC : seules ces opérations sont exposées au renderer, avec validation des entrées.
 */
import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import { writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { IPC } from '@shared/api';
import type { ConflictStatus, NewTimeEntry, PipelineStage, TimeEntryStatus } from '@shared/types';
import { localToday } from '@shared/domain/dates';
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

  ipcMain.handle(IPC.completeDeadline, (_e, id: unknown) => {
    repo.completeDeadline(str(id, 'id'));
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

  ipcMain.handle(IPC.resetDemoData, () => {
    repo.seed(localToday());
    onDataChanged();
  });
}
