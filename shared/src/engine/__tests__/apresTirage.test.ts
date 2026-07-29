import { describe, expect, it } from 'vitest';
import { modificationApresTirage } from '../apresTirage';
import { makeTeam } from './helpers';
import type { Team } from '../../types';

const base = (): Team => ({
  ...makeTeam(7, 'Boule de l\'Avenir'),
  players: [
    { name: 'DUPOND Jean', licence: '02600100' },
    { name: 'MARTIN Lina', licence: '02600101' },
  ],
});

function refus(avant: Team, apres: Team): string {
  const res = modificationApresTirage(avant, apres);
  if (res.ok) throw new Error('modification acceptée alors qu\'elle devait être refusée');
  return res.raison;
}

describe('ce qui peut changer après le tirage', () => {
  it('remplacer un joueur : c\'est le cas qui arrive à chaque concours', () => {
    const avant = base();
    const apres = {
      ...avant,
      players: [avant.players[0]!, { name: 'BLANC Odette', licence: '02600102' }],
    };
    expect(modificationApresTirage(avant, apres)).toEqual({ ok: true });
  });

  it('ajouter un joueur manquant : une doublette inscrite à un seul', () => {
    const avant = { ...base(), players: [base().players[0]!] };
    expect(modificationApresTirage(avant, base())).toEqual({ ok: true });
  });

  it('corriger un numéro de licence ou un club', () => {
    const avant = base();
    expect(
      modificationApresTirage(avant, {
        ...avant,
        players: [{ ...avant.players[0]!, licence: '02600999', club: 'PC Romans' }, avant.players[1]!],
      }),
    ).toEqual({ ok: true });
  });

  it('déclarer ou annuler un forfait', () => {
    const avant = base();
    expect(modificationApresTirage(avant, { ...avant, forfait: true })).toEqual({ ok: true });
  });

  it('marquer l\'engagement réglé', () => {
    const avant = base();
    expect(modificationApresTirage(avant, { ...avant, paid: true })).toEqual({ ok: true });
  });
});

describe('ce qui ne peut pas changer après le tirage', () => {
  it('le numéro de dossard : le tableau et les listes imprimées en dépendent', () => {
    const avant = base();
    expect(refus(avant, { ...avant, number: 12 })).toMatch(/numéro/i);
  });

  it('l\'identité de l\'équipe : le tableau la désigne par là', () => {
    const avant = base();
    expect(refus(avant, { ...avant, id: 'autre' })).toMatch(/équipe/i);
  });

  it('vider la composition : une équipe sans joueur ne peut pas jouer', () => {
    const avant = base();
    expect(refus(avant, { ...avant, players: [] })).toMatch(/joueur/i);
  });

  it('un joueur sans nom ne remplace personne', () => {
    const avant = base();
    expect(
      refus(avant, { ...avant, players: [avant.players[0]!, { name: '   ', licence: '02600102' }] }),
    ).toMatch(/nom/i);
  });
});
