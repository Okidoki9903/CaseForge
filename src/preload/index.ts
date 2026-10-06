/**
 * Preload (sandbox) : expose une API minimale et typée au renderer.
 * Le renderer n'a accès ni à Node.js ni au système de fichiers.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type CaseForgeApi } from '@shared/api';

const api: CaseForgeApi = {
  storage: 'sqlite',
  getSnapshot: () => ipcRenderer.invoke(IPC.getSnapshot),
  acknowledgeDeadline: (id, initials) => ipcRenderer.invoke(IPC.acknowledgeDeadline, id, initials),
  completeDeadline: (id) => ipcRenderer.invoke(IPC.completeDeadline, id),
  setMatterStage: (id, stage) => ipcRenderer.invoke(IPC.setMatterStage, id, stage),
  addTimeEntry: (entry) => ipcRenderer.invoke(IPC.addTimeEntry, entry),
  resetDemoData: () => ipcRenderer.invoke(IPC.resetDemoData),
};

contextBridge.exposeInMainWorld('caseforge', api);
