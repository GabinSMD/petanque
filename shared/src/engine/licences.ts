/**
 * Contrôle de validité des licences (manuel « Gestion Concours » §3.C et
 * §3.B.1 zone 26).
 *
 * Le logiciel fédéral allume un voyant vert ou rouge par joueur et surligne
 * le champ fautif. On reproduit ce comportement : le contrôle rend, pour
 * chaque joueur, la liste des champs en anomalie, plus les anomalies qui ne
 * se jugent qu'au niveau de l'équipe (mixité, homogénéité de club).
 *
 * Principe : on ne signale que ce que les données prouvent. Un joueur absent
 * du fichier fédéral est marqué « inconnu » plutôt que déclaré non conforme
 * sur tel ou tel critère ; en revanche, si un critère est explicitement
 * demandé et que la donnée nécessaire manque, c'est une anomalie — on ne peut
 * pas certifier ce qu'on ne sait pas.
 */
import type {
  CategorieAge,
  Classification,
  CritereClassification,
  CritereSexe,
  Licencie,
  Player,
} from '../types';
import { estHorsUE } from './championnat';

/** Champs susceptibles d'être en anomalie, tels que le manuel les surligne. */
export type ChampLicence =
  | 'licence'
  | 'anneeReprise'
  | 'dateNaissance'
  | 'sexe'
  | 'classification'
  | 'certificatMedical'
  | 'club';

export type AnomalieEquipe =
  | 'mixte'
  | 'homogeneite'
  | 'mutes'
  | 'horsUE'
  /**
   * Le club déclaré pour l'équipe est incorrect : elle n'est pas homogène, donc
   * il devrait valoir **N.H.** (manuel §3.B.6, rapport p.28 : « Equipe 3 : Club
   * Equipe Incorrect : devrait être NH »).
   */
  | 'clubEquipeNonHomogene'
  /**
   * Le club déclaré n'est pas celui des joueurs, qui sont tous du même. Variante
   * que le manuel ne montre pas — mais c'est la même contradiction, et elle a
   * les mêmes conséquences.
   */
  | 'clubEquipeErrone';

/**
 * Catégorie qu'un concours peut **exiger**. C'est presque la catégorie d'un
 * joueur, à une valeur près : le `+55` du panneau « Critères Personnels » des
 * compétitions de clubs (§3.E) est un critère de sélection, jamais la catégorie
 * d'appartenance de quelqu'un — un joueur de 57 ans est sénior, et le reste.
 * D'où deux types : `categorieAgeDe` rend l'une, `CriteresLicence` demande
 * l'autre.
 */
export type CategorieCritere = CategorieAge | 'plus55';

/**
 * Catégories qu'un **concours** peut exiger, dans l'ordre de la fenêtre
 * « Création Nouveau Concours » : Vétéran, Sénior, Junior, Cadet, Minime,
 * Benjamin — et pas de `+55`, qui n'existe que sur le panneau des compétitions
 * de clubs. Sans cette liste, le `+55` ajouté pour le CNC se retrouvait proposé
 * à la création d'un concours, où il aurait écrit en base une catégorie que
 * `Concours.categorieAge` ne connaît pas.
 */
export const CATEGORIES_AGE_CONCOURS: CategorieAge[] = [
  'veterans',
  'seniors',
  'juniors',
  'cadets',
  'minimes',
  'benjamins',
];

export interface CriteresLicence {
  /** Année de référence du concours (bornes d'âge et validité de licence). */
  annee: number;
  /** Date du concours (YYYY-MM-DD) : validité du certificat médical. */
  dateConcours?: string;
  categorieAge?: CategorieCritere;
  /**
   * Catégorie **stricte** : la case du même nom de la fenêtre fédérale. Cochée,
   * seule la catégorie demandée joue. Décochée, une seule catégorie s'ouvre en
   * dessous — la fenêtre le dit dans ses propres étiquettes, qui deviennent
   * « Sénior (Junior) », « Junior (Cadet) », « Cadet (Min.) », « Minime (Benj.) ».
   */
  strict?: boolean;
  sexe?: 'tous' | 'masculin' | 'feminin' | 'mixte';
  classification?: 'tous' | 'elite' | 'honneur' | 'promotion' | 'nonClasse';
  /** Équipes homogènes exigées (tous les joueurs du même club). */
  homogene?: boolean;
  /**
   * Certificats médicaux validés à la main par la table de marque, sur
   * présentation du papier (n° de licence).
   */
  certificatsValides?: Set<string>;
  /**
   * Concours de club : ne pas reprocher aux joueurs de ne pas avoir de n° de
   * licence saisi.
   */
  ignorerLicencesManquantes?: boolean;
  /**
   * Compétitions de clubs (manuel §3.E) : nombre de joueurs mutés autorisés,
   * fixé par l'organisateur, et nombre de joueurs hors Union européenne —
   * un seul par équipe.
   */
  maxMutes?: number;
  maxHorsUE?: number;
}

/**
 * Critères de contrôle déduits d'un concours. Le calcul était recopié dans
 * l'écran des licences ; il sert maintenant aussi au bilan avant tirage, et
 * deux copies auraient divergé.
 */
export function criteresDuConcours(c: {
  date: string;
  categorieAge?: CategorieAge;
  strict?: boolean;
  critereSexe?: CritereSexe;
  critereClassification?: CritereClassification;
  homogene?: boolean;
  certificatsValides?: string[];
  maxMutes?: number;
  maxHorsUE?: number;
}): CriteresLicence {
  return {
    annee: Number(c.date.slice(0, 4)),
    dateConcours: c.date,
    categorieAge: c.categorieAge,
    strict: c.strict,
    sexe: c.critereSexe,
    classification: c.critereClassification,
    homogene: c.homogene,
    certificatsValides: new Set(c.certificatsValides ?? []),
    maxMutes: c.maxMutes,
    maxHorsUE: c.maxHorsUE,
  };
}

export interface ControleJoueur {
  name: string;
  licence?: string;
  /** Champs en anomalie (rouge dans le logiciel fédéral). */
  anomalies: ChampLicence[];
  /** Licence saisie mais absente du fichier des licenciés. */
  inconnu: boolean;
  categorie?: CategorieAge;
}

export interface ControleEquipe {
  conforme: boolean;
  joueurs: ControleJoueur[];
  anomaliesEquipe: AnomalieEquipe[];
}

/**
 * Bornes d'âge fédérales (manuel §3.C), calculées sur l'année en cours.
 * `minimumOnly` : la catégorie se définit par un âge plancher — « vétérans »
 * ne s'ouvre donc pas aux plus jeunes, même hors mode strict.
 */
const BORNES: Record<CategorieCritere, { min?: number; max?: number; minimumOnly?: boolean }> = {
  veterans: { min: 60, minimumOnly: true },
  // §3.E : le « +55 » du panneau des compétitions de clubs. Un plancher, comme
  // les vétérans — personne n'est trop vieux pour un championnat +55.
  plus55: { min: 55, minimumOnly: true },
  seniors: { min: 18 },
  juniors: { min: 15, max: 17 },
  cadets: { min: 12, max: 14 },
  minimes: { min: 9, max: 11 },
  benjamins: { max: 8 },
};

/**
 * Les catégories de la plus âgée à la plus jeune, telles que le panneau fédéral
 * les liste. Sert à trouver « celle du dessous », et rien d'autre.
 */
const ORDRE: CategorieCritere[] = [
  'veterans',
  'plus55',
  'seniors',
  'juniors',
  'cadets',
  'minimes',
  'benjamins',
];

/**
 * Plancher d'âge quand une seule catégorie s'ouvre en dessous : c'est le
 * plancher de cette catégorie-là. Un critère qui est déjà un plancher
 * (vétérans, +55) ne descend pas : « et celle du dessous » n'a pas de sens quand
 * il n'y a pas de plafond.
 */
function plancherUneEnDessous(categorie: CategorieCritere): number | undefined {
  const bornes = BORNES[categorie];
  if (bornes.minimumOnly) return bornes.min;
  const dessous = categorieDuDessous(categorie);
  return dessous ? BORNES[dessous].min : bornes.min;
}

/**
 * La catégorie qui s'ouvre en dessous hors mode strict, ou `undefined` s'il n'y
 * en a pas : rien sous la plus jeune, et rien sous un plancher — le manuel ne
 * met pas de parenthèse à « Vétéran », et un sénior n'entre pas dans un concours
 * vétérans.
 *
 * Sert aussi aux écrans, pour dire en clair ce que le mode non strict admet.
 */
export function categorieDuDessous(
  categorie: CategorieCritere,
): CategorieCritere | undefined {
  if (BORNES[categorie].minimumOnly) return undefined;
  return ORDRE[ORDRE.indexOf(categorie) + 1];
}

/** Âge fédéral : différence des millésimes, sans tenir compte du jour. */
export function ageFederal(dateNaissance: string, annee: number): number {
  return annee - Number(dateNaissance.slice(0, 4));
}

/** Catégorie d'âge d'un joueur, de la plus âgée à la plus jeune. */
export function categorieAgeDe(
  dateNaissance: string | undefined,
  annee: number,
): CategorieAge | undefined {
  if (!dateNaissance) return undefined;
  const age = ageFederal(dateNaissance, annee);
  if (age >= 60) return 'veterans';
  if (age >= 18) return 'seniors';
  if (age >= 15) return 'juniors';
  if (age >= 12) return 'cadets';
  if (age >= 9) return 'minimes';
  return 'benjamins';
}

/** Un jeune : certificat médical exigé. */
function estJeune(categorie: CategorieAge | undefined): boolean {
  return (
    categorie === 'juniors' ||
    categorie === 'cadets' ||
    categorie === 'minimes' ||
    categorie === 'benjamins'
  );
}

const SEXE_ATTENDU: Record<string, 'M' | 'F' | undefined> = {
  masculin: 'M',
  feminin: 'F',
};

/**
 * Les cinq positions de classification de la fenêtre fédérale (planche p.13,
 * confirmée p.14) : `Tous / Elite / Honneur / Promotion/NC / Non Classé`.
 *
 * Chaque critère se lit comme un ensemble de niveaux admis. Le classement
 * fédéral en a **quatre** — E, H, P et non classé : le rapport d'arbitrage le
 * prouve (`Joueurs Classés : 30/64` avec `Elite : 13` et `Honneur : 17`, donc
 * 13 + 17 = 30 et Promotion n'est pas « classé »).
 *
 * `nonClasse` n'accepte **aucune** lettre : c'est ce qui le distingue de
 * `promotion`, dont l'étiquette fédérale est `Promotion/NC` et qui accepte
 * donc Promotion **ou** non classé.
 */
const CLASSIFICATION_ADMISE: Record<
  string,
  { lettres: readonly Classification[]; nonClasse: boolean } | undefined
> = {
  elite: { lettres: ['E'], nonClasse: false },
  honneur: { lettres: ['H'], nonClasse: false },
  promotion: { lettres: ['P'], nonClasse: true },
  nonClasse: { lettres: [], nonClasse: true },
};

/**
 * Contrôle une équipe. `fiches` est indexé par n° de licence — c'est le
 * fichier des licenciés importé dans l'organisation.
 */
export function controlerEquipe(
  players: Player[],
  fiches: Map<string, Licencie>,
  criteres: CriteresLicence,
  /**
   * Club déclaré pour l'équipe (`Team.club`). Facultatif : les appelants qui
   * n'ont que des joueurs — la feuille de match — ne peuvent pas le fournir, et
   * ne perdent rien de ce qu'ils contrôlaient.
   */
  clubEquipe?: string,
): ControleEquipe {
  const joueurs: ControleJoueur[] = players.map((p) => {
    const anomalies: ChampLicence[] = [];
    const fiche = p.licence ? fiches.get(p.licence) : undefined;

    // Une licence étrangère est une licence : le joueur n'est pas « sans ».
    // Ses autres critères restent invérifiables faute de fiche fédérale, et on
    // ne les invente pas.
    if (!p.licence && !p.licenceEtrangere && !criteres.ignorerLicencesManquantes) {
      anomalies.push('licence');
    }

    const categorie = categorieAgeDe(fiche?.dateNaissance, criteres.annee);

    if (fiche) {
      // Licence à jour : l'année en cours ou la suivante.
      if (
        fiche.anneeReprise !== undefined &&
        fiche.anneeReprise !== criteres.annee &&
        fiche.anneeReprise !== criteres.annee + 1
      ) {
        anomalies.push('anneeReprise');
      }

      if (criteres.categorieAge) {
        const bornes = BORNES[criteres.categorieAge];
        if (!fiche.dateNaissance) {
          anomalies.push('dateNaissance');
        } else {
          const age = ageFederal(fiche.dateNaissance, criteres.annee);
          // Hors mode strict, **une seule** catégorie s'ouvre en dessous : le
          // plancher descend d'un cran, il ne disparaît pas. Le plafond, lui, ne
          // bouge jamais.
          const plancher =
            criteres.strict || bornes.minimumOnly
              ? bornes.min
              : plancherUneEnDessous(criteres.categorieAge);
          const plafond = bornes.max;
          if (
            (plancher !== undefined && age < plancher) ||
            (plafond !== undefined && age > plafond)
          ) {
            anomalies.push('dateNaissance');
          }
        }
      }

      const sexeAttendu = criteres.sexe ? SEXE_ATTENDU[criteres.sexe] : undefined;
      if (sexeAttendu) {
        if (!fiche.sexe || fiche.sexe !== sexeAttendu) anomalies.push('sexe');
      }

      const admise = criteres.classification
        ? CLASSIFICATION_ADMISE[criteres.classification]
        : undefined;
      if (admise) {
        // Notre colonne d'import confond un non-classé (cellule vide) avec une
        // classification inconnue (valeur illisible, ou colonne absente). D'où
        // l'asymétrie, qui n'est pourtant qu'une seule règle : une fiche muette
        // passe quand le critère accepte les non-classés, et se fait refuser
        // quand il exige une lettre — un concours réservé à l'élite demande la
        // preuve d'être élite, qu'un silence ne donne pas.
        const conforme = fiche.classification
          ? admise.lettres.includes(fiche.classification)
          : admise.nonClasse;
        if (!conforme) anomalies.push('classification');
      }

      // Certificat médical : jeunes uniquement, sauf validation manuelle.
      if (estJeune(categorie) && !(p.licence && criteres.certificatsValides?.has(p.licence))) {
        const fin = fiche.certificatMedical;
        const perime = criteres.dateConcours ? !fin || fin < criteres.dateConcours : !fin;
        if (perime) anomalies.push('certificatMedical');
      }
    }

    return {
      name: p.name,
      licence: p.licence,
      anomalies,
      inconnu: Boolean(p.licence) && !fiche,
      categorie,
    };
  });

  const anomaliesEquipe: AnomalieEquipe[] = [];
  const fichesEquipe = players
    .map((p) => (p.licence ? fiches.get(p.licence) : undefined))
    .filter((f): f is Licencie => Boolean(f));

  // Mixité : au moins un homme et une femme dans l'équipe.
  if (criteres.sexe === 'mixte') {
    const sexes = new Set(fichesEquipe.map((f) => f.sexe).filter(Boolean));
    if (!(sexes.has('M') && sexes.has('F'))) {
      anomaliesEquipe.push('mixte');
      for (const j of joueurs) if (!j.anomalies.includes('sexe')) j.anomalies.push('sexe');
    }
  }

  // Contingent de mutés (manuel §3.E) : compté sur les fiches connues.
  if (criteres.maxMutes !== undefined) {
    const mutes = fichesEquipe.filter((f) => f.mutation).length;
    if (mutes > criteres.maxMutes) anomaliesEquipe.push('mutes');
  }

  // Contingent de joueurs hors UE : un seul par équipe. Une nationalité
  // illisible ne compte pas — voir `estHorsUE`.
  if (criteres.maxHorsUE !== undefined) {
    // Deux sources : la nationalité des fiches fédérales, et le pays d'une
    // licence étrangère (§3.B.1, zone 21) — un joueur licencié en Suisse compte
    // sans avoir de fiche française.
    const horsUEFiches = fichesEquipe.filter((f) => estHorsUE(f.nationalite) === true).length;
    const horsUEEtrangers = players.filter(
      (p) => p.licenceEtrangere && estHorsUE(p.licenceEtrangere) === true,
    ).length;
    if (horsUEFiches + horsUEEtrangers > criteres.maxHorsUE) anomaliesEquipe.push('horsUE');
  }

  /**
   * Club d'un joueur, normalisé. La fiche fédérale fait foi quand elle existe,
   * sinon ce qui a été saisi à l'inscription — un joueur hors fichier n'échappe
   * pas au contrôle. À défaut de nom, le numéro de club : il distingue deux
   * clubs entre eux, même s'il ne se compare pas à un nom.
   */
  const clubDe = (p: Player): string | undefined => {
    const fiche = p.licence ? fiches.get(p.licence) : undefined;
    const nom = fiche?.club ?? p.club;
    if (nom) return nom.trim().toLowerCase();
    return fiche?.clubNumero?.trim().toLowerCase();
  };

  // Homogénéité : tous les joueurs du même club.
  if (criteres.homogene) {
    const clubs = new Set(players.map(clubDe).filter((c): c is string => Boolean(c)));
    if (clubs.size > 1) {
      anomaliesEquipe.push('homogeneite');
      for (const j of joueurs) if (!j.anomalies.includes('club')) j.anomalies.push('club');
    }
  }

  /*
   * Cohérence du club déclaré pour l'équipe — **indépendante du critère
   * d'homogénéité**, et c'est tout l'enjeu : l'homogénéité est une exigence du
   * concours, la cohérence du club d'équipe est une **erreur de saisie**, fausse
   * même sur un concours ouvert à tous.
   *
   * Elle compte parce que quatre endroits lisent `Team.club` **directement**,
   * sans passer par `clubsEquipe` : le rapport d'arbitrage et le rapport du
   * délégué l'impriment, le tri « par club » des listes s'en sert, et la
   * répartition multisite groupe les équipes dessus — une équipe mal étiquetée
   * part sur le mauvais site.
   *
   * On ne compare que des **noms** : le club d'équipe est un nom, et un joueur
   * dont on ne connaît que le numéro fédéral ne peut ni le confirmer ni le
   * démentir. L'ignorer vaut mieux qu'une fausse anomalie.
   */
  const declare = clubEquipe?.trim().toLowerCase();
  if (declare) {
    const nomsJoueurs = new Set(
      players
        .map((p) => {
          const fiche = p.licence ? fiches.get(p.licence) : undefined;
          const nom = fiche?.club ?? p.club;
          return nom?.trim().toLowerCase();
        })
        .filter((c): c is string => Boolean(c)),
    );
    if (nomsJoueurs.size > 1) anomaliesEquipe.push('clubEquipeNonHomogene');
    else if (nomsJoueurs.size === 1 && !nomsJoueurs.has(declare)) {
      anomaliesEquipe.push('clubEquipeErrone');
    }
  }

  const conforme =
    anomaliesEquipe.length === 0 && joueurs.every((j) => j.anomalies.length === 0 && !j.inconnu);

  return { conforme, joueurs, anomaliesEquipe };
}
