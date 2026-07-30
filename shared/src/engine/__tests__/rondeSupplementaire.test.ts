import { describe, expect, it } from 'vitest';
import { proposerRondeSupplementaire } from '../rondeSupplementaire';

/** Cas nominal : 3 rondes prévues, 3 tirées, on saisit la première partie de la 3e. */
const NOMINAL = {
  rondesTirees: 3,
  rondesPrevues: 3,
  rondeSaisie: 2,
  scoresDejaSaisis: 0,
};

describe('proposer une partie de plus (§3.D.14.A)', () => {
  it('à la première saisie de la dernière ronde prévue', () => {
    // « Lors de la première saisie de la troisième partie le logiciel demande
    // si nous voulons faire une quatrième partie. » C'est le moment où
    // l'organisateur voit l'heure qu'il est et l'état des terrains.
    expect(proposerRondeSupplementaire(NOMINAL)).toBe(true);
  });

  it('pas au deuxième score de la même ronde', () => {
    // Une seule question par ronde : la répéter à chaque score serait
    // insupportable sur douze terrains.
    expect(proposerRondeSupplementaire({ ...NOMINAL, scoresDejaSaisis: 1 })).toBe(false);
  });

  it('pas sur une ronde qui n\'est pas la dernière prévue', () => {
    expect(proposerRondeSupplementaire({ ...NOMINAL, rondeSaisie: 1 })).toBe(false);
    expect(proposerRondeSupplementaire({ ...NOMINAL, rondeSaisie: 0 })).toBe(false);
  });

  it('pas quand il reste des rondes à tirer', () => {
    // 3 prévues mais 2 tirées : la question ne se pose pas encore.
    expect(
      proposerRondeSupplementaire({ ...NOMINAL, rondesTirees: 2, rondeSaisie: 1 }),
    ).toBe(false);
  });

  it('pas quand la ronde saisie sort du prévu', () => {
    // L'organisateur a déjà ajouté une ronde : on ne redemande pas.
    expect(
      proposerRondeSupplementaire({
        rondesTirees: 4,
        rondesPrevues: 3,
        rondeSaisie: 3,
        scoresDejaSaisis: 0,
      }),
    ).toBe(false);
  });

  it('ne redemande pas en corrigeant une ronde passée', () => {
    // Cinq rondes tirées pour trois prévues : l'organisateur a déjà répondu.
    // Corriger un score de la 3e ronde — la dernière « prévue » — ne doit pas
    // reposer la question.
    expect(
      proposerRondeSupplementaire({
        rondesTirees: 5,
        rondesPrevues: 3,
        rondeSaisie: 2,
        scoresDejaSaisis: 0,
      }),
    ).toBe(false);
  });

  it('marche dès la première ronde quand une seule est prévue', () => {
    expect(
      proposerRondeSupplementaire({
        rondesTirees: 1,
        rondesPrevues: 1,
        rondeSaisie: 0,
        scoresDejaSaisis: 0,
      }),
    ).toBe(true);
  });

  it('ne propose rien sur des valeurs qui n\'ont pas de sens', () => {
    expect(
      proposerRondeSupplementaire({ ...NOMINAL, rondesPrevues: 0, rondeSaisie: -1 }),
    ).toBe(false);
    expect(proposerRondeSupplementaire({ ...NOMINAL, scoresDejaSaisis: -1 })).toBe(false);
  });
});
