import { describe, expect, it } from 'vitest';
import { bilanAvantTirage } from '../bilanTirage';
import type { ControleEquipe } from '../licences';

const conforme: ControleEquipe = {
  conforme: true,
  joueurs: [
    { name: 'DUPOND Jean', anomalies: [], inconnu: false },
    { name: 'MARTIN Lina', anomalies: [], inconnu: false },
  ],
  anomaliesEquipe: [],
};

/** Une équipe dont un seul joueur est en faute. */
const unJoueurEnFaute: ControleEquipe = {
  conforme: false,
  joueurs: [
    { name: 'DUPOND Jean', anomalies: [], inconnu: false },
    { name: 'BLANC Odette', anomalies: ['anneeReprise'], inconnu: false },
  ],
  anomaliesEquipe: [],
};

/** Une équipe fautive au niveau de l'équipe, joueurs irréprochables. */
const equipeEnFaute: ControleEquipe = {
  conforme: false,
  joueurs: [
    { name: 'NOIR Paul', anomalies: [], inconnu: false },
    { name: 'ROUGE Alice', anomalies: [], inconnu: false },
  ],
  anomaliesEquipe: ['mixte'],
};

const licenceInconnue: ControleEquipe = {
  conforme: false,
  joueurs: [
    { name: 'VERT Hugo', licence: '02699999', anomalies: [], inconnu: true },
    { name: 'GRIS Emma', anomalies: [], inconnu: false },
  ],
  anomaliesEquipe: [],
};

describe('bilan de validité avant tirage (§3.B.6)', () => {
  it('compte les équipes contrôlées et celles qui passent', () => {
    const bilan = bilanAvantTirage([
      { number: 1, controle: conforme },
      { number: 2, controle: unJoueurEnFaute },
      { number: 3, controle: conforme },
    ]);
    expect(bilan.total).toBe(3);
    expect(bilan.conformes).toBe(2);
    expect(bilan.lignes).toHaveLength(1);
    expect(bilan.lignes[0]!.number).toBe(2);
  });

  it('ne liste que les joueurs réellement en faute', () => {
    // Recopier toute l'équipe noierait le joueur à corriger : à la table de
    // marque, on cherche un nom, pas une liste.
    const bilan = bilanAvantTirage([{ number: 7, controle: unJoueurEnFaute }]);
    expect(bilan.lignes[0]!.joueurs.map((j) => j.name)).toEqual(['BLANC Odette']);
    expect(bilan.lignes[0]!.joueurs[0]!.anomalies).toEqual(['anneeReprise']);
  });

  it('signale une équipe fautive même quand aucun joueur ne l\'est', () => {
    // Équipe non mixte : la faute est celle de la composition. Sans cette
    // ligne, le bilan dirait « non conforme » sans dire pourquoi.
    const bilan = bilanAvantTirage([{ number: 4, controle: equipeEnFaute }]);
    expect(bilan.lignes[0]!.joueurs).toEqual([]);
    expect(bilan.lignes[0]!.anomaliesEquipe).toEqual(['mixte']);
  });

  it('distingue une licence inconnue du fichier d\'une licence en faute', () => {
    // Le fichier des licenciés peut être incomplet ou daté : ce n'est pas la
    // même conversation avec le joueur qu'une licence périmée.
    const bilan = bilanAvantTirage([{ number: 9, controle: licenceInconnue }]);
    const ligne = bilan.lignes[0]!;
    expect(ligne.joueurs).toHaveLength(1);
    expect(ligne.joueurs[0]!.inconnu).toBe(true);
    expect(ligne.joueurs[0]!.anomalies).toEqual([]);
    expect(bilan.inconnues).toBe(1);
  });

  it('range les équipes par numéro de dossard', () => {
    // C'est l'ordre des étiquettes et des appels : celui dans lequel on
    // parcourt les équipes pour corriger.
    const bilan = bilanAvantTirage([
      { number: 12, controle: unJoueurEnFaute },
      { number: 3, controle: equipeEnFaute },
      { number: 8, controle: licenceInconnue },
    ]);
    expect(bilan.lignes.map((l) => l.number)).toEqual([3, 8, 12]);
  });

  it('rend un bilan vide sans rien inventer', () => {
    expect(bilanAvantTirage([])).toEqual({ total: 0, conformes: 0, inconnues: 0, lignes: [] });
    const propre = bilanAvantTirage([{ number: 1, controle: conforme }]);
    expect(propre.lignes).toEqual([]);
    expect(propre.conformes).toBe(1);
  });
});
