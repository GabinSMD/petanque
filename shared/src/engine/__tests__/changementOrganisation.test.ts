import { describe, expect, it } from 'vitest';
import {
  bilanEnAttente,
  decisionChangementOrg,
  messageProtection,
  type LigneEnAttente,
} from '../changementOrganisation';

const enAttente = (type: string, id: string, concoursId?: string): LigneEnAttente => ({
  type,
  id,
  concoursId,
});

describe('changer de compte sur un appareil qui porte des données', () => {
  it('ne fait rien sur un appareil neuf', () => {
    expect(decisionChangementOrg({ orgSession: 'org-b', enAttente: 0 })).toEqual({ action: 'rien' });
  });

  it('ne fait rien quand c\'est le même compte', () => {
    expect(
      decisionChangementOrg({ orgLocale: 'org-a', orgSession: 'org-a', enAttente: 12 }),
    ).toEqual({ action: 'rien' });
  });

  it('purge sans rien demander quand tout est déjà sur le serveur', () => {
    // Rien à perdre : ces données sont récupérables en se reconnectant à
    // l'autre compte. Demander ici serait une question sans enjeu.
    expect(
      decisionChangementOrg({ orgLocale: 'org-a', orgSession: 'org-b', enAttente: 0 }),
    ).toEqual({ action: 'purger' });
  });

  it('protège dès qu\'une seule modification n\'est pas partie', () => {
    // C'est le cas du concours saisi au boulodrome sans réseau : l'effacer
    // silencieusement le perd pour de bon, il n'est nulle part ailleurs.
    const d = decisionChangementOrg({ orgLocale: 'org-a', orgSession: 'org-b', enAttente: 1 });
    expect(d.action).toBe('proteger');
  });

  it('protège les données du mode invité, qui ne sont sur aucun serveur', () => {
    const d = decisionChangementOrg({
      orgLocale: 'invite-local',
      orgSession: 'org-b',
      enAttente: 37,
    });
    expect(d.action).toBe('proteger');
  });
});

describe('ce qui est en attente, et où', () => {
  it('regroupe par concours', () => {
    const bilan = bilanEnAttente([
      enAttente('team', 't1', 'c1'),
      enAttente('team', 't2', 'c1'),
      enAttente('match', 'm1', 'c2'),
    ]);
    expect(bilan.total).toBe(3);
    expect(bilan.parConcours).toEqual([
      { concoursId: 'c1', nb: 2 },
      { concoursId: 'c2', nb: 1 },
    ]);
    expect(bilan.horsConcours).toBe(0);
  });

  it('compte à part ce qu\'une sauvegarde de concours ne couvre pas', () => {
    // Les licenciés appartiennent à l'organisation, pas à un concours : le
    // dire évite de promettre une sauvegarde complète qui n'en est pas une.
    const bilan = bilanEnAttente([
      enAttente('team', 't1', 'c1'),
      enAttente('licencie', 'l1'),
      enAttente('licencie', 'l2'),
    ]);
    expect(bilan.parConcours).toEqual([{ concoursId: 'c1', nb: 1 }]);
    expect(bilan.horsConcours).toBe(2);
    expect(bilan.total).toBe(3);
  });

  it('met le plus gros concours en tête, à égalité par identifiant', () => {
    const bilan = bilanEnAttente([
      enAttente('team', 't1', 'cb'),
      enAttente('team', 't2', 'ca'),
      enAttente('team', 't3', 'cc'),
      enAttente('team', 't4', 'cc'),
    ]);
    expect(bilan.parConcours.map((x) => x.concoursId)).toEqual(['cc', 'ca', 'cb']);
  });

  it('ne compte pas le concours lui-même comme hors concours', () => {
    // L'entité `concours` porte son identifiant dans `id`, pas dans
    // `concoursId` : la ranger « hors concours » ferait croire qu'elle échappe
    // à la sauvegarde alors qu'elle en est le cœur.
    const bilan = bilanEnAttente([enAttente('concours', 'c1'), enAttente('team', 't1', 'c1')]);
    expect(bilan.parConcours).toEqual([{ concoursId: 'c1', nb: 2 }]);
    expect(bilan.horsConcours).toBe(0);
  });

  it('rend un bilan vide sans rien inventer', () => {
    expect(bilanEnAttente([])).toEqual({ total: 0, parConcours: [], horsConcours: 0 });
  });
});

describe('ce qu\'on dit avant d\'effacer', () => {
  it('dit le nombre, l\'enjeu et la sortie', () => {
    const message = messageProtection(bilanEnAttente([enAttente('team', 't1', 'c1')]));
    expect(message).toMatch(/1 modification/);
    expect(message).toMatch(/pas encore|n'a pas été/i);
    expect(message).toMatch(/sauvegarde/i);
    expect(message).not.toMatch(/undefined|NaN/);
  });

  it('accorde au pluriel', () => {
    const message = messageProtection(
      bilanEnAttente([enAttente('team', 't1', 'c1'), enAttente('team', 't2', 'c1')]),
    );
    expect(message).toMatch(/2 modifications/);
  });

  it('avertit quand une partie échappe aux sauvegardes de concours', () => {
    const message = messageProtection(
      bilanEnAttente([enAttente('team', 't1', 'c1'), enAttente('licencie', 'l1')]),
    );
    expect(message).toMatch(/licenciés|hors concours/i);
  });

  it('n\'en parle pas quand tout est couvert', () => {
    const message = messageProtection(bilanEnAttente([enAttente('team', 't1', 'c1')]));
    expect(message).not.toMatch(/hors concours/i);
  });
});
