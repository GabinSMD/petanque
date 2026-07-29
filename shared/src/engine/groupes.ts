/**
 * Formule par groupes A-B-C (manuel « Gestion Concours » §3.D.5).
 *
 * Un groupe de 4 se joue comme une poule, mais **sans barrage** — et son issue
 * n'est pas « 2 qualifiés / 2 éliminés » mais un partage en trois, par nombre de
 * victoires :
 *
 *  - 2 victoires  → concours **A** ;
 *  - 1 victoire   → concours **B**, pour les **deux** équipes concernées, qui ne
 *    se départagent donc pas ;
 *  - 2 défaites   → concours **C**.
 *
 * Chaque équipe joue ainsi la suite du concours, ce qui est tout l'intérêt de la
 * formule : personne ne rentre après deux parties.
 */
import type { Match, Team } from '../types';
import type { Protections } from './protections';
import type { EngineCtx } from './ctx';
import { drawElimination, drawMainFromPoules } from './bracket';
import type { PouleGroupOutcome, PouleOutcome } from './poules';

export interface OptionsGroupes {
  /** Groupes de clubs protégés au tirage (manuel §3.B.5). */
  protections?: Protections;
  sansProtection?: boolean;
}

/**
 * Construit les trois tableaux depuis les bilans de groupes.
 *
 * Le concours B réutilise l'appariement des poules : ses deux équipes venant du
 * même groupe viennent de s'y départager, les faire rejouer d'emblée n'aurait
 * pas de sens — c'est exactement la règle que `drawMainFromPoules` applique aux
 * premier et second d'une même poule.
 *
 * Les concours A et C reçoivent une équipe par groupe : un tirage ordinaire,
 * protection club comprise, suffit.
 */
export function drawGroupesABC(
  concoursId: string,
  outcomes: PouleGroupOutcome[],
  teams: Team[],
  ctx: EngineCtx,
  opts: OptionsGroupes = {},
): Match[] {
  const inacheve = outcomes.find((o) => !o.complete);
  if (inacheve) {
    throw new Error(`Le groupe ${inacheve.poule.index + 1} n'est pas terminé`);
  }

  const parId = new Map(teams.map((t) => [t.id, t]));
  const equipes = (ids: (string | null)[]): Team[] =>
    ids.map((id) => (id ? parId.get(id) : undefined)).filter((t): t is Team => Boolean(t));

  const optionsTirage = {
    protections: opts.protections,
    sansProtection: opts.sansProtection,
    teamsById: parId,
  };

  const out: Match[] = [];

  const a = equipes(outcomes.map((o) => o.gg));
  if (a.length >= 2) {
    out.push(...drawElimination(concoursId, 'principal', a, ctx, optionsTirage));
  }

  // Concours B : deux équipes par groupe, présentées comme les deux qualifiés
  // d'une poule pour bénéficier de leur règle de séparation.
  const bilansB: PouleOutcome[] = outcomes
    .filter((o) => o.gp.length === 2)
    .map((o) => ({
      poule: o.poule,
      complete: true,
      q1: o.gp[0]!,
      q2: o.gp[1]!,
      eliminated: [],
    }));
  if (bilansB.length >= 1) {
    out.push(...drawMainFromPoules(concoursId, bilansB, ctx, 'consolante'));
  }

  const c = equipes(outcomes.map((o) => o.pp));
  if (c.length >= 2) {
    out.push(...drawElimination(concoursId, 'complementaire', c, ctx, optionsTirage));
  }

  return out;
}
