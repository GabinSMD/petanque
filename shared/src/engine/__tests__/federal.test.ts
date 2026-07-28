import { describe, expect, it } from 'vitest';
import {
  autoAssignTerrains,
  freeTerrains,
  terrainBoard,
  terrainNumeros,
} from '../terrains';
import {
  aDesCriteresLicence,
  besoinModeFederal,
  designationCategorie,
  estConcoursOfficiel,
  nomConcoursFederal,
  numeroPremiereEquipe,
  type ParamsOfficiel,
} from '../federal';
import type { Match } from '../../types';

function live(id: string, terrain: number | null): Match {
  return {
    id,
    concoursId: 'c1',
    stage: 'principal',
    round: 0,
    position: Number(id.slice(1)),
    teamAId: 'a' + id,
    teamBId: 'b' + id,
    scoreA: null,
    scoreB: null,
    done: false,
    terrain,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('décalage de numérotation des terrains', () => {
  it('sans décalage, les terrains sont numérotés à partir de 1', () => {
    expect(terrainNumeros(4)).toEqual([1, 2, 3, 4]);
    expect(terrainBoard([], 3).map((t) => t.number)).toEqual([1, 2, 3]);
  });

  it('avec décalage, la numérotation commence après le décalage', () => {
    // 3 championnats le même jour : terrains 1.., 51.., 101…
    // Le décalage se compte comme pour les équipes : 50 → premier terrain 51.
    expect(terrainNumeros(4, 50)).toEqual([51, 52, 53, 54]);
    expect(terrainBoard([], 3, 100).map((t) => t.number)).toEqual([101, 102, 103]);
  });

  it('les terrains occupés sont reconnus dans la plage décalée', () => {
    const matches = [live('m1', 52), live('m2', null)];
    const board = terrainBoard(matches, 3, 50);
    expect(board.find((t) => t.number === 52)?.match?.id).toBe('m1');
    expect(board.filter((t) => t.match === null).map((t) => t.number)).toEqual([51, 53]);
    expect(freeTerrains(matches, 3, 50)).toEqual([51, 53]);
  });

  it('l affectation automatique reste dans la plage décalée', () => {
    const matches = [live('m1', null), live('m2', null)];
    const assignments = autoAssignTerrains(matches, 4, 50);
    expect(assignments.map((a) => a.terrain)).toEqual([51, 52]);
  });
});

describe('décalage de numérotation des équipes', () => {
  it('sans décalage, la première équipe porte le n° 1', () => {
    expect(numeroPremiereEquipe([], undefined)).toBe(1);
  });

  it('avec décalage, la première équipe porte le n° suivant', () => {
    expect(numeroPremiereEquipe([], 100)).toBe(101);
    expect(numeroPremiereEquipe([], 200)).toBe(201);
  });

  it('ensuite, on continue après le plus grand numéro existant', () => {
    expect(numeroPremiereEquipe([101, 102], 100)).toBe(103);
    expect(numeroPremiereEquipe([5], undefined)).toBe(6);
  });
});

describe('nom fédéral du concours', () => {
  it('assemble date, niveau, jeu, comité, formation et club', () => {
    expect(
      nomConcoursFederal({
        date: '2026-12-17',
        niveau: 'departemental',
        discipline: 'petanque',
        comite: 'CD 38 Isère',
        format: 'triplette',
        club: 'PC Pierre Sémard',
      }),
    ).toBe('2026-12-17_DEPARTEMENTAL_PETANQUE_CD-38-ISERE_TRIPLETTE_PC-PIERRE-SEMARD');
  });

  it('omet ce qui n est pas renseigné', () => {
    expect(nomConcoursFederal({ date: '2026-07-27', format: 'doublette' })).toBe(
      '2026-07-27_DOUBLETTE',
    );
  });

  it('rend le jeu provençal et la coupe de France', () => {
    expect(
      nomConcoursFederal({
        date: '2026-05-01',
        niveau: 'coupe_de_france',
        discipline: 'jeu_provencal',
        format: 'triplette',
      }),
    ).toBe('2026-05-01_COUPE-DE-FRANCE_JEU-PROVENCAL_TRIPLETTE');
  });
});

describe('désignation de la catégorie', () => {
  it('âge seul : rend le libellé court', () => {
    expect(designationCategorie({ categorieAge: 'seniors' })).toBe('Séniors');
    expect(designationCategorie({ categorieAge: 'veterans' })).toBe('Vétérans');
  });

  it('sexe + âge + classification : composé dans l ordre [Sexe] [Âge] [Classification]', () => {
    expect(
      designationCategorie({
        critereSexe: 'feminin',
        categorieAge: 'veterans',
        critereClassification: 'promotion',
      }),
    ).toBe('Féminin Vétérans Promotion');
    expect(designationCategorie({ critereSexe: 'mixte', critereClassification: 'elite' })).toBe(
      'Mixte Élite',
    );
  });

  it('les critères neutres (tous) sont omis', () => {
    expect(
      designationCategorie({
        critereSexe: 'tous',
        categorieAge: 'juniors',
        critereClassification: 'tous',
      }),
    ).toBe('Juniors');
  });

  it('aucun critère fédéral : rend le texte libre', () => {
    expect(designationCategorie({ category: 'Open' })).toBe('Open');
    // Un critère fédéral prime toujours sur un texte libre concurrent.
    expect(designationCategorie({ category: 'Vétérans', categorieAge: 'seniors' })).toBe('Séniors');
  });

  it('rien de renseigné : undefined', () => {
    expect(designationCategorie({})).toBeUndefined();
    expect(designationCategorie({ category: '   ' })).toBeUndefined();
    expect(designationCategorie({ critereSexe: 'tous', critereClassification: 'tous' })).toBeUndefined();
  });
});

describe('reconnaître un concours fédéral', () => {
  it('sans critère, il n\'y a rien à contrôler', () => {
    expect(aDesCriteresLicence({})).toBe(false);
    expect(aDesCriteresLicence({ critereSexe: 'tous', critereClassification: 'tous' })).toBe(false);
  });

  it('chacun des quatre critères suffit', () => {
    expect(aDesCriteresLicence({ categorieAge: 'veterans' })).toBe(true);
    expect(aDesCriteresLicence({ critereSexe: 'feminin' })).toBe(true);
    expect(aDesCriteresLicence({ critereClassification: 'elite' })).toBe(true);
    expect(aDesCriteresLicence({ homogene: true })).toBe(true);
  });

  it('un concours officiel peut n\'avoir aucun critère de licence', () => {
    // Un niveau, un comité ou un club organisateur ne sont saisis que sous la
    // case « concours officiel » : leur présence suffit à le reconnaître.
    const nationalSansCritere: ParamsOfficiel = { niveau: 'national' };
    expect(estConcoursOfficiel(nationalSansCritere)).toBe(true);
    expect(estConcoursOfficiel({ comiteOrganisateur: 'CD 26' })).toBe(true);
    expect(estConcoursOfficiel({ clubOrganisateur: 'Boule de l\'Avenir' })).toBe(true);
    // Mais il n'impose rien aux licences : rien à contrôler au dépôt.
    expect(aDesCriteresLicence(nationalSansCritere)).toBe(false);
  });

  it('un critère de licence rend le concours officiel', () => {
    expect(estConcoursOfficiel({ categorieAge: 'juniors' })).toBe(true);
  });

  it('un concours de club n\'est ni l\'un ni l\'autre', () => {
    expect(estConcoursOfficiel({})).toBe(false);
    expect(estConcoursOfficiel({ comiteOrganisateur: '   ' })).toBe(false);
  });
});

describe('faut-il montrer le mode fédéral ?', () => {
  it('un club qui n\'a que des concours amicaux n\'en a pas besoin', () => {
    expect(besoinModeFederal({ concours: [{}, {}], licencies: 0 })).toBe(false);
    expect(besoinModeFederal({ concours: [], licencies: 0 })).toBe(false);
  });

  it('un seul concours officiel suffit', () => {
    expect(besoinModeFederal({ concours: [{}, { niveau: 'departemental' }], licencies: 0 })).toBe(
      true,
    );
  });

  it('un fichier de licenciés importé suffit', () => {
    // On ne l'importe pas pour rien : c'est le signe d'un club qui joue fédéral.
    expect(besoinModeFederal({ concours: [{}], licencies: 1200 })).toBe(true);
  });
});
