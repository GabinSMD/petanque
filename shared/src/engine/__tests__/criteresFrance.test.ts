import { describe, expect, it } from 'vitest';
import { aDesCriteresLicence } from '../federal';
import { controlerEquipe, criteresDuConcours } from '../licences';
import type { Licencie, Player } from '../../types';

const fiche = (licence: string, extra: Partial<Licencie> = {}): Licencie =>
  ({
    id: licence,
    name: `Joueur ${licence}`,
    licence,
    club: 'Club A',
    dateNaissance: '1980-05-01',
    sexe: 'M',
    anneeReprise: 2026,
    ...extra,
  }) as Licencie;

const joueur = (licence: string): Player => ({ name: `Joueur ${licence}`, licence }) as Player;

function controler(fiches: Licencie[], criteresFrance: boolean) {
  const map = new Map(fiches.map((f) => [f.licence!, f]));
  const criteres = criteresDuConcours({ date: '2026-06-01', criteresFrance });
  return controlerEquipe(fiches.map((f) => joueur(f.licence!)), map, criteres, 'Club A');
}

describe('Critères France au dépôt des licences', () => {
  it('suffisent à déclencher le contrôle', () => {
    expect(aDesCriteresLicence({ criteresFrance: true })).toBe(true);
  });

  it('posent un hors UE et un muté externe au plus', () => {
    const c = criteresDuConcours({ date: '2026-06-01', criteresFrance: true });
    expect(c.maxHorsUE).toBe(1);
    expect(c.maxMutes).toBe(1);
  });

  it('un contingent explicite l’emporte', () => {
    const c = criteresDuConcours({ date: '2026-06-01', criteresFrance: true, maxMutes: 0 });
    expect(c.maxMutes).toBe(0);
  });

  it('refusent deux étrangers hors UE, pas un seul', () => {
    const deux = [
      fiche('1', { nationalite: 'MAR' }),
      fiche('2', { nationalite: 'TUN' }),
      fiche('3'),
    ];
    expect(controler(deux, true).anomaliesEquipe).toContain('horsUE');
    expect(controler(deux, false).anomaliesEquipe).not.toContain('horsUE');
    const un = [fiche('1', { nationalite: 'MAR' }), fiche('2'), fiche('3')];
    expect(controler(un, true).anomaliesEquipe).not.toContain('horsUE');
  });

  it('refusent deux mutés externes ; les internes ne comptent pas', () => {
    const externes = [
      fiche('1', { etatMutation: 'externe' }),
      fiche('2', { etatMutation: 'externe' }),
      fiche('3'),
    ];
    expect(controler(externes, true).anomaliesEquipe).toContain('mutes');
    const internes = [
      fiche('1', { etatMutation: 'interne' }),
      fiche('2', { etatMutation: 'interne' }),
      fiche('3', { etatMutation: 'externe' }),
    ];
    expect(controler(internes, true).anomaliesEquipe).not.toContain('mutes');
  });
});
