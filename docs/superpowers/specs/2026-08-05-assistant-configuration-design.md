# Assistant de configuration et niveau d'interface

**Date :** 2026-08-05

## Problème

Le logiciel couvre désormais tout le manuel FFPJP : licences, critères
officiels, protections de clubs, formules par groupes, retirage par tour,
multisite, indemnités, documents remis au comité. Cette complétude est une
qualité pour un comité départemental, et un mur pour la personne qui organise
un concours entre amis un dimanche.

Le `mode fédéral` traite déjà une partie du problème — il masque les licenciés,
le championnat des clubs, les critères officiels et les documents du comité —
mais il s'arrête là. Restent visibles pour tout le monde : les mises et les
indemnités, six cases de formule que personne ne comprend sans le manuel, les
protections de clubs au tirage, le multisite et les décalages de numérotation.

Et surtout, il n'existe aucun réglage persistant. Les six clés `localStorage`
sont `session`, `deviceId`, `modeFederal`, `welcomeDone`, `nouveautesVue`,
`demenagementVu` : rien ne retient que ce boulodrome a huit terrains, qu'on y
joue en doublette et qu'il n'y a pas de mise. L'organisateur retape ces valeurs
à chaque concours.

## Décision

Un assistant de configuration en trois écrans à la première ouverture — compte
ou mode invité, sans différence — qui règle deux choses : **ce que
l'application montre** et **ce qu'elle pré-remplit**. Et une section de
réglages qui permet de le relancer ou de reprendre chaque valeur à la main.

Le `mode fédéral` n'est pas conservé à côté : il devient une des trois valeurs
du nouveau réglage.

## La règle qui tient tout

> Le niveau d'interface ne change que l'affichage, jamais le comportement.

Cette phrase est déjà en tête de `client/src/lib/modeFederal.ts`. Elle devient
la règle du système, et trois mécanismes la font respecter :

1. **Aucun moteur n'est touché.** `shared/src/engine/` continue de calculer les
   licences, les indemnités et les formules à l'identique. Un concours déclaré
   officiel contrôle ses licences que le niveau soit `amical` ou `federal`.
2. **On ne masque jamais ce qui est déjà utilisé.** La porte de visibilité prend
   le concours en argument : un concours qui porte une `miseParEquipe` garde son
   bloc mises même en `amical` ; un concours en `parGroupes` garde ses formules.
3. **L'heuristique remonte le niveau d'elle-même**, tant qu'aucun choix
   explicite n'a été fait. On ne cache pas en silence une fonction dont
   quelqu'un se sert déjà.

S'ajoute une garantie visible plutôt que structurelle : le bouton `⚙` du tableau
de bord porte le niveau courant (`⚙ Entre amis`). « Où est passé X » a une
réponse à un clic.

## Le modèle

### `niveauInterface` — trois valeurs

```
amical   → concours entre amis : ni argent, ni club, ni formule savante
club     → concours du club : mises, indemnités, clubs des équipes, protections
federal  → concours officiels : licences, critères, championnat, documents comité
```

La mécanique à trois états de `modeFederal` est conservée telle quelle, parce
qu'elle est correcte : un choix explicite de l'utilisateur, sinon l'heuristique,
plus un retour explicite à l'automatique.

**Migration de la clé existante `petanque.modeFederal`** — elle est lue une fois
puis remplacée par `petanque.niveauInterface` :

| Ancienne valeur | Nouveau niveau | Raison |
|---|---|---|
| `'1'` | `federal` | l'utilisateur avait demandé le mode fédéral |
| `'0'` | `club` | il avait refusé le fédéral, pas l'argent ni les clubs |
| absente | (aucun choix explicite) | l'heuristique décide, comme avant |

**Ce que la migration ne garantit pas, et il faut le dire.** Un utilisateur
existant qui n'avait jamais touché au mode fédéral tombe sous l'heuristique — et
celle-ci peut le placer en `amical`, où quatre domaines aujourd'hui visibles
deviennent masqués. Ce n'est acceptable que grâce à la clause de sûreté : elle ne
le place en `amical` que si rien dans ses données ne porte de trace d'argent, de
club d'équipe, de protection, de formule avancée ni de multisite. Il ne perd donc
la vue d'aucune fonction dont il se sert. Le seul cas rugueux est celui de
quelqu'un qui s'apprêtait à saisir sa première mise : le bouton `⚙ Entre amis` du
tableau de bord est sa réponse, en un clic.

Épingler ces installations à `club` par précaution a été écarté : cela priverait
définitivement du bénéfice ceux à qui il est destiné, pour couvrir un cas que
l'heuristique couvre déjà.

### `defauts` — les valeurs des nouveaux concours

```ts
interface DefautsConcours {
  nbTerrains: number;
  scoreMax: number;
  format: TeamFormat;
  consolante: boolean;
  miseParEquipe?: number;
}
```

Ce sont exactement les champs que le `CreateConcoursWizard` demande à chaque
création et dont la réponse ne change jamais d'un concours à l'autre. Rien de
plus : la date, le nom, le lieu et la formule sont propres à chaque concours et
n'ont pas de défaut utile.

### Répartition dans le dépôt

Elle suit celle qui existe : `besoinModeFederal` est un calcul pur dans
`shared/engine/federal.ts`, le stockage et le hook sont dans
`client/lib/modeFederal.ts`.

| Fichier | Rôle | Statut |
|---|---|---|
| `shared/src/engine/profil.ts` | `NiveauInterface`, `besoinNiveau()`, `montrer()`, `defautsDuProfil()` — tout le raisonnement, pur et testable | nouveau |
| `shared/src/engine/federal.ts` | `besoinModeFederal` devient un cas particulier appelé par `besoinNiveau` | modifié |
| `client/src/lib/niveauInterface.ts` | localStorage, hook `useNiveauInterface`, migration | remplace `modeFederal.ts` |
| `client/src/lib/defauts.ts` | lecture/écriture des valeurs par défaut | nouveau |

## `montrer()` — la porte unique

Une seule fonction décide de toute visibilité conditionnelle de l'application.
Le raisonnement est à un seul endroit ; les composants ne font que l'appeler.

```ts
type Domaine =
  // masqués en dessous de `federal` — comportement actuel du mode fédéral
  | 'licencies' | 'championnatClubs' | 'criteresOfficiels' | 'documentsComite'
  // masqués en `amical` — nouveaux
  | 'argent' | 'formulesAvancees' | 'protections' | 'multisite';

function montrer(
  domaine: Domaine,
  ctx: { niveau: NiveauInterface; concours?: ParamsUsage },
): boolean;
```

`ParamsUsage` est un sous-ensemble de `Concours` : les seuls champs qui prouvent
qu'un domaine est déjà utilisé. Le paramètre est facultatif parce que les
surfaces du tableau de bord (lien Licenciés, lien Championnat des clubs) n'ont
pas de concours en contexte.

**La clause de sûreté, domaine par domaine.** `montrer` rend `true` dès que le
niveau l'autorise **ou** que le concours porte déjà une trace d'usage :

| Domaine | Niveau minimum | Trace d'usage qui force l'affichage |
|---|---|---|
| `argent` | `club` | `miseParEquipe`, `fraisPct` ou `indemnitesJusquAuRang` renseignés |
| `formulesAvancees` | `club` | `retirageParTour`, `tirageDiffere`, `ggStrict`, `parGroupes`, `recupCadrage` ou `complementaire` vrais |
| `protections` | `club` | `protections` non vide |
| `multisite` | `club` | `issuDeConcours` renseigné, `decalageEquipe` ou `decalageTerrain` non nuls |
| `licencies`, `championnatClubs`, `criteresOfficiels`, `documentsComite` | `federal` | `estConcoursOfficiel(concours)` — inchangé |

## `besoinNiveau()` — l'heuristique

Elle généralise `besoinModeFederal` et rend le niveau que le contenu du club
suggère, du plus élevé au plus bas :

```ts
function besoinNiveau(p: {
  concours: ParamsUsage[];
  licencies: number;
  /** Au moins une équipe inscrite porte un club. */
  clubsSurEquipes: boolean;
}): NiveauInterface;
```

`clubsSurEquipes` est passé plutôt que la liste des équipes : le calcul n'a
besoin que du booléen, et la liste complète des équipes de tous les concours
n'a pas à traverser une frontière de module pour cela. Côté client, un hook
`useClubsSurEquipes()` le produit — une requête sur `db.entities` de type
`team`, du même genre que le `useTeamCounts` de `DashboardPage`.

```
federal  si un fichier de licenciés est importé
         ou si un concours est officiel (estConcoursOfficiel — inchangé)
club     si une équipe porte un club
         ou si un concours porte une mise, des frais ou des indemnités
         ou si un concours porte des protections
         ou si un concours porte des formules avancées ou du multisite
amical   sinon
```

**Piège à ne pas confondre**, et c'est la raison d'être de cette ligne :
`estConcoursOfficiel` teste `concours.clubOrganisateur` — le club organisateur,
un champ fédéral — tandis que la promotion vers `club` teste `team.club`, le
club d'une équipe inscrite. Ce sont deux champs différents dans deux entités
différentes. Saisir le club d'une équipe ne doit pas promouvoir en `federal`.

Le niveau effectif reste `preference ?? besoinNiveau(...)`, comme aujourd'hui.

## L'assistant — trois écrans, contournable

Il remplace `WelcomeModal` et en absorbe le contenu. Il s'ouvre à la première
ouverture (clé `welcomeDone` réutilisée telle quelle, donc les utilisateurs
existants ne le revoient pas) et se relance depuis les réglages.

**Écran 1 — le profil.** Trois cartes au style des `mode-cards` du
`CreateConcoursWizard` : emoji, titre, une ligne de ce que le niveau montre,
une ligne de ce qu'il masque. Le masquage est annoncé, jamais subi.

```
🎉 Entre amis            🏆 Mon club              📋 Concours officiels
Concours du dimanche     Concours du club avec    Licences, critères,
entre copains.           mises et indemnités.     documents du comité.
Masque l'argent, les     Masque les licences et   Tout est affiché.
formules savantes,       les documents du
les protections et       comité.
le multisite.
```

**Écran 2 — deux questions concrètes**, déjà pré-remplies par le profil : les
terrains habituels et la formation habituelle. Sur `club` et `federal`, un
troisième champ : la mise par équipe.

**Écran 3 — la prise en main.** Le contenu actuel du `WelcomeModal` : visite
guidée (`demarrerParcours(parcoursDecouverte)`), concours d'exemple
(`createDemoConcours`), ou entrer directement.

`Plus tard` est présent sur les trois écrans. Il marque `welcomeDone` sans
enregistrer de préférence : l'heuristique reprend la main, et l'utilisateur se
retrouve dans l'état d'aujourd'hui. Contourner l'assistant ne dégrade rien.

**Mode invité :** rigoureusement identique. Tout est en `localStorage`, il n'y a
pas de second chemin à écrire.

**Valeurs par défaut de `defautsDuProfil`** — le point de départ de l'écran 2,
et le défaut appliqué si l'assistant est contourné :

| | `amical` | `club` | `federal` |
|---|---|---|---|
| `nbTerrains` | 4 | 8 | 8 |
| `scoreMax` | 13 | 13 | 13 |
| `format` | `doublette` | `doublette` | `doublette` |
| `consolante` | `true` | `true` | `true` |
| `miseParEquipe` | absent | absent | absent |

La mise reste absente même en `club` : la proposer chiffrée serait inventer un
tarif. C'est un champ de l'écran 2, pas une valeur devinée.

## La section « Paramètres par défaut »

`ReglagesModal` passe de 61 lignes à un modal sectionné. Il reste un modal :
dans cette application, tous les réglages en sont (`ClubModal`,
`ProtectionsModal`, `MultisiteModal`).

**Niveau d'interface** — les trois cartes en format réduit, l'état courant mis
en évidence, la mention « réglé à la main » ou « choisi automatiquement » et le
bouton « Revenir au choix automatique » déjà présents. Les deux paragraphes
d'explication actuels sont conservés : ils disent exactement ce qu'il faut.

**Valeurs par défaut des nouveaux concours** — les cinq champs, modifiables un
par un, avec un bouton pour revenir aux valeurs du profil.

**Relancer l'assistant de configuration** — rouvre les trois écrans.

**Détail qui résout un cercle vicieux :** cet écran ne masque rien, mise
comprise. Un utilisateur en `amical` qui veut ses mises pose une mise par défaut
ici, et l'heuristique le promeut en `club`. Sans cela, il faudrait un
interrupteur par domaine — un second système, capable de contredire le premier.
C'est le seul endroit de l'application où un champ est visible quel que soit le
niveau, et c'est délibéré.

## Câblage — les fichiers touchés

Le remplacement de `useModeFederalActif()` par le nouveau hook est mécanique :
`ConcoursForm`, `DashboardPage`, `PoulesTab`, `ResultsTab`, `ReglagesModal`.

Les nouveaux domaines ajoutent un appel à `montrer()` dans :

| Domaine | Fichiers |
|---|---|
| `argent` | `CreateConcoursWizard`, `ConcoursForm`, `TeamsTab`, `ResultsTab` |
| `formulesAvancees` | `ConcoursForm`, `RondesTab`, `BracketTab`, `PoulesTab` |
| `protections` | `PoulesTab`, `BracketTab` |
| `multisite` | `ConcoursForm`, `ConcoursPage`, `TeamsTab` |

`client/src/db/hooks.ts` gagne `useNiveauInterfaceActif()` — qui remplace
`useModeFederalActif()` — et `useClubsSurEquipes()`. `DashboardPage` change en
plus le libellé de son bouton `⚙` pour y porter le niveau courant.

`PrintDocs` et `PrintPage` ne sont **pas** touchés : un document déjà produit ne
change pas de contenu parce que l'écran est simplifié, et les documents fédéraux
sont déjà conditionnés par le concours lui-même.

**Étape 1 du `CreateConcoursWizard`** — en `amical`, trois cartes de formule
(poules, élimination directe, mêlée) et un `Autres formules ▾` qui déplie
championnat, système suisse et tir de précision. C'est l'écran le plus vu de
l'application ; six cartes d'entrée y sont le plus gros contresens pour un
concours familial. Rien n'est retiré, seulement replié.

## Amélioration ciblée

`ConcoursForm.tsx` fait 957 lignes et reçoit quatre gardes de visibilité. Les
deux blocs qui sont précisément les unités masquées — le bloc argent et le bloc
formules avancées — sortent en composants dédiés. C'est le découpage que le
travail réclame, et il s'arrête là : le reste du formulaire n'est pas retouché.

## Tests

Le raisonnement étant pur, les tests portent sur `shared/engine/profil.ts` —
`shared/src/engine/__tests__/profil.test.ts` :

- `besoinNiveau` : chaque promotion, dans les deux sens, et la non-promotion
  d'un `team.club` vers `federal` (le piège documenté plus haut).
- `montrer` : pour les huit domaines, le niveau minimum **et** la clause de
  sûreté — le domaine s'affiche quand le concours en porte la trace.
- `defautsDuProfil` : les trois profils.
- Migration : les trois cas du tableau, dont l'absence de clé.

La conformité du portage est vérifiée par les tests existants de
`federal.test.ts`, que `besoinNiveau` ne doit pas faire tomber.

Vérification par sabotage, comme sur les travaux précédents du dépôt : chaque
clause de sûreté cassée doit faire tomber exactement un test.

## Découpage du travail

Quatre étapes, chacune vérifiable seule, dans cet ordre :

1. **`profil.ts` et la migration.** Le raisonnement pur, ses tests, le hook et
   le portage des cinq appels à `useModeFederalActif`. À l'issue de cette
   étape, l'application se comporte exactement comme aujourd'hui — les quatre
   nouveaux domaines ne sont pas encore branchés. C'est le filet : si la parité
   est fausse, elle se voit ici et nulle part ailleurs.
2. **Les quatre domaines.** Les appels à `montrer()` dans les onze fichiers, et
   l'extraction des deux blocs du `ConcoursForm`.
3. **L'assistant.** Les trois écrans, en remplacement du `WelcomeModal`, et le
   repli de l'étape 1 du `CreateConcoursWizard`.
4. **La section des réglages.** Le `ReglagesModal` sectionné et les valeurs par
   défaut à la main.

## Hors périmètre

- **Pas de synchronisation serveur des réglages.** Ils vivent sur l'appareil,
  comme `modeFederal`. Un co-organisateur qui rejoint le club refait l'assistant
  — trente secondes, et l'heuristique lui évite l'écran vide. Synchroniser
  imposerait une route serveur, un arbitrage entre organisateurs, et
  permettrait à l'un de changer l'affichage de la tablette d'un autre.
- **Pas d'interrupteur par domaine.** Le niveau suffit ; voir le cercle vicieux
  résolu plus haut.
- **Pas de profil personnalisé nommé.**
- **Aucun moteur de `shared/engine/` modifié**, hors l'ajout de `profil.ts` et
  le branchement de `besoinModeFederal`.
- **Pas de refonte du `ConcoursForm`** au-delà des deux blocs extraits.
