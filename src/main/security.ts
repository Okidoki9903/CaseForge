/**
 * Garantie « aucune donnée ne quitte le poste », appliquée au niveau d'Electron :
 *  - toute requête réseau sortante du renderer est bloquée (sauf le serveur Vite local en dev) ;
 *  - aucune permission (caméra, géolocalisation, notifications web…) n'est accordée ;
 *  - navigation et ouverture de fenêtres externes interdites ;
 *  - CSP stricte sans aucune origine distante.
 */
import { app, session, type WebContents } from 'electron';
import { e2eLog } from './e2eLog';

const DEV_URL = process.env.ELECTRON_RENDERER_URL;

function isAllowedUrl(raw: string): boolean {
  const url = new URL(raw);
  if (['file:', 'devtools:', 'data:', 'blob:', 'chrome-extension:'].includes(url.protocol)) return true;
  // En développement uniquement : le serveur Vite sur la boucle locale.
  if (DEV_URL && !app.isPackaged) {
    const dev = new URL(DEV_URL);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return local && url.port === dev.port;
  }
  return false;
}

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // 'unsafe-eval' requis par le HMR de Vite en développement seulement.
  `script-src 'self'${DEV_URL && !app.isPackaged ? " 'unsafe-inline' 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${DEV_URL && !app.isPackaged ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export function hardenSession(): void {
  const ses = session.defaultSession;
  ses.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isAllowedUrl(details.url);
    if (!allowed) {
      console.warn(`[CaseForge] Requête réseau bloquée : ${details.url}`);
      e2eLog(`[réseau bloqué] ${details.url}`);
    }
    callback({ cancel: !allowed });
  });
  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [CONTENT_SECURITY_POLICY] },
    });
  });
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
}

export function hardenWebContents(contents: WebContents): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url)) event.preventDefault();
  });
}
