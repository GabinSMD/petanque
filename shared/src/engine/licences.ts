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
import type { CategorieAge, CritereClassification, CritereSexe, Licencie, Player } from '../types';
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

export type AnomalieEquipe = 'mixte' | 'homogeneite' | 'mutes' | 'horsUE';

export interface CriteresLicence {
  /** Année de référence du concours (bornes d'âge et validité de licence). */
  annee: number;
  /** Date du concours (YYYY-MM-DD) : validité du certificat médical. */
  dateConcours?: string;
  categorieAge?: CategorieAge;
  /** Interdit les catégories d'âge inférieures. */
  strict?: boolean;
  sexe?: 'tous' | 'masculin' | 'feminin' | 'mixte';
  classification?: 'tous' | 'elite' | 'honneur' | 'promotion';
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
const BORNES: Record<CategorieAge, { min?: number; max?: number; minimumOnly?: boolean }> = {
  veterans: { min: 60, minimumOnly: true },
  seniors: { min: 18 },
  juniors: { min: 15, max: 17 },
  cadets: { min: 12, max: 14 },
  minimes: { min: 9, max: 11 },
  benjamins: { max: 8 },
};

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

const CLASSIFICATION_ATTENDUE: Record<string, 'E' | 'H' | 'P' | undefined> = {
  elite: 'E',
  honneur: 'H',
  promotion: 'P',
};

/**
 * Contrôle une équipe. `fiches` est indexé par n° de licence — c'est le
 * fichier des licenciés importé dans l'organisation.
 */
export function controlerEquipe(
  players: Player[],
  fiches: Map<string, Licencie>,
  criteres: CriteresLicence,
): ControleEquipe {
  const joueurs: ControleJoueur[] = players.map((p) => {
    const anomalies: ChampLicence[] = [];
    const fiche = p.licence ? fiches.get(p.licence) : undefined;

    if (!p.licence && !criteres.ignorerLicencesManquantes) anomalies.push('licence');

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
          // Hors mode strict, la directive fédérale admet les catégories
          // inférieures : le plancher tombe, le plafond reste.
          const plancher = criteres.strict || bornes.minimumOnly ? bornes.min : undefined;
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

      const classAttendue = criteres.classification
        ? CLASSIFICATION_ATTENDUE[criteres.classification]
        : undefined;
      if (classAttendue) {
        if (!fiche.classification || fiche.classification !== classAttendue) {
          anomalies.push('classification');
        }
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
    const horsUE = fichesEquipe.filter((f) => estHorsUE(f.nationalite) === true).length;
    if (horsUE > criteres.maxHorsUE) anomaliesEquipe.push('horsUE');
  }

  // Homogénéité : tous les joueurs du même club. Le club vient de la fiche
  // fédérale quand elle existe, sinon de ce qui a été saisi à l'inscription —
  // un joueur hors fichier n'échappe pas au contrôle. On compare des noms
  // normalisés : le numéro de club ne se compare pas à un nom.
  if (criteres.homogene) {
    const clubDe = (p: Player): string | undefined => {
      const fiche = p.licence ? fiches.get(p.licence) : undefined;
      const nom = fiche?.club ?? p.club;
      if (nom) return nom.trim().toLowerCase();
      return fiche?.clubNumero?.trim().toLowerCase();
    };
    const clubs = new Set(players.map(clubDe).filter((c): c is string => Boolean(c)));
    if (clubs.size > 1) {
      anomaliesEquipe.push('homogeneite');
      for (const j of joueurs) if (!j.anomalies.includes('club')) j.anomalies.push('club');
    }
  }

  const conforme =
    anomaliesEquipe.length === 0 && joueurs.every((j) => j.anomalies.length === 0 && !j.inconnu);

  return { conforme, joueurs, anomaliesEquipe };
}
