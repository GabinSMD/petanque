/**
 * Génère les icônes de l'application installée (PNG) à partir du tracé de la
 * marque, `client/public/favicon.svg` — lui-même tiré du visuel validé
 * (`client/src/assets/marque/treizero-icone.svg`).
 *
 * Usage : node scripts/gen-icons.mjs
 *
 * Le rendu passe par un navigateur : il faut Playwright et son Chromium
 * (`npx playwright install chromium`). Ce n'est pas une dépendance du projet,
 * les icônes ne se régénèrent que lorsque le logo change.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'client', 'public');

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('Playwright est introuvable : npx playwright install chromium, puis relancer.');
  process.exit(1);
}

const svg = readFileSync(join(outDir, 'favicon.svg'), 'utf8');

/**
 * `part` : place que prend le dessin dans le carré.
 * - « any » : le système n'y touche pas, le dessin peut respirer large ;
 * - « maskable » : Android découpe un cercle d'environ 80 % — le but, posé en
 *   bas à droite de la boule, doit rester dedans ;
 * - Apple : iOS arrondit les coins lui-même.
 */
const ICONES = [
  ['pwa-192.png', 192, 0.8],
  ['pwa-512.png', 512, 0.8],
  ['maskable-192.png', 192, 0.58],
  ['maskable-512.png', 512, 0.58],
  ['apple-touch-icon.png', 180, 0.74],
];

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
for (const [nom, taille, part] of ICONES) {
  await page.setViewportSize({ width: taille, height: taille });
  await page.setContent(
    `<body style="margin:0;background:#fff;display:grid;place-items:center;height:100vh">
       <div style="width:${part * 100}%;line-height:0">${svg}</div>
     </body>`,
  );
  writeFileSync(join(outDir, nom), await page.screenshot({ type: 'png' }));
  console.log(`✔ ${nom}`);
}
await navigateur.close();
