import { describe, expect, it } from 'vitest';
import { bilanArbitrage, pourcentageFederal } from '../bilanArbitrage';
import type { Classification, Licencie, Team } from '../../types';

describe('pourcentage du document fédéral', () => {
  it('arrondit les demis au pair, comme le fait le document', () => {
    // Les neuf pourcentages lisibles sur les deux exemplaires du rapport
    // d'arbitrage (p.55 et p.78) ne s'expliquent que par l'arrondi au pair :
    // 12,5 descend à 12 alors que 87,5 monte à 88. L'arrondi supérieur donnerait
    // 13 aux deux 12,5 ; la troncature perdrait 47, 88 et 51.
    expect(pourcentageFederal(4, 32)).toBe(12); // 12,5 → 12 (pair)
    expect(pourcentageFederal(8, 64)).toBe(12); // 12,5 → 12
    expect(pourcentageFederal(56, 64)).toBe(88); // 87,5 → 88 (pair)
  });

  it('rend les autres pourcentages du document', () => {
    expect(pourcentageFederal(0, 32)).toBe(0);
    expect(pourcentageFederal(32, 32)).toBe(100);
    expect(pourcentageFederal(30, 64)).toBe(47); // 46,875
    expect(pourcentageFederal(34, 64)).toBe(53); // 53,125
    expect(pourcentageFederal(50, 99)).toBe(51); // 50,505
  });

  it('rend zéro sur un effectif nul plutôt qu une division par zéro', () => {
    expect(pourcentageFederal(0, 0)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* Le bilan complet                                                    */
/* ------------------------------------------------------------------ */

function fiche(
  licence: string,
  comite: string,
  classification?: Classification,
): Licencie {
  return {
    id: `l${licence}`,
    name: `Joueur ${licence}`,
    licence,
    comite,
    classification,
    updatedAt: '2026-08-04T00:00:00.000Z',
  };
}

/** Une équipe de deux joueurs, licences données, tous du même club. */
function equipe(number: number, licences: string[], club = 'CLUB'): Team {
  return {
    id: `t${number}`,
    concoursId: 'c1',
    number,
    players: licences.map((l) => ({ name: `Joueur ${l}`, licence: l, club })),
    club,
    forfait: false,
    updatedAt: '2026-08-04T00:00:00.000Z',
  };
}

describe('bilan des équipes engagées', () => {
  it('compte les joueurs par classification, et « classés » = élite + honneur', () => {
    // Le document p.55 : Elite 13, Honneur 17, Promotion 34, Classés 30/64.
    // 13 + 17 = 30 : Promotion n'est pas « classé ». C'est la seule lecture qui
    // fait l'addition juste, sur les deux exemplaires.
    // Effectifs **asymétriques** à dessein : le sabotage a montré qu'un élite et
    // un honneur ne prouvent rien, puisque les confondre rend les mêmes comptes.
    const fiches = new Map([
      ['1', fiche('1', '026', 'E')],
      ['2', fiche('2', '026', 'E')],
      ['3', fiche('3', '026', 'H')],
      ['4', fiche('4', '026', 'P')],
      ['5', fiche('5', '026', 'P')],
      ['6', fiche('6', '026', 'P')],
    ]);
    const b = bilanArbitrage(
      [equipe(1, ['1', '2']), equipe(2, ['3', '4']), equipe(3, ['5', '6'])],
      fiches,
      { comiteOrganisateur: '026' },
    );
    expect(b.joueurs.total).toBe(6);
    expect(b.joueurs.elite.n).toBe(2);
    expect(b.joueurs.honneur.n).toBe(1);
    expect(b.joueurs.promotion.n).toBe(3);
    expect(b.joueurs.classes.n).toBe(3);
  });

  it('compte une équipe « du comité » quand tous ses joueurs en sont', () => {
    // Le document p.55 le prouve par l'arithmétique : 4 équipes du comité pour
    // 8 joueurs du comité, en doublette. 4 × 2 = 8 — donc les 4 équipes sont
    // *entièrement* du comité, et une équipe mixte ne compte pas.
    const fiches = new Map([
      ['1', fiche('1', '026')],
      ['2', fiche('2', '026')],
      ['3', fiche('3', '026')],
      ['4', fiche('4', '074')],
    ]);
    const b = bilanArbitrage([equipe(1, ['1', '2']), equipe(2, ['3', '4'])], fiches, {
      comiteOrganisateur: '026',
    });
    expect(b.joueurs.comite.n).toBe(3);
    expect(b.equipes.comite.n).toBe(1);
    expect(b.equipes.total).toBe(2);
  });

  it('le critère Y est le pourcentage de joueurs extérieurs au comité', () => {
    // p.55 : Joueurs du Comité 8/64 → Y = (64−8)/64 = 87,5 → 88 %.
    // p.78 : Joueurs du Comité 0/99 → Y = 100 %. Vérifié deux fois.
    const fiches = new Map([
      ['1', fiche('1', '026')],
      ['2', fiche('2', '074')],
      ['3', fiche('3', '074')],
      ['4', fiche('4', '074')],
    ]);
    const b = bilanArbitrage([equipe(1, ['1', '2']), equipe(2, ['3', '4'])], fiches, {
      comiteOrganisateur: '026',
    });
    expect(b.joueurs.comite.n).toBe(1);
    expect(b.critereY).toBe(75);
  });

  it('compte les équipes non homogènes, et pas les autres', () => {
    // Le sabotage a montré qu'une fixture d'une non homogène sur deux ne prouve
    // rien : inverser le prédicat rend le même compte. Il en faut trois, dont
    // une seule mélangée — inverser donnerait alors 2.
    const fiches = new Map([['1', fiche('1', '026')]]);
    const melangee: Team = {
      ...equipe(3, ['5', '6']),
      club: undefined,
      players: [
        { name: 'A', licence: '5', club: 'CLUB A' },
        { name: 'B', licence: '6', club: 'CLUB B' },
      ],
    };
    const b = bilanArbitrage(
      [equipe(1, ['1', '2']), equipe(2, ['3', '4']), melangee],
      fiches,
      { comiteOrganisateur: '026' },
    );
    expect(b.equipes.nonHomogenes.n).toBe(1);
    expect(b.equipes.total).toBe(3);
  });

  it('compte comme inconnu un joueur absent du fichier ou à licence étrangère', () => {
    const fiches = new Map([['1', fiche('1', '026')]]);
    const etranger: Team = {
      ...equipe(2, ['9', '10']),
      players: [
        { name: 'Belge', licenceEtrangere: 'BE' },
        { name: 'Absent', licence: '99999999' },
      ],
    };
    const b = bilanArbitrage([equipe(1, ['1', '2']), etranger], fiches, {
      comiteOrganisateur: '026',
    });
    // Licence 2 absente du fichier, plus les deux du second : trois inconnus.
    expect(b.joueurs.inconnus.n).toBe(3);
  });

  it('un étranger reste inconnu même si sa licence figure au fichier', () => {
    // Le cas discriminant, trouvé par sabotage : mon premier étranger n'avait
    // pas de licence française, donc l'absence de fiche l'attrapait déjà et le
    // contrôle de `licenceEtrangere` ne servait à rien. Le document dit
    // « Joueurs Inconnus **ou Etranger** » : c'est bien un *ou*, et il doit
    // rester vrai le jour où la base étrangère alimentera la recherche.
    const fiches = new Map([
      ['1', fiche('1', '026')],
      ['2', fiche('2', '026')],
    ]);
    const mixte: Team = {
      ...equipe(1, ['1', '2']),
      players: [
        { name: 'Français', licence: '1', club: 'CLUB' },
        { name: 'Belge fiché', licence: '2', licenceEtrangere: 'BE', club: 'CLUB' },
      ],
    };
    const b = bilanArbitrage([mixte], fiches, { comiteOrganisateur: '026' });
    expect(b.joueurs.inconnus.n).toBe(1);
  });

  it('les forfaits ne comptent pas : ils ne composent pas le champ', () => {
    const fiches = new Map([
      ['1', fiche('1', '026')],
      ['2', fiche('2', '026')],
    ]);
    const forfait: Team = { ...equipe(2, ['1', '2']), forfait: true };
    const b = bilanArbitrage([equipe(1, ['1', '2']), forfait], fiches, {
      comiteOrganisateur: '026',
    });
    expect(b.equipes.total).toBe(1);
    expect(b.joueurs.total).toBe(2);
  });

  it('sans comités de ligue déclarés, les grandeurs de ligue et Z restent absentes', () => {
    // On ne devine pas la table comité → ligue : elle n'est pas dans le manuel.
    const fiches = new Map([['1', fiche('1', '026')]]);
    const b = bilanArbitrage([equipe(1, ['1', '2'])], fiches, { comiteOrganisateur: '026' });
    expect(b.equipes.ligue).toBeUndefined();
    expect(b.joueurs.ligue).toBeUndefined();
    expect(b.critereZ).toBeUndefined();
  });

  it('avec les comités de ligue déclarés, rend la ligue et le critère Z', () => {
    // p.55 : tous les joueurs de la ligue → Z = 0 %. p.78 : aucun → Z = 100 %.
    const fiches = new Map([
      ['1', fiche('1', '026')],
      ['2', fiche('2', '038')],
      ['3', fiche('3', '074')],
      ['4', fiche('4', '013')],
    ]);
    const b = bilanArbitrage([equipe(1, ['1', '2']), equipe(2, ['3', '4'])], fiches, {
      comiteOrganisateur: '026',
      comitesLigue: ['026', '038', '074'],
    });
    expect(b.joueurs.ligue!.n).toBe(3);
    expect(b.equipes.ligue!.n).toBe(1);
    expect(b.critereZ).toBe(25);
  });

  it('ni le critère X ni la grille ne sont rendus', () => {
    // Les deux se contredisent ou manquent dans le manuel. Le bilan doit le dire
    // en ne les portant pas, plutôt qu'en portant un chiffre inventé.
    const fiches = new Map([['1', fiche('1', '026', 'P')]]);
    const b = bilanArbitrage([equipe(1, ['1', '2'])], fiches, { comiteOrganisateur: '026' });
    expect('critereX' in b).toBe(false);
    expect('grille' in b).toBe(false);
  });
});

describe('reproduction du document fédéral', () => {
  /**
   * Le bloc de la p.55, reconstitué : 32 doublettes, 64 joueurs, 13 élites,
   * 17 honneurs, 34 promotions, 8 joueurs du comité organisateur, tous de la
   * ligue, toutes les équipes homogènes.
   *
   * C'est la vérification la plus forte dont ce lot soit capable : non pas que
   * nos formules soient cohérentes entre elles, mais qu'elles rendent **les
   * nombres imprimés par le logiciel fédéral**.
   */
  it('rend les chiffres du bilan de la p.55', () => {
    const classif: Classification[] = [
      ...Array<Classification>(13).fill('E'),
      ...Array<Classification>(17).fill('H'),
      ...Array<Classification>(34).fill('P'),
    ];
    const fiches = new Map<string, Licencie>();
    for (let i = 0; i < 64; i += 1) {
      const licence = String(10000000 + i);
      fiches.set(licence, {
        id: `l${i}`,
        name: `JOUEUR ${i}`,
        licence,
        club: `CLUB ${Math.floor(i / 2) + 1}`,
        // Les huit premiers au comité organisateur, les autres ailleurs dans la ligue.
        comite: i < 8 ? '026' : i % 2 ? '038' : '074',
        classification: classif[i],
        updatedAt: '2026-08-04T00:00:00.000Z',
      });
    }
    const teams: Team[] = [];
    for (let t = 0; t < 32; t += 1) {
      const a = String(10000000 + t * 2);
      const b = String(10000000 + t * 2 + 1);
      teams.push(equipe(t + 1, [a, b], `CLUB ${t + 1}`));
    }

    const bilan = bilanArbitrage(teams, fiches, {
      comiteOrganisateur: '026',
      comitesLigue: ['026', '038', '074'],
    });

    // Colonne de gauche du document.
    expect(bilan.equipes.total).toBe(32);
    expect(bilan.equipes.nonHomogenes).toMatchObject({ n: 0, total: 32, pourcentage: 0 });
    expect(bilan.equipes.ligue).toMatchObject({ n: 32, total: 32, pourcentage: 100 });
    expect(bilan.equipes.comite).toMatchObject({ n: 4, total: 32, pourcentage: 12 });
    expect(bilan.joueurs.elite.n).toBe(13);
    expect(bilan.joueurs.honneur.n).toBe(17);
    expect(bilan.joueurs.promotion).toMatchObject({ n: 34, total: 64, pourcentage: 53 });

    // Colonne de droite.
    expect(bilan.joueurs.ligue).toMatchObject({ n: 64, total: 64, pourcentage: 100 });
    expect(bilan.joueurs.comite).toMatchObject({ n: 8, total: 64, pourcentage: 12 });
    expect(bilan.joueurs.classes).toMatchObject({ n: 30, total: 64, pourcentage: 47 });
    expect(bilan.joueurs.inconnus.n).toBe(0);

    // Les deux critères que le manuel permet d'établir.
    expect(bilan.critereY).toBe(88);
    expect(bilan.critereZ).toBe(0);
  });
});
