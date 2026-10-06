/**
 * Build « navigateur » du renderer seul (mode démo).
 * Les données sont alors stockées dans IndexedDB, toujours sur la machine locale.
 * Utile pour le développement de l'interface et les captures d'écran.
 */
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
  plugins: [react(), tailwindcss()],
  build: { outDir: resolve(__dirname, 'dist-web'), emptyOutDir: true },
  server: { host: '127.0.0.1', port: 5173 },
});
