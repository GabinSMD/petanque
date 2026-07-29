/**
 * Phases finales après un concours en rondes (manuel §3.D.15).
 *
 * Le logiciel fédéral s'arrête au bout des 3 ou 4 parties « gagnant contre
 * gagnant » : il exporte le classement vers Excel, et un second programme —
 * le « LOGICIEL DE GESTION DES PHASES FINALES SWISS SYSTEM » — génère le
 * tableau à élimination directe. Ici tout se passe dans le même concours :
 * pas d'export, pas de réimport, le classement des rondes alimente
 * directement le tableau.
 *
 * Le manuel prévoit deux configurations (l'information n'est que dans ses
 * copies d'écran) : deux tableaux de 16 entrant en huitièmes — concours A et
 * B — ou trois tableaux de 8 entrant en quarts — concours A, B et C. Les
 * mieux classés vont dans le A, les suivants dans le B, et ainsi de suite :
 * chacun continue à jouer à son niveau.
 *
 * Sur les égalités, le manuel est explicite : « si confrontation directe,
 * l'équipe victorieuse passe devant ». Ce qu'aucune confrontation ne
 * départage reste signalé comme tel, à l'organisateur de trancher.
 */
import type { Match, MatchStage, Team } from '../types';
import type { EngineCtx } from './ctx';
import { drawElimination } from './bracket';
import { confrontationDirecte, memeNiveau, rondeStandings, type Standing } from './rondes';

/** Une configuration de phases finales : la taille de chaque tableau. */
export interface ConfigFinales {
  id: string;
  label: string;
  /** Taille de chaque tableau, dans l'ordre : concours A, B, puis C. */
  blocs: number[];
  hint: string;
}

/**
 * Configurations proposées. Les deux dernières sont celles du manuel ; les
 * quatre premières servent aux concours plus petits, qu'un tableau unique
 * suffit à conclure.
 */
export const CONFIGS_FINALES: readonly ConfigFinales[] = [
  {
    id: 'finale',
    label: 'Finale seule',
    blocs: [2],
    hint: 'Les deux premiers du classement se disputent le concours.',
  },
  {
    id: 'demies',
    label: 'Demi-finales',
    blocs: [4],
    hint: 'Les quatre premiers : deux demies puis la finale.',
  },
  {
    id: 'quarts',
    label: 'Quarts de finale',
    blocs: [8],
    hint: 'Les huit premiers : quarts, demies, finale.',
  },
  {
    id: 'huitiemes',
    label: 'Huitièmes de finale',
    blocs: [16],
    hint: 'Les seize premiers : huitièmes, quarts, demies, finale.',
  },
  {
    id: 'huitiemes_ab',
    label: '1/8 A + 1/8 B',
    blocs: [16, 16],
    hint: 'Configuration fédérale : les 16 premiers en concours A, les 16 suivants en concours B.',
  },
  {
    id: 'quarts_abc',
    label: '1/4 A + 1/4 B + 1/4 C',
    blocs: [8, 8, 8],
    hint: 'Configuration fédérale : trois concours de 8, par tranches du classement.',
  },
];

/** Tableaux des blocs, dans l'ordre : le concours A est le tableau principal. */
const STAGES: readonly MatchStage[] = ['principal', 'consolante', 'complementaire'];

/** Nom du bloc, tel qu'on l'annonce : concours A, B ou C. */
export function nomDuBloc(index: number): string {
  return `Concours ${String.fromCharCode(65 + index)}`;
}

/**
 * Configurations qu'un effectif permet. Un tableau unique doit être plein —
 * avec six équipes on joue les demies, pas des quarts à deux exempts. Le
 * dernier tableau d'une configuration à plusieurs blocs peut en revanche être
 * incomplet : les qualifiés en trop doivent bien jouer quelque part.
 */
export function configsPossibles(nbEntrants: number): ConfigFinales[] {
  return CONFIGS_FINALES.filter((c) => {
    if (c.blocs.length === 1) return nbEntrants >= c.blocs[0]!;
    const avantDernier = c.blocs.slice(0, -1).reduce((a, b) => a + b, 0);
    return nbEntrants >= avantDernier + 2;
  });
}

/** Une ligne de classement prête pour les phases finales. */
export interface LigneClassement extends Standing {
  /** Rang, partagé quand une égalité n'a pas pu être départagée. */
  rang: number;
  /** Vrai quand cette ligne reste à égalité avec une autre. */
  exAequo: boolean;
}

/**
 * Classement des rondes en vue des phases finales : victoires, goal-average,
 * points marqués — puis, entre équipes que cela laisse à égalité, leur
 * confrontation directe.
 *
 * `ordreManuel` est la main de l'organisateur : la liste ordonnée des inscrits
 * qu'il a lui-même départagés. Elle ne s'applique **qu'à l'intérieur d'un
 * groupe d'ex æquo** — une main ne doit pas pouvoir faire passer une équipe
 * devant une autre qui a plus de victoires.
 */
export function classementFinales(
  entrants: Team[],
  matches: Match[],
  ordreManuel: string[] = [],
): LigneClassement[] {
  const base = rondeStandings(entrants, matches);
  const lignes: LigneClassement[] = [];

  let i = 0;
  while (i < base.length) {
    let fin = i;
    while (fin + 1 < base.length && memeNiveau(base[i]!, base[fin + 1]!)) fin += 1;
    const groupe = base.slice(i, fin + 1);

    if (groupe.length === 1) {
      lignes.push({ ...groupe[0]!, rang: i + 1, exAequo: false });
    } else {
      // À égalité de critères : la main de l'organisateur d'abord, puis la
      // confrontation directe.
      const rangManuel = (id: string): number => {
        const k = ordreManuel.indexOf(id);
        return k === -1 ? Number.POSITIVE_INFINITY : k;
      };
      const compare = (a: Standing, b: Standing): number => {
        const ma = rangManuel(a.id);
        const mb = rangManuel(b.id);
        if (ma !== mb) return ma - mb;
        return -confrontationDirecte(a.id, b.id, matches);
      };
      // Dernier recours pour l'ordre d'affichage : l'identifiant. Sans lui,
      // deux appels avec les inscrits dans un ordre différent afficheraient les
      // ex æquo dans un ordre différent — et une interversion à la main
      // porterait sur une autre ligne que celle qu'on voit.
      const ordonne = [...groupe].sort((a, b) => compare(a, b) || a.id.localeCompare(b.id));
      // Rang : le nombre d'équipes du groupe qui passent strictement devant.
      const devant = (s: Standing): number =>
        ordonne.filter((autre) => autre.id !== s.id && compare(autre, s) < 0).length;
      for (const s of ordonne) {
        const rang = i + 1 + devant(s);
        const exAequo = ordonne.some(
          (autre) => autre.id !== s.id && i + 1 + devant(autre) === rang,
        );
        lignes.push({ ...s, rang, exAequo });
      }
    }
    i = fin + 1;
  }
  return lignes;
}

/** Les groupes d'inscrits qu'aucun critère ne départage. */
export function groupesExAequo(lignes: LigneClassement[]): LigneClassement[][] {
  const parRang = new Map<number, LigneClassement[]>();
  for (const l of lignes) {
    if (!l.exAequo) continue;
    const g = parRang.get(l.rang) ?? [];
    g.push(l);
    parRang.set(l.rang, g);
  }
  return [...parRang.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => g);
}

/**
 * Construit les tableaux des phases finales à partir du classement.
 *
 * Chaque bloc prend la tranche suivante du classement et devient un tableau à
 * élimination directe entièrement déterminé par les rangs : le 1er contre le
 * dernier, le 2e contre l'avant-dernier, et les mieux classés placés pour se
 * rencontrer le plus tard possible. Aucun hasard n'intervient — c'est le
 * classement des rondes qui décide, comme dans le classeur fédéral.
 *
 * Quand un tableau est incomplet, les exempts reviennent aux mieux classés.
 */
export function buildFinales(
  concoursId: string,
  lignes: LigneClassement[],
  config: ConfigFinales,
  teams: Team[],
  ctx: EngineCtx,
): Match[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const out: Match[] = [];
  let debut = 0;

  for (const [i, taille] of config.blocs.entries()) {
    const stage = STAGES[i];
    if (!stage) break;
    const bloc = lignes
      .slice(debut, debut + taille)
      .map((l) => byId.get(l.id))
      .filter((t): t is Team => Boolean(t));
    debut += taille;

    if (bloc.length < 2) {
      if (i === 0) {
        throw new Error('Il faut au moins 2 qualifiés pour lancer les phases finales');
      }
      // Un seul qualifié en trop : pas de quoi jouer un tableau de plus.
      break;
    }
    out.push(
      ...drawElimination(concoursId, stage, bloc, ctx, { seeds: bloc.map((t) => t.id) }),
    );
  }
  return out;
}
