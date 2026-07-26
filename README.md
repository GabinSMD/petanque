# 🎯 Pétanque Concours — gestion de concours en SaaS, avec mode hors-ligne

Application web de gestion de concours de pétanque inspirée du logiciel
[FFPJP Gestion Concours](https://www.ffpjp-gestion-concours.com/), repensée en
**SaaS multi-clubs** avec un **mode hors-ligne complet** : l'application
fonctionne intégralement sans connexion au boulodrome (tirages, saisie des
scores, tableaux) et se synchronise dès que le réseau revient.

## Fonctionnalités

### Gestion sportive
- **Concours** en tête-à-tête, doublette ou triplette ; parties en 13 points
  (configurable, ex. 11) ; nombre de terrains.
- **Inscriptions** : équipes numérotées, joueurs avec n° de licence optionnel,
  club, forfaits, verrouillage après tirage.
- **Poules à la FFPJP** : poules de 4 complétées par des poules de 3
  (7 → 1×4 + 1×3, 9 → 3×3…), enchaînement automatique
  *1ère partie / 2e partie → gagnants / perdants → barrage*, qualification du
  1er (2 victoires) et du 2e (barrage), option « éviter deux équipes du même
  club dans une poule ».
- **Tableau final** : génération à l'issue des poules — exempts prioritaires
  aux premiers, premier contre second d'une autre poule au 1er tour, 1er et 2e
  d'une même poule placés dans des moitiés opposées ; tour de **cadrage**
  automatique quand l'effectif n'est pas une puissance de 2 ; libellés
  officiels (8èmes, quarts, demi-finales, finale).
- **Élimination directe** (sans poules) avec les mêmes règles de cadrage.
- **Consolante** : repêchage des éliminés de poules, ou des perdants du 1er
  tour en élimination directe (places « perdant de la partie N » remplies au
  fil des résultats).
- **Saisie des scores** avec validation (13 points, pas de nul), **correction
  en cascade** : corriger une partie amont réinitialise proprement tout ce qui
  en dépendait.
- **Terrains** affectés automatiquement aux premières parties, modifiables
  partie par partie.
- **Classement** : vainqueur, finaliste, demi-finalistes, éliminés par tour,
  issue des poules, consolante.
- **Affichage public** (TV / vidéoprojecteur) : page dédiée en lecture seule,
  grandes polices, mise à jour en temps réel.
- **Impression** : feuilles de poules, tableaux et résultats via la mise en
  page d'impression du navigateur.

### SaaS & hors-ligne
- **Comptes club (multi-tenant)** : chaque organisation a ses concours, ses
  utilisateurs et son journal de modifications.
- **Local-first / PWA** : l'interface lit et écrit d'abord dans IndexedDB ;
  le service worker met l'application en cache — rechargez la page sans
  réseau, tout est là. Installable sur mobile/tablette.
- **Synchronisation** : envoi des modifications locales + récupération de
  celles des autres appareils du club (curseur d'oplog par organisation,
  résolution *dernier écrivain gagnant* horodatée, départage par appareil,
  idempotente — rejouable sans effet de bord).
- **Multi-appareils** : le même compte connecté sur l'ordinateur de la table
  de marque et la tablette du terrain voit les mêmes données.

## Architecture

```
petanque/
├── shared/   Moteur de tournoi TypeScript pur (poules, barrage, cadrage,
│             tableaux, consolante, classements) + types + tests Vitest.
│             Il tourne CÔTÉ CLIENT : indispensable au mode hors-ligne.
├── client/   PWA React + Vite. IndexedDB (Dexie) comme base primaire,
│             moteur de synchronisation (outbox + curseur), react-router,
│             service worker Workbox (vite-plugin-pwa).
└── server/   API Fastify (Node ≥ 22.5, SQLite natif node:sqlite, zéro
              dépendance native). Authentification JWT, multi-tenant,
              endpoint /api/sync (réplication), sert le client construit.
```

Le serveur ne connaît **aucune règle de pétanque** : c'est un réplicateur
authentifié. Toute la logique sportive vit dans `shared/` et s'exécute dans le
navigateur — c'est ce qui permet un hors-ligne total.

### Protocole de synchronisation

```
POST /api/sync  { cursor, deviceId, changes: [{type, id, data, updatedAt, deleted}] }
             →  { cursor, hasMore, accepted, changes: [...] }
```

- Chaque organisation possède une séquence monotone (oplog). Le client envoie
  ses entités « sales » et son curseur ; le serveur applique en
  dernier-écrivain-gagnant (`updatedAt`, départage `deviceId`), attribue un
  numéro de séquence et renvoie tout ce qui a changé depuis le curseur.
- Un push rejeté (version serveur plus récente) renvoie immédiatement la
  version gagnante : l'appareil émetteur converge sans attendre.
- Les suppressions sont des pierres tombales synchronisées.

## Démarrage

Prérequis : **Node.js ≥ 22.5** (SQLite intégré).

```bash
npm install

# Développement (API sur :8787 + Vite sur :5173 avec proxy /api)
npm run dev

# Tests du moteur de tournoi
npm test

# Production : construit le client puis le serveur, puis sert le tout sur :8787
npm run build
npm start
```

Variables d'environnement du serveur :

| Variable     | Défaut           | Rôle                                   |
| ------------ | ---------------- | -------------------------------------- |
| `PORT`       | `8787`           | Port HTTP                              |
| `DATA_DIR`   | `server/data`    | Dossier SQLite + secret JWT            |
| `DB_PATH`    | `$DATA_DIR/petanque.sqlite` | Fichier de base           |
| `JWT_SECRET` | généré/persisté  | Secret de signature des jetons         |

### Docker

```bash
docker build -t petanque-concours .
docker run -p 8787:8787 -v petanque-data:/app/server/data petanque-concours
```

## Utilisation type (jour de concours)

1. La veille, au club : créer le concours, saisir les inscriptions.
2. Au boulodrome (souvent sans réseau) : ouvrir l'application — elle charge
   depuis le cache — tirer les poules, imprimer, saisir les scores, générer
   le tableau, jouer la consolante… tout fonctionne hors connexion.
3. L'écran d'affichage (TV) montre poules et tableaux en direct.
4. Dès que le réseau revient (ou en partage de connexion), tout se
   synchronise ; le second appareil du club voit les résultats.

## Tests

- `shared/` : 22 tests Vitest couvrant la répartition des poules, le
  déroulement 4/3 avec barrage, les corrections en cascade, le cadrage et les
  exempts, l'appariement premiers/seconds, la consolante alimentée par les
  perdants et les classements.
- Un test de bout en bout (Playwright) a validé le parcours complet :
  inscription club → concours → 7 équipes → poules → tableau → consolante →
  vainqueur → synchronisation serveur → **rechargement de l'application hors
  ligne**.

## Feuille de route

- Invitations multi-utilisateurs au sein d'un club, rôles (table de marque /
  lecture seule).
- Import du fichier des licenciés (CSV / Geslico) et recherche par n° de
  licence, lecteur code-barres.
- Concours « complémentaire », parties limitées au temps, tir de précision.
- Indemnités / répartition des mises, export PDF des feuilles de parties.
- Page publique de résultats (lien partageable sans compte).
- Durcissement SaaS : limitation de débit, Postgres, sauvegardes, RGPD.
