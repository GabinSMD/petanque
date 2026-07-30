import { describe, expect, it } from 'vitest';
import {
  EMPLACEMENTS_PHOTO,
  MAX_OCTETS_PHOTO,
  photoAcceptable,
  photosPubliables,
} from '../photos';
import type { PhotoConcours } from '../photos';

const T = '2026-07-30T12:00:00.000Z';

/** Une image minuscule mais valide (GIF 1×1 transparent). */
const IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const photo = (over: Partial<PhotoConcours> = {}): PhotoConcours => ({
  id: 'p1',
  concoursId: 'c1',
  emplacement: 'vainqueur',
  image: IMAGE,
  consentement: T,
  updatedAt: T,
  ...over,
});

describe('photos du podium (§3.D.1.B.5.5)', () => {
  it('nomme les cinq emplacements du manuel', () => {
    // « les photos des quatre équipes demi-finalistes et du vainqueur ».
    expect(EMPLACEMENTS_PHOTO).toHaveLength(5);
    expect(EMPLACEMENTS_PHOTO.map((e) => e.id)).toContain('vainqueur');
    expect(EMPLACEMENTS_PHOTO.filter((e) => e.id.startsWith('demi'))).toHaveLength(4);
  });
});

describe('ce qu\'on accepte comme photo', () => {
  it('accepte une image', () => {
    expect(photoAcceptable(IMAGE)).toEqual({ ok: true });
  });

  it('refuse ce qui n\'est pas une image', () => {
    // Une page HTML renommée, un PDF, du texte : le champ ne doit pas servir
    // de véhicule à autre chose.
    for (const faux of ['data:text/html;base64,PHNjcmlwdD4=', 'https://exemple.fr/photo.jpg', '', 'coucou']) {
      const res = photoAcceptable(faux);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.raison).toMatch(/image/i);
    }
  });

  it('refuse une image trop lourde, en disant le poids', () => {
    // Une photo de téléphone brute pèse plusieurs mégaoctets : elle passerait
    // dans chaque échange de synchronisation et sur chaque chargement de la
    // page publique.
    const enorme = `data:image/jpeg;base64,${'A'.repeat(MAX_OCTETS_PHOTO * 2)}`;
    const res = photoAcceptable(enorme);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.raison).toMatch(/lourde|Ko|Mo/i);
  });
});

describe('ce qui est publié, et ce qui ne l\'est pas', () => {
  it('ne publie pas une photo sans accord des personnes', () => {
    // La page est publique et une photo d'équipe est une donnée personnelle :
    // sans accord constaté, elle reste sur l'appareil.
    expect(photosPubliables([photo({ consentement: undefined })])).toEqual([]);
  });

  it('publie une photo dont l\'accord est constaté', () => {
    expect(photosPubliables([photo()])).toHaveLength(1);
  });

  it('ne publie pas une photo vide', () => {
    expect(photosPubliables([photo({ image: '' })])).toEqual([]);
  });

  it('une seule photo par emplacement : la plus récente', () => {
    const ancienne = photo({ id: 'p1', updatedAt: '2026-07-30T10:00:00.000Z' });
    const recente = photo({ id: 'p2', updatedAt: '2026-07-30T11:00:00.000Z' });
    // L'ancienne arrive en premier : garder « la première vue » ne doit pas
    // suffire, sinon reprendre une photo ne remplacerait rien.
    const publiees = photosPubliables([ancienne, recente]);
    expect(publiees).toHaveLength(1);
    expect(publiees[0]!.id).toBe('p2');
  });

  it('range dans l\'ordre du podium', () => {
    const desordre = [
      photo({ id: 'd2', emplacement: 'demi2' }),
      photo({ id: 'v', emplacement: 'vainqueur' }),
      photo({ id: 'd1', emplacement: 'demi1' }),
    ];
    expect(photosPubliables(desordre).map((p) => p.id)).toEqual(['v', 'd1', 'd2']);
  });

  it('ignore un emplacement inconnu plutôt que de l\'afficher', () => {
    // Une donnée venue d'une autre version ne doit pas apparaître à une place
    // qu'on ne sait pas nommer.
    const bizarre = photo({ emplacement: 'podium-du-futur' as PhotoConcours['emplacement'] });
    expect(photosPubliables([bizarre])).toEqual([]);
  });
});
