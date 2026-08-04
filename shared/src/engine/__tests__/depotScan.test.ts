import { describe, expect, it } from 'vitest';
import { lireLicenceAuDepot } from '../depot';
import type { Licencie, Team } from '../../types';

function equipe(number: number, licences: (string | undefined)[]): Team {
  return {
    id: `t${number}`,
    concoursId: 'c1',
    number,
    players: licences.map((licence, i) => ({ name: `Joueur ${number}.${i + 1}`, licence })),
    forfait: false,
    updatedAt: '2026-08-04T00:00:00.000Z',
  };
}

const equipes = [equipe(1, ['03801221', '03801220']), equipe(2, ['03800764', '03833465'])];

describe('lecture d une licence au dépôt', () => {
  it('reconnaît un joueur de l équipe ouverte, et dit lequel', () => {
    const lu = lireLicenceAuDepot('03833465', equipes, 't2');
    expect(lu).toEqual({ type: 'equipe_ouverte', index: 1 });
  });

  it('signale une licence inscrite dans une autre équipe, avec son dossard', () => {
    // Le geste fautif du matin : on scanne la licence d'une autre équipe dans
    // l'équipe ouverte. Ce n'est pas un remplacement, c'est une méprise.
    const lu = lireLicenceAuDepot('03801221', equipes, 't2');
    expect(lu.type).toBe('autre_equipe');
    expect(lu.type === 'autre_equipe' && lu.team.number).toBe(1);
  });

  it('appelle « pas inscrit » une licence qu aucune équipe ne porte', () => {
    expect(lireLicenceAuDepot('03807307', equipes, 't2')).toEqual({
      type: 'pas_inscrit',
      fiche: undefined,
    });
  });

  it('joint la fiche du licencié quand elle existe : c est elle qui remplira', () => {
    const fiche: Licencie = {
      id: 'l1',
      name: 'EVRARD RENE',
      licence: '03807307',
      updatedAt: '2026-08-04T00:00:00.000Z',
    };
    const lu = lireLicenceAuDepot('03807307', equipes, 't2', new Map([['03807307', fiche]]));
    expect(lu).toEqual({ type: 'pas_inscrit', fiche });
  });

  it('sans équipe ouverte, une licence connue désigne son équipe', () => {
    // Le scan à froid : la licence ouvre l'équipe qui la porte. C'est le geste
    // qui existait déjà, et il ne doit pas se perdre.
    const lu = lireLicenceAuDepot('03800764', equipes, null);
    expect(lu.type).toBe('autre_equipe');
    expect(lu.type === 'autre_equipe' && lu.team.number).toBe(2);
  });

  it('une saisie vide n accroche pas une équipe dont un joueur a une licence vide', () => {
    // Le cas discriminant, trouvé par sabotage : un import CSV laisse des
    // licences à chaîne vide. Sans le filtre sur la saisie, `find` les
    // rencontrerait et ouvrirait une équipe au hasard sur un Entrée à blanc.
    const licenceVide = [equipe(3, ['', ''])];
    expect(lireLicenceAuDepot('  ', licenceVide, null)).toEqual({
      type: 'pas_inscrit',
      fiche: undefined,
    });
  });
});
