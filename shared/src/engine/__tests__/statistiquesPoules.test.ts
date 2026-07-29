import { describe, expect, it } from 'vitest';
import { statistiquesPoules } from '../statistiquesPoules';
import { createPouleMatches, drawPoules, recomputePoule } from '../poules';
import { applyChanges } from '../bracket';
import { makeTeams, testCtx } from './helpers';
import type { Match, Poule } from '../../types';

/** Tire des poules et joue les créneaux demandés, dans l'ordre. */
function jouer(
  nbEquipes: number,
  slots: string[],
  opts: { sansBarrage?: boolean; lancee?: string } = {},
): { poules: Poule[]; matches: Match[] } {
  const ctx = testCtx();
  const tirage = drawPoules('c1', makeTeams(nbEquipes), ctx);
  if (!tirage) throw new Error('effectif incompatible');
  const { poules } = tirage;
  let matches: Match[] = poules.flatMap((p) =>
    createPouleMatches('c1', p, ctx, { sansBarrage: opts.sansBarrage }),
  );
  for (const slot of slots) {
    for (const poule of poules) {
      const m = matches.find((x) => x.pouleId === poule.id && x.pouleSlot === slot);
      if (!m || !m.teamAId || !m.teamBId) continue;
      matches = matches.map((x) =>
        x.id === m.id ? { ...x, scoreA: 13, scoreB: 6, done: true } : x,
      );
      matches = applyChanges(
        matches,
        recomputePoule(
          poule,
          matches.filter((x) => x.pouleId === poule.id),
        ),
      );
    }
  }
  if (opts.lancee) {
    matches = matches.map((m) =>
      !m.done && m.teamAId && m.teamBId ? { ...m, lanceeA: opts.lancee } : m,
    );
  }
  return { poules, matches };
}

describe('statistiques des poules (§3.D.1.G)', () => {
  it('ne montre que les poules non terminées', () => {
    // Deux poules de 4 : la première finie, la seconde à peine commencée.
    const { poules, matches } = jouer(8, ['M1', 'M2', 'GAGNANTS', 'PERDANTS', 'BARRAGE']);
    expect(statistiquesPoules(poules, matches)).toEqual([]);
  });

  it('compte ce qui reste à jouer, poule par poule', () => {
    const { poules, matches } = jouer(8, ['M1']);
    const stats = statistiquesPoules(poules, matches);
    expect(stats).toHaveLength(2);
    // Une poule de 4 compte 5 parties ; une seule est jouée.
    expect(stats[0]!.restantes).toBe(4);
    expect(stats.every((s) => !s.terminee)).toBe(true);
  });

  it('signale le barrage qui retient la poule', () => {
    const { poules, matches } = jouer(4, ['M1', 'M2', 'GAGNANTS', 'PERDANTS']);
    const [stat] = statistiquesPoules(poules, matches);
    expect(stat!.restantes).toBe(1);
    expect(stat!.barragePret).toBe(true);
  });

  it('et dit depuis quand il attend', () => {
    const { poules, matches } = jouer(4, ['M1', 'M2', 'GAGNANTS', 'PERDANTS'], {
      lancee: '2026-10-04T14:00:00.000Z',
    });
    const [stat] = statistiquesPoules(poules, matches);
    expect(stat!.barragePret).toBe(true);
    expect(stat!.depuis).toBe('2026-10-04T14:00:00.000Z');
  });

  it('un barrage dont les équipes sont inconnues n\'est pas prêt', () => {
    // Les parties amont ne sont pas jouées : rien à annoncer au micro.
    const { poules, matches } = jouer(4, ['M1']);
    const [stat] = statistiquesPoules(poules, matches);
    expect(stat!.barragePret).toBe(false);
  });

  it('formule par groupes : jamais de barrage, il n\'y en a pas', () => {
    const { poules, matches } = jouer(4, ['M1', 'M2', 'GAGNANTS'], { sansBarrage: true });
    const [stat] = statistiquesPoules(poules, matches);
    expect(stat!.restantes).toBe(1);
    expect(stat!.barragePret).toBe(false);
  });

  it('poule de 3 : le barrage s\'appelle aussi, sans partie des perdants', () => {
    // Une poule de 3 n'existe qu'en reste : 7 équipes donnent une poule de 4 et
    // une de 3.
    const { poules, matches } = jouer(7, ['M1', 'M2', 'GAGNANTS']);
    const stats = statistiquesPoules(poules, matches);
    const troisPuis = stats.find((s) => s.poule.teamIds.length === 3);
    expect(troisPuis).toBeDefined();
    expect(troisPuis!.barragePret).toBe(true);
    // Elle ne compte que trois parties, dont deux jouées.
    expect(troisPuis!.restantes).toBe(1);
  });

  it('la plus en retard d\'abord : c\'est celle qu\'on va chercher', () => {
    const { poules, matches } = jouer(8, ['M1']);
    // La poule 2 attend depuis plus longtemps que la poule 1.
    const parPoule = new Map(poules.map((p, i) => [p.id, i]));
    const horodates = matches.map((m) =>
      !m.done && m.teamAId && m.teamBId
        ? {
            ...m,
            lanceeA:
              parPoule.get(m.pouleId ?? '') === 1
                ? '2026-10-04T13:00:00.000Z'
                : '2026-10-04T14:30:00.000Z',
          }
        : m,
    );
    const stats = statistiquesPoules(poules, horodates);
    expect(stats[0]!.poule.index).toBe(poules[1]!.index);
    expect(stats[0]!.depuis).toBe('2026-10-04T13:00:00.000Z');
  });

  it('une poule sans partie annoncée passe après celles qui attendent', () => {
    const { poules, matches } = jouer(8, []);
    const avecUne = matches.map((m, i) =>
      i === 0 ? { ...m, lanceeA: '2026-10-04T13:00:00.000Z' } : m,
    );
    const stats = statistiquesPoules(poules, avecUne);
    expect(stats[0]!.depuis).toBe('2026-10-04T13:00:00.000Z');
    expect(stats[1]!.depuis).toBeNull();
  });
});
