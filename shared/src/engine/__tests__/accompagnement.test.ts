import { describe, expect, it } from 'vitest';
import {
  etapeCourante,
  pistesContextuelles,
  suiteSuggeree,
  type EtapeCourante,
} from '../accompagnement';
import { parcoursParId } from '../parcoursCatalogue';
import type { EtatParcours } from '../parcours';
import type { Concours, ConcoursMode, ConcoursStatus, Match, Poule, Team } from '../../types';

const concours = (over: Partial<Concours> = {}): Concours =>
  ({ id: 'c1', name: 'Concours test', mode: 'poules', status: 'inscriptions', ...over }) as Concours;

const equipes = (n: number, forfaits = 0): Team[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, forfait: i < forfaits }) as Team);

const etat = (over: Partial<EtatParcours> = {}): EtatParcours => ({
  concours: concours(),
  teams: [],
  poules: [],
  matches: [],
  ...over,
});

const matchPoule = (id: string, pouleId: string, slot: string, done: boolean): Match =>
  ({
    id,
    stage: 'poule',
    pouleId,
    pouleSlot: slot,
    done,
    teamAId: 'a',
    teamBId: 'b',
    scoreA: done ? 13 : null,
    scoreB: done ? 7 : null,
    round: 0,
    position: 0,
  }) as unknown as Match;

/**
 * Une poule de 4 entièrement jouée. `pouleOutcome` ne la tient pour finie que
 * si les parties GAGNANTS **et** BARRAGE sont saisies.
 */
const pouleJouee = (pid: string): { poule: Poule; matches: Match[] } => ({
  poule: { id: pid, index: 1, teamIds: ['a', 'b', 'c', 'd'] } as Poule,
  matches: [
    matchPoule(`${pid}-1`, pid, 'M1', true),
    matchPoule(`${pid}-2`, pid, 'M2', true),
    matchPoule(`${pid}-g`, pid, 'GAGNANTS', true),
    matchPoule(`${pid}-p`, pid, 'PERDANTS', true),
    matchPoule(`${pid}-b`, pid, 'BARRAGE', true),
  ],
});

describe('où en est le concours', () => {
  it('sans concours ouvert', () => {
    expect(etapeCourante(etat({ concours: null }))).toBe('aucun-concours');
  });

  it('poules : moins de 4 équipes, il en manque', () => {
    expect(etapeCourante(etat({ teams: equipes(3) }))).toBe('inscriptions-insuffisantes');
  });

  it('poules : les forfaits ne comptent pas dans l\'effectif', () => {
    // 5 inscrites dont 2 forfaits = 3 actives : on est encore court.
    expect(etapeCourante(etat({ teams: equipes(5, 2) }))).toBe('inscriptions-insuffisantes');
  });

  it('poules : un effectif qui ne se répartit pas est signalé comme tel', () => {
    // 5 équipes ne font ni des poules de 4 ni de 3.
    expect(etapeCourante(etat({ teams: equipes(5) }))).toBe('effectif-impossible');
  });

  it('poules : 8 équipes, prêt au tirage', () => {
    expect(etapeCourante(etat({ teams: equipes(8) }))).toBe('pret-au-tirage');
  });

  it('élimination directe : 2 équipes suffisent', () => {
    const c = concours({ mode: 'elimination_directe' as ConcoursMode });
    expect(etapeCourante(etat({ concours: c, teams: equipes(1) }))).toBe(
      'inscriptions-insuffisantes',
    );
    expect(etapeCourante(etat({ concours: c, teams: equipes(2) }))).toBe('pret-au-tirage');
  });

  it('poules tirées avec des parties ouvertes : il y a des scores à saisir', () => {
    const { poule, matches } = pouleJouee('p1');
    const enCours = [...matches.slice(0, 4), matchPoule('p1-x', 'p1', 'BARRAGE', false)];
    expect(
      etapeCourante(
        etat({ concours: concours({ status: 'poules' }), poules: [poule], matches: enCours }),
      ),
    ).toBe('scores-a-saisir');
  });

  it('toutes les poules jouées : place au tableau', () => {
    const { poule, matches } = pouleJouee('p1');
    expect(
      etapeCourante(
        etat({ concours: concours({ status: 'poules' }), poules: [poule], matches }),
      ),
    ).toBe('poules-terminees');
  });

  it('tableau en cours', () => {
    const m = {
      id: 'm1',
      stage: 'principal',
      round: 0,
      position: 0,
      done: false,
      teamAId: 'a',
      teamBId: 'b',
    } as unknown as Match;
    expect(etapeCourante(etat({ concours: concours({ status: 'tableau' }), matches: [m] }))).toBe(
      'tableau-a-saisir',
    );
  });

  it('finale jouée : il ne reste qu\'à clôturer', () => {
    const finale = {
      id: 'f',
      stage: 'principal',
      round: 2,
      position: 0,
      done: true,
      teamAId: 'a',
      teamBId: 'b',
      scoreA: 13,
      scoreB: 5,
    } as unknown as Match;
    expect(
      etapeCourante(etat({ concours: concours({ status: 'tableau' }), matches: [finale] })),
    ).toBe('a-cloturer');
  });

  it('rondes : la ronde est complète mais il en reste à tirer', () => {
    const c = concours({ mode: 'suisse' as ConcoursMode, status: 'rondes', nbRondes: 4 });
    const m = {
      id: 'r1',
      stage: 'ronde',
      round: 0,
      position: 0,
      done: true,
      teamAId: 'a',
      teamBId: 'b',
    } as unknown as Match;
    expect(etapeCourante(etat({ concours: c, matches: [m] }))).toBe('ronde-suivante');
  });

  it('rondes : la dernière ronde jouée mène à la clôture', () => {
    const c = concours({ mode: 'suisse' as ConcoursMode, status: 'rondes', nbRondes: 1 });
    const m = {
      id: 'r1',
      stage: 'ronde',
      round: 0,
      position: 0,
      done: true,
      teamAId: 'a',
      teamBId: 'b',
    } as unknown as Match;
    expect(etapeCourante(etat({ concours: c, matches: [m] }))).toBe('a-cloturer');
  });

  it('championnat : le calendrier est généré d\'un coup, rien à tirer', () => {
    // Sans ce cas, on proposerait indéfiniment de « tirer la ronde suivante ».
    const c = concours({ mode: 'championnat' as ConcoursMode, status: 'rondes' });
    const m = {
      id: 'r1',
      stage: 'ronde',
      round: 0,
      position: 0,
      done: true,
      teamAId: 'a',
      teamBId: 'b',
    } as unknown as Match;
    expect(etapeCourante(etat({ concours: c, matches: [m] }))).toBe('a-cloturer');
  });

  it('concours clôturé', () => {
    expect(etapeCourante(etat({ concours: concours({ status: 'termine' as ConcoursStatus }) }))).toBe(
      'termine',
    );
  });
});

/** Toutes les étapes atteignables, pour balayer les suites en une fois. */
const ETAPES: EtapeCourante[] = [
  'aucun-concours',
  'inscriptions-insuffisantes',
  'effectif-impossible',
  'pret-au-tirage',
  'scores-a-saisir',
  'poules-terminees',
  'ronde-suivante',
  'tableau-a-saisir',
  'a-cloturer',
  'termine',
];

/** Un état qui produit l'étape voulue, pour tester les suites sans détour. */
function etatPour(etape: EtapeCourante): EtatParcours {
  switch (etape) {
    case 'aucun-concours':
      return etat({ concours: null });
    case 'inscriptions-insuffisantes':
      return etat({ teams: equipes(2) });
    case 'effectif-impossible':
      return etat({ teams: equipes(5) });
    case 'pret-au-tirage':
      return etat({ teams: equipes(8) });
    case 'scores-a-saisir': {
      const { poule, matches } = pouleJouee('p1');
      return etat({
        concours: concours({ status: 'poules' }),
        poules: [poule],
        matches: [...matches.slice(0, 4), matchPoule('x', 'p1', 'BARRAGE', false)],
      });
    }
    case 'poules-terminees': {
      const { poule, matches } = pouleJouee('p1');
      return etat({ concours: concours({ status: 'poules' }), poules: [poule], matches });
    }
    case 'ronde-suivante':
      return etat({
        concours: concours({ mode: 'suisse' as ConcoursMode, status: 'rondes', nbRondes: 4 }),
        matches: [
          { id: 'r', stage: 'ronde', round: 0, position: 0, done: true } as unknown as Match,
        ],
      });
    case 'tableau-a-saisir':
      return etat({
        concours: concours({ status: 'tableau' }),
        matches: [
          {
            id: 'm',
            stage: 'principal',
            round: 0,
            position: 0,
            done: false,
            teamAId: 'a',
            teamBId: 'b',
          } as unknown as Match,
        ],
      });
    case 'a-cloturer':
      return etat({
        concours: concours({ status: 'tableau' }),
        matches: [
          {
            id: 'f',
            stage: 'principal',
            round: 0,
            position: 0,
            done: true,
            teamAId: 'a',
            teamBId: 'b',
            scoreA: 13,
            scoreB: 4,
          } as unknown as Match,
        ],
      });
    case 'termine':
      return etat({ concours: concours({ status: 'termine' as ConcoursStatus }) });
  }
}

describe('la suite proposée', () => {
  it.each(ETAPES)('« %s » débouche bien sur cette étape', (etape) => {
    // Garde-fou du test lui-même : sinon on validerait la mauvaise branche.
    expect(etapeCourante(etatPour(etape))).toBe(etape);
  });

  it.each(ETAPES)('« %s » propose un parcours qui existe', (etape) => {
    const suite = suiteSuggeree(etatPour(etape));
    expect(suite.phrase.trim()).not.toBe('');
    // Un identifiant fantaisiste donnerait un bouton qui ne fait rien.
    expect(parcoursParId(suite.parcours), `parcours « ${suite.parcours} » introuvable`).toBeDefined();
  });

  it('sans concours, elle propose d\'en créer un — pas une liste de sujets', () => {
    expect(suiteSuggeree(etat({ concours: null })).parcours).toBe('creer-concours');
  });

  it('prêt au tirage, elle distingue les poules du tableau', () => {
    expect(suiteSuggeree(etat({ teams: equipes(8) })).parcours).toBe('tirer-poules');
    expect(
      suiteSuggeree(
        etat({ concours: concours({ mode: 'elimination_directe' as ConcoursMode }), teams: equipes(8) }),
      ).parcours,
    ).toBe('lancer-tableau');
  });
});

describe('pistes quand la question n\'est pas comprise', () => {
  it.each(ETAPES)('« %s » donne des pistes, toutes réelles', (etape) => {
    const pistes = pistesContextuelles(etatPour(etape));
    expect(pistes.length).toBeGreaterThan(1);
    const inconnues = pistes.filter((id) => !parcoursParId(id));
    expect(inconnues).toEqual([]);
  });

  it('les pistes collent à l\'étape', () => {
    // Au milieu des poules : corriger et barrage, pas « exporter les résultats ».
    expect(pistesContextuelles(etatPour('scores-a-saisir'))).toContain('barrage');
    expect(pistesContextuelles(etatPour('scores-a-saisir'))).not.toContain('exporter-resultats');
    // Concours fini : l'inverse.
    expect(pistesContextuelles(etatPour('termine'))).toContain('exporter-resultats');
    expect(pistesContextuelles(etatPour('termine'))).not.toContain('tirer-poules');
  });

  it('ne se répètent pas', () => {
    for (const etape of ETAPES) {
      const pistes = pistesContextuelles(etatPour(etape));
      expect(new Set(pistes).size, `doublon dans « ${etape} »`).toBe(pistes.length);
    }
  });
});
