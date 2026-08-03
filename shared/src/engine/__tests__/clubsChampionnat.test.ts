import { describe, expect, it } from 'vitest';
import { controlerEquipe } from '../licences';
import { COMPETITIONS_CLUB, criteresCompetition, estHorsUE } from '../championnat';
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

describe('quota de mutés', () => {
  it('respecte le nombre autorisé', () => {
    const b = base(
      fiche({ licence: '1', mutation: true }),
      fiche({ licence: '2', mutation: true }),
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

  it('aucun muté autorisé : une équipe sans muté passe', () => {
    const b = base(fiche({ licence: '1' }), fiche({ licence: '2' }));
    expect(
      controlerEquipe([j('1'), j('2')], b, { annee: 2026, maxMutes: 0 }).anomaliesEquipe,
    ).not.toContain('mutes');
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
    const c = criteresCompetition('cnc_feminin', 2026, 1);
    expect(c.sexe).toBe('feminin');
  });

  it('l homogénéité est exigée partout sauf chez les jeunes', () => {
    expect(criteresCompetition('coupe_de_france', 2026, 1).homogene).toBe(true);
    expect(criteresCompetition('cnc_open', 2026, 1).homogene).toBe(true);
    // Le manuel : « il faut Homogène club pour tous les championnats sauf
    // pour les championnats jeunes ».
    expect(criteresCompetition('cnc_jeunes', 2026, 1).homogene).toBe(false);
  });

  it('un seul joueur hors UE partout', () => {
    for (const c of COMPETITIONS_CLUB) {
      expect(criteresCompetition(c.id, 2026, 1).maxHorsUE, c.id).toBe(1);
    }
  });

  it('le quota de mutés vient de l organisateur', () => {
    expect(criteresCompetition('cnc_open', 2026, 3).maxMutes).toBe(3);
  });

  it('les jeunes admettent les cadets, et rien de plus jeune', () => {
    // « Juniors (Cadet) » sur le panneau fédéral : une seule catégorie s'ouvre
    // en dessous. On vérifie la règle sur des joueurs, pas la présence d'un
    // champ : le champ, je l'avais inventé, et il a disparu.
    const c = criteresCompetition('cnc_jeunes', 2026, 0);
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
      expect(criteresCompetition(c.id, 2026, 0).strict, c.id).toBe(false);
    }
  });

  it('porte le championnat « +55 »', () => {
    const c = criteresCompetition('cnc_plus55', 2026, 0);
    expect(c.categorieAge).toBe('plus55');
    expect(COMPETITIONS_CLUB.map((x) => x.id)).toContain('cnc_plus55');
  });

  it('les trois états du contingent hors UE (Tous / Limite 1 Externe / Aucune)', () => {
    // Le manuel : « Choix du nbre de joueurs mutés dans l'équipe (étranger hors
    // UE) », avec trois positions. Le 1 était codé en dur.
    expect(criteresCompetition('cnc_open', 2026, 0, undefined, 'un_externe').maxHorsUE).toBe(1);
    expect(criteresCompetition('cnc_open', 2026, 0, undefined, 'aucun').maxHorsUE).toBe(0);
    // « Tous » : aucun plafond, donc aucun contrôle du tout.
    expect(criteresCompetition('cnc_open', 2026, 0, undefined, 'tous').maxHorsUE).toBeUndefined();
    // Sans précision, on garde la limite d'un seul : c'est le cas courant, et
    // c'est le comportement qui existait avant les trois états.
    expect(criteresCompetition('cnc_open', 2026, 0).maxHorsUE).toBe(1);
  });
});
