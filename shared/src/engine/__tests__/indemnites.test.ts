import { describe, expect, it } from 'vitest';
import { repartitionIndemnites } from '../indemnites';
import type { RankGroup } from '../bracket';

const groupes: RankGroup[] = [
  { rank: 1, label: 'Vainqueur', teamIds: ['a'] },
  { rank: 2, label: 'Finaliste', teamIds: ['b'] },
  { rank: 3, label: 'Demi-finalistes', teamIds: ['c', 'd'] },
  { rank: 5, label: 'Éliminés en quarts', teamIds: ['e', 'f', 'g', 'h'] },
  { rank: 9, label: 'Éliminés en 8èmes', teamIds: ['i', 'j', 'k', 'l', 'm', 'n', 'o', 'p'] },
];

describe('répartition des indemnités', () => {
  it('distribue tout le pot quand tous les rangs sont payés', () => {
    const r = repartitionIndemnites(groupes, 1000, undefined);
    expect(r.lignes.every((l) => l.paye)).toBe(true);
    // Arrondi à 0,10 € près : le total reste proche du pot.
    expect(Math.abs(r.totalDistribue - 1000)).toBeLessThan(2);
  });

  it('le vainqueur touche plus que le finaliste, qui touche plus que les demis', () => {
    const r = repartitionIndemnites(groupes, 1000, undefined);
    const par = (label: string) => r.lignes.find((l) => l.label === label)!.parEquipe;
    expect(par('Vainqueur')).toBeGreaterThan(par('Finaliste'));
    expect(par('Finaliste')).toBeGreaterThan(par('Demi-finalistes'));
    expect(par('Demi-finalistes')).toBeGreaterThan(par('Éliminés en quarts'));
  });

  it('ne paie que jusqu au rang demandé', () => {
    const r = repartitionIndemnites(groupes, 1000, 8);
    const payes = r.lignes.filter((l) => l.paye).map((l) => l.label);
    expect(payes).toEqual(['Vainqueur', 'Finaliste', 'Demi-finalistes', 'Éliminés en quarts']);
    // Les 8èmes figurent toujours au tableau, mais sans indemnité.
    const huitiemes = r.lignes.find((l) => l.label === 'Éliminés en 8èmes')!;
    expect(huitiemes.paye).toBe(false);
    expect(huitiemes.parEquipe).toBe(0);
  });

  it('tout le pot va aux rangs payés, pas une part perdue', () => {
    const r = repartitionIndemnites(groupes, 1000, 4);
    expect(Math.abs(r.totalDistribue - 1000)).toBeLessThan(2);
    expect(r.lignes.filter((l) => l.paye)).toHaveLength(3);
  });

  it('un seuil au premier rang donne tout au vainqueur', () => {
    const r = repartitionIndemnites(groupes, 500, 1);
    const v = r.lignes.find((l) => l.label === 'Vainqueur')!;
    expect(v.parEquipe).toBeCloseTo(500, 1);
    expect(r.lignes.filter((l) => l.paye)).toHaveLength(1);
  });

  it('un pot nul ne distribue rien, sans planter', () => {
    const r = repartitionIndemnites(groupes, 0, undefined);
    expect(r.totalDistribue).toBe(0);
    expect(r.lignes.every((l) => l.parEquipe === 0)).toBe(true);
  });

  it('sans groupe, rien à répartir', () => {
    const r = repartitionIndemnites([], 1000, undefined);
    expect(r.lignes).toEqual([]);
    expect(r.totalDistribue).toBe(0);
  });

  it('un seuil sous le premier rang ne paie personne', () => {
    const r = repartitionIndemnites(groupes, 1000, 0);
    expect(r.lignes.every((l) => !l.paye)).toBe(true);
    expect(r.totalDistribue).toBe(0);
  });

  it('rend le montant moyen par équipe engagée', () => {
    const r = repartitionIndemnites(groupes, 800, 8, 16);
    expect(r.parEquipeEngagee).toBeCloseTo(r.totalDistribue / 16, 2);
  });
});
