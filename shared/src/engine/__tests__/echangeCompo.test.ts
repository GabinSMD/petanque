import { describe, expect, it } from 'vitest';
import {
  ENTETE_COMPOSITION,
  decoderComposition,
  encoderComposition,
  type CompositionEchangee,
} from '../echangeCompo';

const COMPO: CompositionEchangee = {
  club: 'Boule de l\'Avenir',
  numeroClub: '6032',
  competition: 'cnc_open',
  date: '2026-09-05',
  capitaine: { nom: 'MARTIN Lina', licence: '02600199' },
  joueurs: [
    { nom: 'DUPOND Jean', licence: '02600100' },
    { nom: 'BLANC Odette', licence: '02600101' },
  ],
};

/** Décodage réussi, ou l'échec est signalé par le test lui-même. */
function decode(texte: string): CompositionEchangee {
  const res = decoderComposition(texte);
  if (!res.ok) throw new Error(`décodage refusé : ${res.raison}`);
  return res.composition;
}

describe('échange de composition', () => {
  it('un aller-retour rend exactement ce qui a été envoyé', () => {
    expect(decode(encoderComposition(COMPO))).toEqual(COMPO);
  });

  it('le code porte son format et sa version', () => {
    expect(encoderComposition(COMPO).startsWith(`${ENTETE_COMPOSITION}/1`)).toBe(true);
  });

  it('reste assez court pour tenir dans un QR lisible', () => {
    const huit: CompositionEchangee = {
      ...COMPO,
      joueurs: Array.from({ length: 8 }, (_, i) => ({
        nom: `JOUEUR NUMERO ${i + 1}`,
        licence: `026001${String(i).padStart(2, '0')}`,
      })),
    };
    // Un QR de version raisonnable tient ~1000 caractères sans devenir illisible
    // sur un écran de tablette.
    expect(encoderComposition(huit).length).toBeLessThan(500);
  });

  it('un nom contenant le séparateur survit', () => {
    const bizarre: CompositionEchangee = {
      ...COMPO,
      joueurs: [{ nom: 'DUPOND | Jean', licence: '02600100' }],
    };
    expect(decode(encoderComposition(bizarre)).joueurs[0]).toEqual({
      nom: 'DUPOND | Jean',
      licence: '02600100',
    });
  });

  it('sans capitaine déclaré, l\'aller-retour reste juste', () => {
    const sansCapitaine = { ...COMPO, capitaine: undefined };
    expect(decode(encoderComposition(sansCapitaine)).capitaine).toBeUndefined();
  });

  it('tolère les espaces et les lignes vides', () => {
    const abime = encoderComposition(COMPO)
      .split('\n')
      .flatMap((l) => [`  ${l}  `, ''])
      .join('\n');
    expect(decode(abime)).toEqual(COMPO);
  });

  it('ignore une ligne inconnue : une version future peut en ajouter', () => {
    const enrichi = `${encoderComposition(COMPO)}\ncouleurDesBoules=rouge`;
    expect(decode(enrichi)).toEqual(COMPO);
  });

  it('refuse ce qui n\'est pas une composition, plutôt que de rendre du vide', () => {
    for (const intrus of ['', '02600100', 'https://petanque.example/licence/42', '{"nom":"x"}']) {
      const res = decoderComposition(intrus);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.raison).toMatch(/composition/i);
    }
  });

  it('refuse une version qu\'elle ne sait pas lire, en disant quoi faire', () => {
    const futur = encoderComposition(COMPO).replace(`${ENTETE_COMPOSITION}/1`, `${ENTETE_COMPOSITION}/2`);
    const res = decoderComposition(futur);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.raison).toMatch(/jour/i);
  });

  it('refuse une composition sans aucun joueur : il n\'y aurait rien à recopier', () => {
    const vide = encoderComposition({ ...COMPO, joueurs: [] });
    const res = decoderComposition(vide);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.raison).toMatch(/joueur/i);
  });

  it('garde tous les joueurs reçus : c\'est à l\'écran de décider quoi en faire', () => {
    const dix: CompositionEchangee = {
      ...COMPO,
      joueurs: Array.from({ length: 10 }, (_, i) => ({ nom: `J${i}`, licence: `0260010${i}` })),
    };
    expect(decode(encoderComposition(dix)).joueurs).toHaveLength(10);
  });
});
