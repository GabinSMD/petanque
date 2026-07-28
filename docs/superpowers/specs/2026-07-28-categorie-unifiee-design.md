# Catégorie unifiée d'un concours (issue #33)

**Date :** 2026-07-28
**Issue :** [#33](https://github.com/GabinSMD/petanque/issues/33) — « Catégorie du concours : un seul champ au lieu de deux »

## Problème

Un concours porte aujourd'hui deux notions de catégorie qui se saisissent
séparément et peuvent se contredire :

- `category?: string` — texte libre (datalist `CATEGORY_SUGGESTIONS`), utilisé
  pour l'affichage, le regroupement au tableau de bord et le palmarès.
- Trois critères fédéraux normalisés, utilisés pour le contrôle des licences :
  `categorieAge` (âge, §3.C), `critereSexe`, `critereClassification`.

Le texte libre empiète sur les trois critères : ses suggestions mélangent
l'âge (« Vétérans »), le sexe (« Féminines ») et la classification
(« Promotion », « Honneur »). Sur un concours fédéral, la désignation affichée
peut donc contredire les critères qui pilotent réellement le contrôle des
licences — le logiciel n'est pas fédéral proof.

## Contrainte directrice

Le logiciel doit rester **100 % fédéral proof** : un concours fédéral doit se
désigner exactement par ses critères normalisés. Le texte libre est une
commodité réservée au **non-fédéral** (hors nomenclature : Open, Mixte, noms
maison…).

## Décision

**Source unique du libellé de catégorie = les critères fédéraux quand ils
existent, sinon le texte libre.**

Les critères fédéraux ne sont persistés que lorsque le toggle « officiel » du
formulaire est actif (voir `ConcoursForm.submit`, `shared`… champs gated). Par
construction, le libellé composé ne concerne donc que les concours fédéraux ;
le texte libre reste maître pour le non-fédéral.

## Conception

### 1. Helper de dérivation — `designationCategorie(concours)`

Nouveau helper, source unique du libellé affiché / de regroupement / de
palmarès.

**Écart assumé par rapport au premier jet de cette spec** : il est implémenté
dans `shared/src/engine/federal.ts` et non dans `client/src/lib/labels.ts`.
Raison : `npm test` ne couvre que le workspace `shared` — il n'existe pas de
runner côté client. Une règle de nomenclature fédérale doit être testée, donc
elle vit dans le moteur, à côté de `nomConcoursFederal` qui compose déjà les
désignations fédérales. Les tables de libellés courts y sont privées ; le client
n'appelle que le helper.

Logique :

```
categoryLabel(c):
  parts = []
  si c.critereSexe && c.critereSexe !== 'tous'                   → parts += LIBELLE_SEXE_COURT[c.critereSexe]
  si c.categorieAge                                              → parts += LIBELLE_AGE_COURT[c.categorieAge]
  si c.critereClassification && c.critereClassification !== 'tous' → parts += LIBELLE_CLASSIF_COURT[c.critereClassification]
  si parts non vide → parts.join(' ')      // ex. "Féminin Vétérans Promotion"
  sinon             → c.category           // texte libre (non fédéral)
  // les deux vides → undefined (aucune catégorie)
```

Ordre du libellé : **[Sexe] [Âge] [Classification]**. Exemples : « Féminin
Vétérans Promotion », « Séniors », « Mixte Élite ».

Tables de libellés **courts** à ajouter dans `labels.ts` (les tables
existantes `CATEGORIE_AGE_LABELS` / `CRITERE_SEXE_LABELS` sont verbeuses —
« Vétérans (60 ans et plus) », « Mixte (au moins 1 homme et 1 femme) » — donc
inadaptées à un tag) :

- `CATEGORIE_AGE_LABELS_COURTS`: veterans→Vétérans, seniors→Séniors,
  juniors→Juniors, cadets→Cadets, minimes→Minimes, benjamins→Benjamins.
- `CRITERE_SEXE_LABELS_COURTS`: masculin→Masculin, feminin→Féminin,
  mixte→Mixte (tous : omis).
- Classification : les valeurs non-`tous` de `CRITERE_CLASSIFICATION_LABELS`
  sont déjà courtes (Élite / Honneur / Promotion) — réutilisées telles quelles.

### 2. Consommateurs — remplacer `category` brut par `categoryLabel(c)`

Tous les points d'affichage / regroupement basculent sur le helper :

- `client/src/pages/DashboardPage.tsx:59` — set des catégories du filtre.
- `client/src/pages/DashboardPage.tsx:63` — filtrage par catégorie sélectionnée.
- `client/src/pages/DashboardPage.tsx:177` — tag `tag-cat` de la carte.
- `client/src/pages/PalmaresPage.tsx:137-138` — tag `tag-cat` du palmarès.
- `client/src/pages/ConcoursPage.tsx:114` — suffixe « · {catégorie} » du titre.
- `client/src/lib/export.ts:176` — ligne de résumé (`concoursSummaryLine`).

Le regroupement du tableau de bord se fait donc sur le libellé dérivé :
plus de coexistence « Vétérans » (texte) / « seniors » (âge).

### 3. Formulaire — `ConcoursForm`

- Le champ texte « Catégorie » (actuellement `ConcoursForm.tsx:179-192`)
  devient **lecture seule** dès qu'un critère fédéral est renseigné
  (`officiel && (categorieAge !== '' || critereSexe !== 'tous' ||
  critereClassification !== 'tous')`). Il affiche alors le libellé dérivé,
  grisé, avec la mention « dérivée des critères fédéraux ».
- Tant qu'aucun critère fédéral n'est posé (non-fédéral, ou officiel sans
  critère encore choisi), le champ texte reste l'unique saisie éditable,
  comme aujourd'hui.

### 4. Persistance — `ConcoursForm.submit`

À l'enregistrement, si au moins un critère fédéral est effectivement persisté
(`categorieAge`, ou `critereSexe`/`critereClassification` ≠ leur valeur neutre,
sous condition `officiel`), alors `category` est mis à `undefined`.

Conséquence : la sauvegarde JSON ne peut plus contenir de désignation texte
contradictoire avec les critères fédéraux — base 100 % cohérente. Le texte
libre n'est stocké que pour les concours sans critère fédéral.

`CreateConcoursWizard` n'écrit que `category` (jamais les critères fédéraux) :
inchangé, il produit toujours du non-fédéral cohérent.

## Tests

Unitaires sur le helper (`shared/src/engine/__tests__/federal.test.ts`) :

- âge seul → libellé court (« Séniors »).
- sexe + âge + classification → composé ordonné (« Féminin Vétérans Promotion »).
- sexe/classification à `tous` → omis.
- aucun critère fédéral, texte libre → renvoie le texte libre.
- aucun critère + pas de texte → `undefined`.

Logique de persistance : si testable hors composant, vérifier qu'un critère
fédéral posé ⇒ `category` non persistée ; sinon, couverture manuelle du
formulaire.

## Hors périmètre (YAGNI)

- Pas de migration rétroactive des concours déjà en base : la dérivation à
  l'affichage neutralise déjà l'incohérence visible ; l'effacement s'applique au
  prochain enregistrement de chaque concours.
- Pas de refonte de `CATEGORY_SUGGESTIONS` ni du gating « officiel ».
- Pas de composition dans les documents fédéraux imprimés au-delà de la ligne
  de résumé existante.
