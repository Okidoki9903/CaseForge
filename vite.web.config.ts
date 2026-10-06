/**
 * Build « navigateur » du renderer seul (mode démo).
 * Les données sont alors stockées dans IndexedDB, toujours sur la machine locale.
 * Utile pour le développement de l'interface, les captures d'écran et la démo publique
 * (GitHub Pages) : 100 % côté client, aucune donnée envoyée à un serveur.
 *
 * CASEFORGE_BASE : chemin de publication (ex. « /CaseForge/ » pour GitHub Pages) ;
 * par défaut « ./ » (chemins relatifs, fonctionne sous n'importe quel sous-dossier).
 */
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * GitHub Pages ne permet pas d'en-têtes HTTP : la politique de sécurité est donc injectée
 * en <meta> dans la page publiée (build seulement — le serveur de dev Vite a besoin de scripts en ligne).
 * connect-src 'self' : le navigateur refuse toute requête vers un autre serveur.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const strictCsp = (): Plugin => ({
  name: 'caseforge-strict-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="referrer" content="no-referrer" />`),
});

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: process.env.CASEFORGE_BASE || './',
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
  plugins: [react(), tailwindcss(), strictCsp()],
  build: { outDir: resolve(__dirname, 'dist-web'), emptyOutDir: true },
  server: { host: '127.0.0.1', port: 5173 },
});
