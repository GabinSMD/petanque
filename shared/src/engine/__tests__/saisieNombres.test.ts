import { describe, expect, it } from 'vitest';
import { MAX_DECALAGE, MAX_MISE, raisonRefusDecalage, raisonRefusMise } from '../saisieNombres';

/**
 * « Un champ nombre ne refuse jamais sans dire pourquoi. »
 *
 * Ce lot naît d'un défaut observé dans l'application. Le champ « Décalage n° de
 * terrain » portait `step={50}`, celui du décalage d'équipe `step={100}`. Aucune
 * règle du manuel ne l'exige : §3.B.1 dit seulement de décaler les numéros pour
 * que deux concours du même jour n'aient pas deux « équipe 1 » ni deux
 * « terrain 1 ». Le pas était inventé, et il refusait des valeurs légitimes.
 *
 * Le refus était **muet**, pour une raison de structure : les deux champs vivent
 * dans un `<details>` replié. Le navigateur avait bien un motif — « les deux
 * valeurs valides les plus proches sont 0 et 50 » — mais il ne peut pas amener
 * le curseur sur un élément qu'il ne peint pas. Il n'affiche donc rien et se
 * contente d'écrire en console `An invalid form control with name='' is not
 * focusable`. L'organisateur cliquait « Enregistrer », et rien ne se passait.
 *
 * Le cas dévastateur n'est même pas celui qu'on tape : `decalageTerrain: 8` est
 * un nombre que le type, le moteur et la base acceptent tous. Arrivé par une
 * sauvegarde, une synchronisation ou une version différente, il rendait le
 * concours **définitivement** inenregistrable — sans que personne ait rien fait,
 * et sans qu'un mot l'explique.
 *
 * D'où des fonctions qui rendent une **raison** et non un booléen, sur le modèle
 * de `validerEquipe`. Un `false` se traduit en silence à l'écran ; une phrase,
 * non.
 */
describe('décalage de numérotation', () => {
  it('accepte 0 — la numérotation normale', () => {
    // Le formulaire écrit « 0 = numérotation normale ». Un `!valeur` naïf
    // prendrait ce zéro pour une absence de saisie ; ici c'est une réponse.
    expect(raisonRefusDecalage(0)).toBeUndefined();
  });

  it('accepte 8, la valeur que le pas de 50 refusait', () => {
    // Le cas exact du défaut : huit terrains décalés de huit, ce que fait un
    // organisateur qui tient deux concours sur seize terrains.
    expect(raisonRefusDecalage(8)).toBeUndefined();
  });

  it('accepte les valeurs rondes qu on utilisait déjà', () => {
    // Le lot ne retire pas les multiples de 50 et 100 : il cesse de n'accepter
    // qu'eux. Les concours déjà enregistrés doivent rester enregistrables.
    expect(raisonRefusDecalage(50)).toBeUndefined();
    expect(raisonRefusDecalage(100)).toBeUndefined();
    expect(raisonRefusDecalage(MAX_DECALAGE)).toBeUndefined();
  });

  it('refuse un décalage négatif, et le dit', () => {
    // Il n'y a pas d'équipe n°-3.
    expect(raisonRefusDecalage(-1)).toMatch(/négatif|positif|\b0\b/i);
  });

  it('refuse un décalage non entier, et le dit', () => {
    // Il n'y a pas de terrain 8,5.
    expect(raisonRefusDecalage(8.5)).toMatch(/entier/i);
  });

  it('refuse au-delà de la borne, en nommant la borne', () => {
    // La borne n'est pas une règle fédérale : c'est un garde-fou contre le
    // collage d'un numéro de licence dans le champ. Elle doit donc se nommer,
    // sinon elle redevient un refus arbitraire.
    expect(raisonRefusDecalage(MAX_DECALAGE + 1)).toContain(String(MAX_DECALAGE));
  });

  it('refuse ce qui n est pas un nombre, en le disant', () => {
    // `Number('')` fait 0, mais `Number('abc')` fait NaN et une division ratée
    // fait Infinity. Aucun des deux n'est un décalage.
    //
    // Le test porte sur le **texte** et pas seulement sur la présence d'un
    // refus : sans le garde `Number.isFinite`, `NaN` et `Infinity` retombent sur
    // le contrôle d'entier — `Number.isInteger(NaN)` est faux — et l'organisateur
    // lirait « un décalage est un nombre entier », ce qui n'explique rien. Le
    // sabotage a montré qu'un simple `toBeTruthy` laissait passer cette
    // substitution : une mauvaise raison est un défaut, pas un détail.
    expect(raisonRefusDecalage(Number.NaN)).toMatch(/n'est pas un nombre/i);
    expect(raisonRefusDecalage(Number.POSITIVE_INFINITY)).toMatch(/n'est pas un nombre/i);
  });
});

describe('mise par joueur', () => {
  it('accepte 0 — le concours gratuit', () => {
    // `miseEquipe` distingue déjà `0` de `undefined`. Refuser ce zéro ici
    // rétablirait la confusion que son `!== undefined` sert à éviter.
    expect(raisonRefusMise(0)).toBeUndefined();
  });

  it('accepte 3,20 € — la mise que le pas de 0,5 refusait', () => {
    // Une mise n'est pas un multiple de cinquante centimes. Le champ portait
    // `step={0.5}` : 3,20 € y était invalide. Même défaut, autre champ.
    expect(raisonRefusMise(3.2)).toBeUndefined();
  });

  it('accepte les centimes que le binaire arrondit mal', () => {
    // `4.35 * 100` vaut `434.99999999999994` et `8.7 * 100` vaut
    // `869.9999999999999`. Une vérification des décimales par égalité stricte
    // refuserait ces deux mises, écrites au centime l'une comme l'autre.
    //
    // Ces valeurs précises sont dans le test parce que le sabotage l'a exigé :
    // remplacer la tolérance par `=== 0` ne cassait rien tant que le seul
    // exemple était 3,20 €, dont la montée à l'échelle tombe pile sur 320.
    expect(raisonRefusMise(4.35)).toBeUndefined();
    expect(raisonRefusMise(8.7)).toBeUndefined();
    expect(raisonRefusMise(19.99)).toBeUndefined();
    expect(raisonRefusMise(0.29)).toBeUndefined();
  });

  it('accepte la mise fédérale de la planche', () => {
    // `Mise/Joueur : 4.00 €` (manuel, fenêtre de création, planche p.12).
    expect(raisonRefusMise(4)).toBeUndefined();
    expect(raisonRefusMise(MAX_MISE)).toBeUndefined();
  });

  it('refuse une mise négative, et le dit', () => {
    expect(raisonRefusMise(-4)).toMatch(/négatif|positif|\b0\b/i);
  });

  it('refuse plus de deux décimales, et le dit', () => {
    // L'euro s'arrête au centime : 3,333 € ne s'encaisse ni ne se rend, et un
    // total de mises calculé dessus ne tomberait jamais juste.
    expect(raisonRefusMise(3.333)).toMatch(/centime|décimale/i);
  });

  it('refuse au-delà de la borne, en nommant la borne', () => {
    expect(raisonRefusMise(MAX_MISE + 1)).toContain(String(MAX_MISE));
  });

  it('refuse ce qui n est pas un nombre, en le disant', () => {
    // Même exigence que pour le décalage : sans le garde `Number.isFinite`, ces
    // deux valeurs retombent sur le contrôle des centimes et l'organisateur
    // lirait « une mise s'arrête au centime » devant une saisie illisible.
    expect(raisonRefusMise(Number.NaN)).toMatch(/n'est pas un nombre/i);
    expect(raisonRefusMise(Number.POSITIVE_INFINITY)).toMatch(/n'est pas un nombre/i);
  });
});

describe('la règle du lot : un refus porte toujours une phrase', () => {
  const REFUS = () => [
    raisonRefusDecalage(-1),
    raisonRefusDecalage(8.5),
    raisonRefusDecalage(MAX_DECALAGE + 1),
    raisonRefusDecalage(Number.NaN),
    raisonRefusMise(-4),
    raisonRefusMise(3.333),
    raisonRefusMise(MAX_MISE + 1),
    raisonRefusMise(Number.NaN),
  ];

  it('aucune raison n est vide', () => {
    // C'est l'invariant qui fait tout le lot. Une raison vide se traduirait par
    // un formulaire qui ne s'enregistre pas sans rien afficher — exactement le
    // défaut qu'on corrige. Le `typeof` n'est pas décoratif : il empêche qu'un
    // retour de booléen satisfasse le test.
    for (const raison of REFUS()) {
      expect(typeof raison).toBe('string');
      expect((raison ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('une raison se lit comme une phrase, pas comme un code', () => {
    // « step mismatch » ou « ERR_RANGE » ne s'affichent pas à la table de
    // marque. On veut une phrase : une majuscule au début, un point à la fin.
    for (const raison of REFUS()) {
      expect(raison).toMatch(/^[A-ZÀ-Þ]/);
      expect(raison).toMatch(/\.$/);
    }
  });
});
