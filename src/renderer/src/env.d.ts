import type { CaseForgeApi } from '@shared/api';

declare global {
  interface Window {
    /** Présent uniquement dans Electron (exposé par le preload). */
    caseforge?: CaseForgeApi;
  }
}
export {};
