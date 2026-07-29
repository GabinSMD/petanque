# 🎯 Pétanque Concours — gestion de concours en SaaS, avec mode hors-ligne

Application web de gestion de concours de pétanque inspirée du logiciel
[FFPJP Gestion Concours](https://www.ffpjp-gestion-concours.com/), repensée en
**SaaS multi-clubs** avec un **mode hors-ligne complet** : l'application
fonctionne intégralement sans connexion au boulodrome (tirages, saisie des
scores, tableaux) et se synchronise dès que le réseau revient.

## Deux usages, une application

Un club qui organise des concours amicaux n'a que faire du fichier des
licenciés, du championnat des clubs ou des documents remis au comité. Le
**mode fédéral** (⚙ Réglages) masque tout cela ; décoché, l'application s'en
tient aux inscriptions, au tirage, aux poules, aux tableaux, aux scores et aux
indemnités.

Ce réglage ne change **que l'affichage**, jamais le comportement : un concours
déjà déclaré officiel continue de contrôler ses licences, et ses écrans restent
visibles sur lui. Il s'active de lui-même si un concours officiel existe ou si
un fichier de licenciés a été importé — on ne cache pas à un organisateur une
fonction dont il se sert.

## Fonctionnalités

### Gestion sportive
- **Concours** en tête-à-tête, doublette ou triplette ; parties en 13 points
  (configurable, ex. 11) ; nombre de terrains ; parties en temps limité
  (indication de durée).
- **Toutes les formules de jeu** :
  - **Poules puis élimination** (le classique FFPJP) ;
  - **Élimination directe** (avec consolante possible) ;
  - **Formules fédérales A-B-C** (manuel FFPJP §3.D.8 à §3.D.12) : les
    perdants sont reversés d'un tableau à l'autre — consolante, complémentaire,
    et récupération des perdants du 2ᵉ tour du principal au cadrage de la
    consolante (ou au complémentaire, variante CD19) ;
  - **Formule par groupes A-B-C** (manuel §3.D.5) : groupes de 4 **sans
    barrage**, dont l'issue se lit au nombre de victoires — 2 victoires au
    concours A, 1 victoire au B (les **deux** équipes), 0 au C. Personne ne
    rentre après deux parties ;
  - **Mêlée tournante** : inscriptions individuelles, équipes tirées au sort
    à chaque ronde — effectifs inégaux gérés comme sur le terrain (une
    triplette peut rencontrer une doublette, personne n'est exempt),
    classement individuel ;
  - **Système suisse** : ronde 1 aléatoire puis appariement par classement
    sans revanche, exempt gagnant 13-7 en effectif impair (jamais deux fois
    le même) ;
  - **Championnat toutes rondes** : calendrier complet généré d'un coup
    (méthode du cercle), ronde de repos en effectif impair.
- **Classements en rondes** : victoires, puis goal-average, puis points
  marqués — mis à jour en direct à chaque saisie.
- **Phases finales après les rondes** (manuel §3.D.15) : le classement bascule
  en élimination directe dans le même concours, sans export intermédiaire. Les
  deux configurations fédérales sont proposées — 1/8 A + 1/8 B, ou 1/4 A + 1/4 B
  + 1/4 C : chaque tranche du classement joue son propre concours. Égalités
  départagées par confrontation directe, et interversion à la main de ce qu'elle
  ne tranche pas.
- **Inscriptions** : équipes numérotées, joueurs avec n° de licence optionnel,
  club, forfaits, verrouillage après tirage — avec un **mode modification**
  (manuel §3.B.8) pour remplacer ou ajouter un joueur après le tirage sans y
  toucher : ni les dossards, ni les places au tableau.
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

### Organisation d'une journée
- **Catégories & vue « journée »** : catégorie par concours — dérivée des
  critères fédéraux quand ils existent (« Féminin Vétérans Promotion »), texte
  libre sinon —, tableau de bord regroupé par date avec filtre par catégorie —
  pratique quand un club enchaîne plusieurs concours le même jour.
- **Fractionnement multisite** (manuel §3.B.10.D) : un concours qu'un seul
  boulodrome ne peut accueillir se coupe en un concours par site. Les effectifs
  suivent les terrains de chaque site, les équipes d'un même club restent
  ensemble, les dossards sont conservés et le concours d'origine est archivé
  comme trace.
- **Archivage** (manuel §3.F.3) : un concours rangé sort de la liste courante
  et du palmarès sans rien perdre, et revient d'un clic. Le palmarès annonce
  toujours combien de concours archivés il laisse de côté — un vainqueur ne
  disparaît pas en silence.
- **Import d'une liste d'inscrits** (manuel §3.B.10.B) : reprendre en CSV la
  liste d'un autre concours — l'export « 📋 Engagés » de l'application se
  réimporte tel quel, dossards, licences, clubs, forfaits et règlements
  compris. Une colonne par joueur est acceptée aussi, pour un tableur fait à la
  main. Dans un concours vide, les dossards du fichier sont conservés ; sinon
  les équipes s'ajoutent à la suite.
- **Pré-inscriptions en ligne** : les équipes s'inscrivent elles-mêmes via
  le lien public (« ✍️ Je m'inscris ») ; l'organisateur valide d'un clic à
  la table de marque.
- **Statistiques des poules** (manuel §3.D.1.G) : la synthèse de ce qui n'est
  pas fini, la poule qui attend depuis le plus longtemps en tête, et les
  barrages qui retiennent leur poule. Sur trente poules, c'est ce qui permet de
  trouver la retardataire sans tout parcourir.
- **Plan des terrains** : plateau libre/occupé en direct, affectation
  automatique des parties en attente aux terrains libres, libération à la
  saisie du score.
- **Têtes de série** : au tirage, désigner les meilleures équipes pour les
  répartir dans des poules / moitiés de tableau différentes.

### Championnat des clubs (mode fédéral)
- **Contrôle des compositions** (manuel §3.E) : les cinq compétitions de clubs
  ont leur filtre prédéfini — Coupe de France, CNC/CRC/CDC Open, Féminin,
  Jeunes, Vétérans — avec les contingents de mutés et de joueurs hors Union
  européenne. Une nationalité illisible n'exclut personne.
- **Feuille de match** : la feuille remplie à la main aujourd'hui — composition
  des deux équipes, ordre des rencontres, scores et signatures. Les points ne
  se saisissent pas : ils découlent du vainqueur et du type de partie
  (tête-à-tête, doublette, triplette), et l'application vérifie l'invariant que
  la feuille rappelle en en-tête — **la somme des deux totaux est connue
  d'avance** (36 points sur la feuille du CD26). Une feuille fausse se voit
  avant d'être signée. Le barème est une donnée : il varie d'un comité à
  l'autre.
- **Échange des compositions entre les deux clubs** : le club visiteur montre un
  QR code, l'hôte le scanne, et les huit lignes de l'équipe adverse se
  remplissent avec les numéros de licence — au lieu d'être recopiées à la main
  alors que l'autre club les a déjà saisies et contrôlées chez lui. Rien ne
  passe par le réseau ni par un compte commun : au boulodrome il n'y a souvent
  ni l'un ni l'autre. Le code est du texte lisible, donc recopiable si une
  caméra fait défaut.
- **Une feuille par rencontre, synchronisée** : les feuilles sont des entités
  répliquées, pas un brouillon d'appareil. Elles se retrouvent sur les autres
  tablettes du club, survivent à la perte de l'une d'elles, et se conservent
  d'une rencontre à l'autre.
- **Signature des capitaines dans l'application** : chacun signe au doigt sur
  la tablette. Signer **verrouille la feuille** — plus rien n'est modifiable —
  et une **empreinte du contenu signé** est imprimée à côté des signatures. Si
  la feuille est modifiée après coup, l'empreinte ne correspond plus à celle de
  l'exemplaire signé, et l'application le dit. Corriger exige d'effacer
  explicitement les signatures, jamais en silence. Une feuille en anomalie n'est
  pas signable du tout.
- **Sauvegarde en fichier** : une feuille s'exporte en JSON autonome, signatures
  comprises, et se réimporte — pour l'archiver, la transmettre, ou la reprendre
  sur un appareil qui n'a pas le compte du club. Elle arrive toujours **à côté**
  des existantes, jamais par-dessus, et l'empreinte du contenu signé reste
  vérifiable après l'aller-retour. Les deux imports — concours et feuille —
  reconnaissent le fichier de l'autre et le disent.
- **Retour au comité** : courriel préparé (objet, résultat, remarques) auquel
  joindre la feuille signée — ou dépôt sur le site du comité. C'est la signature
  qui fait foi.

### Prise en main
- **Création guidée en 3 étapes** : des cartes de formules en langage
  courant (« le classique des concours officiels », « idéal club & amis —
  chacun pour soi »…), la formation illustrée, puis un nom proposé
  automatiquement.
- **Tutoriel intégré** : écran de bienvenue à la première utilisation, visite
  guidée interactive (mise en lumière des éléments de l'interface) et
  **concours d'exemple** pré-rempli pour s'entraîner sans risque.
- **Bandeau « prochaine étape »** : chaque concours indique en permanence où
  vous en êtes et quoi faire ensuite (inscriptions → tirage → scores →
  tableau → clôture).
- **Assistant intégré** 💬 : une vingtaine de guides pas-à-pas (tirer les
  poules, corriger un score, consolante, forfait, affichage TV, hors-ligne…),
  recherche par mots-clés tolérante aux accents, boutons de navigation
  contextuelle — entièrement **hors-ligne**, aucun service externe.
- **Version affichée en pied de page** (numéro, commit, date de compilation,
  injectés au build) : de quoi savoir ce que la tablette exécute vraiment.
- **Pop-up « Nouveautés »** après une mise à jour : l'application se remplace
  silencieusement (PWA en mise à jour automatique), la pop-up fait le tour
  d'horizon de ce qu'elle a gagné, avec un bouton pour aller voir. Les versions
  sautées sont cumulées en une seule fenêtre ; le tour d'horizon se rouvre
  depuis le pied de page ou l'assistant (« Quoi de neuf ? »).

### Partage & auto-arbitrage
- **Lien public** par concours (révocable, avec **QR code** à afficher au
  boulodrome) avec **deux parcours** : *« Je joue »* (on saisit son numéro
  d'équipe et on ne voit que sa partie, sa déclaration, ses notifications)
  et *« Je consulte »* (affichage complet en direct), sans compte.
- **Notifications push** : une équipe s'abonne par son numéro et reçoit une
  alerte sur son téléphone à chaque convocation (barrage, tour suivant…) —
  même application fermée. La table de marque n'a rien à faire : les
  convocations sont détectées côté client et relayées par le serveur
  (Web Push / VAPID, dédupliqué par partie).
- **Auto-déclaration des scores** : une équipe déclare, l'adversaire
  confirme depuis son propre téléphone ; la table de marque voit les
  déclarations **concordantes** et les applique en un clic (elle reste
  seule décisionnaire).
- **Licenciés** : import CSV (Nom/Prénom/Licence/Club), autocomplétion aux
  inscriptions, mise à jour sans doublons.
- **Feuilles imprimables** : feuilles de poules officielles et tickets de
  parties à distribuer.
- **Multi-organisateurs** : codes d'invitation (7 jours) pour rejoindre le
  club, liste des membres.
- **Tir de précision** : séries de 20 boules (100 pts max), classement à la
  meilleure série. **Indemnités** : répartition suggérée du pot par groupe
  de classement.

### SaaS & hors-ligne
- **Comptes club (multi-tenant)** : chaque organisation a ses concours, ses
  utilisateurs et son journal de modifications.
- **Mode invité** : tout essayer **sans créer de compte** — les données
  restent sur l'appareil ; à la création d'un compte, l'application propose
  de **rattacher les concours invité** (ils sont alors poussés au serveur).
- **Stockage persistant** : `navigator.storage.persist()` est demandé au
  démarrage pour interdire au navigateur de purger les données locales.
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

Le client n'acquitte que ce que le serveur a **accepté** : une entité refusée
reste en attente et visible au compteur, plutôt que d'être crue synchronisée
alors qu'elle n'est nulle part. Les deux décisions qui gouvernent la réplication
— « ce changement remplace-t-il l'état local ? » et « cet envoi est-il
acquitté ? » — vivent dans `shared/src/engine/replication.ts`, où elles sont
testées.

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

## Publier une nouveauté

Livrer quelque chose que l'utilisateur verra, c'est deux gestes :

1. ajouter un point dans `client/src/help/nouveautes.ts`, sous la version en
   cours (ou une nouvelle entrée de version) ;
2. monter le `version` du `package.json` racine.

C'est le **journal** qui déclenche la pop-up, pas le `package.json` : un oubli
de bump ne rend pas la détection muette, il fait seulement mentir l'étiquette du
pied de page. La version retenue est toujours la plus haute que le journal
publie, et l'ordre du tableau n'a pas d'importance (`recapNouveautes` trie).

## Tests

- `shared/` : 417 tests Vitest couvrant la répartition des poules, le
  déroulement 4/3 avec barrage, les corrections en cascade, le cadrage et les
  exempts, l'appariement premiers/seconds, la consolante alimentée par les
  perdants et les classements.
- Un test de bout en bout (Playwright) a validé le parcours complet :
  inscription club → visite guidée → assistant (réponse pas-à-pas) →
  concours → 7 équipes → poules → tableau → consolante → vainqueur →
  synchronisation serveur → **rechargement de l'application hors ligne**.

## Feuille de route

- Invitations multi-utilisateurs au sein d'un club, rôles (table de marque /
  lecture seule).
- Import du fichier des licenciés (CSV / Geslico) et recherche par n° de
  licence, lecteur code-barres.
- Concours « complémentaire », parties limitées au temps, tir de précision.
- Indemnités / répartition des mises, export PDF des feuilles de parties.
- Page publique de résultats (lien partageable sans compte).
- Durcissement SaaS : limitation de débit, Postgres, sauvegardes, RGPD.
