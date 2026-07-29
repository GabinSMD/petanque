import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Version applicative : celle du package racine, source unique de vérité. */
const appVersion = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version as string;

/**
 * Commit court. Le déploiement VM construit dans un dépôt git, donc `git`
 * répond ; l'image Docker exclut `.git` (voir .dockerignore) et retombe sur
 * APP_COMMIT, sinon sur une chaîne vide — le pied de page s'en accommode.
 */
function commitCourt(): string {
  if (process.env.APP_COMMIT) return process.env.APP_COMMIT.slice(0, 7);
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_COMMIT__: JSON.stringify(commitCourt()),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        id: '/',
        name: 'Pétanque Concours',
        short_name: 'Pétanque',
        description:
          'Gestion de concours de pétanque : poules, tableaux, consolante — fonctionne sans connexion.',
        lang: 'fr',
        dir: 'ltr',
        theme_color: '#1d3d9c',
        background_color: '#f1f4fa',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        scope: '/',
        start_url: '/',
        categories: ['sports', 'productivity', 'utilities'],
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          {
            name: 'Nouveau concours',
            short_name: 'Nouveau',
            description: 'Créer un concours (assistant guidé)',
            url: '/?nouveau=1',
            icons: [{ src: '/maskable-192.png', sizes: '192x192' }]
          },
          {
            name: 'Palmarès du club',
            short_name: 'Palmarès',
            description: 'Vainqueurs et classement des clubs',
            url: '/palmares',
            icons: [{ src: '/maskable-192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        importScripts: ['push-sw.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787'
    }
  }
});
