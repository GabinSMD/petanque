import { describe, expect, it } from 'vitest';
import {
  VERSION_FEUILLE_FICHIER,
  ecrireFeuilleFichier,
  empreinteFeuille,
  feuilleVierge,
  lireFeuilleFichier,
  type FeuilleMatch,
} from '../feuilleMatch';
import { lireSauvegarde } from '../sauvegarde';

/** Feuille remplie et signée, comme celle qu'un club archive. */
function feuilleRemplie(): FeuilleMatch {
  const f = feuilleVierge('f1', '2026-09-05', 'cnc_open');
  return {
    ...f,
    club: 'Boule de l\'Avenir',
    numeroClub: '6032',
    adversaire: 'PC Romans',
    numeroClubAdverse: '6047',
    division: 'D1',
    poule: 'A',
    licences: ['02600100', '02600101'],
    adversaireJoueurs: f.adversaireJoueurs.map((j, i) =>
      i < 2 ? { nom: `ADVERSE ${i + 1}`, licence: `026402${i}` } : j,
    ),
    parties: f.parties.map((p, i) => (i === 0 ? { ...p, scoreA: 13, scoreB: 7, jeu: '3' } : p)),
    remarques: 'Vent fort',
    signatures: {
      a: { image: 'data:image/png;base64,AAAA', quand: '05/09/2026 18:30', empreinte: 'DEADBEEF' },
      b: null,
    },
    updatedAt: '2026-09-05T18:30:00.000Z',
  };
}

function lire(texte: string): FeuilleMatch {
  const res = lireFeuilleFichier(texte);
  if (!res.ok) throw new Error(`lecture refusée : ${res.erreur}`);
  return res.feuille;
}

describe('feuille de match en fichier', () => {
  it('un aller-retour conserve la feuille, signatures comprises', () => {
    const f = feuilleRemplie();
    const relue = lire(ecrireFeuilleFichier(f));
    expect(relue.club).toBe(f.club);
    expect(relue.adversaire).toBe(f.adversaire);
    expect(relue.division).toBe('D1');
    expect(relue.licences).toEqual(f.licences);
    expect(relue.parties[0]).toMatchObject({ scoreA: 13, scoreB: 7, jeu: '3' });
    expect(relue.remarques).toBe('Vent fort');
    expect(relue.signatures.a?.image).toBe('data:image/png;base64,AAAA');
  });

  it('l\'empreinte survit à l\'aller-retour : une feuille signée reste vérifiable', () => {
    // L'identifiant change à l'import ; l'empreinte n'en dépend pas, donc la
    // signature reste comparable à celle de l'exemplaire papier.
    const f = feuilleRemplie();
    const relue = lire(ecrireFeuilleFichier(f));
    expect(relue.id).not.toBe(f.id);
    expect(empreinteFeuille(contenu(relue))).toBe(empreinteFeuille(contenu(f)));
  });

  it('refuse ce qui n\'est pas un fichier de l\'application', () => {
    expect(lireFeuilleFichier('pas du json')).toMatchObject({ ok: false });
    expect(lireFeuilleFichier('{}')).toMatchObject({ ok: false });
    expect(lireFeuilleFichier(JSON.stringify({ app: 'autre-chose' }))).toMatchObject({ ok: false });
  });

  it('refuse une version plus récente en disant quoi faire', () => {
    const futur = JSON.stringify({
      app: 'petanque-concours',
      type: 'feuilleMatch',
      version: VERSION_FEUILLE_FICHIER + 1,
      feuille: feuilleRemplie(),
    });
    const res = lireFeuilleFichier(futur);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.erreur).toMatch(/jour/i);
  });

  it('reconnaît une sauvegarde de concours et le dit', () => {
    // L'erreur qui arrivera vraiment : on mélange les deux fichiers.
    const concoursFichier = JSON.stringify({
      app: 'petanque-concours',
      version: 1,
      concours: { id: 'c1', name: 'Concours', date: '2026-09-05', format: 'doublette', mode: 'poules', scoreMax: 13, status: 'inscriptions' },
      teams: [],
      poules: [],
      matches: [],
    });
    const res = lireFeuilleFichier(concoursFichier);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.erreur).toMatch(/concours/i);
  });

  it('et l\'import de concours reconnaît une feuille de match', () => {
    const res = lireSauvegarde(ecrireFeuilleFichier(feuilleRemplie()));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.erreur).toMatch(/feuille de match/i);
  });

  it('répare un fichier bricolé plutôt que d\'afficher des totaux faux', () => {
    const bricole = JSON.stringify({
      app: 'petanque-concours',
      type: 'feuilleMatch',
      version: 1,
      feuille: { club: 'Boule', parties: [{ type: 'doublette', scoreA: 13, scoreB: 2 }], places: 'n\'importe quoi' },
    });
    const f = lire(bricole);
    expect(f.club).toBe('Boule');
    // Les onze parties du barème sont rétablies, vierges.
    expect(f.parties).toHaveLength(11);
    expect(f.parties[0]!.scoreA).toBeNull();
    expect(f.places).toHaveLength(11);
  });
});

/** Contenu signé d'une feuille, tel que l'écran le compose. */
function contenu(f: FeuilleMatch) {
  return {
    entete: {
      competition: f.competition,
      date: f.date,
      division: f.division,
      poule: f.poule,
      clubA: f.club,
      clubB: f.adversaire,
    },
    compositionA: f.licences,
    compositionB: f.adversaireJoueurs.map((j) => `${j.nom} ${j.licence}`),
    parties: f.parties.map((p, i) => ({
      type: p.type,
      scoreA: p.scoreA,
      scoreB: p.scoreB,
      jeu: p.jeu,
      placesA: f.places[i]?.a ?? [],
      placesB: f.places[i]?.b ?? [],
    })),
    remplacements: [],
    remarques: f.remarques,
    totalA: 2,
    totalB: 0,
  };
}
