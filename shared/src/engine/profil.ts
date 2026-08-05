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
