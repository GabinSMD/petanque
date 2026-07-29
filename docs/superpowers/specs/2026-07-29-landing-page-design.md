# Landing page publique du SaaS

**Date :** 2026-07-29

## Problème

Un visiteur qui découvre l'application tombe directement sur `/login` : un
formulaire de connexion, deux onglets et un bouton « Essayer sans compte ».
Rien ne lui dit ce que fait le logiciel, à qui il s'adresse, ni pourquoi il
serait meilleur que le tableur qu'il utilise aujourd'hui — et surtout rien ne
lui dit ce qui fait sa singularité : **tout fonctionne sans réseau au
boulodrome**.

Le README raconte tout cela, mais personne ne lit un README avant d'essayer un
logiciel de club.

## Décision

Une page vitrine en français, servie sur `/` aux visiteurs sans session, écrite
dans la voix du produit — concrète, ancrée dans le jour de concours, sans
jargon SaaS.

Pas de section tarifs : aucune facturation n'existe dans le code, et rien ne
sera annoncé qu'il faudrait retirer ensuite. Les deux appels à l'action sont
« Essayer sans compte » et « Créer un compte club ».

## Routage

`/` reste le tableau de bord pour un utilisateur connecté. C'est une contrainte,
pas une préférence : le `start_url` du manifeste PWA, le raccourci
`/?nouveau=1`, le logo de l'en-tête, le `<Route path="*">` et une dizaine de
`<Link to="/">` en dépendent tous. Déplacer le tableau de bord obligerait à
réécrire chacun d'eux et à préserver la chaîne de requête à travers une
redirection.

Le seul changement se fait donc dans `RequireAuth` (`client/src/App.tsx`) :

```
visiteur → /          → LandingPage
visiteur → /palmares  → /login          (inchangé)
connecté → /          → DashboardPage   (inchangé)
```

Sans session, la racine affiche la vitrine ; tout autre chemin protégé redirige
vers `/login` comme aujourd'hui. Aucune URL existante ne bouge.

Conséquence voulue : la vitrine s'affiche **hors du `Layout`**, donc sans
en-tête applicatif, sans badge de synchro, sans assistant. Elle porte sa propre
en-tête légère.

## Contenu

1. **En-tête vitrine** — logo boule, liseré tricolore, ancres de section,
   « Se connecter » et « Essayer sans compte ».
2. **Hero** — la promesse en une phrase (gérer un concours de A à Z, même sans
   réseau), les deux CTA, une capture du tableau final.
3. **Le hors-ligne** — le vrai différenciateur, expliqué franchement :
   l'interface lit et écrit d'abord dans le navigateur, la synchronisation
   attend le retour du réseau.
4. **Fonctionnalités** — grille : formules de jeu (poules puis élimination,
   A-B-C, mêlée tournante, système suisse, toutes rondes), poules FFPJP avec
   barrage et cadrage, correction en cascade des scores, affichage TV,
   impression, lien public avec QR code et notifications push, championnat des
   clubs et feuille de match signée, fichier des licenciés.
5. **Deux usages, une application** — mode fédéral contre concours amicaux.
6. **Le jour du concours** — quatre étapes : la veille au club, au boulodrome
   hors ligne, l'écran d'affichage, la synchronisation au retour du réseau.
7. **Captures** — deux à trois, légendées, prises en mode invité sur le
   concours d'exemple.
8. **FAQ** — faut-il un compte, où sont les données, est-ce gratuit, faut-il
   installer quelque chose, est-ce un logiciel officiel de la FFPJP.
9. **CTA final et pied de page** — dont la mention **« application
   indépendante, non affiliée à la FFPJP »**. Le code note déjà que le logo
   fédéral est une marque protégée ; une page publique qui met en avant la
   conformité au manuel fédéral a besoin de cette phrase.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `client/src/pages/LandingPage.tsx` | La page |
| `client/src/landing.css` | Ses styles, importés par la page |
| `client/public/vitrine/*.png` | Les captures |
| `client/src/App.tsx` | Trois lignes dans `RequireAuth` |

Les styles de la vitrine vivent dans leur propre fichier : `styles.css` fait
déjà 4 305 lignes, et une page publique qu'un utilisateur connecté ne voit
jamais n'a pas besoin d'y être. Elle réutilise en revanche les jetons existants
(`--accent`, `--terra`, `--radius`, `--shadow`) et les classes `.btn` : la
vitrine doit ressembler à l'application, pas à un thème acheté.

## Point de vigilance

`globPatterns` du service worker (`client/vite.config.ts`) précache tous les
`png`. Les captures y entreraient et alourdiraient le cache de l'application
pour des images qu'un utilisateur connecté ne reverra jamais. Elles sont donc
gardées légères (largeur ~1200, PNG optimisé) et le poids total est vérifié
après coup ; au-delà du raisonnable, elles seront exclues du précache.

## Vérification

- `npm run typecheck` et `npm run build` passent.
- La page se rend hors session sur `/`, en 1280 px et en 375 px.
- Un utilisateur connecté voit toujours son tableau de bord sur `/`.
- `/palmares` sans session redirige toujours vers `/login`.
