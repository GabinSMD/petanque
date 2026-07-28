import { describe, expect, it } from 'vitest';
import { effectifsParSite, repartirEntreSites, type Site } from '../multisite';
import { makeTeam, testCtx } from './helpers';
import type { Team } from '../../types';

const site = (nom: string, nbTerrains: number): Site => ({ nom, nbTerrains });

/** n équipes, réparties entre les clubs donnés (autant d'équipes que d'entrées). */
function equipes(clubs: string[]): Team[] {
  return clubs.map((club, i) => makeTeam(i + 1, club));
}

describe('effectifs par site', () => {
  it('deux sites de même taille : l\'exemple du manuel, 200 équipes en 2 × 100', () => {
    expect(effectifsParSite(200, [site('A', 20), site('B', 20)])).toEqual([100, 100]);
  });

  it('proportionnel aux terrains : un site deux fois plus grand reçoit deux fois plus', () => {
    // 200 équipes, 20 terrains contre 10 : sinon le petit site jouerait deux
    // fois plus longtemps que le grand.
    expect(effectifsParSite(200, [site('A', 20), site('B', 10)])).toEqual([133, 67]);
  });

  it('le compte est toujours exact, même quand ça ne tombe pas juste', () => {
    const parts = effectifsParSite(10, [site('A', 5), site('B', 5), site('C', 5)]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10);
    expect(parts.sort((a, b) => b - a)).toEqual([4, 3, 3]);
  });

  it('refuse un fractionnement qui n\'en est pas un', () => {
    expect(() => effectifsParSite(100, [site('A', 20)])).toThrow(/deux sites/i);
    expect(() => effectifsParSite(100, [])).toThrow(/deux sites/i);
  });

  it('refuse un site sans terrain : il ne peut rien accueillir', () => {
    expect(() => effectifsParSite(100, [site('A', 20), site('B', 0)])).toThrow(/terrain/i);
  });

  it('refuse un partage qui laisserait un site sans adversaire', () => {
    // 3 équipes sur 2 sites : un site à 1 équipe ne joue pas.
    expect(() => effectifsParSite(3, [site('A', 4), site('B', 4)])).toThrow(/2 équipes/i);
  });
});

describe('répartition des équipes entre les sites', () => {
  const deuxSites = [site('Boulodrome Nord', 10), site('Boulodrome Sud', 10)];

  it('place chaque équipe une fois et une seule', () => {
    const teams = equipes(['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D']);
    const repartition = repartirEntreSites(teams, deuxSites, testCtx());
    const tous = repartition.flatMap((r) => r.teamIds);
    expect(tous).toHaveLength(8);
    expect(new Set(tous).size).toBe(8);
    expect(repartition.map((r) => r.teamIds.length)).toEqual([4, 4]);
  });

  it('garde les équipes d\'un même club sur le même site', () => {
    // Un club ne doit pas avoir à se rendre dans deux villes le même jour.
    const teams = equipes(['Nord', 'Nord', 'Nord', 'Nord', 'Sud', 'Sud', 'Est', 'Est']);
    for (const graine of [1, 2, 3, 5, 8, 13, 21, 42]) {
      const repartition = repartirEntreSites(teams, deuxSites, testCtx(graine));
      const clubDe = new Map(teams.map((t) => [t.id, t.club]));
      for (const club of ['Nord', 'Sud', 'Est']) {
        const sites = repartition
          .map((r, i) => (r.teamIds.some((id) => clubDe.get(id) === club) ? i : -1))
          .filter((i) => i >= 0);
        expect(sites).toHaveLength(1);
      }
    }
  });

  it('un club trop nombreux pour un site est quand même placé en entier', () => {
    // 6 équipes d'un même club pour des sites de 4 : on ne laisse personne
    // dehors, la préférence cède.
    const teams = equipes(['Gros', 'Gros', 'Gros', 'Gros', 'Gros', 'Gros', 'Petit', 'Petit']);
    const repartition = repartirEntreSites(teams, deuxSites, testCtx());
    const tous = repartition.flatMap((r) => r.teamIds);
    expect(new Set(tous).size).toBe(8);
    expect(repartition.map((r) => r.teamIds.length)).toEqual([4, 4]);
  });

  it('les équipes sans club sont réparties sans faire un « club » commun', () => {
    const teams = equipes(['', '', '', '', '', '', '', '']);
    const repartition = repartirEntreSites(teams, deuxSites, testCtx());
    expect(repartition.map((r) => r.teamIds.length)).toEqual([4, 4]);
  });

  it('respecte les effectifs proportionnels aux terrains', () => {
    const teams = equipes(Array.from({ length: 12 }, (_, i) => `Club${i}`));
    const repartition = repartirEntreSites(
      teams,
      [site('Grand', 20), site('Petit', 10)],
      testCtx(),
    );
    expect(repartition.map((r) => r.teamIds.length)).toEqual([8, 4]);
    expect(repartition.map((r) => r.site.nom)).toEqual(['Grand', 'Petit']);
  });

  it('reste aléatoire : deux fractionnements ne donnent pas le même partage', () => {
    const teams = equipes(Array.from({ length: 12 }, (_, i) => `Club${i}`));
    const empreinte = (graine: number): string =>
      repartirEntreSites(teams, deuxSites, testCtx(graine))
        .map((r) => [...r.teamIds].sort().join('+'))
        .join(' | ');
    const vues = new Set([1, 2, 3, 5, 8, 13, 21, 42].map(empreinte));
    expect(vues.size).toBeGreaterThan(1);
  });
});
