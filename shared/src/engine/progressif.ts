/**
 * Entrée au tableau au fil des poules (manuel « Gestion Concours » §3.D.1.A).
 *
 * Le logiciel fédéral n'attend pas la dernière poule : dès qu'une équipe sort,
 * on la place dans une case libre du tableau, « de façon tout à fait
 * aléatoire », et la partie se joue dès qu'elle est couverte par une
 * adversaire. Une poule qui traîne ne bloque donc pas le concours.
 *
 * La case ne mémorise pas l'équipe mais **d'où elle vient** (`qualifFrom`) :
 * corriger un résultat de poule met le tableau à jour tout seul, exactement
 * comme pour les places de repêchage.
 */
import type { Match, Poule } from '../types';
import type { EngineCtx } from './ctx';
import { shuffle } from './ctx';
import { nextPow2 } from './bracket';
import { winnerOf } from './match';

/** Un qualifié attendu : la poule d'où il sort, et son rang (1er ou 2e). */
export interface Qualifie {
  pouleId: string;
  rang: 1 | 2;
  /** `pouleId:rang`, la référence écrite dans la case du tableau. */
  ref: string;
  /** Équipe qualifiée, telle qu'elle est connue à cet instant. */
  teamId: string;
}

const refDe = (pouleId: string, rang: 1 | 2): string => `${pouleId}:${rang}`;

/**
 * Tableau principal créé vide, dimensionné pour les qualifiés attendus
 * (2 par poule). Les exempts sont posés dès la création : on sait combien il y
 * en aura, même si on ne sait pas encore qui.
 */
export function buildTableauVide(
  concoursId: string,
  nbQualifies: number,
  ctx: EngineCtx,
): Match[] {
  if (nbQualifies < 2) return [];
  const size = nextPow2(nbQualifies);
  const byes = size - nbQualifies;
  const now = ctx.now();
  const matches: Match[] = [];

  // Exempts répartis régulièrement : une moitié de tableau ne doit pas
  // concentrer les places vides.
  const unites = size / 2;
  const avecExempt = new Set<number>();
  if (byes > 0) {
    const pas = unites / byes;
    for (let i = 0; i < byes; i += 1) avecExempt.add(Math.floor(i * pas));
  }

  const rounds = Math.log2(size);
  for (let round = 0; round < rounds; round += 1) {
    const count = size >> (round + 1);
    for (let position = 0; position < count; position += 1) {
      matches.push({
        id: ctx.newId(),
        concoursId,
        stage: 'principal',
        round,
        position,
        teamAId: null,
        teamBId: null,
        byeB: round === 0 && avecExempt.has(position) ? true : undefined,
        scoreA: null,
        scoreB: null,
        done: false,
        terrain: null,
        updatedAt: now,
      });
    }
  }
  return matches;
}

/**
 * Qualifiés désormais connus et pas encore placés dans le tableau. Le 1er
 * d'une poule est connu dès la partie des gagnants, le 2e après le barrage :
 * ils entrent donc séparément, sans attendre que la poule soit finie.
 */
export function qualifiesManquants(poules: Poule[], matches: Match[]): Qualifie[] {
  const dejaPlaces = new Set(
    matches.flatMap((m) => [m.qualifFromA, m.qualifFromB]).filter((r): r is string => Boolean(r)),
  );

  const out: Qualifie[] = [];
  for (const poule of poules) {
    const pouleMatches = matches.filter((m) => m.pouleId === poule.id);
    const gagnants = pouleMatches.find((m) => m.pouleSlot === 'GAGNANTS');
    const barrage = pouleMatches.find((m) => m.pouleSlot === 'BARRAGE');
    const candidats: [1 | 2, string | null][] = [
      [1, winnerOf(gagnants)],
      [2, winnerOf(barrage)],
    ];
    for (const [rang, teamId] of candidats) {
      if (!teamId) continue;
      const ref = refDe(poule.id, rang);
      if (dejaPlaces.has(ref)) continue;
      out.push({ pouleId: poule.id, rang, ref, teamId });
    }
  }
  return out;
}

/**
 * Place un qualifié dans une case libre du premier tour.
 *
 * Le manuel dit « de façon tout à fait aléatoire ». On garde ce hasard, avec
 * une préférence : ne pas faire rejouer immédiatement deux équipes de la même
 * poule, et éviter de réunir dans la même moitié les deux qualifiés d'une
 * poule. Ce sont des préférences et non des règles : si aucune case ne les
 * satisfait, on place quand même — mieux vaut un tableau complet qu'un
 * concours arrêté.
 */
export function placerQualifie(matches: Match[], qualifie: Qualifie, ctx: EngineCtx): Match[] {
  const principal = matches.filter((m) => m.stage === 'principal' && m.round === 0);
  if (principal.length === 0) return matches;

  /** Poule d'origine d'une case déjà occupée. */
  const pouleDeRef = (ref: string | undefined): string | undefined => ref?.split(':')[0];

  interface Place {
    match: Match;
    cote: 'A' | 'B';
  }
  const libres: Place[] = [];
  for (const m of principal) {
    if (!m.qualifFromA && !m.byeA) libres.push({ match: m, cote: 'A' });
    if (!m.qualifFromB && !m.byeB) libres.push({ match: m, cote: 'B' });
  }
  if (libres.length === 0) return matches;

  const moitie = (m: Match): 0 | 1 => (m.position * 2 < principal.length ? 0 : 1);
  const memePouleDansMoitie = new Set<0 | 1>();
  for (const m of principal) {
    for (const ref of [m.qualifFromA, m.qualifFromB]) {
      if (pouleDeRef(ref) === qualifie.pouleId) memePouleDansMoitie.add(moitie(m));
    }
  }

  const cout = (place: Place): number => {
    const enFace = place.cote === 'A' ? place.match.qualifFromB : place.match.qualifFromA;
    let c = 0;
    // Adversaire immédiat de la même poule : à éviter en premier.
    if (pouleDeRef(enFace) === qualifie.pouleId) c += 10;
    // Moitié qui contient déjà l'autre qualifié de la poule.
    if (memePouleDansMoitie.has(moitie(place.match))) c += 1;
    return c;
  };

  const meilleurCout = Math.min(...libres.map(cout));
  const candidates = shuffle(
    libres.filter((p) => cout(p) === meilleurCout),
    ctx.rng,
  );
  const choisie = candidates[0]!;

  return matches.map((m) =>
    m.id === choisie.match.id
      ? {
          ...m,
          ...(choisie.cote === 'A'
            ? { qualifFromA: qualifie.ref }
            : { qualifFromB: qualifie.ref }),
        }
      : m,
  );
}
