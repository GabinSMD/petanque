import { describe, expect, it } from 'vitest';
import { applyChanges, drawElimination, propagate } from '../bracket';
import { marquerRetirage, placerVainqueur, vainqueursManquants } from '../retirage';
import { isByeMatch, winnerOf } from '../match';
import { makeTeams, playStageRound, testCtx } from './helpers';
import type { Match } from '../../types';

/** Tableau de 8 équipes, premier tour joué. */
function premierTourJoue() {
  const matches = marquerRetirage(
    drawElimination('c1', 'principal', makeTeams(8), testCtx()),
    'principal',
  );
  return playStageRound(matches, 'principal', 0);
}

describe('retirage à chaque tour (§3.D.1.A)', () => {
  it('liste les vainqueurs qui n\'ont pas encore de place au tour suivant', () => {
    const matches = premierTourJoue();
    const attente = vainqueursManquants(matches, 'principal');
    expect(attente).toHaveLength(4);
    // Chaque entrée désigne la partie d'où sort le vainqueur.
    expect(attente.every((v) => matches.some((m) => m.id === v.matchId))).toBe(true);
  });

  it('ne liste rien avant que les parties soient jouées', () => {
    const matches = marquerRetirage(
      drawElimination('c1', 'principal', makeTeams(8), testCtx()),
      'principal',
    );
    expect(vainqueursManquants(matches, 'principal')).toEqual([]);
  });

  it('place un vainqueur dans une case libre du tour suivant', () => {
    let matches = premierTourJoue();
    const [premier] = vainqueursManquants(matches, 'principal');
    matches = placerVainqueur(matches, 'principal', premier!, testCtx());
    const refs = matches
      .filter((m) => m.round === 1)
      .flatMap((m) => [m.vainqueurDeA, m.vainqueurDeB])
      .filter(Boolean);
    expect(refs).toEqual([premier!.matchId]);
    // Et il n'attend plus.
    expect(vainqueursManquants(matches, 'principal')).toHaveLength(3);
  });

  it('la place retient la partie source, pas l\'équipe', () => {
    // C'est ce qui fait qu'une correction se répercute : la case dit « le
    // vainqueur de la partie X », et la propagation relit qui c'est.
    let matches = premierTourJoue();
    for (const v of vainqueursManquants(matches, 'principal')) {
      matches = placerVainqueur(matches, 'principal', v, testCtx());
    }
    matches = applyChanges(matches, propagate(matches));
    const source = matches.find((m) => m.round === 0 && !isByeMatch(m))!;
    const gagnantAvant = winnerOf(source)!;
    const place = matches.find(
      (m) => m.vainqueurDeA === source.id || m.vainqueurDeB === source.id,
    )!;
    expect([place.teamAId, place.teamBId]).toContain(gagnantAvant);

    // On inverse le score de la partie source.
    matches = matches.map((m) =>
      m.id === source.id ? { ...m, scoreA: m.scoreB, scoreB: m.scoreA } : m,
    );
    matches = applyChanges(matches, propagate(matches));
    const apres = matches.find((m) => m.id === place.id)!;
    expect([apres.teamAId, apres.teamBId]).toContain(winnerOf(
      matches.find((m) => m.id === source.id),
    ));
    expect([apres.teamAId, apres.teamBId]).not.toContain(gagnantAvant);
  });

  it('remplit tout le tour quand tous les vainqueurs sont placés', () => {
    let matches = premierTourJoue();
    for (const v of vainqueursManquants(matches, 'principal')) {
      matches = placerVainqueur(matches, 'principal', v, testCtx());
    }
    matches = applyChanges(matches, propagate(matches));
    const tour1 = matches.filter((m) => m.round === 1);
    expect(tour1).toHaveLength(2);
    expect(tour1.every((m) => m.teamAId && m.teamBId)).toBe(true);
  });

  it('se joue jusqu\'à la finale', () => {
    let matches = marquerRetirage(
      drawElimination('c1', 'principal', makeTeams(8), testCtx()),
      'principal',
    );
    for (let r = 0; r < 3; r += 1) {
      matches = playStageRound(matches, 'principal', r);
      for (const v of vainqueursManquants(matches, 'principal')) {
        matches = placerVainqueur(matches, 'principal', v, testCtx());
      }
      matches = applyChanges(matches, propagate(matches));
    }
    const finale = matches.find((m) => m.round === 2)!;
    expect(winnerOf(finale)).toBeTruthy();
  });

  it('ne place pas deux fois le même vainqueur', () => {
    let matches = premierTourJoue();
    const [v] = vainqueursManquants(matches, 'principal');
    matches = placerVainqueur(matches, 'principal', v!, testCtx());
    const avant = matches.filter((m) => m.vainqueurDeA === v!.matchId || m.vainqueurDeB === v!.matchId);
    matches = placerVainqueur(matches, 'principal', v!, testCtx());
    const apres = matches.filter((m) => m.vainqueurDeA === v!.matchId || m.vainqueurDeB === v!.matchId);
    expect(apres).toEqual(avant);
  });

  it('un exempt compte comme un vainqueur : il monte aussi', () => {
    // 6 équipes : deux exempts au premier tour. Leurs équipes doivent être
    // tirées au tour suivant comme les autres.
    let matches = marquerRetirage(
      drawElimination('c1', 'principal', makeTeams(6), testCtx()),
      'principal',
    );
    matches = playStageRound(matches, 'principal', 0);
    const attente = vainqueursManquants(matches, 'principal');
    expect(attente).toHaveLength(4); // 2 parties réelles + 2 exempts
  });

  it('le vainqueur de la finale n\'attend rien', () => {
    // Il n'y a pas de tour après. Le proposer ferait apparaître une place à
    // tirer qui n'existe pas.
    let matches = marquerRetirage(
      drawElimination('c1', 'principal', makeTeams(4), testCtx()),
      'principal',
    );
    matches = playStageRound(matches, 'principal', 0);
    for (const v of vainqueursManquants(matches, 'principal')) {
      matches = placerVainqueur(matches, 'principal', v, testCtx());
    }
    matches = applyChanges(matches, propagate(matches));
    matches = playStageRound(matches, 'principal', 1);
    expect(vainqueursManquants(matches, 'principal')).toEqual([]);
  });

  it('n\'écrase pas une place réservée à un exempt', () => {
    // Cadrage différé (§3.D.11) : le tour 2 porte des exempts. Un vainqueur
    // tiré ne doit pas prendre leur place — ce serait supprimer l'exempt.
    let matches = marquerRetirage(
      drawElimination('c1', 'principal', makeTeams(48), testCtx(), { tourCadrage: 1 }),
      'principal',
    );
    const exemptsAvant = matches.filter((m) => m.round === 1 && isByeMatch(m)).length;
    expect(exemptsAvant).toBe(8);
    matches = playStageRound(matches, 'principal', 0);
    for (const v of vainqueursManquants(matches, 'principal')) {
      matches = placerVainqueur(matches, 'principal', v, testCtx());
    }
    // Aucune place d'exempt n'a reçu de référence : les 8 exempts sont intacts.
    const surExempt = matches.filter(
      (m) => m.round === 1 && ((m.byeB && m.vainqueurDeB) || (m.byeA && m.vainqueurDeA)),
    );
    expect(surExempt).toEqual([]);
  });

  it('ne touche pas au tour déjà tiré positionnellement', () => {
    // Sans retirage, le tableau monte tout seul : `vainqueursManquants` ne doit
    // pas proposer de replacer un vainqueur déjà arrivé par l'arbre.
    let matches = drawElimination('c1', 'principal', makeTeams(8), testCtx());
    matches = playStageRound(matches, 'principal', 0);
    matches = applyChanges(matches, propagate(matches));
    const tour1 = matches.filter((m) => m.round === 1);
    // La propagation positionnelle a rempli le tour 1 : les places sont prises.
    expect(tour1.every((m) => m.teamAId && m.teamBId)).toBe(true);
    // Le retirage ne s'applique qu'à un tableau qui l'attend : les places
    // occupées sans référence ne sont pas libres.
    const libres = matches
      .filter((m) => m.round === 1)
      .flatMap((m) => [m.vainqueurDeA, m.vainqueurDeB])
      .filter(Boolean);
    expect(libres).toEqual([]);
  });
});
