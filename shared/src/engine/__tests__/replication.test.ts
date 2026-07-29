import { describe, expect, it } from 'vitest';
import { changementApplicable, changementGagne, envoisAcquittes, cleEntite } from '../replication';

describe('un changement du serveur remplace-t-il l\'état local ?', () => {
  it('rien en local : on prend', () => {
    expect(changementGagne({ updatedAt: '2026-07-29T10:00:00.000Z' }, undefined)).toBe(true);
  });

  it('plus récent que le local : on prend', () => {
    expect(
      changementGagne(
        { updatedAt: '2026-07-29T11:00:00.000Z' },
        { updatedAt: '2026-07-29T10:00:00.000Z', dirty: 0 },
      ),
    ).toBe(true);
  });

  it('plus ancien que le local : on garde le local', () => {
    expect(
      changementGagne(
        { updatedAt: '2026-07-29T09:00:00.000Z' },
        { updatedAt: '2026-07-29T10:00:00.000Z', dirty: 0 },
      ),
    ).toBe(false);
  });

  it('même horodatage, local propre : on prend, c\'est sans effet', () => {
    expect(
      changementGagne(
        { updatedAt: '2026-07-29T10:00:00.000Z' },
        { updatedAt: '2026-07-29T10:00:00.000Z', dirty: 0 },
      ),
    ).toBe(true);
  });

  it('même horodatage, local en attente : on prend quand même', () => {
    // Le serveur a déjà arbitré — il départage à horodatage égal par identifiant
    // d'appareil. S'il nous renvoie cette ligne, c'est que la nôtre a perdu.
    // Refuser de l'appliquer laisserait la version locale divergente et
    // renvoyée indéfiniment.
    expect(
      changementGagne(
        { updatedAt: '2026-07-29T10:00:00.000Z' },
        { updatedAt: '2026-07-29T10:00:00.000Z', dirty: 1 },
      ),
    ).toBe(true);
  });

  it('un envoi local postérieur n\'est pas écrasé', () => {
    // L'horodatage local est strictement croissant : une modification faite
    // pendant l'échange porte une date plus récente et doit survivre.
    expect(
      changementGagne(
        { updatedAt: '2026-07-29T10:00:00.000Z' },
        { updatedAt: '2026-07-29T10:00:00.001Z', dirty: 1 },
      ),
    ).toBe(false);
  });
});

describe('quels envois le serveur a-t-il acceptés ?', () => {
  const envoyes = [
    { type: 'concours', id: 'c1' },
    { type: 'team', id: 't1' },
    { type: 'feuilleMatch', id: 'f1' },
  ];

  it('seuls les envois acceptés sont acquittés', () => {
    const acquittes = envoisAcquittes(envoyes, ['concours:c1', 'team:t1']);
    expect(acquittes.has(cleEntite('concours', 'c1'))).toBe(true);
    expect(acquittes.has(cleEntite('team', 't1'))).toBe(true);
    // Non acquittée : elle reste à pousser, plutôt que d'être crue synchronisée.
    expect(acquittes.has(cleEntite('feuilleMatch', 'f1'))).toBe(false);
  });

  it('rien d\'accepté : rien d\'acquitté', () => {
    expect(envoisAcquittes(envoyes, []).size).toBe(0);
  });

  it('une acceptation qui ne correspond à aucun envoi est ignorée', () => {
    const acquittes = envoisAcquittes(envoyes, ['concours:c1', 'poule:inconnue']);
    expect(acquittes.size).toBe(1);
    expect(acquittes.has(cleEntite('concours', 'c1'))).toBe(true);
  });

  it('la clé distingue le type : deux entités peuvent partager un identifiant', () => {
    const memeId = [
      { type: 'team', id: 'x' },
      { type: 'match', id: 'x' },
    ];
    const acquittes = envoisAcquittes(memeId, ['team:x']);
    expect(acquittes.has(cleEntite('team', 'x'))).toBe(true);
    expect(acquittes.has(cleEntite('match', 'x'))).toBe(false);
  });
});

describe('un changement reçu est-il exploitable ?', () => {
  const equipe = {
    id: 't1',
    concoursId: 'c1',
    number: 1,
    players: [{ name: 'DUPOND Jean' }],
    forfait: false,
    updatedAt: '2026-07-29T10:00:00.000Z',
  };

  it('une équipe correcte est appliquée', () => {
    expect(changementApplicable({ type: 'team', data: equipe })).toBe(true);
  });

  it('une équipe malformée n\'est pas appliquée', () => {
    // Un appareil d'une autre version peut pousser n'importe quoi. L'appliquer
    // blanchirait l'écran ici aussi, et le rechargement ne sauverait rien.
    expect(changementApplicable({ type: 'team', data: { ...equipe, players: null } })).toBe(false);
    expect(changementApplicable({ type: 'team', data: { ...equipe, players: [] } })).toBe(false);
    expect(changementApplicable({ type: 'team', data: null })).toBe(false);
  });

  it('une suppression est toujours appliquée', () => {
    // Une pierre tombale ne porte pas de données : la refuser ferait réapparaître
    // une équipe supprimée sur un autre appareil.
    expect(changementApplicable({ type: 'team', data: null, deleted: true })).toBe(true);
  });

  it('les autres types ne sont pas jugés ici', () => {
    // Parties, poules et feuilles ont leurs propres invariants ; la réplication
    // n'est pas l'endroit pour les inventer.
    expect(changementApplicable({ type: 'match', data: { nimporte: 'quoi' } })).toBe(true);
    expect(changementApplicable({ type: 'concours', data: {} })).toBe(true);
  });
});
