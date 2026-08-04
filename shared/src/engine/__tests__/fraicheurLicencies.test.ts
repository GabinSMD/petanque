import { describe, expect, it } from 'vitest';
import { dateDeLaBase, fraicheurLicencies, saisonFederale } from '../fraicheurLicencies';

const AOUT_2026 = '2026-08-04T10:00:00.000Z';

describe('saison fédérale d une date', () => {
  it('court de novembre à octobre : novembre appartient déjà à la saison suivante', () => {
    // Une licence de l'année N+1 se prend dès novembre de l'année N — c'est déjà
    // la règle de `licences.ts` sur l'année de reprise.
    expect(saisonFederale('2026-01-15T00:00:00.000Z')).toBe(2026);
    expect(saisonFederale('2026-10-31T00:00:00.000Z')).toBe(2026);
    expect(saisonFederale('2026-11-01T00:00:00.000Z')).toBe(2027);
    expect(saisonFederale('2026-12-24T00:00:00.000Z')).toBe(2027);
  });
});

describe('date de la base', () => {
  it('prend la fiche la plus récente, pas la première venue', () => {
    expect(
      dateDeLaBase([
        { updatedAt: '2026-02-01T00:00:00.000Z' },
        { updatedAt: '2026-07-20T09:30:00.000Z' },
        { updatedAt: '2026-03-11T00:00:00.000Z' },
      ]),
    ).toBe('2026-07-20T09:30:00.000Z');
  });

  it('sans fiche, pas de date', () => {
    expect(dateDeLaBase([])).toBeUndefined();
  });

  it('écarte les dates illisibles mais garde la plus récente des lisibles', () => {
    expect(
      dateDeLaBase([{ updatedAt: '' }, { updatedAt: '2025-03-02T00:00:00.000Z' }, { updatedAt: 'x' }]),
    ).toBe('2025-03-02T00:00:00.000Z');
  });

  it('sans aucune date lisible, pas de date', () => {
    expect(dateDeLaBase([{ updatedAt: 'pas une date' }, { updatedAt: '12/03/2026' }])).toBeUndefined();
  });
});

describe('fraîcheur du fichier des licenciés', () => {
  it('sans fiche, la base est absente et rien n est signalé', () => {
    expect(fraicheurLicencies(undefined, 0, AOUT_2026)).toEqual({
      nombre: 0,
      date: undefined,
      saison: undefined,
      saisonCourante: 2026,
      perimee: false,
    });
  });

  it('une base de la saison courante n est pas périmée', () => {
    const f = fraicheurLicencies('2026-07-20T09:30:00.000Z', 3, AOUT_2026);
    expect(f.saison).toBe(2026);
    expect(f.perimee).toBe(false);
    expect(f.nombre).toBe(3);
  });

  it('une base de la saison précédente est périmée', () => {
    // Le cas qui compte : en août 2026 avec un fichier de mars 2025, toutes les
    // années de reprise sont fausses et chaque licence ressort en anomalie.
    const f = fraicheurLicencies('2025-03-02T00:00:00.000Z', 1200, AOUT_2026);
    expect(f.saison).toBe(2025);
    expect(f.saisonCourante).toBe(2026);
    expect(f.perimee).toBe(true);
  });

  it('un import de décembre n est pas périmé l été suivant : c est la même saison', () => {
    // Le cas discriminant. Un fichier de décembre 2025 porte déjà les licences
    // 2026 : le crier périmé en août 2026 serait une fausse alerte, et un seuil
    // en jours le ferait.
    const f = fraicheurLicencies('2025-12-18T00:00:00.000Z', 1200, AOUT_2026);
    expect(f.saison).toBe(2026);
    expect(f.perimee).toBe(false);
  });

  it('un import de novembre est déjà de la saison suivante', () => {
    // Novembre 2026 pour un concours de septembre 2026 : la base est en avance,
    // pas en retard. Rien à signaler.
    const f = fraicheurLicencies('2026-11-03T00:00:00.000Z', 10, '2026-09-01T00:00:00.000Z');
    expect(f.saison).toBe(2027);
    expect(f.perimee).toBe(false);
  });

  it('ne crie pas au loup sur une date illisible', () => {
    // Absence de preuve n'est pas preuve de péremption : une alerte à tort sur
    // chaque écran apprendrait à l'organisateur à ne plus la lire.
    const f = fraicheurLicencies('pas une date', 1, AOUT_2026);
    expect(f.date).toBeUndefined();
    expect(f.nombre).toBe(1);
    expect(f.perimee).toBe(false);
  });
});
