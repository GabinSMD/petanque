import { describe, expect, it } from 'vitest';
import {
  analyserVersion,
  comparerVersions,
  recapNouveautes,
  versionJournal,
  type Nouveaute,
} from '../nouveautes';

const entree = (version: string, titre = `Nouveauté ${version}`): Nouveaute => ({
  version,
  date: '2026-07-29',
  items: [{ titre, texte: 'Texte.' }],
});

/** Journal de trois versions, du plus récent au plus ancien comme un vrai. */
const JOURNAL = [entree('0.4.0'), entree('0.3.0'), entree('0.2.0')];

const versions = (j: Nouveaute[]) => j.map((e) => e.version);

describe('lecture d\'un numéro de version', () => {
  it('lit major.minor.patch', () => {
    expect(analyserVersion('1.2.3')).toEqual([1, 2, 3]);
  });

  it('tolère un v en tête et les parties absentes', () => {
    expect(analyserVersion('v2')).toEqual([2, 0, 0]);
    expect(analyserVersion('0.5')).toEqual([0, 5, 0]);
  });

  it('ignore un suffixe de pré-version', () => {
    expect(analyserVersion('1.0.0-rc.2')).toEqual([1, 0, 0]);
  });

  it('refuse ce qui n\'est pas une version', () => {
    // Une valeur illisible vient d'un stockage corrompu : mieux vaut le savoir
    // que la traiter comme 0.0.0 et dérouler tout le journal.
    expect(analyserVersion('')).toBeNull();
    expect(analyserVersion('   ')).toBeNull();
    expect(analyserVersion('abc')).toBeNull();
    expect(analyserVersion('v')).toBeNull();
  });

  it('compare sur les nombres, pas sur les chaînes', () => {
    // '0.10.0' < '0.9.0' en comparaison de texte : le piège classique.
    expect(comparerVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(comparerVersions('0.9.0', '0.10.0')).toBeLessThan(0);
    expect(comparerVersions('1.2.3', '1.2.3')).toBe(0);
    expect(comparerVersions('0.2', '0.2.0')).toBe(0);
  });
});

describe('dernière version publiée par le journal', () => {
  it('prend la plus haute, quel que soit l\'ordre du tableau', () => {
    expect(versionJournal(JOURNAL)).toBe('0.4.0');
    expect(versionJournal([entree('0.2.0'), entree('0.9.0'), entree('0.3.0')])).toBe('0.9.0');
  });

  it('un journal vide n\'a pas de version', () => {
    expect(versionJournal([])).toBeNull();
  });
});

describe('récapitulatif à présenter', () => {
  it('ne montre rien à la première installation, mais retient la version', () => {
    // L'écran de bienvenue joue déjà ce rôle : deux pop-ups d'affilée, non.
    const r = recapNouveautes(JOURNAL, null, { premiereInstallation: true });
    expect(r.entrees).toEqual([]);
    expect(r.aMemoriser).toBe('0.4.0');
  });

  it('déroule tout le journal pour qui utilisait déjà l\'appli', () => {
    // Rien de mémorisé mais l'accueil déjà vu : l'utilisateur vient d'une
    // version d'avant le journal, il a droit au tour d'horizon complet.
    const r = recapNouveautes(JOURNAL, null, { premiereInstallation: false });
    expect(versions(r.entrees)).toEqual(['0.4.0', '0.3.0', '0.2.0']);
    expect(r.aMemoriser).toBe('0.4.0');
  });

  it('ne montre que ce qui est arrivé depuis la dernière version vue', () => {
    const r = recapNouveautes(JOURNAL, '0.3.0', { premiereInstallation: false });
    expect(versions(r.entrees)).toEqual(['0.4.0']);
  });

  it('cumule les versions sautées en une seule pop-up', () => {
    const r = recapNouveautes(JOURNAL, '0.1.0', { premiereInstallation: false });
    expect(versions(r.entrees)).toEqual(['0.4.0', '0.3.0', '0.2.0']);
  });

  it('ne montre rien quand la dernière version vue est la version courante', () => {
    const r = recapNouveautes(JOURNAL, '0.4.0', { premiereInstallation: false });
    expect(r.entrees).toEqual([]);
    expect(r.aMemoriser).toBe('0.4.0');
  });

  it('présente du plus récent au plus ancien, même si le journal est mal rangé', () => {
    // Le tri ne dépend pas de l'ordre du tableau : une entrée insérée au
    // mauvais endroit ne fait pas rater la détection.
    const desordre = [entree('0.3.0'), entree('0.4.0'), entree('0.2.0')];
    const r = recapNouveautes(desordre, '0.2.0', { premiereInstallation: false });
    expect(versions(r.entrees)).toEqual(['0.4.0', '0.3.0']);
  });

  it('un journal vide ne montre rien et ne mémorise rien', () => {
    const r = recapNouveautes([], null, { premiereInstallation: false });
    expect(r.entrees).toEqual([]);
    expect(r.aMemoriser).toBeNull();
  });

  it('une version vue illisible ne déclenche pas le déluge', () => {
    // Stockage bricolé ou corrompu : on se tait et on repart proprement.
    const r = recapNouveautes(JOURNAL, 'n\'importe quoi', { premiereInstallation: false });
    expect(r.entrees).toEqual([]);
    expect(r.aMemoriser).toBe('0.4.0');
  });

  it('ignore les entrées dont la version est illisible', () => {
    const r = recapNouveautes([entree('0.4.0'), entree('brouillon')], '0.3.0', {
      premiereInstallation: false,
    });
    expect(versions(r.entrees)).toEqual(['0.4.0']);
  });

  it('ne fait pas reculer la version mémorisée', () => {
    // Un onglet resté sur un ancien bundle ne doit pas réarmer la pop-up
    // pour la version que l'utilisateur a déjà vue.
    const r = recapNouveautes(JOURNAL, '0.9.0', { premiereInstallation: false });
    expect(r.entrees).toEqual([]);
    expect(r.aMemoriser).toBe('0.9.0');
  });

  it('compare sur les nombres : 0.10.0 est plus récent que 0.9.0', () => {
    const journal = [entree('0.10.0'), entree('0.9.0')];
    const r = recapNouveautes(journal, '0.9.0', { premiereInstallation: false });
    expect(versions(r.entrees)).toEqual(['0.10.0']);
  });

  it('ne modifie pas le journal qu\'on lui donne', () => {
    const journal = [entree('0.3.0'), entree('0.4.0')];
    recapNouveautes(journal, null, { premiereInstallation: false });
    expect(versions(journal)).toEqual(['0.3.0', '0.4.0']);
  });
});
