/**
 * Formules de concours du manuel fédéral « Gestion Concours » (§3.D).
 *
 * Un concours FFPJP peut faire coexister plusieurs tableaux — le A
 * (`principal`), le B (`consolante`) et le C (`complementaire`) — et
 * « reverser » les perdants d'un tableau dans un autre, à un tour précis.
 * Chaque formule se ramène donc à une table de récupération.
 */
import type { Formule, Match, MatchStage } from '../types';
import { buildRecoveryBracket, type RecoveryEntry } from './bracket';
import type { EngineCtx } from './ctx';
import { isByeMatch } from './match';

/** « Le perdant du tour `fromRound` de `from` entre au tour `toRound` de `to` ». */
export interface RecoveryRule {
  from: MatchStage;
  fromRound: number;
  to: MatchStage;
  toRound: number;
}

const LOSER_1TA: RecoveryRule = {
  from: 'principal',
  fromRound: 0,
  to: 'consolante',
  toRound: 0,
};
const LOSER_1TB: RecoveryRule = {
  from: 'consolante',
  fromRound: 0,
  to: 'complementaire',
  toRound: 0,
};

export const FORMULE_RULES: Record<Formule, RecoveryRule[]> = {
  a: [],
  ab: [LOSER_1TA],
  abc: [LOSER_1TA, LOSER_1TB],
  abc_recup: [
    LOSER_1TA,
    { from: 'principal', fromRound: 1, to: 'consolante', toRound: 1 },
    LOSER_1TB,
  ],
  abc_cd19: [
    LOSER_1TA,
    { from: 'principal', fromRound: 1, to: 'complementaire', toRound: 0 },
    LOSER_1TB,
  ],
};

/**
 * Formule d'un concours : celle qui est enregistrée, sinon celle que
 * décrivent les cases « consolante » et « complémentaire ».
 */
export function formuleOf(concours: {
  formule?: Formule;
  consolante: boolean;
  complementaire?: boolean;
}): Formule {
  if (concours.formule) return concours.formule;
  if (!concours.consolante) return 'a';
  return concours.complementaire ? 'abc' : 'ab';
}

/** Le B doit être construit avant le C, qui peut s'alimenter chez lui. */
const BUILD_ORDER: MatchStage[] = ['consolante', 'complementaire'];

/**
 * Construit les tableaux secondaires (B puis C) d'un tableau principal déjà
 * tiré, selon la formule choisie. Les parties retournées sont nouvelles ;
 * le tableau principal n'est pas modifié.
 */
export function buildFormuleBrackets(
  concoursId: string,
  mainMatches: Match[],
  formule: Formule,
  ctx: EngineCtx,
): Match[] {
  const rules = FORMULE_RULES[formule];
  if (rules.length === 0) return [];

  let known = mainMatches;
  const created: Match[] = [];

  for (const stage of BUILD_ORDER) {
    const entries: RecoveryEntry[] = [];
    for (const rule of rules.filter((r) => r.to === stage)) {
      const sources = known
        .filter((m) => m.stage === rule.from && m.round === rule.fromRound && !isByeMatch(m))
        .sort((a, b) => a.position - b.position);
      for (const s of sources) {
        entries.push({ loserFrom: s.id, deferred: rule.toRound > 0 });
      }
    }
    if (entries.length === 0) continue;
    const bracket = buildRecoveryBracket(concoursId, stage, entries, ctx);
    created.push(...bracket);
    known = [...known, ...bracket];
  }
  return created;
}
