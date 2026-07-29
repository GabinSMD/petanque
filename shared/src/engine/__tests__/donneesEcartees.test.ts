import { describe, expect, it } from 'vitest';
import {
  MAX_ECARTEES,
  ajouterEcart,
  detailEcartees,
  resumeEcartees,
  type DonneeEcartee,
} from '../donneesEcartees';

const ecart = (id: string, quand: string, type = 'team'): DonneeEcartee => ({ type, id, quand });

describe('mémoire des données écartées', () => {
  it('retient ce qui a été écarté', () => {
    const liste = ajouterEcart([], ecart('t1', '2026-07-29T10:00:00.000Z'));
    expect(liste).toEqual([{ type: 'team', id: 't1', quand: '2026-07-29T10:00:00.000Z' }]);
  });

  it('ne compte qu\'une fois la même donnée reçue vingt fois', () => {
    // Le serveur renvoie la ligne à chaque échange tant qu'un appareil y touche.
    // Sans dédoublonnage, l'organisateur lirait « 47 données écartées » pour une.
    let liste: DonneeEcartee[] = [];
    for (let i = 0; i < 20; i += 1) {
      liste = ajouterEcart(liste, ecart('t1', `2026-07-29T10:00:${String(i).padStart(2, '0')}.000Z`));
    }
    expect(liste).toHaveLength(1);
    expect(liste[0]!.quand).toBe('2026-07-29T10:00:19.000Z');
  });

  it('distingue deux équipes différentes, et deux types différents', () => {
    let liste = ajouterEcart([], ecart('t1', '2026-07-29T10:00:00.000Z'));
    liste = ajouterEcart(liste, ecart('t2', '2026-07-29T10:00:01.000Z'));
    liste = ajouterEcart(liste, ecart('t1', '2026-07-29T10:00:02.000Z', 'match'));
    expect(liste).toHaveLength(3);
  });

  it('garde les plus récentes en tête, et ne grossit pas sans fin', () => {
    // La liste est enregistrée sur l'appareil : elle doit rester bornée.
    let liste: DonneeEcartee[] = [];
    for (let i = 0; i < MAX_ECARTEES + 5; i += 1) {
      liste = ajouterEcart(liste, ecart(`t${i}`, `2026-07-29T10:${String(i).padStart(2, '0')}:00.000Z`));
    }
    expect(liste).toHaveLength(MAX_ECARTEES);
    expect(liste[0]!.id).toBe(`t${MAX_ECARTEES + 4}`);
    expect(liste.some((e) => e.id === 't0')).toBe(false);
  });
});

describe('ce qu\'on en dit à l\'organisateur', () => {
  it('ne dit rien quand il n\'y a rien à dire', () => {
    expect(resumeEcartees([])).toBeNull();
  });

  it('nomme l\'entité en français, au singulier', () => {
    const resume = resumeEcartees([ecart('t1', '2026-07-29T10:00:00.000Z')]);
    expect(resume).toMatch(/équipe/i);
    expect(resume).not.toMatch(/team|1 données/i);
  });

  it('accorde au pluriel', () => {
    const liste = [ecart('t1', '2026-07-29T10:00:00.000Z'), ecart('t2', '2026-07-29T10:00:01.000Z')];
    const resume = resumeEcartees(liste)!;
    expect(resume).toMatch(/2 /);
    expect(resume).toMatch(/reçues|écartées|lues/);
  });

  it('dit la conséquence, pas seulement le fait', () => {
    // « Une donnée a été écartée » ne sert à rien. Ce qui sert, c'est de savoir
    // qu'une équipe manque **ici** et pourquoi il ne faut pas la ressaisir à
    // l'aveugle.
    const resume = resumeEcartees([ecart('t1', '2026-07-29T10:00:00.000Z')])!;
    expect(resume).toMatch(/appareil/i);
    expect(resume.length).toBeGreaterThan(40);
  });

  it('mélange les types sans mentir sur le nombre', () => {
    const liste = [
      ecart('t1', '2026-07-29T10:00:00.000Z'),
      ecart('m1', '2026-07-29T10:00:01.000Z', 'match'),
    ];
    const resume = resumeEcartees(liste)!;
    expect(resume).toMatch(/2 /);
    // Deux types différents : on ne les nomme pas, on reste sur « données ».
    expect(resume).toMatch(/données/i);
  });
});

describe('détail à transmettre', () => {
  it('porte type, identifiant et date de chaque écart', () => {
    const detail = detailEcartees([
      ecart('t1', '2026-07-29T10:00:00.000Z'),
      ecart('m1', '2026-07-29T10:00:01.000Z', 'match'),
    ]);
    expect(detail).toContain('team');
    expect(detail).toContain('t1');
    expect(detail).toContain('2026-07-29T10:00:00.000Z');
    expect(detail).toContain('match');
    expect(detail.split('\n')).toHaveLength(2);
  });

  it('reste vide quand il n\'y a rien', () => {
    expect(detailEcartees([])).toBe('');
  });
});
