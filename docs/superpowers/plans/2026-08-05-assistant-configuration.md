# Assistant de configuration et niveau d'interface — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le booléen `modeFederal` par un niveau d'interface à trois valeurs (`amical` / `club` / `federal`), ajouter des valeurs par défaut persistées pour les nouveaux concours, un assistant de configuration en trois écrans contournable à la première ouverture, et une section de réglages pour le relancer ou reprendre chaque valeur à la main.

**Architecture:** Tout le raisonnement est une fonction pure dans `shared/src/engine/profil.ts` — `montrer(domaine, ctx)` est la porte unique de toute visibilité conditionnelle, `besoinNiveau()` l'heuristique. Le client n'y ajoute que la plomberie `localStorage` (`client/src/lib/niveauInterface.ts`, `client/src/lib/defauts.ts`) et les appels dans les composants. Aucun moteur de calcul n'est modifié : le niveau ne change que l'affichage.

**Tech Stack:** TypeScript, React 18, Vite, Dexie (IndexedDB), vitest (paquet `shared` uniquement), monorepo npm workspaces (`shared` / `client` / `server`).

**Spec:** [`docs/superpowers/specs/2026-08-05-assistant-configuration-design.md`](../specs/2026-08-05-assistant-configuration-design.md)

## Global Constraints

- **Langue :** tout le code, les commentaires, les noms de symboles et le texte d'interface sont en **français**, comme le reste du dépôt. Les commentaires expliquent *pourquoi*, pas *quoi* — relire `client/src/lib/modeFederal.ts` pour le ton.
- **La règle inviolable :** le niveau d'interface ne change que l'affichage, jamais le comportement. **Aucun fichier de `shared/src/engine/` n'est modifié** hors l'ajout de `profil.ts` et l'export dans `index.ts`.
- **`PrintDocs.tsx` et `PrintPage.tsx` ne sont touchés par aucune tâche.** Un document déjà produit ne change pas de contenu parce que l'écran est simplifié, et les documents fédéraux sont déjà conditionnés par le concours lui-même. Ne pas y ajouter d'appel à `montrer()`.
- **Clause de sûreté :** on ne masque jamais ce qui est déjà utilisé. Chaque appel à `montrer()` qui dispose d'un concours en contexte **doit** le passer.
- **Tests :** seul le paquet `shared` porte vitest. `npm test` à la racine ne lance que `shared`. Aucun test ne peut être écrit pour du code de `client/` — d'où le déport de toute décision dans `profil.ts`.
- **Commandes de vérification** (depuis la racine du dépôt) :
  - `npm test` — les tests de `shared`
  - `npm run typecheck` — les trois paquets
  - `npm run build` — les trois paquets
- **Vérification navigateur** (tâches 5 à 11) : `mcp__Claude_Browser__preview_start`, puis lire le DOM avec `read_page` / `get_page_text`. Deux pièges connus du dépôt : `getBoundingClientRect` mentira si le volet est replié — lire le style inline ; et filtrer la console sur la version de module courante.
- **Commits :** un par tâche, message en français, sujet à l'impératif, corps expliquant le pourquoi. Terminer par `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Valeurs par défaut, verbatim de la spec :** `amical` → 4 terrains ; `club` et `federal` → 8 terrains. Partout : 13 points, `doublette`, `consolante: true`, `miseParEquipe` absent.
- **Migration, verbatim de la spec :** `petanque.modeFederal === '1'` → `federal`, `=== '0'` → `club`, absente → aucune préférence (l'heuristique décide).

---

### Task 1 : la porte de visibilité (`montrer`)

**Files:**
- Create: `shared/src/engine/profil.ts`
- Test: `shared/src/engine/__tests__/profil.test.ts`

**Interfaces:**
- Consumes: `estConcoursOfficiel(c: ParamsOfficiel): boolean` et `interface ParamsOfficiel` de `shared/src/engine/federal.ts` (lignes 256-273).
- Produces:
  - `type NiveauInterface = 'amical' | 'club' | 'federal'`
  - `type DomaineInterface = 'licencies' | 'championnatClubs' | 'criteresOfficiels' | 'documentsComite' | 'argent' | 'formulesAvancees' | 'protections' | 'multisite'`
  - `interface ParamsUsage extends ParamsOfficiel`
  - `domaineEnUsage(domaine: DomaineInterface, c: ParamsUsage): boolean`
  - `montrer(domaine: DomaineInterface, ctx: { niveau: NiveauInterface; concours?: ParamsUsage }): boolean`

- [ ] **Step 1 : écrire les tests qui échouent**

Créer `shared/src/engine/__tests__/profil.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { domaineEnUsage, montrer, type DomaineInterface, type ParamsUsage } from '../profil';

/** Les quatre domaines que le niveau « amical » masque. */
const DOMAINES_CLUB: DomaineInterface[] = [
  'argent',
  'formulesAvancees',
  'protections',
  'multisite',
];

/** Les quatre domaines que seul le niveau « federal » montre. */
const DOMAINES_FEDERAL: DomaineInterface[] = [
  'licencies',
  'championnatClubs',
  'criteresOfficiels',
  'documentsComite',
];

/** Un concours vierge : aucune trace d'usage d'aucun domaine. */
const VIERGE: ParamsUsage = {};

describe('montrer — le niveau minimum de chaque domaine', () => {
  it('en amical, masque les huit domaines conditionnels', () => {
    for (const d of [...DOMAINES_CLUB, ...DOMAINES_FEDERAL]) {
      expect(montrer(d, { niveau: 'amical' })).toBe(false);
    }
  });

  it('en club, montre les quatre domaines de club et masque les quatre fédéraux', () => {
    for (const d of DOMAINES_CLUB) expect(montrer(d, { niveau: 'club' })).toBe(true);
    for (const d of DOMAINES_FEDERAL) expect(montrer(d, { niveau: 'club' })).toBe(false);
  });

  it('en federal, montre les huit', () => {
    for (const d of [...DOMAINES_CLUB, ...DOMAINES_FEDERAL]) {
      expect(montrer(d, { niveau: 'federal' })).toBe(true);
    }
  });

  it('sans concours en contexte, un concours vierge ne change rien', () => {
    for (const d of DOMAINES_CLUB) {
      expect(montrer(d, { niveau: 'amical', concours: VIERGE })).toBe(false);
    }
  });
});

describe('montrer — la clause de sûreté : jamais masquer ce qui est utilisé', () => {
  it('argent : une mise, des frais ou un rang limite forcent l\'affichage', () => {
    for (const c of [
      { miseParEquipe: 5 },
      { fraisPct: 20 },
      { indemnitesJusquAuRang: 8 },
    ] satisfies ParamsUsage[]) {
      expect(montrer('argent', { niveau: 'amical', concours: c })).toBe(true);
    }
  });

  it('argent : une mise à zéro n\'est pas un usage', () => {
    expect(montrer('argent', { niveau: 'amical', concours: { miseParEquipe: 0 } })).toBe(false);
  });

  it('formulesAvancees : chacune des six options force l\'affichage', () => {
    for (const c of [
      { retirageParTour: true },
      { tirageDiffere: true },
      { ggStrict: true },
      { parGroupes: true },
      { recupCadrage: true },
      { complementaire: true },
    ] satisfies ParamsUsage[]) {
      expect(montrer('formulesAvancees', { niveau: 'amical', concours: c })).toBe(true);
    }
  });

  it('formulesAvancees : une option à false n\'est pas un usage', () => {
    expect(
      montrer('formulesAvancees', { niveau: 'amical', concours: { parGroupes: false } }),
    ).toBe(false);
  });

  it('protections : un groupe non vide force l\'affichage, une liste vide non', () => {
    expect(
      montrer('protections', { niveau: 'amical', concours: { protections: [['A', 'B']] } }),
    ).toBe(true);
    expect(montrer('protections', { niveau: 'amical', concours: { protections: [] } })).toBe(
      false,
    );
  });

  it('multisite : une origine ou un décalage force l\'affichage', () => {
    for (const c of [
      { issuDeConcours: 'c1' },
      { decalageEquipe: 100 },
      { decalageTerrain: 50 },
    ] satisfies ParamsUsage[]) {
      expect(montrer('multisite', { niveau: 'amical', concours: c })).toBe(true);
    }
  });

  it('multisite : un décalage à zéro n\'est pas un usage', () => {
    expect(montrer('multisite', { niveau: 'amical', concours: { decalageEquipe: 0 } })).toBe(
      false,
    );
  });

  it('domaines fédéraux : un concours officiel force l\'affichage même en amical', () => {
    // `niveau` déclenche estConcoursOfficiel — comportement inchangé.
    for (const d of DOMAINES_FEDERAL) {
      expect(montrer(d, { niveau: 'amical', concours: { niveau: 'departemental' } })).toBe(true);
    }
  });

  it('domaines fédéraux : le club d\'une équipe n\'est pas un concours officiel', () => {
    // Piège : `clubOrganisateur` est fédéral, `team.club` non — et il n'entre
    // pas dans ParamsUsage. Un concours vierge reste vierge.
    for (const d of DOMAINES_FEDERAL) {
      expect(montrer(d, { niveau: 'amical', concours: VIERGE })).toBe(false);
    }
  });
});

describe('domaineEnUsage', () => {
  it('rend false sur tous les domaines pour un concours vierge', () => {
    for (const d of [...DOMAINES_CLUB, ...DOMAINES_FEDERAL]) {
      expect(domaineEnUsage(d, VIERGE)).toBe(false);
    }
  });
});
```

- [ ] **Step 2 : lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -- profil`
Expected: FAIL — `Cannot find module '../profil'`

- [ ] **Step 3 : écrire `profil.ts`**

Créer `shared/src/engine/profil.ts` :

```ts
/**
 * Niveau d'interface : ce que l'application montre, jamais ce qu'elle fait.
 *
 * Le logiciel couvre tout le manuel FFPJP, et cette complétude est un mur pour
 * qui organise un concours entre amis. Trois niveaux règlent ce qui s'affiche —
 * et rien d'autre : aucun moteur de calcul ne lit ce réglage. Un concours
 * déclaré officiel contrôle ses licences que le niveau soit `amical` ou
 * `federal`.
 *
 * La règle qui rend le masquage acceptable est dans `montrer` : on ne masque
 * jamais ce dont le concours porte déjà la trace. Cacher une fonction dont
 * quelqu'un se sert est plus grave que lui montrer un écran de trop.
 */
import { estConcoursOfficiel, type ParamsOfficiel } from './federal';

export type NiveauInterface = 'amical' | 'club' | 'federal';

/** Les trois niveaux, du plus dépouillé au plus complet. */
export const NIVEAUX_INTERFACE: NiveauInterface[] = ['amical', 'club', 'federal'];

/**
 * Rang de richesse : chaque niveau montre tout ce que montre le précédent.
 * L'inclusion est volontaire — sans elle, « simplifier » pourrait retirer à un
 * comité une fonction qu'un club voit.
 */
const RANG: Record<NiveauInterface, number> = { amical: 0, club: 1, federal: 2 };

/** Les surfaces de l'application dont l'affichage dépend du niveau. */
export type DomaineInterface =
  // Masqués en dessous de `federal` — c'est le périmètre de l'ancien mode fédéral.
  | 'licencies'
  | 'championnatClubs'
  | 'criteresOfficiels'
  | 'documentsComite'
  // Masqués en `amical`.
  | 'argent'
  | 'formulesAvancees'
  | 'protections'
  | 'multisite';

const NIVEAU_MINIMUM: Record<DomaineInterface, NiveauInterface> = {
  licencies: 'federal',
  championnatClubs: 'federal',
  criteresOfficiels: 'federal',
  documentsComite: 'federal',
  argent: 'club',
  formulesAvancees: 'club',
  protections: 'club',
  multisite: 'club',
};

/**
 * Les seuls champs d'un concours qui prouvent qu'un domaine est déjà utilisé.
 * Volontairement plus étroit que `Concours` : ce module n'a pas à connaître le
 * reste, et la liste dit d'elle-même ce qui compte comme un usage.
 */
export interface ParamsUsage extends ParamsOfficiel {
  miseParEquipe?: number;
  fraisPct?: number;
  indemnitesJusquAuRang?: number;
  retirageParTour?: boolean;
  tirageDiffere?: boolean;
  ggStrict?: boolean;
  parGroupes?: boolean;
  recupCadrage?: boolean;
  complementaire?: boolean;
  protections?: string[][];
  issuDeConcours?: string;
  decalageEquipe?: number;
  decalageTerrain?: number;
}

/**
 * Ce concours porte-t-il la trace d'un usage de ce domaine ? Un zéro et un
 * `false` n'en sont pas : ce sont les valeurs qu'un champ prend quand personne
 * ne s'en est servi.
 */
export function domaineEnUsage(domaine: DomaineInterface, c: ParamsUsage): boolean {
  switch (domaine) {
    case 'argent':
      return Boolean(c.miseParEquipe || c.fraisPct || c.indemnitesJusquAuRang);
    case 'formulesAvancees':
      return Boolean(
        c.retirageParTour ||
          c.tirageDiffere ||
          c.ggStrict ||
          c.parGroupes ||
          c.recupCadrage ||
          c.complementaire,
      );
    case 'protections':
      return (c.protections?.length ?? 0) > 0;
    case 'multisite':
      return Boolean(c.issuDeConcours || c.decalageEquipe || c.decalageTerrain);
    case 'licencies':
    case 'championnatClubs':
    case 'criteresOfficiels':
    case 'documentsComite':
      return estConcoursOfficiel(c);
  }
}

/**
 * Faut-il afficher ce domaine ? La porte unique de toute visibilité
 * conditionnelle de l'application : le raisonnement est ici, les composants ne
 * font que l'appeler.
 *
 * `concours` est facultatif parce que les surfaces du tableau de bord — le lien
 * Licenciés, le lien Championnat des clubs — n'ont pas de concours en contexte.
 * Quand il existe, **il faut le passer** : c'est lui qui porte la clause de
 * sûreté.
 */
export function montrer(
  domaine: DomaineInterface,
  ctx: { niveau: NiveauInterface; concours?: ParamsUsage },
): boolean {
  if (RANG[ctx.niveau] >= RANG[NIVEAU_MINIMUM[domaine]]) return true;
  return ctx.concours ? domaineEnUsage(domaine, ctx.concours) : false;
}
```

- [ ] **Step 4 : lancer les tests pour vérifier qu'ils passent**

Run: `npm test -- profil`
Expected: PASS — 14 tests

- [ ] **Step 5 : vérification par sabotage**

Le dépôt vérifie ses clauses par sabotage. Pour chacune des quatre clauses de `domaineEnUsage`, la casser et vérifier qu'**exactement un** test tombe, puis rétablir :

| Sabotage | Test qui doit tomber |
|---|---|
| `case 'argent': return false;` | `argent : une mise, des frais ou un rang limite…` |
| retirer `c.tirageDiffere ||` | `formulesAvancees : chacune des six options…` |
| `case 'protections': return true;` | `protections : un groupe non vide…` |
| `Boolean(c.issuDeConcours)` seul | `multisite : une origine ou un décalage…` |

Rétablir le fichier après chaque essai. Si un sabotage ne fait tomber aucun test, ou en fait tomber plusieurs, la couverture est fausse — corriger les tests avant de continuer.

- [ ] **Step 6 : commit**

```bash
git add shared/src/engine/profil.ts shared/src/engine/__tests__/profil.test.ts
git commit -m "Niveau d'interface : la porte unique de visibilité

montrer() décide de tout affichage conditionnel, et sa clause de sûreté est ce
qui rend le masquage acceptable : un concours qui porte déjà une mise garde son
bloc mises même au niveau le plus dépouillé. Cacher une fonction dont quelqu'un
se sert est plus grave que montrer un écran de trop.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2 : l'heuristique, les défauts de profil et la migration

**Files:**
- Modify: `shared/src/engine/profil.ts` (ajouts en fin de fichier)
- Modify: `shared/src/engine/__tests__/profil.test.ts` (ajouts en fin de fichier)
- Modify: `shared/src/index.ts:40` (ajouter la ligne d'export après `export * from './engine/bornesParties';`)

**Interfaces:**
- Consumes: `domaineEnUsage`, `ParamsUsage`, `NiveauInterface` de la tâche 1 ; `besoinModeFederal(p: { concours: ParamsOfficiel[]; licencies: number }): boolean` de `./federal` ; `type TeamFormat` de `../types`.
- Produces:
  - `besoinNiveau(p: { concours: ParamsUsage[]; licencies: number; clubsSurEquipes: boolean }): NiveauInterface`
  - `interface DefautsConcours { nbTerrains: number; scoreMax: number; format: TeamFormat; consolante: boolean; miseParEquipe?: number }`
  - `defautsDuProfil(niveau: NiveauInterface): DefautsConcours`
  - `niveauDepuisAncienneCle(brut: string | null): NiveauInterface | null`
  - `estNiveauInterface(v: unknown): v is NiveauInterface`

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter à la fin de `shared/src/engine/__tests__/profil.test.ts`, et compléter la ligne d'import du haut du fichier pour qu'elle devienne :

```ts
import {
  besoinNiveau,
  defautsDuProfil,
  domaineEnUsage,
  estNiveauInterface,
  montrer,
  niveauDepuisAncienneCle,
  type DomaineInterface,
  type ParamsUsage,
} from '../profil';
```

```ts
describe('besoinNiveau — ce que le contenu du club suggère', () => {
  const RIEN = { concours: [], licencies: 0, clubsSurEquipes: false };

  it('amical quand rien ne réclame plus', () => {
    expect(besoinNiveau(RIEN)).toBe('amical');
    expect(besoinNiveau({ ...RIEN, concours: [{}, {}] })).toBe('amical');
  });

  it('federal dès qu\'un fichier de licenciés est importé', () => {
    expect(besoinNiveau({ ...RIEN, licencies: 1200 })).toBe('federal');
  });

  it('federal dès qu\'un concours est officiel', () => {
    expect(besoinNiveau({ ...RIEN, concours: [{}, { niveau: 'departemental' }] })).toBe('federal');
    expect(besoinNiveau({ ...RIEN, concours: [{ clubOrganisateur: 'Boule du Fort' }] })).toBe(
      'federal',
    );
  });

  it('club dès qu\'une équipe porte un club', () => {
    expect(besoinNiveau({ ...RIEN, clubsSurEquipes: true })).toBe('club');
  });

  it('le club d\'une équipe ne promeut pas en federal', () => {
    // Le piège du dépôt : estConcoursOfficiel teste `clubOrganisateur` — le
    // club organisateur du concours, un champ fédéral — et non `team.club`.
    // Confondre les deux ferait basculer en fédéral un simple club de village.
    expect(besoinNiveau({ ...RIEN, clubsSurEquipes: true })).not.toBe('federal');
  });

  it('club dès qu\'un concours porte l\'un des quatre domaines de club', () => {
    for (const c of [
      { miseParEquipe: 5 },
      { protections: [['A', 'B']] },
      { parGroupes: true },
      { decalageEquipe: 100 },
    ] satisfies ParamsUsage[]) {
      expect(besoinNiveau({ ...RIEN, concours: [c] })).toBe('club');
    }
  });

  it('federal l\'emporte sur club quand les deux sont réunis', () => {
    expect(
      besoinNiveau({ concours: [{ miseParEquipe: 5 }], licencies: 900, clubsSurEquipes: true }),
    ).toBe('federal');
  });
});

describe('defautsDuProfil', () => {
  it('amical part de quatre terrains, les deux autres de huit', () => {
    expect(defautsDuProfil('amical').nbTerrains).toBe(4);
    expect(defautsDuProfil('club').nbTerrains).toBe(8);
    expect(defautsDuProfil('federal').nbTerrains).toBe(8);
  });

  it('les autres valeurs ne dépendent pas du profil', () => {
    for (const n of ['amical', 'club', 'federal'] as const) {
      expect(defautsDuProfil(n)).toMatchObject({
        scoreMax: 13,
        format: 'doublette',
        consolante: true,
      });
    }
  });

  it('la mise n\'est jamais devinée', () => {
    // Proposer un tarif chiffré serait l'inventer. C'est un champ à saisir.
    for (const n of ['amical', 'club', 'federal'] as const) {
      expect(defautsDuProfil(n).miseParEquipe).toBeUndefined();
    }
  });
});

describe('niveauDepuisAncienneCle — migration de petanque.modeFederal', () => {
  it('« 1 » devient federal : l\'utilisateur avait demandé le mode fédéral', () => {
    expect(niveauDepuisAncienneCle('1')).toBe('federal');
  });

  it('« 0 » devient club : il avait refusé le fédéral, pas l\'argent ni les clubs', () => {
    expect(niveauDepuisAncienneCle('0')).toBe('club');
  });

  it('l\'absence de clé ne produit aucune préférence', () => {
    expect(niveauDepuisAncienneCle(null)).toBeNull();
  });

  it('une valeur inattendue ne produit aucune préférence', () => {
    expect(niveauDepuisAncienneCle('')).toBeNull();
    expect(niveauDepuisAncienneCle('oui')).toBeNull();
  });
});

describe('estNiveauInterface', () => {
  it('reconnaît les trois niveaux et rejette le reste', () => {
    expect(estNiveauInterface('amical')).toBe(true);
    expect(estNiveauInterface('club')).toBe(true);
    expect(estNiveauInterface('federal')).toBe(true);
    expect(estNiveauInterface('simple')).toBe(false);
    expect(estNiveauInterface(null)).toBe(false);
    expect(estNiveauInterface(1)).toBe(false);
  });
});
```

- [ ] **Step 2 : lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -- profil`
Expected: FAIL — `besoinNiveau is not a function` (les 14 tests de la tâche 1 continuent de passer)

- [ ] **Step 3 : écrire l'implémentation**

Compléter la ligne d'import en tête de `shared/src/engine/profil.ts` :

```ts
import { besoinModeFederal, estConcoursOfficiel, type ParamsOfficiel } from './federal';
import type { TeamFormat } from '../types';
```

Puis ajouter à la fin du fichier :

```ts
/* ------------------------------------------------------------------ */
/* L'heuristique                                                       */
/* ------------------------------------------------------------------ */

/**
 * Quel niveau le contenu du club suggère-t-il ? Généralise
 * `besoinModeFederal` : il ne sert qu'à proposer le bon niveau de lui-même
 * plutôt qu'à laisser un organisateur chercher où sont passées ses fonctions.
 * Un choix explicite de l'utilisateur le remplace.
 *
 * `clubsSurEquipes` est passé en booléen plutôt que la liste des équipes : le
 * calcul n'a besoin que de cela, et la liste complète des équipes de tous les
 * concours n'a pas à traverser une frontière de module pour être réduite ici.
 */
export function besoinNiveau(p: {
  concours: ParamsUsage[];
  licencies: number;
  /** Au moins une équipe inscrite porte un club. */
  clubsSurEquipes: boolean;
}): NiveauInterface {
  if (besoinModeFederal({ concours: p.concours, licencies: p.licencies })) return 'federal';
  if (p.clubsSurEquipes) return 'club';
  const domainesClub: DomaineInterface[] = [
    'argent',
    'formulesAvancees',
    'protections',
    'multisite',
  ];
  if (p.concours.some((c) => domainesClub.some((d) => domaineEnUsage(d, c)))) return 'club';
  return 'amical';
}

/* ------------------------------------------------------------------ */
/* Les valeurs par défaut des nouveaux concours                        */
/* ------------------------------------------------------------------ */

/**
 * Ce que l'organisateur retape aujourd'hui à chaque création et dont la réponse
 * ne change jamais d'un concours à l'autre. Rien de plus : la date, le nom, le
 * lieu et la formule sont propres à chaque concours.
 */
export interface DefautsConcours {
  nbTerrains: number;
  scoreMax: number;
  format: TeamFormat;
  consolante: boolean;
  miseParEquipe?: number;
}

/** Le point de départ que le profil suggère, avant toute saisie. */
export function defautsDuProfil(niveau: NiveauInterface): DefautsConcours {
  return {
    // Un concours entre amis se joue sur le terrain du village, pas au boulodrome.
    nbTerrains: niveau === 'amical' ? 4 : 8,
    scoreMax: 13,
    format: 'doublette',
    consolante: true,
    // La mise reste absente même en club : la proposer chiffrée serait inventer
    // un tarif. C'est un champ à saisir, pas une valeur à deviner.
  };
}

/* ------------------------------------------------------------------ */
/* Migration depuis le booléen `modeFederal`                           */
/* ------------------------------------------------------------------ */

export function estNiveauInterface(v: unknown): v is NiveauInterface {
  return typeof v === 'string' && (NIVEAUX_INTERFACE as string[]).includes(v);
}

/**
 * Traduit l'ancienne clé `petanque.modeFederal` en niveau. Le `'0'` devient
 * `club` et non `amical` : l'utilisateur avait refusé le fédéral, il n'avait
 * rien dit de l'argent ni des clubs, et lui retirer en silence des fonctions
 * qu'il voyait serait exactement la faute que ce système cherche à éviter.
 *
 * La décision est ici plutôt que dans le client parce que c'est le seul endroit
 * où elle peut être testée : `shared` porte vitest, `client` non.
 */
export function niveauDepuisAncienneCle(brut: string | null): NiveauInterface | null {
  if (brut === '1') return 'federal';
  if (brut === '0') return 'club';
  return null;
}
```

- [ ] **Step 4 : exporter le module**

Dans `shared/src/index.ts`, ajouter après la ligne 40 (`export * from './engine/bornesParties';`) :

```ts
export * from './engine/profil';
```

- [ ] **Step 5 : lancer les tests et le typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS — les 14 tests de la tâche 1, les 15 nouveaux, et **tous les tests existants de `federal.test.ts`**, que le branchement de `besoinModeFederal` ne doit pas faire tomber.

- [ ] **Step 6 : vérification par sabotage**

| Sabotage | Test qui doit tomber |
|---|---|
| dans `besoinNiveau`, remonter `if (p.clubsSurEquipes) return 'club'` **avant** le test fédéral | `federal l'emporte sur club…` |
| `if (p.clubsSurEquipes) return 'federal'` | `le club d'une équipe ne promeut pas en federal` |
| `nbTerrains: 8` en dur | `amical part de quatre terrains…` |
| `if (brut === '0') return 'amical'` | `« 0 » devient club…` |

- [ ] **Step 7 : commit**

```bash
git add shared/src/engine/profil.ts shared/src/engine/__tests__/profil.test.ts shared/src/index.ts
git commit -m "Niveau d'interface : l'heuristique, les défauts et la migration

besoinNiveau généralise besoinModeFederal pour ne jamais masquer une fonction
dont le club se sert déjà. Attention au piège que les tests verrouillent :
estConcoursOfficiel lit clubOrganisateur — un champ fédéral — alors que la
promotion vers « club » lit le club d'une équipe inscrite. Confondre les deux
basculerait un club de village en mode fédéral.

La migration rend « club » et non « amical » pour un ancien refus du mode
fédéral : l'utilisateur n'avait rien dit de l'argent ni des clubs.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3 : la plomberie client, à parité de comportement

Cette tâche porte tout le câblage **sans rien masquer de nouveau**. À son terme, l'application se comporte exactement comme avant. C'est le filet : si la parité est fausse, elle se voit ici et nulle part ailleurs.

**Files:**
- Create: `client/src/lib/niveauInterface.ts`
- Delete: `client/src/lib/modeFederal.ts`
- Modify: `client/src/db/hooks.ts` (imports en tête, et `useModeFederalActif` lignes 179-183)
- Modify: `client/src/components/ConcoursForm.tsx:36,135,611`
- Modify: `client/src/pages/DashboardPage.tsx:11,56,132-148,150-152`
- Modify: `client/src/pages/tabs/PoulesTab.tsx:28,41,171`
- Modify: `client/src/pages/tabs/ResultsTab.tsx:17`
- Modify: `client/src/components/ReglagesModal.tsx` (réécriture minimale : le nouveau hook, les trois niveaux en boutons radio)

**Interfaces:**
- Consumes: `montrer`, `besoinNiveau`, `niveauDepuisAncienneCle`, `estNiveauInterface`, `NIVEAUX_INTERFACE`, `type NiveauInterface` de `@shared`.
- Produces:
  - `client/src/lib/niveauInterface.ts` : `preferenceNiveau(): NiveauInterface | null`, `setPreferenceNiveau(n: NiveauInterface): void`, `oublierPreferenceNiveau(): void`, `useNiveauInterface(besoin: NiveauInterface): { niveau: NiveauInterface; preference: NiveauInterface | null; choisir: (n: NiveauInterface) => void; oublier: () => void }`
  - `client/src/db/hooks.ts` : `useNiveauInterfaceActif(): NiveauInterface`, `useClubsSurEquipes(): boolean`

- [ ] **Step 1 : écrire `client/src/lib/niveauInterface.ts`**

Il remplace `modeFederal.ts` et en reprend la mécanique — elle est correcte : un choix explicite, sinon l'heuristique, plus un retour explicite à l'automatique.

```ts
/**
 * Niveau d'interface : ce que l'application montre, jamais ce qu'elle fait.
 * Le raisonnement est dans `shared/engine/profil.ts` ; ce module n'en est que
 * le stockage et la glu React.
 *
 * Trois états, et c'est volontaire : tant que l'utilisateur n'a pas choisi, on
 * décide pour lui d'après ce qu'il a déjà (voir `besoinNiveau`), pour ne jamais
 * lui cacher une fonction dont il se sert.
 *
 * Ce module remplace `modeFederal.ts`, dont il migre la clé au premier accès.
 */
import { useEffect, useState } from 'react';
import { estNiveauInterface, niveauDepuisAncienneCle, type NiveauInterface } from '@shared';

const CLE = 'petanque.niveauInterface';
const CLE_ANCIENNE = 'petanque.modeFederal';

const auditeurs = new Set<() => void>();

function prevenir(): void {
  for (const fn of auditeurs) fn();
}

/**
 * Reprend le choix fait sous l'ancien booléen, une fois. Sans cela, un
 * utilisateur qui avait demandé le mode fédéral le verrait disparaître à la
 * mise à jour.
 */
function migrer(): void {
  try {
    if (localStorage.getItem(CLE) !== null) return;
    const traduit = niveauDepuisAncienneCle(localStorage.getItem(CLE_ANCIENNE));
    if (traduit) localStorage.setItem(CLE, traduit);
    localStorage.removeItem(CLE_ANCIENNE);
  } catch {
    /* stockage indisponible : la migration se refera au prochain démarrage */
  }
}

/** Choix explicite de l'utilisateur, ou `null` s'il n'a jamais choisi. */
export function preferenceNiveau(): NiveauInterface | null {
  try {
    migrer();
    const brut = localStorage.getItem(CLE);
    // Une valeur inconnue — clé bricolée, version future rétrogradée — vaut
    // « pas de choix » : mieux vaut l'heuristique qu'un niveau inintelligible.
    return estNiveauInterface(brut) ? brut : null;
  } catch {
    return null;
  }
}

export function setPreferenceNiveau(niveau: NiveauInterface): void {
  try {
    localStorage.setItem(CLE, niveau);
  } catch {
    /* stockage indisponible : le réglage vaudra pour cette session seulement */
  }
  prevenir();
}

/** Revenir au choix automatique. */
export function oublierPreferenceNiveau(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* rien à faire */
  }
  prevenir();
}

/**
 * Le niveau effectif. `besoin` est ce que le contenu du club suggère ; la
 * préférence explicite le remplace quand elle existe.
 */
export function useNiveauInterface(besoin: NiveauInterface): {
  niveau: NiveauInterface;
  preference: NiveauInterface | null;
  choisir: (niveau: NiveauInterface) => void;
  oublier: () => void;
} {
  const [preference, setPreference] = useState<NiveauInterface | null>(preferenceNiveau);

  useEffect(() => {
    const relire = (): void => setPreference(preferenceNiveau());
    auditeurs.add(relire);
    // Un autre onglet a pu changer le réglage.
    window.addEventListener('storage', relire);
    return () => {
      auditeurs.delete(relire);
      window.removeEventListener('storage', relire);
    };
  }, []);

  return {
    niveau: preference ?? besoin,
    preference,
    choisir: setPreferenceNiveau,
    oublier: oublierPreferenceNiveau,
  };
}
```

- [ ] **Step 2 : les deux hooks dans `client/src/db/hooks.ts`**

Dans le bloc d'import de `@shared` (lignes 15-27), remplacer `besoinModeFederal,` par `besoinNiveau,` et ajouter `type NiveauInterface,`. Remplacer la ligne 28 `import { useModeFederal } from '../lib/modeFederal';` par :

```ts
import { useNiveauInterface } from '../lib/niveauInterface';
```

Remplacer `useModeFederalActif` (lignes 179-183) par :

```ts
/**
 * Au moins une équipe inscrite porte-t-elle un club ? C'est ce qui distingue un
 * concours de club d'un concours entre amis, et donc ce qui promeut
 * l'heuristique du niveau `amical` vers `club`.
 */
export function useClubsSurEquipes(): boolean {
  return (
    useLiveQuery(async () => {
      // Toutes les équipes, tous concours confondus : le niveau d'interface est
      // un réglage d'appareil, il ne dépend pas du concours ouvert.
      const rows = await db.entities.where('type').equals('team').toArray();
      return rows.some(
        (r) => r.deleted === 0 && r.data && Boolean((r.data as Team).club?.trim()),
      );
    }, []) ?? false
  );
}

export function useNiveauInterfaceActif(): NiveauInterface {
  const concours = useConcoursList() ?? [];
  const licencies = useLicenciesCount();
  const clubsSurEquipes = useClubsSurEquipes();
  return useNiveauInterface(besoinNiveau({ concours, licencies, clubsSurEquipes })).niveau;
}
```

Le filtre `r.deleted === 0 && r.data` est celui de `useEntityList` (`hooks.ts:66`) — le reprendre tel quel plutôt que le `r.deleted !== 1` de `useTeamCounts` (`DashboardPage.tsx:38`), qui est l'exception et non la règle du fichier.

- [ ] **Step 3 : porter les cinq appels**

Remplacer partout `useModeFederalActif()` par `useNiveauInterfaceActif()`, et le booléen par un appel à `montrer`. Les cinq sites :

1. **`ResultsTab.tsx:17`** — l'import. Le booléen local devient
   `montrer('documentsComite', { niveau, concours })`.
2. **`PoulesTab.tsx:28,41`** — l'import et `const modeFederal = useModeFederalActif();` deviennent `const niveau = useNiveauInterfaceActif();`.
3. **`PoulesTab.tsx:171`** — `{(modeFederal || concours.protections?.length) && (` devient
   `{montrer('protections', { niveau, concours }) && (`. La clause `|| concours.protections?.length` **disparaît** : `montrer` la porte déjà, c'est précisément sa clause de sûreté. Vérifier que le comportement est identique — il l'est, à ceci près que `montrer` rend un booléen là où l'ancienne expression rendait un nombre.
4. **`ConcoursForm.tsx:36,135`** — `const modeFederal = useModeFederalActif();` devient `const niveau = useNiveauInterfaceActif();`.
5. **`ConcoursForm.tsx:611`** — `{(modeFederal || officiel) && (` devient
   `{(montrer('criteresOfficiels', { niveau, concours: initial }) || officiel) && (`.

   ⚠️ **La clause `|| officiel` doit rester.** `officiel` est l'état vivant de la case à cocher du formulaire ; `initial` est le concours enregistré. Sans elle, cocher « concours officiel » n'ouvrirait plus le bloc fédéral tant que le formulaire n'est pas enregistré. C'est le seul site où la clause de sûreté ne suffit pas.

6. **`DashboardPage.tsx:11,56`** — même remplacement ; les lignes 132 et 140 (`{federal && (`) deviennent `{montrer('licencies', { niveau }) && (` et `{montrer('championnatClubs', { niveau }) && (`. Pas de concours en contexte : c'est le cas prévu par le paramètre facultatif.

- [ ] **Step 4 : le libellé du bouton ⚙**

`DashboardPage.tsx:150-152`. Le bouton `⚙` porte le niveau courant — c'est la porte de sortie visible, la réponse à « où est passé X » :

```tsx
<button
  className="btn btn-sm"
  title="Réglages et niveau d'interface"
  onClick={() => setReglages(true)}
>
  ⚙ {LIBELLE_NIVEAU[niveau]}
</button>
```

Ajouter dans `client/src/lib/labels.ts`, à côté des autres tables de libellés :

```ts
/** Libellé court du niveau d'interface, pour le bouton des réglages. */
export const LIBELLE_NIVEAU: Record<NiveauInterface, string> = {
  amical: 'Entre amis',
  club: 'Mon club',
  federal: 'Officiel',
};
```

- [ ] **Step 5 : le `ReglagesModal` à parité**

Remplacer la case à cocher par trois boutons radio sur le même niveau de détail — le sectionnement complet vient à la tâche 11. Conserver **mot pour mot** les deux paragraphes `.hint` d'explication existants (lignes 24-34) : ils disent exactement ce qu'il faut, en remplaçant « Décoché, » par « Au niveau « Entre amis », ». Conserver le bloc `preference === null` / `preference !== null` et le bouton « Revenir au choix automatique ».

- [ ] **Step 6 : supprimer l'ancien module et vérifier qu'il ne reste aucune référence**

```bash
git rm client/src/lib/modeFederal.ts
grep -rn "modeFederal\|useModeFederal\|besoinModeFederal" client/src
```
Expected: aucun résultat. (`besoinModeFederal` reste dans `shared` — il est appelé par `besoinNiveau` — mais plus rien dans `client` ne doit le nommer.)

- [ ] **Step 7 : typecheck et build**

Run: `npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 8 : vérifier la parité au navigateur**

Démarrer l'aperçu, puis vérifier les quatre états. Le point de cette tâche est qu'**il ne doit rien y avoir de neuf à voir** :

1. `localStorage.setItem('petanque.modeFederal', '1')`, recharger → la clé `petanque.modeFederal` a disparu, `petanque.niveauInterface` vaut `federal`, le bouton affiche `⚙ Officiel`, les liens Licenciés et Championnat des clubs sont présents.
2. Vider les deux clés, `setItem('petanque.modeFederal', '0')`, recharger → `niveauInterface` vaut `club`, bouton `⚙ Mon club`, les deux liens fédéraux sont absents, **les mises et les formules restent visibles**.
3. Vider les deux clés, recharger sur une base vide → bouton `⚙ Entre amis` (l'heuristique), et là encore mises et formules restent visibles : aucun domaine n'est encore branché.
4. Ouvrir ⚙ et basculer les trois niveaux : les liens fédéraux apparaissent et disparaissent, « Revenir au choix automatique » remet le libellé sur la valeur heuristique.

- [ ] **Step 9 : commit**

```bash
git add -A client/src shared
git commit -m "Porter le client sur le niveau d'interface, à parité

Le booléen modeFederal disparaît au profit du niveau à trois valeurs, et les six
sites de décision passent par montrer(). Rien n'est masqué de plus qu'avant :
cette étape est le filet qui isole une éventuelle rupture de parité des quatre
domaines à venir.

Deux points à ne pas défaire : la clause « || officiel » du ConcoursForm, qui
lit l'état vivant de la case et non le concours enregistré ; et le libellé du
bouton ⚙, qui porte le niveau courant pour que « où est passé X » ait une
réponse à un clic.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4 : les valeurs par défaut persistées

**Files:**
- Create: `client/src/lib/defauts.ts`

**Interfaces:**
- Consumes: `defautsDuProfil(niveau)`, `type DefautsConcours`, `type NiveauInterface` de `@shared`.
- Produces: `getDefauts(niveau: NiveauInterface): DefautsConcours`, `setDefauts(d: DefautsConcours): void`, `oublierDefauts(): void`, `aDesDefauts(): boolean`, `useDefauts(niveau: NiveauInterface): { defauts: DefautsConcours; personnalises: boolean; enregistrer: (d: DefautsConcours) => void; oublier: () => void }`

- [ ] **Step 1 : écrire le module**

```ts
/**
 * Valeurs par défaut des nouveaux concours.
 *
 * Rien ne retenait jusqu'ici que ce boulodrome a huit terrains, qu'on y joue en
 * doublette et qu'il n'y a pas de mise : l'organisateur les retapait à chaque
 * concours. Ce module les garde sur l'appareil, comme le niveau d'interface.
 *
 * Le profil fournit le point de départ ; ce qui est enregistré ici le recouvre,
 * champ par champ. Une valeur absente de l'enregistrement retombe donc sur le
 * profil — utile quand une version future ajoute un champ.
 */
import { useEffect, useState } from 'react';
import { defautsDuProfil, type DefautsConcours, type NiveauInterface } from '@shared';

const CLE = 'petanque.defauts';

const auditeurs = new Set<() => void>();

function prevenir(): void {
  for (const fn of auditeurs) fn();
}

/** L'utilisateur a-t-il enregistré des valeurs à lui ? */
export function aDesDefauts(): boolean {
  try {
    return localStorage.getItem(CLE) !== null;
  } catch {
    return false;
  }
}

export function getDefauts(niveau: NiveauInterface): DefautsConcours {
  const base = defautsDuProfil(niveau);
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return base;
    const enregistre = JSON.parse(brut) as Partial<DefautsConcours>;
    return { ...base, ...enregistre };
  } catch {
    // Enregistrement illisible : le profil vaut mieux qu'un écran cassé.
    return base;
  }
}

export function setDefauts(d: DefautsConcours): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(d));
  } catch {
    /* stockage indisponible : les valeurs vaudront pour cette session */
  }
  prevenir();
}

/** Revenir aux valeurs du profil. */
export function oublierDefauts(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* rien à faire */
  }
  prevenir();
}

export function useDefauts(niveau: NiveauInterface): {
  defauts: DefautsConcours;
  personnalises: boolean;
  enregistrer: (d: DefautsConcours) => void;
  oublier: () => void;
} {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const relire = (): void => setVersion((v) => v + 1);
    auditeurs.add(relire);
    window.addEventListener('storage', relire);
    return () => {
      auditeurs.delete(relire);
      window.removeEventListener('storage', relire);
    };
  }, []);

  // `version` force la relecture ; les valeurs viennent du stockage, pas d'un
  // état React, pour rester cohérentes entre deux composants montés.
  void version;

  return {
    defauts: getDefauts(niveau),
    personnalises: aDesDefauts(),
    enregistrer: setDefauts,
    oublier: oublierDefauts,
  };
}
```

- [ ] **Step 2 : typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3 : commit**

```bash
git add client/src/lib/defauts.ts
git commit -m "Retenir les valeurs par défaut des nouveaux concours

Le profil fournit le point de départ, l'enregistrement le recouvre champ par
champ : un champ ajouté par une version future retombe ainsi sur le profil au
lieu de valoir undefined.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5 : masquer l'argent en niveau amical

**Files:**
- Create: `client/src/components/BlocMises.tsx`
- Modify: `client/src/components/ConcoursForm.tsx:471-509` (extraction du bloc), `:275`
- Modify: `client/src/components/CreateConcoursWizard.tsx:316-329`
- Modify: `client/src/pages/tabs/TeamsTab.tsx:287-289` et le cadre « Mises » (lignes 655-690)
- Modify: `client/src/pages/tabs/ResultsTab.tsx:182`

**Interfaces:**
- Consumes: `montrer` de `@shared`, `useNiveauInterfaceActif` de `../db/hooks` (tâche 3).
- Produces: `BlocMises` — le champ « Mise par équipe » et le champ « Concours qualificatif » extraits du `ConcoursForm`.

```tsx
interface PropsBlocMises {
  miseParEquipe: number | '';
  setMiseParEquipe: (v: number | '') => void;
  nbQualifies: number | '';
  setNbQualifies: (v: number | '') => void;
  /** Le champ « nombre de qualifiés » ne concerne ni les rondes ni le tir. */
  avecQualifies: boolean;
}
export function BlocMises(p: PropsBlocMises): JSX.Element;
```

- [ ] **Step 1 : extraire `BlocMises`**

Déplacer le `<div className="form-row">` des lignes 471-509 de `ConcoursForm.tsx` dans `client/src/components/BlocMises.tsx`, sans en changer une ligne de JSX : seuls les états deviennent des props. Le composant porte un commentaire d'en-tête disant pourquoi il existe — c'est l'unité que le niveau d'interface masque.

- [ ] **Step 2 : le brancher derrière `montrer`**

Dans `ConcoursForm.tsx`, à la place des lignes 471-509 :

```tsx
{montrer('argent', { niveau, concours: initial }) && (
  <BlocMises
    miseParEquipe={miseParEquipe}
    setMiseParEquipe={setMiseParEquipe}
    nbQualifies={nbQualifies}
    setNbQualifies={setNbQualifies}
    avecQualifies={!isRondesMode(mode) && !isTirMode(mode)}
  />
)}
```

⚠️ La ligne 275 (`miseParEquipe: miseParEquipe === '' ? undefined : Number(miseParEquipe)`) du `submit` **ne change pas**. Masquer le champ ne doit pas effacer une valeur déjà enregistrée : l'état est initialisé depuis `initial?.miseParEquipe` et repart tel quel. C'est la règle « l'affichage, jamais le comportement ».

- [ ] **Step 3 : le champ « Mise par équipe » du `CreateConcoursWizard`**

Envelopper le `<label>` des lignes 316-329 dans `{montrer('argent', { niveau }) && (…)}`. Pas de concours en contexte : c'est une création.

- [ ] **Step 4 : `TeamsTab` — le cadre « Mises »**

`TeamsTab.tsx:287-289` calcule `mise`, `trackPaid` et `bilan`. Ne toucher **ni** à ces calculs **ni** à `bilanMises` : seul l'affichage du cadre est conditionné. Envelopper la colonne « Mises » et le bilan dans `montrer('argent', { niveau, concours })`. Comme le cadre est déjà conditionné par `trackPaid` (donc par `mise > 0`), la clause de sûreté rend l'ajout presque inopérant en pratique — le vérifier plutôt que le supposer, et si `trackPaid` couvre déjà tout, **ne rien ajouter ici** et le noter dans le message de commit.

- [ ] **Step 5 : `ResultsTab` — la section Indemnités**

Ligne 182 : envelopper `<IndemnitesSection …/>` dans `montrer('argent', { niveau, concours })`.

⚠️ `IndemnitesSection` prend `concours.miseParEquipe ?? 10` (ligne 242) : une mise par défaut de 10 € apparaît là où rien n'est saisi. C'est justement le calcul qui n'a aucun sens en amical, et la raison principale de masquer ce domaine.

- [ ] **Step 6 : typecheck et build**

Run: `npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 7 : vérifier au navigateur**

Sur un concours **sans** mise, niveau `amical` : le champ « Mise par équipe » est absent du formulaire et de l'assistant de création, la section Indemnités est absente des résultats.
Puis passer en `club`, saisir une mise de 5 €, **revenir en `amical`** : la mise et les indemnités **restent visibles** sur ce concours. C'est la clause de sûreté, et c'est le test qui compte.

- [ ] **Step 8 : commit**

```bash
git add -A client/src
git commit -m "Masquer l'argent au niveau « Entre amis »

Un concours du dimanche entre copains n'a ni mise, ni frais d'organisation, ni
répartition d'indemnités — et IndemnitesSection allait jusqu'à supposer 10 € par
équipe là où rien n'est saisi.

Rien n'est effacé pour autant : le submit du ConcoursForm continue de reporter
miseParEquipe tel quel, et un concours qui porte déjà une mise garde ses écrans
même au niveau le plus dépouillé.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6 : masquer les formules avancées en niveau amical

**Files:**
- Create: `client/src/components/BlocFormulesAvancees.tsx`
- Modify: `client/src/components/ConcoursForm.tsx:527-598`
- Modify: `client/src/pages/tabs/BracketTab.tsx:120-137` (`retirageParTour`)
- Modify: `client/src/pages/tabs/PoulesTab.tsx:235-245` (`tirageDiffere`)

**Interfaces:**
- Consumes: `montrer` de `@shared`, `useNiveauInterfaceActif` de `../db/hooks`.
- Produces: `BlocFormulesAvancees` — les cases `parGroupes`, `ggStrict`, `complementaire` et `recupCadrage` extraites du `ConcoursForm`.

```tsx
interface PropsBlocFormulesAvancees {
  mode: ConcoursMode;
  parGroupes: boolean;
  setParGroupes: (v: boolean) => void;
  ggStrict: boolean;
  /**
   * Bascule du strict. Pas de `setGgStrict` : le parent doit aussi rabattre
   * `nbRondes` sur la nouvelle borne, et le bloc ne possède pas cet état.
   */
  onGgStrictChange: (actif: boolean) => void;
  consolante: boolean;
  complementaire: boolean;
  setComplementaire: (v: boolean) => void;
  recupCadrage: boolean;
  setRecupCadrage: (v: boolean) => void;
  /** Après tirage, la structure n'est plus modifiable. */
  lockStructure?: boolean;
}
```

- [ ] **Step 1 : extraire le bloc**

Déplacer les lignes 527-598 de `ConcoursForm.tsx` — `parGroupes`, `ggStrict`, et le groupe `consolante` / `complementaire` / `recupCadrage` — dans le nouveau composant.

⚠️ **La case `consolante` reste dans le `ConcoursForm`.** Elle n'est pas une formule avancée : c'est le repêchage que tout le monde comprend, et le `CreateConcoursWizard` la propose déjà à la création. Seules `complementaire` et `recupCadrage`, qui sont imbriquées dessous, partent dans le bloc. Le composant reçoit donc `consolante` en lecture seule, pour savoir s'il doit afficher ses deux cases filles.

⚠️ Le `onChange` de `ggStrict` (lignes 547-553) recalcule `bornesParties` et rabat `nbRondes`. Cette logique **reste dans le `ConcoursForm`** et passe par `onGgStrictChange` : elle touche un état que le bloc ne possède pas.

- [ ] **Step 2 : le brancher derrière `montrer`**

```tsx
{montrer('formulesAvancees', { niveau, concours: initial }) && (
  <BlocFormulesAvancees … />
)}
```

- [ ] **Step 3 : `BracketTab` — le retirage à chaque tour**

Envelopper le `<label className="checkbox-label">` des lignes 120-137 dans
`montrer('formulesAvancees', { niveau, concours })`.

- [ ] **Step 4 : `PoulesTab` — le tirage à la reprise**

Envelopper le contrôle de `concours.tirageDiffere` (autour de la ligne 237) dans
`montrer('formulesAvancees', { niveau, concours })`.

- [ ] **Step 5 : typecheck et build**

Run: `npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 6 : vérifier au navigateur**

Concours en poules, niveau `amical` : la case « Formule par groupes A-B-C » est absente, la case « Consolante » **est présente**, « Complémentaire » et « Repêchage au cadrage » sont absentes, « Tirage à la reprise » est absent de l'onglet Poules, « Retirage à chaque tour » est absent de l'onglet Tableau.
Puis en `club`, cocher « Formule par groupes A-B-C », enregistrer, **revenir en `amical`** : le bloc reste visible sur ce concours.

- [ ] **Step 7 : commit**

```bash
git add -A client/src
git commit -m "Masquer les formules avancées au niveau « Entre amis »

Six cases que personne ne comprend sans le manuel FFPJP, toutes absentes ou
false par défaut : c'est le domaine qui gagne le plus à être replié et qui
risque le moins à l'être.

La consolante reste visible : ce n'est pas une formule savante, c'est le
repêchage que tout le monde comprend, et l'assistant de création la propose
déjà. Seules ses deux cases filles partent dans le bloc.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7 : masquer les protections de clubs en niveau amical

**Files:**
- Modify: `client/src/pages/tabs/PoulesTab.tsx:171`
- Modify: `client/src/pages/tabs/BracketTab.tsx:100-119`

**Interfaces:**
- Consumes: `montrer` de `@shared`, `useNiveauInterfaceActif` de `../db/hooks`.
- Produces: rien de nouveau.

- [ ] **Step 1 : `PoulesTab` — déjà fait à la tâche 3**

La ligne 171 est passée par `montrer('protections', { niveau, concours })` au step 3 de la tâche 3. Vérifier que c'est bien le cas et qu'il n'y reste pas de `|| concours.protections?.length`.

- [ ] **Step 2 : `BracketTab` — le bouton « Groupes de protection »**

Envelopper le `<button>` des lignes 111-119 dans
`montrer('protections', { niveau, concours })`.

⚠️ **La case « Protection : séparer les équipes d'un même club au premier tour » (lignes 104-110) reste visible.** C'est la protection de niveau 1, celle que tout le monde comprend, et son effet est de toute façon nul si personne ne saisit de club. Seuls les *groupes* de clubs — la protection de niveau 2, manuel §3.B.5 — sont masqués.

- [ ] **Step 3 : typecheck et build**

Run: `npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 4 : vérifier au navigateur**

Niveau `amical` : le bouton « 🛡 Groupes de protection » est absent des onglets Poules et Tableau, la case « Protection : séparer les équipes d'un même club » est présente.
Puis en `club`, créer un groupe de protection, **revenir en `amical`** : le bouton reste visible, avec son compteur.

- [ ] **Step 5 : commit**

```bash
git add -A client/src
git commit -m "Masquer les groupes de protection au niveau « Entre amis »

Traiter deux clubs d'un même village comme un seul au tirage (manuel §3.B.5)
n'a pas de sens sans notion de club. La protection de niveau 1 reste visible :
elle est compréhensible, et son effet est nul de lui-même si personne ne saisit
de club.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8 : masquer le multisite en niveau amical

**Files:**
- Modify: `client/src/pages/tabs/TeamsTab.tsx:320-336`
- Modify: `client/src/pages/ConcoursPage.tsx:125`
- Modify: `client/src/components/ConcoursForm.tsx:830-870` (les décalages de numérotation)

**Interfaces:**
- Consumes: `montrer` de `@shared`, `useNiveauInterfaceActif` de `../db/hooks`.
- Produces: rien de nouveau.

- [ ] **Step 1 : `TeamsTab` — le bouton de fractionnement**

Ajouter `montrer('multisite', { niveau, concours })` à la condition existante des lignes 320-333, sans retirer les conditions déjà là (le fractionnement n'est possible qu'avant le tirage).

- [ ] **Step 2 : `ConcoursPage` — le lien multisite**

Ligne 125 : envelopper `<LienMultisite concours={concours} />` dans
`montrer('multisite', { niveau, concours })`.

- [ ] **Step 3 : `ConcoursForm` — les décalages de numérotation**

Les champs `decalageEquipe` et `decalageTerrain` (lignes ~830-870) sont **déjà** dans le bloc fédéral ouvert à la ligne 611. Vérifier où ils tombent exactement :
- s'ils sont **dans** le bloc `criteresOfficiels`, ils sont déjà masqués hors fédéral → **ne rien changer** et le noter dans le message de commit ;
- s'ils sont **hors** de ce bloc, les envelopper dans `montrer('multisite', { niveau, concours: initial })`.

Ne pas supposer : lire le fichier et compter les accolades.

- [ ] **Step 4 : typecheck et build**

Run: `npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 5 : vérifier au navigateur**

Niveau `amical` : le bouton de fractionnement multisite est absent de l'onglet Équipes, le lien multisite est absent de l'en-tête du concours.
Sur un concours issu d'un fractionnement (`issuDeConcours` renseigné), **même en `amical`** : le lien reste visible. C'est la clause de sûreté, et ici elle compte double — masquer le lien d'un concours qui *est* un site secondaire couperait l'organisateur de son concours d'origine.

- [ ] **Step 6 : commit**

```bash
git add -A client/src
git commit -m "Masquer le multisite au niveau « Entre amis »

Le fractionnement d'un concours sur plusieurs boulodromes (manuel §3.B.10.D)
est réservé aux gros concours. La clause de sûreté compte double ici : un
concours qui est lui-même un site secondaire garde son lien d'origine, sinon
on couperait l'organisateur de son propre concours.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9 : l'assistant de configuration

**Files:**
- Create: `client/src/components/AssistantConfiguration.tsx`
- Delete: `client/src/components/WelcomeModal.tsx`
- Modify: `client/src/pages/DashboardPage.tsx:17,66,71-73,336`

**Interfaces:**
- Consumes: `NIVEAUX_INTERFACE`, `defautsDuProfil`, `type DefautsConcours`, `type NiveauInterface`, `type TeamFormat`, `parcoursDecouverte` de `@shared` ; `setPreferenceNiveau` de `../lib/niveauInterface` ; `setDefauts` de `../lib/defauts` ; `createDemoConcours` de `../db/actions` ; `demarrerParcours` de `../help/parcoursState` ; `BouleLogo`.
- Produces:
  - `isConfigurationFaite(): boolean` — remplace `isWelcomeDone`, **même clé `petanque.welcomeDone`** pour que les utilisateurs existants ne revoient pas l'assistant
  - `AssistantConfiguration({ onClose }: { onClose: () => void })`
  - `PROFILS: Record<NiveauInterface, { emoji: string; titre: string; montre: string; masque: string }>` — **exporté**, la tâche 11 le réutilise pour les mêmes cartes en format réduit

- [ ] **Step 1 : écrire le composant**

Trois écrans dans un seul composant, sur le modèle du `CreateConcoursWizard` (état `step`, `wizard-progress`, `mode-cards`). Contenu, verbatim de la spec :

**Écran 0 — le profil.** Trois cartes `mode-card`, chacune avec emoji, titre, ce qu'elle montre, ce qu'elle masque :

```tsx
export const PROFILS: Record<
  NiveauInterface,
  { emoji: string; titre: string; montre: string; masque: string }
> = {
  amical: {
    emoji: '🎉',
    titre: 'Entre amis',
    montre: 'Concours du dimanche entre copains : inscriptions, tirage, poules, tableaux, scores.',
    masque: 'Masque les mises et indemnités, les formules du manuel, les groupes de protection et le multisite.',
  },
  club: {
    emoji: '🏆',
    titre: 'Mon club',
    montre: 'Concours du club, avec mises, indemnités, clubs des équipes et protections au tirage.',
    masque: 'Masque le fichier des licenciés, le championnat des clubs et les documents du comité.',
  },
  federal: {
    emoji: '📋',
    titre: 'Concours officiels',
    montre: 'Licences, critères officiels, championnat des clubs, documents remis au comité.',
    masque: 'Tout est affiché.',
  },
};
```

Choisir une carte appelle `setPreferenceNiveau(niveau)`, initialise l'état de l'écran 1 avec `defautsDuProfil(niveau)` et passe à l'écran 1.

**Écran 1 — deux ou trois questions concrètes.** Les terrains habituels (`number`, min 1 max 200) et la formation habituelle (les trois cartes `format-card` du `CreateConcoursWizard`, lignes 156-167). Sur `club` et `federal` seulement, un troisième champ : la mise par équipe (`number`, min 0 max 1000, step 0.5, placeholder `—`). « Continuer » appelle `setDefauts(…)` puis passe à l'écran 2.

**Écran 2 — la prise en main.** Reprendre **à l'identique** le contenu de `WelcomeModal.tsx` lignes 45-69 : la marque, la liste des trois arguments, les boutons « 🎓 Commencer la visite guidée » (`demarrerParcours(parcoursDecouverte)`), « 🎯 Créer un concours d'exemple » (`createDemoConcours` puis navigation) et le `.welcome-hint` final.

**`Plus tard` sur les trois écrans.** Il marque `petanque.welcomeDone` **sans** appeler `setPreferenceNiveau` ni `setDefauts` : l'heuristique reprend la main, et l'utilisateur se retrouve dans l'état d'aujourd'hui. Contourner l'assistant ne doit rien dégrader.

⚠️ Sur l'écran 0, `Plus tard` ne doit pas non plus écrire de préférence. Sur l'écran 1, la préférence de niveau **est déjà écrite** (elle l'a été au clic sur la carte) et c'est voulu : l'utilisateur a bien choisi son profil, il renonce seulement à en régler le détail.

- [ ] **Step 2 : brancher dans le `DashboardPage`**

Remplacer l'import et l'usage de `WelcomeModal` / `isWelcomeDone` par `AssistantConfiguration` / `isConfigurationFaite`. Les lignes 66 (`useState(() => !isWelcomeDone())`), 71-73 (`annoncerNouveautes(!isWelcomeDone())`) et 336 suivent mécaniquement.

- [ ] **Step 3 : supprimer l'ancien modal et vérifier**

```bash
git rm client/src/components/WelcomeModal.tsx
grep -rn "WelcomeModal\|isWelcomeDone" client/src
```
Expected: aucun résultat.

- [ ] **Step 4 : typecheck et build**

Run: `npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 5 : vérifier au navigateur**

1. Vider `localStorage`, recharger → l'assistant s'ouvre sur les trois cartes.
2. Choisir « Entre amis » → l'écran 1 propose **4 terrains** et `doublette`, **sans** champ de mise.
3. Continuer → l'écran 2 montre la visite guidée et le concours d'exemple.
4. Fermer, ouvrir ⚙ → le bouton affiche `⚙ Entre amis`, `petanque.niveauInterface` vaut `amical`, `petanque.defauts` porte `nbTerrains: 4`.
5. Vider `localStorage`, recharger, **« Plus tard » dès l'écran 0** → ni `petanque.niveauInterface` ni `petanque.defauts` n'existent, `petanque.welcomeDone` vaut `1`, et le bouton ⚙ affiche le niveau heuristique.
6. Choisir « Mon club » → l'écran 1 propose **8 terrains** et **un champ de mise vide**.
7. Recharger avec `petanque.welcomeDone` à `1` → l'assistant ne se rouvre pas.

Vérifier aussi que les nouveautés (`annoncerNouveautes`) ne s'empilent pas par-dessus l'assistant à la première ouverture — c'est déjà ce que le paramètre de la ligne 72 protège.

- [ ] **Step 6 : commit**

```bash
git add -A client/src
git commit -m "Assistant de configuration à la première ouverture

Trois écrans qui remplacent le WelcomeModal : le profil, deux questions
concrètes, la prise en main. Le masquage est annoncé sur les cartes, jamais
subi.

« Plus tard » n'écrit aucune préférence et rend la main à l'heuristique :
contourner l'assistant laisse l'application dans l'état qu'elle avait avant lui.
La clé petanque.welcomeDone est réutilisée telle quelle, pour que les
utilisateurs existants ne voient pas l'assistant surgir après une mise à jour.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10 : pré-remplir et replier l'assistant de création

**Files:**
- Modify: `client/src/components/CreateConcoursWizard.tsx:22-29,41-67,126-147`

**Interfaces:**
- Consumes: `useDefauts` de `../lib/defauts`, `useNiveauInterfaceActif` de `../db/hooks`, `montrer` de `@shared`.
- Produces: rien de nouveau.

- [ ] **Step 1 : pré-remplir depuis les valeurs par défaut**

Les `useState` des lignes 52-66 partent aujourd'hui de constantes en dur (`8`, `13`, `true`). Les faire partir de `useDefauts(niveau).defauts` :

```tsx
const niveau = useNiveauInterfaceActif();
const { defauts } = useDefauts(niveau);
const [nbTerrains, setNbTerrains] = useState(defauts.nbTerrains);
const [scoreMax, setScoreMax] = useState(defauts.scoreMax);
const [consolante, setConsolante] = useState(defauts.consolante);
const [miseParEquipe, setMiseParEquipe] = useState<number | ''>(defauts.miseParEquipe ?? '');
```

Et la formation par défaut : `pickMode` passe aujourd'hui à l'étape 1 pour la choisir. Ne pas court-circuiter cette étape — la formation change d'un concours à l'autre plus souvent que les terrains. La valeur par défaut sert uniquement à **présélectionner** la carte correspondante (`className` avec un état `active`), pas à sauter l'écran.

- [ ] **Step 2 : replier l'étape 1 en niveau amical**

Aujourd'hui les six modes de la constante `MODES` (lignes 22-29) sont affichés d'un bloc. En `amical`, n'en montrer que trois et replier les autres :

```tsx
/** Les formules qu'un concours entre amis utilise. */
const MODES_COURANTS: ConcoursMode[] = ['poules', 'elimination_directe', 'melee'];
/** Les trois autres, dépliables : elles supposent le manuel ou un club. */
const MODES_AVANCES: ConcoursMode[] = ['suisse', 'championnat', 'tir_precision'];
```

En `amical`, afficher `MODES_COURANTS` puis un `<button className="btn-lien">Autres formules ▾</button>` qui déplie `MODES_AVANCES`. Aux deux autres niveaux, afficher les six comme aujourd'hui. **Rien n'est retiré, seulement replié** : c'est la différence avec les quatre domaines masqués, et c'est pourquoi ce point ne passe pas par `montrer`.

- [ ] **Step 3 : typecheck et build**

Run: `npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 4 : vérifier au navigateur**

Niveau `amical` avec `petanque.defauts` à `{ nbTerrains: 4, … }` : « + Nouveau concours » montre **trois** cartes de formule et un lien « Autres formules ▾ » ; le déplier montre les trois autres ; l'étape 3 affiche **4** terrains et 13 points.
Niveau `club` : les six cartes d'emblée, 8 terrains, et le champ de mise présent (tâche 5).

- [ ] **Step 5 : commit**

```bash
git add -A client/src
git commit -m "Pré-remplir la création de concours et replier ses formules

L'organisateur retapait ses 8 terrains et ses 13 points à chaque concours : ils
viennent maintenant des valeurs par défaut de l'appareil.

Et l'étape 1 — l'écran le plus vu de l'application — ne montre plus six
formules d'entrée au niveau « Entre amis » mais trois, les autres derrière un
lien. Replié, pas retiré : c'est ce qui distingue ce point des quatre domaines
que montrer() masque.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11 : la section « Paramètres par défaut »

**Files:**
- Modify: `client/src/components/ReglagesModal.tsx` (réécriture complète)
- Modify: `client/src/styles.css` (classes du modal sectionné, si nécessaire)

**Interfaces:**
- Consumes: `useNiveauInterface` de `../lib/niveauInterface`, `useDefauts` de `../lib/defauts`, `besoinNiveau` / `NIVEAUX_INTERFACE` / `defautsDuProfil` de `@shared`, `useConcoursList` / `useLicenciesCount` / `useClubsSurEquipes` de `../db/hooks`, `AssistantConfiguration` de `./AssistantConfiguration`.
- Produces: rien de nouveau.

- [ ] **Step 1 : trois sections**

**« Niveau d'interface »** — les trois cartes de profil en format réduit (réutiliser le `PROFILS` de la tâche 9 en l'exportant depuis `AssistantConfiguration.tsx`), l'état courant mis en évidence. Conserver **mot pour mot** les deux paragraphes `.hint` de l'actuel `ReglagesModal` (lignes 24-34) et le bloc `preference === null` / `preference !== null` avec « Revenir au choix automatique ».

**« Valeurs par défaut des nouveaux concours »** — les cinq champs de `DefautsConcours`, modifiables un par un, plus un bouton « Revenir aux valeurs du profil » branché sur `oublier` de `useDefauts`.

⚠️ **Cette section ne masque rien, mise comprise, quel que soit le niveau.** C'est le seul endroit de l'application où un champ échappe à `montrer`, et c'est délibéré : sans cela, un utilisateur en `amical` qui veut ses mises ne pourrait pas en poser une, donc l'heuristique ne le promouvrait jamais en `club`. Ne pas « corriger » ce point en y ajoutant un appel à `montrer` — ce serait rétablir le cercle vicieux que la spec résout.

**« Relancer l'assistant de configuration »** — un bouton qui monte `AssistantConfiguration`. Il ne touche pas à `petanque.welcomeDone` : la clé est déjà à `1`, et l'assistant relancé se referme normalement.

- [ ] **Step 2 : typecheck et build**

Run: `npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 3 : vérifier au navigateur**

1. Niveau `amical`, ouvrir ⚙ : les trois sections sont là, « Entre amis » est mis en évidence, et **le champ de mise par défaut est présent** malgré le niveau.
2. Y saisir une mise de 5 € → l'heuristique ne bouge pas (elle lit les concours, pas les défauts) mais la mise apparaît désormais pré-remplie dans l'assistant de création ; créer un concours avec cette mise, puis vérifier que le bouton passe à `⚙ Mon club` **après retour au choix automatique**.
3. « Revenir aux valeurs du profil » → les cinq champs reprennent les valeurs de `defautsDuProfil`, `petanque.defauts` disparaît du stockage.
4. « Relancer l'assistant » → les trois écrans s'ouvrent, et le choix d'un profil met à jour le libellé du bouton ⚙ au retour.
5. Changer de niveau dans un onglet, vérifier que l'autre onglet suit (l'événement `storage` est câblé dans les deux modules).

⚠️ Le point 2 mérite d'être vérifié honnêtement : `besoinNiveau` lit les concours et les équipes, pas `petanque.defauts`. La promotion n'a donc lieu qu'**une fois un concours créé avec une mise**, pas au moment de la saisie du défaut. Si ce délai rend l'enchaînement décrit dans la spec confus à l'usage, le signaler plutôt que de le contourner en douce.

- [ ] **Step 4 : commit**

```bash
git add -A client/src
git commit -m "Section « Paramètres par défaut » dans les réglages

Trois sections : le niveau d'interface, les valeurs des nouveaux concours et le
relancement de l'assistant.

Cet écran ne masque rien, mise comprise, quel que soit le niveau — seul endroit
de l'application où un champ échappe à montrer(). C'est délibéré : sans cela un
utilisateur au niveau « Entre amis » qui veut ses mises ne pourrait pas en poser
une, et l'heuristique ne le promouvrait jamais. L'alternative aurait été un
interrupteur par domaine, soit un second système capable de contredire le
premier.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Vérification finale

- [ ] `npm test` — tous les tests de `shared`, dont les 29 de `profil.test.ts`
- [ ] `npm run typecheck` — les trois paquets
- [ ] `npm run build` — les trois paquets
- [ ] `grep -rn "modeFederal" client/src` — aucun résultat
- [ ] Parcours complet en mode invité, `localStorage` vidé : assistant → profil « Entre amis » → création d'un concours → tirage des poules → saisie de scores → résultats. Aucun écran d'argent, de formule avancée, de protection de groupe ni de multisite ne doit apparaître, et rien ne doit manquer pour mener le concours à son terme.
- [ ] Le même parcours en niveau « Concours officiels » : tout est là, à l'identique d'avant ce travail.
