import { describe, expect, it } from 'vitest';
import { departementDeLicence, rapportDelegue } from '../rapportDelegue';
import { drawElimination, applyChanges, propagate } from '../bracket';
import { makeTeams, playStageRound, testCtx } from './helpers';
import type { Team } from '../../types';

/** Un tableau de 8 équipes joué jusqu'au bout. */
function concoursJoue(): { teams: Team[]; matches: ReturnType<typeof drawElimination> } {
  const teams = makeTeams(8).map((t, i) => ({
    ...t,
    club: `Club ${i + 1}`,
    players: t.players.map((p, j) => ({
      ...p,
      licence: `07${String(400000 + i * 100 + j).padStart(6, '0')}`,
    })),
  }));
  let matches = drawElimination('c1', 'principal', teams, testCtx());
  for (const r of [0, 1, 2]) matches = playStageRound(matches, 'principal', r);
  matches = applyChanges(matches, propagate(matches));
  return { teams, matches };
}

describe('département déduit du numéro de licence', () => {
  it('prend les trois premiers chiffres', () => {
    // Relevé sur le document du manuel (p.112) : 07411559 → 074, 02604451 →
    // 026, 00101957 → 001.
    expect(departementDeLicence('07411559')).toBe('074');
    expect(departementDeLicence('02604451')).toBe('026');
    expect(departementDeLicence('00101957')).toBe('001');
  });

  it('ne devine pas sur un numéro qui n\'en est pas un', () => {
    // Mieux vaut une colonne vide qu'un département inventé : le délégué
    // remplira à la main.
    for (const faux of ['', '123', 'abcdefgh', '0260010', '026001000']) {
      expect(departementDeLicence(faux)).toBeUndefined();
    }
    expect(departementDeLicence(undefined)).toBeUndefined();
  });
});

describe('rapport du délégué (§3.D.15)', () => {
  it('range du perdant le plus précoce au champion', () => {
    // L'ordre du document fédéral, l'inverse du nôtre : « Perdants 1/8 finale »
    // en tête, « Champion » en dernier.
    const { teams, matches } = concoursJoue();
    const rapport = rapportDelegue(teams, matches);
    const labels = rapport.sections.map((s) => s.label);
    expect(labels[labels.length - 1]).toBe('Champion');
    expect(labels[labels.length - 2]).toBe('Finaliste');
    expect(labels[0]).toMatch(/Perdants/);
  });

  it('nomme le vainqueur « Champion », comme le document', () => {
    const { teams, matches } = concoursJoue();
    const rapport = rapportDelegue(teams, matches);
    expect(rapport.sections.map((s) => s.label)).toContain('Champion');
    expect(rapport.sections.map((s) => s.label)).not.toContain('Vainqueur');
  });

  it('porte le département de chaque joueur', () => {
    const { teams, matches } = concoursJoue();
    const rapport = rapportDelegue(teams, matches);
    const joueurs = rapport.sections.flatMap((s) => s.teams.flatMap((t) => t.players));
    expect(joueurs.length).toBeGreaterThan(0);
    expect(joueurs.every((j) => j.departement === '074')).toBe(true);
  });

  it('laisse le département vide plutôt que de l\'inventer', () => {
    const teams = makeTeams(2).map((t) => ({
      ...t,
      players: t.players.map((p) => ({ ...p, licence: undefined })),
    }));
    let matches = drawElimination('c1', 'principal', teams, testCtx());
    matches = playStageRound(matches, 'principal', 0);
    const rapport = rapportDelegue(teams, matches);
    const joueurs = rapport.sections.flatMap((s) => s.teams.flatMap((t) => t.players));
    expect(joueurs.every((j) => j.departement === undefined)).toBe(true);
  });

  it('garde le numéro de dossard de chaque équipe', () => {
    // C'est la colonne « N° d'équipe » du document, celle qui permet de
    // recouper avec le graphique.
    const { teams, matches } = concoursJoue();
    const rapport = rapportDelegue(teams, matches);
    const numeros = rapport.sections.flatMap((s) => s.teams.map((t) => t.number));
    expect(numeros.every((n) => n >= 1 && n <= 8)).toBe(true);
    expect(new Set(numeros).size).toBe(numeros.length);
  });

  it('ne rend rien sur un concours qui n\'a pas commencé', () => {
    const teams = makeTeams(8);
    const matches = drawElimination('c1', 'principal', teams, testCtx());
    expect(rapportDelegue(teams, matches).sections).toEqual([]);
  });
});
