/**
 * Paramètres fédéraux d'un concours (manuel « Gestion Concours » §3.A) :
 * numérotation décalée et nom construit automatiquement.
 */
import type {
  CategorieAge,
  CritereClassification,
  CritereSexe,
  Discipline,
  NiveauConcours,
  TeamFormat,
} from '../types';
import { jeuFederal, type JeuFederal } from './championnatCDF';

/**
 * Numéro de la prochaine équipe. Le décalage sert quand un club enchaîne
 * plusieurs concours le même jour : équipes 1.., 101.., 201.., pour qu'il n'y
 * ait jamais deux « équipe 1 » à la table de marque (manuel §3.A zone 6).
 */
export function numeroPremiereEquipe(
  numerosExistants: number[],
  decalage: number | undefined,
): number {
  if (numerosExistants.length > 0) return Math.max(...numerosExistants) + 1;
  return (decalage ?? 0) + 1;
}

const NIVEAU_MOTS: Record<NiveauConcours, string> = {
  departemental: 'DEPARTEMENTAL',
  regional: 'REGIONAL',
  championnat_departemental_honorifique: 'CHAMPIONNAT-DEPARTEMENTAL-HONORIFIQUE',
  national: 'NATIONAL',
  international: 'INTERNATIONAL',
  qualificatif_departemental: 'QUALIFICATIF-DEPARTEMENTAL',
  championnat_departemental: 'CHAMPIONNAT-DEPARTEMENTAL',
  championnat_regional: 'CHAMPIONNAT-REGIONAL',
  club: 'CLUB',
  coupe_de_france: 'COUPE-DE-FRANCE',
  championnat: 'CHAMPIONNAT',
};

/**
 * Les huit niveaux de la liste fédérale, dans l'ordre de la liste déroulante
 * (manuel §3.A, copie d'écran p.13) : « Concours Départemental », « Concours
 * Régional », « Championnat Départemental Honorifique », « National »,
 * « International », « Qualificatif Départemental », « Championnat
 * Départemental », « Championnat Régional ».
 *
 * `club` et `coupe_de_france` n'y sont pas : le premier est à nous — un concours
 * interne, hors fédération — et le second relève du menu « Championnat – Coupe »
 * (§3.E), pas de cette liste.
 */
export const NIVEAUX_FEDERAUX: NiveauConcours[] = [
  'departemental',
  'regional',
  'championnat_departemental_honorifique',
  'national',
  'international',
  'qualificatif_departemental',
  'championnat_departemental',
  'championnat_regional',
];

/**
 * Le niveau est-il un championnat ? Quatre le sont dans la liste fédérale, là où
 * nous n'en avions qu'un — d'où l'impossibilité de dire lequel, et donc de
 * composer un numéro de concours (#111).
 *
 * Sert aussi à décider si la liste « Choix CDF » s'affiche. Le manuel la montre
 * pour « Championnat Départemental » et « Qualificatif Départemental » ; je
 * l'étends aux deux autres championnats, ce qui est une inférence — mais
 * proposer une liste n'impose rien, et un championnat régional se choisit dans
 * la même liste de dix-sept.
 */
export function estNiveauChampionnat(niveau: NiveauConcours | undefined): boolean {
  if (!niveau) return false;
  return (
    niveau === 'championnat_departemental' ||
    niveau === 'championnat_regional' ||
    niveau === 'championnat_departemental_honorifique' ||
    niveau === 'qualificatif_departemental' ||
    // Ancienne valeur des concours déjà en base.
    niveau === 'championnat'
  );
}

const FORMATION_MOTS: Record<TeamFormat, string> = {
  tete_a_tete: 'TETE-A-TETE',
  doublette: 'DOUBLETTE',
  triplette: 'TRIPLETTE',
};

/** Majuscules sans accent, espaces et ponctuation ramenés à des tirets. */
function motFederal(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface ParamsNomFederal {
  /** Date au format YYYY-MM-DD. */
  date: string;
  /** Code de niveau, comme dans le numéro : `DEPT`, `CD`, `QUALIF_CD`… */
  codeNiveau: string;
  /**
   * Jeu fédéral, par son **identifiant** — `petanque`, `promotion`… — et non par
   * son code. C'est ce que `numeroConcoursFederal` reçoit, et les deux fonctions
   * doivent prendre les mêmes entrées : la vérification dans l'application a
   * montré ce qu'il arrive sinon, l'écran affichant `_petanque_` au lieu de
   * `_PET_` parce que mes tests, eux, passaient déjà un code.
   */
  jeu?: JeuFederal;
  /** Code du comité, à trois chiffres (`038`). */
  comiteNumero?: string;
  /** Segment de catégorie : `T`, `DSMixte`, `TPromo`, `ISM`… */
  segment?: string;
  /** **Nom** du club organisateur, en clair — pas son numéro. */
  clubNom?: string;
}

/**
 * Nom du concours, tel que le logiciel fédéral l'écrit dans le champ du bas de
 * sa fenêtre de création (copies d'écran p.12 à p.15) :
 *
 * ```
 * 20261217_DEPT_PET_038_T_"P C PIERRE SEMARD"
 * ```
 *
 * ## Le nom, c'est le numéro avec le club en clair
 *
 * Les **cinq premiers segments sont exactement ceux du numéro** — codes de
 * niveau et de jeu, code de comité, segment de catégorie. Seul le sixième
 * diffère : le numéro porte le **code** du club (`0423`), le nom porte son
 * **nom**, entre guillemets et avec ses espaces.
 *
 * Neuf noms complets l'attestent, chacun sur un code différent : `DEPT_PET_038_T`,
 * `DEPT_PROMO_038_TPromo`, `CD_PET_038_DSMixte`, `CD_PROMO_038_TSPromo`,
 * `CD_VET_038_TV`, `CD_PROV_038_T`, `CD_TDP_038_I`, `QUALIF_CD_TDP_038_ISM`,
 * `QUALIF_CD_TDP_038_IJuniorM`.
 *
 * **Ce n'est pas ce que cette fonction faisait.** Elle écrivait les mots longs —
 * `DEPARTEMENTAL_PETANQUE_ISERE_TRIPLETTE` — et le **nom** du comité au lieu de
 * son code, alors que les codes étaient déjà dans le projet et que
 * `numeroConcoursFederal` s'en servait. Deux tests verrouillaient cette forme :
 * ce sont eux qui l'ont maintenue.
 *
 * ## Les séparateurs des segments manquants sont conservés
 *
 * L'aperçu du manuel montre le nom **se construire**, séparateurs compris :
 * `20261217___038_T_` après le choix du seul comité, et
 * `20261217_CD_PET_038__"P C PIERRE SEMARD"` quand le segment manque. Le double
 * tiret bas **est** l'information — il dit ce qui reste à renseigner — là où
 * notre ancien `filter(Boolean)` l'effaçait.
 *
 * ## Ce que le nom n'est pas
 *
 * Le **bandeau de la fenêtre de préparation** écrit autre chose encore :
 * `Nom du Concours : 20260107 DEPT PET 038 D 0103`, soit le numéro avec des
 * espaces (voir `nomDepuisNumero`). La fédération appelle donc « nom » deux
 * chaînes différentes selon l'écran ; les deux existent, et aucune ne remplace
 * l'autre.
 */
export function nomConcoursFederal(p: ParamsNomFederal): string {
  const club = p.clubNom?.trim();
  return [
    p.date.replaceAll('-', ''),
    p.codeNiveau,
    p.jeu ? (jeuFederal(p.jeu)?.code ?? '') : '',
    p.comiteNumero ?? '',
    p.segment ?? '',
    club ? `"${club}"` : '',
  ].join('_');
}

/** Libellés courts de la catégorie d'âge, pour composer la désignation d'un concours. */
const AGE_COURT: Record<CategorieAge, string> = {
  veterans: 'Vétérans',
  seniors: 'Séniors',
  juniors: 'Juniors',
  cadets: 'Cadets',
  minimes: 'Minimes',
  benjamins: 'Benjamins',
};

const SEXE_COURT: Record<Exclude<CritereSexe, 'tous'>, string> = {
  masculin: 'Masculin',
  feminin: 'Féminin',
  mixte: 'Mixte',
};

const CLASSIFICATION_COURT: Record<Exclude<CritereClassification, 'tous'>, string> = {
  elite: 'Élite',
  honneur: 'Honneur',
  promotion: 'Promotion',
};

export interface ParamsCategorie {
  categorieAge?: CategorieAge;
  critereSexe?: CritereSexe;
  critereClassification?: CritereClassification;
  /** Catégorie en texte libre (non fédéral, hors nomenclature : Open, Mixte…). */
  category?: string;
}

/**
 * Désignation de la catégorie d'un concours — source unique du libellé affiché,
 * du regroupement et du palmarès (issue #33).
 *
 * Sur un concours fédéral, elle est composée des critères normalisés dans
 * l'ordre [Sexe] [Âge] [Classification] (ex. « Féminin Vétérans Promotion ») —
 * jamais du texte libre, qui ne peut donc plus les contredire. Sur un concours
 * non fédéral, le texte libre est renvoyé tel quel. `undefined` si rien n'est
 * renseigné.
 */
export function designationCategorie(c: ParamsCategorie): string | undefined {
  const parties = [
    c.critereSexe && c.critereSexe !== 'tous' ? SEXE_COURT[c.critereSexe] : '',
    c.categorieAge ? AGE_COURT[c.categorieAge] : '',
    c.critereClassification && c.critereClassification !== 'tous'
      ? CLASSIFICATION_COURT[c.critereClassification]
      : '',
  ].filter(Boolean);
  if (parties.length > 0) return parties.join(' ');
  return c.category?.trim() || undefined;
}

/* ------------------------------------------------------------------ */
/* Reconnaître un concours fédéral                                     */
/* ------------------------------------------------------------------ */

/** Critères de contrôle des licences (manuel §3.A zones 2 à 5 et 9). */
export interface CriteresLicenceConcours {
  categorieAge?: CategorieAge;
  critereSexe?: CritereSexe;
  critereClassification?: CritereClassification;
  homogene?: boolean;
}

/**
 * Le concours pose-t-il des critères de licence ? C'est ce qui déclenche le
 * contrôle et l'écran « Dépôt des licences » : sans critère, il n'y a rien à
 * vérifier.
 */
export function aDesCriteresLicence(c: CriteresLicenceConcours): boolean {
  return Boolean(
    c.categorieAge ||
      c.homogene ||
      (c.critereSexe && c.critereSexe !== 'tous') ||
      (c.critereClassification && c.critereClassification !== 'tous'),
  );
}

/** Ce qui n'est saisi que sous la case « concours officiel ». */
export interface ParamsOfficiel extends CriteresLicenceConcours {
  niveau?: NiveauConcours;
  comiteOrganisateur?: string;
  clubOrganisateur?: string;
}

/**
 * Le concours a-t-il été déclaré officiel ? Plus large que les critères de
 * licence : un concours peut porter un niveau, un comité ou un club
 * organisateur sans imposer de critère aux licences.
 */
export function estConcoursOfficiel(c: ParamsOfficiel): boolean {
  return (
    aDesCriteresLicence(c) ||
    Boolean(c.niveau || c.comiteOrganisateur?.trim() || c.clubOrganisateur?.trim())
  );
}

/**
 * Ce club a-t-il besoin du mode fédéral ? Sert à le proposer de lui-même
 * plutôt qu'à laisser un organisateur chercher où sont passées ses fonctions :
 * un concours officiel déjà créé, ou un fichier de licenciés importé — on ne
 * l'importe pas pour rien — et le mode a sa raison d'être.
 *
 * Ce n'est qu'un défaut : un choix explicite de l'utilisateur le remplace.
 */
export function besoinModeFederal(p: {
  concours: ParamsOfficiel[];
  licencies: number;
}): boolean {
  return p.licencies > 0 || p.concours.some(estConcoursOfficiel);
}
