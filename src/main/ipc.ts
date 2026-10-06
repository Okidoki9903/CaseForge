/**
 * Pont IPC : seules ces opérations sont exposées au renderer, avec validation des entrées.
 */
import { ipcMain } from 'electron';
import { IPC } from '@shared/api';
import type { NewTimeEntry, PipelineStage } from '@shared/types';
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

  ipcMain.handle(IPC.setMatterStage, (_e, id: unknown, stage: unknown) => {
    repo.setMatterStage(str(id, 'id'), str(stage, 'stage') as PipelineStage);
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

  ipcMain.handle(IPC.resetDemoData, () => {
    repo.seed(localToday());
    onDataChanged();
  });
}
