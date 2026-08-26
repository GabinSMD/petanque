import { describe, expect, it } from 'vitest';
import {
  MODES_CONCOURS,
  accepteConsolante,
  estModeConnu,
  estModeIndividuel,
  estModeRondes,
  estModeTir,
} from '../modes';
import type { ConcoursMode } from '../../types';

/**
 * Ce que dit la formule d'un concours : joue-t-on en rondes, s'inscrit-on seul,
 * est-ce du tir, une consolante a-t-elle un sens.
 *
 * Ces quatre questions vivaient dans `client/src/lib/labels.ts`, mêlées aux
 * emojis et aux accroches, et s'y posaient **sans garde** :
 * `MODE_INFO[mode].rondes`. Un mode inconnu — reçu par réplication d'un appareil
 * portant une version plus récente, ou par un import de sauvegarde — levait
 * `Cannot read properties of undefined`, et la frontière d'erreur remplaçait
 * **tout** l'écran du concours par « Cet écran n'a pas pu s'afficher ».
 *
 * L'organisateur perdait alors l'accès à ses équipes et à ses résultats déjà
 * saisis. Un affichage dégradé valait infiniment mieux.
 *
 * Ces règles sont donc ici, où elles se testent — le client ne porte aucun
 * harnais de test, ce qui est la raison du déplacement.
 */
const CONNUS: ConcoursMode[] = [
  'poules',
  'elimination_directe',
  'melee',
  'suisse',
  'championnat',
  'tir_precision',
];

/** Ce qu'un appareil plus récent pourrait nous envoyer. */
const INCONNU = 'formule_de_demain' as ConcoursMode;

describe('les modes connus', () => {
  it('sont exactement les six du type', () => {
    expect([...MODES_CONCOURS]).toEqual(CONNUS);
  });

  it('répondent ce qu ils doivent aux quatre questions', () => {
    expect(CONNUS.filter(estModeRondes)).toEqual(['melee', 'suisse', 'championnat']);
    expect(CONNUS.filter(estModeIndividuel)).toEqual(['melee', 'tir_precision']);
    expect(CONNUS.filter(estModeTir)).toEqual(['tir_precision']);
    expect(CONNUS.filter(accepteConsolante)).toEqual(['poules', 'elimination_directe']);
  });
});

describe('un mode inconnu se dégrade au lieu de tomber', () => {
  it('ne lève sur aucune des quatre questions', () => {
    // C'est le défaut même : sans garde, chacune levait et faisait disparaître
    // l'écran du concours.
    expect(() => estModeRondes(INCONNU)).not.toThrow();
    expect(() => estModeIndividuel(INCONNU)).not.toThrow();
    expect(() => estModeTir(INCONNU)).not.toThrow();
    expect(() => accepteConsolante(INCONNU)).not.toThrow();
  });

  it('répond faux partout, ce qui est le repli le plus sûr', () => {
    // Faux, et non vrai : un concours qu'on ne comprend pas s'affiche comme un
    // tableau classique par équipes. Répondre « oui, c'est du tir » enverrait
    // l'écran sur une saisie de séries qui n'a rien à voir.
    expect(estModeRondes(INCONNU)).toBe(false);
    expect(estModeIndividuel(INCONNU)).toBe(false);
    expect(estModeTir(INCONNU)).toBe(false);
    expect(accepteConsolante(INCONNU)).toBe(false);
  });

  it('tient aussi sur les valeurs qu une donnée abîmée peut porter', () => {
    for (const valeur of ['', 'tableau', 'POULES', 'poules ', null, undefined]) {
      const mode = valeur as unknown as ConcoursMode;
      expect(() => estModeRondes(mode)).not.toThrow();
      expect(estModeRondes(mode)).toBe(false);
      expect(estModeTir(mode)).toBe(false);
    }
  });

  it('ne se laisse pas berner par les propriétés héritées d Object', () => {
    /*
     * Un `Record` interrogé avec une clé venue de la base répond pour les
     * propriétés héritées : `table['constructor']` rend une fonction, pas
     * `undefined`.
     *
     * Le sabotage a montré la limite de ce test-ci : pour les quatre prédicats,
     * l'`=== true` neutralise déjà une fonction, si bien qu'ils passeraient même
     * avec un objet nu. C'est `estModeConnu` — testé juste en dessous — qui rend
     * le choix de la `Map` réellement porteur.
     */
    for (const piege of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      const mode = piege as ConcoursMode;
      expect(estModeRondes(mode)).toBe(false);
      expect(estModeTir(mode)).toBe(false);
      expect(accepteConsolante(mode)).toBe(false);
    }
  });

  it('estModeConnu distingue une vraie formule d une propriété héritée', () => {
    // C'est ce test que le sabotage « la Map redevient un objet » fait tomber :
    // avec un objet nu, `'constructor' in table` répond **vrai** et l'écran
    // croirait connaître une formule qui n'existe pas.
    for (const connu of CONNUS) expect(estModeConnu(connu)).toBe(true);
    for (const piege of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      expect(estModeConnu(piege as ConcoursMode)).toBe(false);
    }
    expect(estModeConnu(INCONNU)).toBe(false);
  });
});
