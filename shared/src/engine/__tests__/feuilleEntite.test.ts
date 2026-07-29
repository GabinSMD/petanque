import { describe, expect, it } from 'vitest';
import {
  feuilleDepuisMemoire,
  feuilleVierge,
  resumeFeuille,
  BAREME_CDC,
  partiesVides,
} from '../feuilleMatch';

describe('feuille de match, entité synchronisée', () => {
  it('une feuille neuve est prête à remplir', () => {
    const f = feuilleVierge('f1', '2026-09-05', 'cnc_open');
    expect(f.id).toBe('f1');
    expect(f.date).toBe('2026-09-05');
    expect(f.parties).toHaveLength(partiesVides(BAREME_CDC).length);
    expect(f.parties.every((p) => p.scoreA === null && p.scoreB === null)).toBe(true);
    expect(f.places).toHaveLength(f.parties.length);
    // Les places ont autant d'emplacements que la formation l'exige.
    expect(f.places[0]!.a).toHaveLength(1);
    expect(f.places.at(-1)!.a).toHaveLength(3);
    expect(f.signatures).toEqual({ a: null, b: null });
    // Une feuille ne dépend d'aucun concours : elle vit seule.
    expect(f.concoursId).toBe('');
  });

  it('reprend la feuille laissée sur l\'appareil, sans rien perdre', () => {
    // Ce que l'ancienne version stockait dans le navigateur.
    const memoire = {
      competition: 'cnc_feminin',
      maxMutes: 2,
      date: '2026-08-02',
      club: 'Boule de l\'Avenir',
      adversaire: 'PC Romans',
      licences: ['02600100', '02600101'],
      division: 'D1',
      poule: 'B',
      numeroClub: '6032',
      numeroClubAdverse: '6047',
      capitaineNom: 'MARTIN Lina',
      capitaineLicence: '02600199',
      adversaireJoueurs: [{ nom: 'ADVERSE 1', licence: '0264020' }],
      heureDebut: '14:00',
      heureFin: '18:30',
      parties: partiesVides(BAREME_CDC).map((p, i) =>
        i === 0 ? { ...p, scoreA: 13, scoreB: 7, jeu: '3' } : p,
      ),
      places: [],
      remplacements: { a: {}, b: {} },
      remarques: 'Vent fort',
      courrielComite: 'cd26-cdc@francepetanque.com',
      signatures: { a: null, b: null },
    };
    const f = feuilleDepuisMemoire('f2', memoire);
    expect(f.id).toBe('f2');
    expect(f.competition).toBe('cnc_feminin');
    expect(f.maxMutes).toBe(2);
    expect(f.club).toBe('Boule de l\'Avenir');
    expect(f.licences).toEqual(['02600100', '02600101']);
    expect(f.capitaineNom).toBe('MARTIN Lina');
    expect(f.remarques).toBe('Vent fort');
    expect(f.parties[0]).toMatchObject({ scoreA: 13, scoreB: 7, jeu: '3' });
    // Les places manquantes sont reconstruites à la bonne taille.
    expect(f.places).toHaveLength(f.parties.length);
    expect(f.places.at(-1)!.b).toHaveLength(3);
  });

  it('une mémoire vide ou abîmée donne une feuille vierge, pas une exception', () => {
    for (const brut of [{}, null, undefined, { parties: 'n\'importe quoi' }, { places: 42 }]) {
      const f = feuilleDepuisMemoire('f3', brut);
      expect(f.parties).toHaveLength(partiesVides(BAREME_CDC).length);
      expect(f.places).toHaveLength(f.parties.length);
    }
  });

  it('un barème modifié depuis : les parties sont refaites plutôt que fausses', () => {
    const memoire = { parties: [{ type: 'doublette', scoreA: 13, scoreB: 2 }] };
    const f = feuilleDepuisMemoire('f4', memoire);
    expect(f.parties).toHaveLength(partiesVides(BAREME_CDC).length);
    expect(f.parties[0]!.scoreA).toBeNull();
  });

  it('résume une feuille pour la reconnaître dans une liste', () => {
    const f = feuilleVierge('f5', '2026-09-05', 'cnc_open');
    expect(resumeFeuille({ ...f, club: 'Boule de l\'Avenir', adversaire: 'PC Romans' })).toContain(
      'Boule de l\'Avenir',
    );
    expect(resumeFeuille({ ...f, club: 'Boule de l\'Avenir', adversaire: 'PC Romans' })).toContain(
      'PC Romans',
    );
    // Sans adversaire renseigné, on ne laisse pas un « contre » orphelin.
    expect(resumeFeuille({ ...f, club: 'Boule de l\'Avenir' })).toBe('Boule de l\'Avenir');
    expect(resumeFeuille(f)).toBe('Rencontre sans équipes');
  });
});
