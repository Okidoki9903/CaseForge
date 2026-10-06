import type { CaseForgeApi } from '@shared/api';
import { createDemoApi } from './demoApi';

/** SQLite via Electron si disponible, sinon IndexedDB (mode démo navigateur). */
export const api: CaseForgeApi = window.caseforge ?? createDemoApi();
