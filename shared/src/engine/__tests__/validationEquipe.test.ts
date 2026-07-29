import { describe, expect, it } from 'vitest';
import { validerEquipe } from '../validationEquipe';
import type { Team } from '../../types';

const EQUIPE: Team = {
  id: 'e1',
  concoursId: 'c1',
  number: 7,
  players: [{ name: 'DUPOND Jean' }, { name: 'MARTIN Lina', licence: '02600101' }],
  forfait: false,
  updatedAt: '2026-07-29T10:00:00.000Z',
};

/** Le motif de refus, ou `null` si l'équipe est acceptée. */
function raison(candidat: unknown): string | null {
  const res = validerEquipe(candidat);
  return res.ok ? null : res.raison;
}

describe('validation d\'une équipe à l\'écriture', () => {
  it('accepte une équipe normale', () => {
    expect(validerEquipe(EQUIPE)).toEqual({ ok: true });
  });

  it('accepte les champs facultatifs absents ou renseignés', () => {
    expect(validerEquipe({ ...EQUIPE, club: undefined, paid: undefined })).toEqual({ ok: true });
    expect(
      validerEquipe({
        ...EQUIPE,
        club: 'Boule de l\'Avenir',
        paid: true,
        licencesDeposees: '2026-07-29T09:00:00.000Z',
        players: [{ name: 'DUPOND Jean', licence: '02600100', club: 'Crest', role: 'tireur' }],
      }),
    ).toEqual({ ok: true });
  });

  it('refuse une liste de joueurs qui n\'est pas une liste', () => {
    // Le cas vécu : un appel passe { players: [...] } au lieu du tableau.
    // Écrit tel quel, l'équipe fait planter l'écran des inscriptions — et le
    // rechargement aussi, puisque la donnée est en base.
    expect(raison({ ...EQUIPE, players: { players: [{ name: 'DUPOND Jean' }] } })).toMatch(
      /joueurs/i,
    );
    expect(raison({ ...EQUIPE, players: undefined })).toMatch(/joueurs/i);
    expect(raison({ ...EQUIPE, players: 'DUPOND Jean' })).toMatch(/joueurs/i);
  });

  it('refuse une équipe sans joueur', () => {
    expect(raison({ ...EQUIPE, players: [] })).toMatch(/aucun joueur|sans joueur/i);
  });

  it('refuse un joueur qui n\'est pas un joueur', () => {
    expect(raison({ ...EQUIPE, players: [{ name: 'DUPOND Jean' }, null] })).toMatch(/joueur/i);
    expect(raison({ ...EQUIPE, players: ['MARTIN Lina'] })).toMatch(/joueur/i);
  });

  it('refuse un joueur sans nom', () => {
    expect(raison({ ...EQUIPE, players: [{ name: '   ' }] })).toMatch(/nom/i);
    expect(raison({ ...EQUIPE, players: [{ licence: '02600100' }] })).toMatch(/nom/i);
  });

  it('refuse une équipe sans identité : rien ne la retrouverait', () => {
    expect(raison({ ...EQUIPE, id: '' })).toMatch(/identifiant/i);
    expect(raison({ ...EQUIPE, id: undefined })).toMatch(/identifiant/i);
    expect(raison({ ...EQUIPE, concoursId: '' })).toMatch(/concours/i);
  });

  it('refuse un dossard qui n\'est pas un numéro de dossard', () => {
    // Le tableau, les listes imprimées et la saisie rapide désignent l'équipe
    // par son numéro : 0, un décimal ou un texte n'en est pas un.
    for (const number of [0, -3, 2.5, '7', undefined, Number.NaN]) {
      expect(raison({ ...EQUIPE, number })).toMatch(/dossard/i);
    }
  });

  it('refuse ce qui n\'est pas une équipe du tout', () => {
    for (const intrus of [null, undefined, 42, 'équipe', []]) {
      expect(raison(intrus)).toMatch(/équipe/i);
    }
  });

  it('dit toujours quoi corriger', () => {
    // Un refus muet au point d'écriture est aussi opaque qu'un écran blanc.
    const refus = [
      { ...EQUIPE, players: [] },
      { ...EQUIPE, number: 0 },
      null,
    ].map((x) => raison(x));
    expect(refus.every((r) => r !== null && r.length > 15)).toBe(true);
  });
});
