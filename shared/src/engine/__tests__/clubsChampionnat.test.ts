import { describe, expect, it } from 'vitest';
import { controlerEquipe } from '../licences';
import {
  COMPETITIONS_CLUB,
  competitionClub,
  criteresCompetition,
  estHorsUE,
} from '../championnat';
import type { Licencie, Player } from '../../types';

const T = '2026-01-01T00:00:00.000Z';

function fiche(over: Partial<Licencie> & { licence: string }): Licencie {
  return {
    id: over.licence,
    name: 'Joueur ' + over.licence,
    club: 'La Boule Joyeuse',
    anneeReprise: 2026,
    sexe: 'M',
    classification: 'P',
    dateNaissance: '1980-05-04',
    nationalite: 'FRA',
    updatedAt: T,
    ...over,
  };
}
const base = (...f: Licencie[]) => new Map(f.map((x) => [x.licence!, x]));
const j = (licence: string): Player => ({ name: 'J' + licence, licence });

describe('nationalité hors UE', () => {
  it('reconnaît les pays de l Union', () => {
    expect(estHorsUE('FRA')).toBe(false);
    expect(estHorsUE('ESP')).toBe(false);
    expect(estHorsUE('BEL')).toBe(false);
    expect(estHorsUE('FR')).toBe(false);
  });

  it('reconnaît un pays hors Union', () => {
    expect(estHorsUE('MAR')).toBe(true);
    expect(estHorsUE('CHE')).toBe(true); // Suisse : hors UE
    expect(estHorsUE('TUN')).toBe(true);
  });

  it('ne tranche pas sur une valeur inconnue ou absente', () => {
    // On ne disqualifie pas un joueur sur une nationalité qu'on ne sait pas lire.
    expect(estHorsUE(undefined)).toBeNull();
    expect(estHorsUE('')).toBeNull();
    expect(estHorsUE('Française')).toBeNull();
  });
});

describe('quota de joueurs hors UE', () => {
  const criteres = { annee: 2026, maxHorsUE: 1 };

  it('un seul joueur hors UE passe', () => {
    const b = base(fiche({ licence: '1' }), fiche({ licence: '2', nationalite: 'MAR' }));
    expect(controlerEquipe([j('1'), j('2')], b, criteres).anomaliesEquipe).not.toContain('horsUE');
  });

  it('deux joueurs hors UE ne passent pas', () => {
    const b = base(
      fiche({ licence: '1', nationalite: 'MAR' }),
      fiche({ licence: '2', nationalite: 'TUN' }),
    );
    const r = controlerEquipe([j('1'), j('2')], b, criteres);
    expect(r.anomaliesEquipe).toContain('horsUE');
    expect(r.conforme).toBe(false);
  });

  it('sans quota demandé, la nationalité ne bloque rien', () => {
    const b = base(
      fiche({ licence: '1', nationalite: 'MAR' }),
      fiche({ licence: '2', nationalite: 'TUN' }),
    );
    expect(controlerEquipe([j('1'), j('2')], b, { annee: 2026 }).anomaliesEquipe).toEqual([]);
  });
});

describe('quota de mutés externes (#134)', () => {
  it('respecte le nombre autorisé', () => {
    const b = base(
      fiche({ licence: '1', etatMutation: 'externe' }),
      fiche({ licence: '2', etatMutation: 'externe' }),
      fiche({ licence: '3' }),
    );
    const deuxAutorises = controlerEquipe([j('1'), j('2'), j('3')], b, {
      annee: 2026,
      maxMutes: 2,
    });
    expect(deuxAutorises.anomaliesEquipe).not.toContain('mutes');

    const unSeul = controlerEquipe([j('1'), j('2'), j('3')], b, { annee: 2026, maxMutes: 1 });
    expect(unSeul.anomaliesEquipe).toContain('mutes');
  });

  it('une mutation interne ne compte pas', () => {
    // Le cas de la planche p.114 : « MUT.INT » sur une carte d'une équipe
    // conforme. Compter les internes refusait des équipes valides.
    const b = base(
      fiche({ licence: '1', etatMutation: 'interne', mutation: true }),
      fiche({ licence: '2', etatMutation: 'interne', mutation: true }),
      fiche({ licence: '3', etatMutation: 'externe', mutation: true }),
    );
    expect(
      controlerEquipe([j('1'), j('2'), j('3')], b, { annee: 2026, maxMutes: 1 }).anomaliesEquipe,
    ).not.toContain('mutes');
    expect(
      controlerEquipe([j('1'), j('2'), j('3')], b, { annee: 2026, maxMutes: 0 }).anomaliesEquipe,
    ).toContain('mutes');
  });

  it('une fiche qui ne dit que « muté » compte comme externe', () => {
    // Ancien champ seul : on ne sait pas laquelle, et on garde le contrôle
    // d'avant plutôt que de l'assouplir sur une information absente.
    const b = base(fiche({ licence: '1', mutation: true }), fiche({ licence: '2', mutation: true }));
    expect(
      controlerEquipe([j('1'), j('2')], b, { annee: 2026, maxMutes: 1 }).anomaliesEquipe,
    ).toContain('mutes');
  });

  it('aucun muté autorisé : une équipe sans muté passe', () => {
    const b = base(fiche({ licence: '1' }), fiche({ licence: '2' }));
    expect(
      controlerEquipe([j('1'), j('2')], b, { annee: 2026, maxMutes: 0 }).anomaliesEquipe,
    ).not.toContain('mutes');
  });
});

describe('licencié suspendu (#136)', () => {
  it('le joueur est signalé, quel que soit le concours', () => {
    const b = base(fiche({ licence: '1', suspendu: true }), fiche({ licence: '2' }));
    const c = controlerEquipe([j('1'), j('2')], b, { annee: 2026 });
    expect(c.joueurs[0]!.anomalies).toContain('suspension');
    expect(c.joueurs[1]!.anomalies).not.toContain('suspension');
    expect(c.conforme).toBe(false);
  });

  it('une suspension levée ne laisse rien', () => {
    const b = base(fiche({ licence: '1', suspendu: false }));
    expect(controlerEquipe([j('1')], b, { annee: 2026 }).joueurs[0]!.anomalies).toEqual([]);
  });
});

describe('compétitions de clubs prédéfinies', () => {
  it('couvre les compétitions du manuel', () => {
    const ids = COMPETITIONS_CLUB.map((c) => c.id);
    expect(ids).toContain('coupe_de_france');
    expect(ids).toContain('cnc_open');
    expect(ids).toContain('cnc_feminin');
    expect(ids).toContain('cnc_jeunes');
    expect(ids).toContain('cnc_veterans');
  });

  it('le championnat féminin n accepte que des femmes', () => {
    const c = criteresCompetition('cnc_feminin', 2026);
    expect(c.sexe).toBe('feminin');
  });

  it('l homogénéité est exigée partout sauf chez les jeunes', () => {
    expect(criteresCompetition('coupe_de_france', 2026).homogene).toBe(true);
    expect(criteresCompetition('cnc_open', 2026).homogene).toBe(true);
    // Le manuel : « il faut Homogène club pour tous les championnats sauf
    // pour les championnats jeunes ».
    expect(criteresCompetition('cnc_jeunes', 2026).homogene).toBe(false);
  });

  it('un seul joueur hors UE partout', () => {
    for (const c of COMPETITIONS_CLUB) {
      expect(criteresCompetition(c.id, 2026).maxHorsUE, c.id).toBe(1);
    }
  });

  it('les jeunes admettent les cadets, et rien de plus jeune', () => {
    // « Juniors (Cadet) » sur le panneau fédéral : une seule catégorie s'ouvre
    // en dessous. On vérifie la règle sur des joueurs, pas la présence d'un
    // champ : le champ, je l'avais inventé, et il a disparu.
    const c = criteresCompetition('cnc_jeunes', 2026);
    expect(c.categorieAge).toBe('juniors');
    expect(c.strict).toBe(false);
    const cadet = fiche({ licence: 'c', dateNaissance: '2013-06-01' }); // 13 ans
    const minime = fiche({ licence: 'm', dateNaissance: '2016-06-01' }); // 10 ans
    const b = new Map([[cadet.licence!, cadet], [minime.licence!, minime]]);
    expect(controlerEquipe([j('c')], b, c).joueurs[0]!.anomalies).not.toContain('dateNaissance');
    expect(controlerEquipe([j('m')], b, c).joueurs[0]!.anomalies).toContain('dateNaissance');
  });

  it('aucune compétition de clubs n est en catégorie stricte', () => {
    // La règle « une seule en dessous » est celle de `controlerEquipe` hors mode
    // strict : il suffit qu'aucune compétition ne demande le mode strict.
    for (const c of COMPETITIONS_CLUB) {
      expect(criteresCompetition(c.id, 2026).strict, c.id).toBe(false);
    }
  });

  it('porte le championnat « +55 »', () => {
    const c = criteresCompetition('cnc_plus55', 2026);
    expect(c.categorieAge).toBe('plus55');
    expect(COMPETITIONS_CLUB.map((x) => x.id)).toContain('cnc_plus55');
  });

  it('le panneau « Mutations » règle le contingent de mutés externes (#134)', () => {
    // Manuel §3.E, planches p.112-114 : le panneau s'appelle « Mutations », ses
    // trois positions sont Tous / Limite 1 Externe / Aucune.
    expect(criteresCompetition('cnc_open', 2026, 'un_externe').maxMutes).toBe(1);
    expect(criteresCompetition('cnc_open', 2026, 'aucun').maxMutes).toBe(0);
    expect(criteresCompetition('cnc_open', 2026, 'tous').maxMutes).toBeUndefined();
    // Sans précision, la limite d'un seul : la position courante du panneau.
    expect(criteresCompetition('cnc_open', 2026).maxMutes).toBe(1);
  });

  it('le contingent hors UE ne dépend pas du panneau « Mutations »', () => {
    // Deux règles distinctes : « 1 seul joueur étranger Hors UE par équipe »
    // (manuel p.35, Critères France) ne s'ouvre pas quand on choisit « Tous ».
    for (const position of ['tous', 'un_externe', 'aucun'] as const) {
      expect(criteresCompetition('cnc_open', 2026, position).maxHorsUE, position).toBe(1);
    }
  });
});

describe('autre championnat de clubs : filtres libres (§3.E)', () => {
  it('figure dans la liste, à côté des compétitions prédéfinies', () => {
    expect(COMPETITIONS_CLUB.map((c) => c.id)).toContain('autre');
  });

  it('sans filtres, part d un championnat ouvert, homogène, toutes catégories', () => {
    // « Il faut Homogène club pour tous les championnats sauf pour les
    // championnats jeunes » : l'homogénéité est la valeur de départ.
    const c = criteresCompetition('autre', 2026);
    expect(c.sexe).toBe('tous');
    expect(c.categorieAge).toBeUndefined();
    expect(c.homogene).toBe(true);
    expect(c.strict).toBe(false);
    expect(c.maxHorsUE).toBe(1);
  });

  it('applique le sexe, la catégorie et l homogénéité choisis', () => {
    const c = criteresCompetition('autre', 2026, 'aucun', '2026-05-01', {
      sexe: 'feminin',
      categorieAge: 'veterans',
      homogene: false,
    });
    expect(c.sexe).toBe('feminin');
    expect(c.categorieAge).toBe('veterans');
    expect(c.homogene).toBe(false);
    // Le contingent de mutations se règle à part, comme pour les autres.
    expect(c.maxMutes).toBe(0);
    expect(c.dateConcours).toBe('2026-05-01');
  });

  it('le filtre se vérifie sur les joueurs', () => {
    const c = criteresCompetition('autre', 2026, 'tous', undefined, {
      sexe: 'feminin',
      categorieAge: 'veterans',
      homogene: true,
    });
    const veterane = fiche({ licence: 'v', sexe: 'F', dateNaissance: '1960-01-01' });
    const homme = fiche({ licence: 'h', sexe: 'M', dateNaissance: '1960-01-01' });
    const jeune = fiche({ licence: 'y', sexe: 'F', dateNaissance: '1990-01-01' });
    const b = base(veterane, homme, jeune);
    expect(controlerEquipe([j('v')], b, c).joueurs[0]!.anomalies).toEqual([]);
    expect(controlerEquipe([j('h')], b, c).joueurs[0]!.anomalies).toContain('sexe');
    expect(controlerEquipe([j('y')], b, c).joueurs[0]!.anomalies).toContain('dateNaissance');
  });

  it('l homogénéité se règle : deux clubs passent quand elle n est pas exigée', () => {
    const a = fiche({ licence: 'a', club: 'Club A' });
    const b2 = fiche({ licence: 'b', club: 'Club B' });
    const b = base(a, b2);
    const exige = criteresCompetition('autre', 2026, 'tous', undefined, {
      sexe: 'tous',
      homogene: true,
    });
    const libre = criteresCompetition('autre', 2026, 'tous', undefined, {
      sexe: 'tous',
      homogene: false,
    });
    expect(controlerEquipe([j('a'), j('b')], b, exige).conforme).toBe(false);
    expect(controlerEquipe([j('a'), j('b')], b, libre).conforme).toBe(true);
  });

  it('ignore les filtres d une compétition prédéfinie', () => {
    // Le règlement d'une compétition de la liste ne se change pas sur la feuille.
    const filtres = { sexe: 'masculin' as const, categorieAge: 'juniors' as const, homogene: false };
    const c = criteresCompetition('cnc_feminin', 2026, 'un_externe', undefined, filtres);
    expect(c.sexe).toBe('feminin');
    expect(c.categorieAge).toBeUndefined();
    expect(c.homogene).toBe(true);
    expect(competitionClub('cnc_feminin', filtres).sexe).toBe('feminin');
    expect(competitionClub('autre', filtres).sexe).toBe('masculin');
  });
});
