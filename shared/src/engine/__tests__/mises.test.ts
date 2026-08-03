import { describe, expect, it } from 'vitest';
import {
  ETATS_MISE,
  bilanMises,
  etatMise,
  etatMiseDepuisTexte,
  poserMise,
} from '../mises';
import type { Team } from '../../types';

const equipe = (over: Partial<Team> = {}): Team => ({
  id: over.id ?? 't1',
  concoursId: 'c1',
  number: over.number ?? 1,
  players: [{ name: 'A' }, { name: 'B' }],
  forfait: false,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('les trois états des mises (§3.B.1, zone 19)', () => {
  it('porte les trois positions du cadre, dans son ordre', () => {
    // Cadre « Mises » de la fenêtre d'inscription : Non Payé, Payé, Facturation.
    expect(ETATS_MISE).toEqual(['non_paye', 'paye', 'facturation']);
  });

  it('lit l\'état de l\'équipe', () => {
    expect(etatMise(equipe({ mise: 'facturation' }))).toBe('facturation');
    expect(etatMise(equipe({ mise: 'paye' }))).toBe('paye');
    expect(etatMise(equipe({ mise: 'non_paye' }))).toBe('non_paye');
  });
});

describe('reprise des équipes déjà en base', () => {
  it('un booléen `paid` à vrai se lit « payé »', () => {
    // Les équipes inscrites avant ce lot n'ont que ce booléen : elles doivent
    // rester réglées, pas repasser impayées.
    expect(etatMise(equipe({ paid: true }))).toBe('paye');
  });

  it('un booléen à faux ou absent se lit « non payé »', () => {
    expect(etatMise(equipe({ paid: false }))).toBe('non_paye');
    expect(etatMise(equipe({}))).toBe('non_paye');
  });

  it('le nouvel état prime sur l\'ancien booléen', () => {
    // Cas d'une équipe passée en facturation depuis un appareil à jour, puis
    // relue : le booléen ne doit pas la ramener à « payé ».
    expect(etatMise(equipe({ mise: 'facturation', paid: true }))).toBe('facturation');
  });
});

describe('poser une mise garde l\'ancien booléen en accord', () => {
  it('« payé » met le booléen à vrai', () => {
    // Un appareil resté sur l'ancienne version ne lit que `paid` : le laisser
    // divergerait afficherait toute la liste comme impayée après une
    // synchronisation.
    const t = poserMise(equipe(), 'paye');
    expect(t.mise).toBe('paye');
    expect(t.paid).toBe(true);
  });

  it('« non payé » et « facturation » mettent le booléen à faux', () => {
    expect(poserMise(equipe({ paid: true }), 'non_paye').paid).toBe(false);
    // Facturation n'est pas encaissé : pour l'ancien écran, ce n'est pas réglé.
    expect(poserMise(equipe({ paid: true }), 'facturation').paid).toBe(false);
  });

  it('garde le commentaire quand on change d\'état', () => {
    const t = poserMise(equipe({ commentaireMise: 'chèque n° 214' }), 'paye');
    expect(t.commentaireMise).toBe('chèque n° 214');
  });
});

describe('bilan des mises (§3.B.9.D)', () => {
  const teams = [
    equipe({ id: '1', number: 1, mise: 'paye' }),
    equipe({ id: '2', number: 2, mise: 'paye' }),
    equipe({ id: '3', number: 3, mise: 'facturation' }),
    equipe({ id: '4', number: 4, mise: 'non_paye' }),
    // Ancienne équipe, réglée avant ce lot.
    equipe({ id: '5', number: 5, paid: true }),
    // Forfait : elle ne joue pas, elle compte à part.
    equipe({ id: '6', number: 6, mise: 'paye', forfait: true }),
  ];

  it('compte les équipes par état, forfaits à part', () => {
    const b = bilanMises(teams, 8);
    expect(b.parEtat).toEqual({ non_paye: 1, paye: 3, facturation: 1 });
    expect(b.forfaits).toBe(1);
  });

  it('la facturation n\'est pas encaissée : c\'est tout l\'intérêt du troisième état', () => {
    const b = bilanMises(teams, 8);
    expect(b.encaisse).toBe(24); // 3 payées × 8 €
    expect(b.aFacturer).toBe(8); // 1 en facturation
    expect(b.restantDu).toBe(8); // 1 non payée
  });

  it('sans mise par équipe, les montants sont nuls mais les comptes tiennent', () => {
    const b = bilanMises(teams, 0);
    expect(b.encaisse).toBe(0);
    expect(b.aFacturer).toBe(0);
    expect(b.parEtat.paye).toBe(3);
  });

  it('sans équipe, tout est à zéro', () => {
    expect(bilanMises([], 8)).toEqual({
      parEtat: { non_paye: 0, paye: 0, facturation: 0 },
      encaisse: 0,
      aFacturer: 0,
      restantDu: 0,
      forfaits: 0,
    });
  });
});

describe('relire une mise depuis un fichier', () => {
  it('reconnaît les trois états en clair', () => {
    expect(etatMiseDepuisTexte('Facturation')).toBe('facturation');
    expect(etatMiseDepuisTexte('facturation')).toBe('facturation');
    expect(etatMiseDepuisTexte('Payé')).toBe('paye');
    expect(etatMiseDepuisTexte('paye')).toBe('paye');
    expect(etatMiseDepuisTexte('Non payé')).toBe('non_paye');
  });

  it('reconnaît les anciens fichiers, où la colonne était « Réglé : oui »', () => {
    // Un organisateur peut réimporter un export de la version précédente : la
    // colonne y valait « oui » ou rien du tout.
    expect(etatMiseDepuisTexte('oui')).toBe('paye');
    expect(etatMiseDepuisTexte('O')).toBe('paye');
    expect(etatMiseDepuisTexte('x')).toBe('paye');
    expect(etatMiseDepuisTexte('1')).toBe('paye');
    expect(etatMiseDepuisTexte('true')).toBe('paye');
    expect(etatMiseDepuisTexte('non')).toBe('non_paye');
    expect(etatMiseDepuisTexte('')).toBe('non_paye');
    expect(etatMiseDepuisTexte(undefined)).toBe('non_paye');
  });

  it('ne prend pas « non payé » pour un « oui »', () => {
    // Le piège : « non payé » contient « paye ». Une reconnaissance trop lâche
    // marquerait réglées toutes les équipes qui ne le sont pas.
    expect(etatMiseDepuisTexte('Non Payé')).toBe('non_paye');
    expect(etatMiseDepuisTexte('non paye')).toBe('non_paye');
  });
});
