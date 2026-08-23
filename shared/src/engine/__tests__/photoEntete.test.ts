import { describe, expect, it } from 'vitest';
import {
  EMPLACEMENTS_PHOTO,
  MAX_OCTETS_PHOTO,
  photoEntete,
  photosPubliables,
  type PhotoConcours,
} from '../photos';

/**
 * Bannière en tête de la page publiée (manuel, paramétrage FTP, planche p.61) :
 * `Photo Haut de Page : Non / Oui` avec « Choix Photo Haut de Page ». L'exemple
 * du manuel montre un encart de partenaire.
 *
 * **Le consentement s'applique ici comme au podium.** L'issue laissait le choix
 * de l'exempter ; il ne se justifie pas :
 *
 *  - nous ne pouvons pas distinguer un logo d'une photo de groupe, et rien
 *    n'empêchera un organisateur d'y mettre la seconde ;
 *  - la surface de publication est **la même** page à jeton, avec le même risque
 *    d'indexation après suppression ;
 *  - un logo de partenaire a lui aussi besoin d'une autorisation de diffusion.
 *
 * Une seule déclaration couvre donc les deux cas, et le coût est un clic.
 */
const IMAGE = 'data:image/png;base64,iVBORw0KGgo=';

const photo = (over: Partial<PhotoConcours> = {}): PhotoConcours => ({
  id: 'p1',
  concoursId: 'c',
  emplacement: 'entete',
  image: IMAGE,
  consentement: '2026-08-06T09:00:00.000Z',
  updatedAt: '2026-08-06T09:00:00.000Z',
  ...over,
});

describe('photo d en-tête de la page publiée', () => {
  it('est rendue quand tout est en règle', () => {
    expect(photoEntete([photo()])?.id).toBe('p1');
  });

  it('reste sur l appareil sans accord constaté', () => {
    // Même règle structurelle que le podium : ce n'est pas une case à cocher,
    // c'est la fonction qui refuse.
    expect(photoEntete([photo({ consentement: undefined })])).toBeUndefined();
  });

  it('refuse ce qui n est pas une image', () => {
    expect(photoEntete([photo({ image: 'data:text/html;base64,PHNjcmlwdD4=' })])).toBeUndefined();
    expect(photoEntete([photo({ image: '' })])).toBeUndefined();
  });

  it('refuse une image trop lourde', () => {
    const grosse = 'data:image/png;base64,' + 'A'.repeat(MAX_OCTETS_PHOTO);
    expect(photoEntete([photo({ image: grosse })])).toBeUndefined();
  });

  it('garde la plus récente quand l organisateur en reprend une', () => {
    const ancienne = photo({ id: 'vieille', updatedAt: '2026-08-06T08:00:00.000Z' });
    const recente = photo({ id: 'neuve', updatedAt: '2026-08-06T10:00:00.000Z' });
    expect(photoEntete([recente, ancienne])?.id).toBe('neuve');
    expect(photoEntete([ancienne, recente])?.id).toBe('neuve');
  });

  it('ignore les photos du podium', () => {
    const podium = photo({ id: 'podium', emplacement: 'vainqueur' });
    expect(photoEntete([podium])).toBeUndefined();
  });

  it('ignore un emplacement inconnu', () => {
    // « Une donnée venue d'une autre version n'apparaît pas à une place qu'on ne
    // sait pas nommer. »
    const inconnu = photo({ emplacement: 'banniere_laterale' as PhotoConcours['emplacement'] });
    expect(photoEntete([inconnu])).toBeUndefined();
  });
});

describe('l en-tête ne fuit pas dans le podium', () => {
  it('photosPubliables ne rend pas la photo d en-tête', () => {
    // Sinon la bannière du partenaire apparaîtrait dans la galerie du podium,
    // et le tri du podium n'aurait pas de place pour elle.
    const podium = photo({ id: 'gagnant', emplacement: 'vainqueur' });
    const banniere = photo({ id: 'banniere', emplacement: 'entete' });
    const publiables = photosPubliables([podium, banniere]);
    expect(publiables.map((p) => p.id)).toEqual(['gagnant']);
  });

  it('l en-tête n est pas un emplacement du podium', () => {
    // `EMPLACEMENTS_PHOTO` décrit les cinq places du manuel, dans l'ordre du
    // podium. Y glisser l'en-tête l'afficherait dans la grille de saisie du
    // podium, où elle n'a rien à faire.
    expect(EMPLACEMENTS_PHOTO.map((e) => e.id)).toEqual([
      'vainqueur',
      'demi1',
      'demi2',
      'demi3',
      'demi4',
    ]);
  });
});
