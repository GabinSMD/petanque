import { defineConfig, type Plugin } from 'vite';
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

/**
 * Deux retouches sur le seul document de la vitrine, après le plugin PWA :
 *
 * - retirer le lien vers le manifeste, que le plugin injecte dans tous les
 *   documents : sans lui, le navigateur ne proposera pas d'« installer » une
 *   page de présentation comme si c'était l'application ;
 * - rendre absolues les adresses Open Graph quand `VITE_SITE_ORIGIN` est
 *   fournie, les aperçus de lien n'acceptant pas de chemin relatif.
 */
function vitrineHtml(): Plugin {
  const site = (process.env.VITE_SITE_ORIGIN ?? '').replace(/\/+$/, '');
  return {
    name: 'petanque-vitrine-html',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.filename.endsWith('vitrine.html')) return html;
        let out = html.replace(/\s*<link rel="manifest"[^>]*>/g, '');
        if (site) {
          out = out.replace(
            /(<meta property="og:image" content=")(\/[^"]*)(")/,
            `$1${site}$2$3`,
          );
          out = out.replace(
            '<meta property="og:type"',
            `<meta property="og:url" content="${site}/" />\n    <meta property="og:type"`,
          );
        }
        return out;
      },
    },
  };
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
      // `main.tsx` appelle `registerSW` lui-même : rien à injecter dans les
      // documents. Surtout pas dans `vitrine.html`, qui ne doit installer aucun
      // service worker — la page vitrine ne crée rien sur son origine.
      injectRegister: null,
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
        // La vitrine est une page publique en ligne : la précacher dans
        // l'application n'aurait aucun usage hors connexion.
        globIgnores: ['**/vitrine.html'],
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
    }),
    // Après VitePWA : c'est lui qui injecte le lien vers le manifeste.
    vitrineHtml()
  ],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url))
    }
  },
  build: {
    rollupOptions: {
      // Deux documents : l'application, et la vitrine servie sur son propre nom
      // de domaine (voir la sélection par en-tête Host côté serveur).
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        vitrine: fileURLToPath(new URL('vitrine.html', import.meta.url))
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787'
    }
  }
});
