/**
 * « Recherche Résultats Club » (manuel §3.D.1.D, la loupe) : « elle permet
 * également de rechercher les résultats des équipes d'un club ».
 *
 * La loupe de `recherche.ts` répond à « où joue cette équipe ? ». Le président
 * de club qui passe à la table de marque pose une autre question : « où en sont
 * mes équipes ? ». Il veut, pour chacune, le concours où elle se trouve (A, B
 * ou C), le dernier tour atteint ou sa place, et si elle est encore en jeu.
 * C'est ce que rend ce module, en relisant les classements déjà calculés
 * (`bracketRanking`, `pouleOutcome`) plutôt qu'en recalculant un parcours.
 *
 * Le logiciel fédéral ne trouve que les équipes **homogènes** (un seul club).
 * On garde aussi les équipes mixtes où joue un licencié du club : écartées, le
 * président ne saurait pas qu'elles existent. Elles sont signalées comme telles.
 */
import type { Match, MatchStage, Poule, Team } from '../types';
import { bracketRanking, bracketSizeOf, roundLabel } from './bracket';
import { clubsEquipe } from './clubs';
import { isByeMatch, loserOf, winnerOf } from './match';
import { pouleOutcome } from './poules';
import { estQualificatif } from './qualification';

/** Où en est l'équipe dans le concours. */
export type EtatParcoursEquipe =
  /** Encore une partie à jouer, ou qualifiée pour le tour suivant. */
  | 'en_jeu'
  /** Battue dans le dernier concours où elle est entrée. */
  | 'eliminee'
  /** A gagné la finale de son concours. */
  | 'vainqueur'
  /** Qualificatif : a gagné le dernier tour, le tableau s'arrête là. */
  | 'qualifiee'
  | 'forfait'
  /** Ni poule ni tableau : le tirage n'est pas encore fait. */
  | 'non_tiree';

export interface ParcoursEquipe {
  team: Team;
  /**
   * Concours où se trouve l'équipe : `A` (principal), `B` (consolante), `C`
   * (complémentaire). Absent tant qu'elle n'est qu'en poule ou en rondes.
   */
  concours?: 'A' | 'B' | 'C';
  etat: EtatParcoursEquipe;
  /** Ce qu'on annonce : « Quarts de finale », « Éliminée en poule 3 »… */
  libelle: string;
  /** Rang de l'équipe dans son concours, quand le classement le donne. */
  place?: number;
  /** Équipe mixte : le club n'y a qu'une partie des joueurs. */
  homogene: boolean;
}

/** Ordre de passage : une équipe ne remonte jamais du B vers le A. */
const STAGES_TABLEAU: { stage: MatchStage; lettre: 'A' | 'B' | 'C' }[] = [
  { stage: 'principal', lettre: 'A' },
  { stage: 'consolante', lettre: 'B' },
  { stage: 'complementaire', lettre: 'C' },
];

/** Sans accents ni casse, comme la loupe : on tape ce qu'on entend. */
const normaliser = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('fr-FR')
    .trim();

const joue = (m: Match, teamId: string): boolean => m.teamAId === teamId || m.teamBId === teamId;

/** Parcours d'une équipe, quel que soit son club. */
export function parcoursEquipe(
  team: Team,
  poules: Poule[],
  matches: Match[],
): Omit<ParcoursEquipe, 'homogene'> {
  if (team.forfait) return { team, etat: 'forfait', libelle: 'Forfait' };

  // Le dernier tableau où elle apparaît est celui où elle se trouve : les
  // perdants descendent du A vers le B, jamais l'inverse.
  for (const { stage, lettre } of [...STAGES_TABLEAU].reverse()) {
    const duTableau = matches.filter((m) => m.stage === stage);
    const siennes = duTableau
      .filter((m) => joue(m, team.id) && !isByeMatch(m))
      .sort((a, b) => a.round - b.round);
    const exemptee = duTableau.some((m) => joue(m, team.id) && isByeMatch(m));
    if (siennes.length === 0 && !exemptee) continue;

    const taille = bracketSizeOf(duTableau);
    const avecExempts = duTableau.some((m) => m.round === 0 && isByeMatch(m));
    const dernierTour = Math.max(...duTableau.map((m) => m.round));
    const tour = (r: number): string => roundLabel(taille, r, avecExempts);
    const derniere = siennes[siennes.length - 1];

    // Pas encore jouée (ou seulement exemptée) : elle attend sa partie. Tant
    // que l'adversaire n'est pas connu — l'autre poule n'a pas fini — on dit
    // qu'elle est qualifiée, pas qu'elle joue.
    if (!derniere || !derniere.done) {
      // Exemptée au cadrage sans partie suivante encore garnie : elle attend
      // le tour d'après.
      const r = derniere?.round ?? (exemptee ? 1 : 0);
      const adversaireConnu = Boolean(derniere?.teamAId && derniere?.teamBId);
      return {
        team,
        concours: lettre,
        etat: 'en_jeu',
        libelle: adversaireConnu ? `En jeu : ${tour(r)}` : `Qualifiée pour : ${tour(r)}`,
      };
    }
    if (loserOf(derniere) === team.id) {
      const groupe = bracketRanking(matches, stage).find((g) => g.teamIds.includes(team.id));
      return {
        team,
        concours: lettre,
        etat: 'eliminee',
        libelle: groupe?.label ?? `Éliminée : ${tour(derniere.round)}`,
        ...(groupe ? { place: groupe.rank } : {}),
      };
    }
    // Gagnée.
    if (winnerOf(derniere) === team.id && derniere.round === dernierTour) {
      return estQualificatif(matches, stage)
        ? { team, concours: lettre, etat: 'qualifiee', libelle: 'Qualifiée' }
        : { team, concours: lettre, etat: 'vainqueur', libelle: 'Vainqueur', place: 1 };
    }
    // Gagnée, la partie suivante n'est pas encore garnie.
    return {
      team,
      concours: lettre,
      etat: 'en_jeu',
      libelle: `Qualifiée pour : ${tour(derniere.round + 1)}`,
    };
  }

  const poule = poules.find((p) => p.teamIds.includes(team.id));
  if (poule) {
    const issue = pouleOutcome(poule, matches.filter((m) => m.pouleId === poule.id));
    if (issue.eliminated.includes(team.id)) {
      return { team, etat: 'eliminee', libelle: `Éliminée en poule ${poule.index}` };
    }
    if (issue.q1 === team.id || issue.q2 === team.id) {
      const rang = issue.q1 === team.id ? '1re' : '2e';
      return { team, etat: 'en_jeu', libelle: `Qualifiée ${rang} de la poule ${poule.index}` };
    }
    return { team, etat: 'en_jeu', libelle: `En poule ${poule.index}` };
  }

  // Concours en rondes : pas de tour atteint, on dit le bilan.
  const rondes = matches.filter((m) => m.stage === 'ronde' && joue(m, team.id) && m.done);
  if (rondes.length > 0) {
    const victoires = rondes.filter((m) => winnerOf(m) === team.id).length;
    return {
      team,
      etat: 'en_jeu',
      libelle: `${victoires} victoire${victoires > 1 ? 's' : ''} en ${rondes.length} partie${
        rondes.length > 1 ? 's' : ''
      }`,
    };
  }

  return { team, etat: 'non_tiree', libelle: 'Pas encore tirée' };
}

export interface ResultatsClub {
  /** Les clubs reconnus par la requête, tels qu'ils sont écrits. */
  clubs: string[];
  equipes: ParcoursEquipe[];
}

/**
 * Résultats des équipes d'un club. La requête est un nom de club, entier ou en
 * partie (« romans » trouve « PC Romans »). Moins de deux lettres ne cherchent
 * rien : « r » rendrait la moitié du concours.
 */
export function resultatsClub(
  teams: Team[],
  poules: Poule[],
  matches: Match[],
  requete: string,
): ResultatsClub {
  const q = normaliser(requete);
  if (q.length < 2) return { clubs: [], equipes: [] };

  const clubs = new Map<string, string>();
  const equipes: ParcoursEquipe[] = [];
  for (const team of teams) {
    const siens = clubsEquipe(team.players, team.club);
    const trouves = siens.filter((c) => normaliser(c).includes(q));
    if (trouves.length === 0) continue;
    for (const c of trouves) clubs.set(normaliser(c), c);
    equipes.push({ ...parcoursEquipe(team, poules, matches), homogene: siens.length <= 1 });
  }

  return {
    clubs: [...clubs.values()].sort((a, b) => a.localeCompare(b, 'fr')),
    equipes: equipes.sort((a, b) => a.team.number - b.team.number),
  };
}
