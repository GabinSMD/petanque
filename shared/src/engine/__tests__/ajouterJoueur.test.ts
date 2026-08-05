import { describe, expect, it } from 'vitest';
import { ajouterJoueur, placesLibres, remplacerJoueur } from '../depot';
import type { Licencie, Player, Team } from '../../types';

/**
 * « Possibilité de remplacer un joueur lors du dépôt de licence **ou d'ajouter
 * un joueur** lors du dépôt de licence » (manuel §3.C, page 38 du manuel).
 *
 * #127 a livré le remplacement. Ici l'ajout : une équipe inscrite incomplète le
 * matin, dont le troisième joueur se présente au dépôt avec sa licence en main.
 *
 * Le manuel ne montre aucune copie d'écran de ce geste et ne nomme qu'un bouton
 * « Remplacer » : la forme de l'écran est notre choix, la possibilité est la
 * sienne.
 */
const AT = '2026-08-05T10:30:00.000Z';

const fiche = (over: Partial<Licencie> & { licence: string }): Licencie => ({
  id: over.licence,
  name: `JOUEUR ${over.licence}`,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const equipe = (players: Player[], over: Partial<Team> = {}): Team =>
  ({ id: 't1', concoursId: 'c', number: 1, players, forfait: false, updatedAt: AT, ...over }) as Team;

describe('places libres d une équipe', () => {
  it('compte ce qui manque pour atteindre la formation', () => {
    expect(placesLibres(equipe([{ name: 'A' }, { name: 'B' }]), 3)).toBe(1);
    expect(placesLibres(equipe([{ name: 'A' }]), 3)).toBe(2);
    expect(placesLibres(equipe([]), 3)).toBe(3);
  });

  it('rend zéro sur une équipe complète, et jamais un nombre négatif', () => {
    expect(placesLibres(equipe([{ name: 'A' }, { name: 'B' }, { name: 'C' }]), 3)).toBe(0);
    // Une équipe en surnombre — donnée abîmée ou reçue d'ailleurs — ne doit pas
    // rendre -1, sinon l'écran proposerait « ajouter » en croyant à une place.
    expect(placesLibres(equipe([{ name: 'A' }, { name: 'B' }, { name: 'C' }]), 2)).toBe(0);
  });

  it('en individuel, un participant seul est déjà complet', () => {
    // Mêlée et tir : chacun s'inscrit seul, les équipes sont tirées à chaque
    // ronde. La taille prévue vaut 1, et rien ne doit s'ajouter — c'est
    // l'appelant qui la connaît, le moteur ne devine pas le mode.
    expect(placesLibres(equipe([{ name: 'A' }]), 1)).toBe(0);
  });
});

describe('ajouter un joueur au dépôt', () => {
  it('ajoute le joueur en fin d équipe, construit depuis la fiche', () => {
    const t = ajouterJoueur(
      equipe([{ name: 'DUPONT ANDRE', licence: '1' }]),
      fiche({ licence: '2', name: 'MARTIN BRUNO', club: 'BOULE JOYEUSE', comite: 'CD38' }),
      AT,
      3,
    );
    expect(t.players).toHaveLength(2);
    expect(t.players[1]).toEqual({
      name: 'MARTIN BRUNO',
      licence: '2',
      club: 'BOULE JOYEUSE',
      comite: 'CD38',
    });
  });

  it('ne recopie que ce que la fiche dit', () => {
    // Même règle que `remplacerJoueur` : ce que la fiche ne dit pas reste vide
    // plutôt que d'être inventé. Un rôle deviné ferait mentir le tirage des
    // mêlées, un comité deviné ferait mentir la colonne CD.
    const t = ajouterJoueur(equipe([]), fiche({ licence: '2', name: 'SEUL' }), AT, 3);
    expect(t.players[0]).toEqual({ name: 'SEUL', licence: '2' });
  });

  it('trace l ajout, avec le rang du nouveau venu', () => {
    // Un ajout invisible poserait le même problème que #127 : le lendemain,
    // personne ne peut dire qui a joué.
    const t = ajouterJoueur(
      equipe([{ name: 'A' }, { name: 'B' }]),
      fiche({ licence: '9', name: 'TROISIEME' }),
      AT,
      3,
    );
    expect(t.ajouts).toEqual([
      { index: 2, joueur: { name: 'TROISIEME', licence: '9' }, at: AT },
    ]);
  });

  it('refuse sur une équipe complète, sans rien changer ni tracer', () => {
    // Sur une équipe complète, seul le remplacement a un sens.
    const pleine = equipe([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
    const t = ajouterJoueur(pleine, fiche({ licence: '9' }), AT, 3);
    expect(t).toBe(pleine);
    expect(t.ajouts).toBeUndefined();
  });

  it('refuse aussi en individuel, où la taille prévue est 1', () => {
    const seul = equipe([{ name: 'A' }]);
    expect(ajouterJoueur(seul, fiche({ licence: '9' }), AT, 1)).toBe(seul);
  });

  it('deux ajouts remplissent puis le troisième est refusé', () => {
    let t = equipe([{ name: 'A' }]);
    t = ajouterJoueur(t, fiche({ licence: '2', name: 'B' }), AT, 3);
    t = ajouterJoueur(t, fiche({ licence: '3', name: 'C' }), AT, 3);
    expect(t.players.map((p) => p.name)).toEqual(['A', 'B', 'C']);
    expect(t.ajouts).toHaveLength(2);
    expect(t.ajouts!.map((a) => a.index)).toEqual([1, 2]);
    const refuse = ajouterJoueur(t, fiche({ licence: '4', name: 'D' }), AT, 3);
    expect(refuse).toBe(t);
  });

  it('n interfère pas avec les remplacements, et réciproquement', () => {
    // Deux listes distinctes : un ajout n'a pas de sortant, et le seul lecteur
    // des remplacements fait `r.avant.name` sans garde — y glisser une entrée
    // sans `avant` ferait tomber l'écran d'une tablette restée en arrière.
    let t = equipe([{ name: 'A', licence: '1' }, { name: 'B', licence: '2' }]);
    t = ajouterJoueur(t, fiche({ licence: '3', name: 'C' }), AT, 3);
    t = remplacerJoueur(t, 0, fiche({ licence: '4', name: 'REMPLACANT' }), AT);
    expect(t.ajouts).toHaveLength(1);
    expect(t.remplacements).toHaveLength(1);
    expect(t.remplacements![0]!.avant.name).toBe('A');
    expect(t.players.map((p) => p.name)).toEqual(['REMPLACANT', 'B', 'C']);
  });

  it('un joueur ajouté peut ensuite être remplacé', () => {
    let t = ajouterJoueur(equipe([{ name: 'A' }]), fiche({ licence: '2', name: 'B' }), AT, 3);
    t = remplacerJoueur(t, 1, fiche({ licence: '3', name: 'C' }), AT);
    expect(t.players.map((p) => p.name)).toEqual(['A', 'C']);
    expect(t.ajouts![0]!.joueur.name).toBe('B');
    expect(t.remplacements![0]!.avant.name).toBe('B');
  });
});
