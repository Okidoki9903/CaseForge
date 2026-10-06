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
  completeDeadline: (id, initials) => ipcRenderer.invoke(IPC.completeDeadline, id, initials),
  setMatterStage: (id, stage, actor) => ipcRenderer.invoke(IPC.setMatterStage, id, stage, actor),
  addTimeEntry: (entry) => ipcRenderer.invoke(IPC.addTimeEntry, entry),
  setTimeEntryStatus: (id, status, actor) => ipcRenderer.invoke(IPC.setTimeEntryStatus, id, status, actor),
  saveTextFile: (name, content) => ipcRenderer.invoke(IPC.saveTextFile, name, content),
  recordConflictCheck: (query, actor, matterId) => ipcRenderer.invoke(IPC.recordConflictCheck, query, actor, matterId ?? null),
  updateConflictCheck: (id, patch, actor) => ipcRenderer.invoke(IPC.updateConflictCheck, id, patch, actor),
  resetDemoData: () => ipcRenderer.invoke(IPC.resetDemoData),
  updateSettings: (patch, actor) => ipcRenderer.invoke(IPC.updateSettings, patch, actor),
  saveStaff: (input, actor) => ipcRenderer.invoke(IPC.saveStaff, input, actor),
  setStaffActive: (id, active, actor) => ipcRenderer.invoke(IPC.setStaffActive, id, active, actor),
  createEmptyFirm: (input) => ipcRenderer.invoke(IPC.createEmptyFirm, input),
};

contextBridge.exposeInMainWorld('caseforge', api);
