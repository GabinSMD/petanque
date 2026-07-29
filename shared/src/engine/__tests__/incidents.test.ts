import { describe, expect, it } from 'vitest';
import { analyserIncident, rapportIncident } from '../incidents';

/** Pile de composants telle que React la fournit. */
const PILE = `
    at TeamsTab (http://localhost:5199/src/pages/tabs/TeamsTab.tsx:35:28)
    at div
    at ConcoursPage (http://localhost:5199/src/pages/ConcoursPage.tsx:67:23)
    at main
    at Layout (http://localhost:5199/src/App.tsx:39:19)
    at App`;

describe('analyse d\'un incident', () => {
  it('reconnaît une application mise à jour sous les pieds', () => {
    // Le cas le plus fréquent en PWA : la tablette du boulodrome garde l'ancien
    // code en mémoire et demande un morceau que le déploiement a remplacé.
    // Recharger suffit — et c'est la seule chose qui marche.
    for (const message of [
      'Failed to fetch dynamically imported module: https://petanque.gabin-simond.fr/assets/jsQR-D3oer-1A.js',
      'error loading dynamically imported module',
      'Importing a module script failed.',
      'Loading chunk 42 failed.',
      'Unable to preload CSS for /assets/styles-WfMk4UQ8.css',
    ]) {
      const incident = analyserIncident({ message }, 0);
      expect(incident.genre).toBe('miseAJour');
      expect(incident.action).toBe('recharger');
      expect(incident.titre).toMatch(/jour/i);
    }
  });

  it('propose de réessayer sur une erreur ordinaire', () => {
    const incident = analyserIncident({ message: 'Cannot read properties of undefined' }, 0);
    expect(incident.genre).toBe('inconnu');
    expect(incident.action).toBe('reessayer');
  });

  it('cesse de proposer de réessayer quand ça a déjà échoué deux fois', () => {
    // Réessayer une troisième fois donnerait le même écran : autant orienter
    // vers ce qui peut encore marcher.
    const incident = analyserIncident({ message: 'boum' }, 2);
    expect(incident.action).toBe('recharger');
  });

  it('reste lisible sans message d\'erreur', () => {
    for (const erreur of [{}, { message: '' }, null, undefined]) {
      const incident = analyserIncident(erreur, 0);
      expect(incident.titre.length).toBeGreaterThan(5);
      expect(incident.explication.length).toBeGreaterThan(15);
      expect(incident.explication).not.toMatch(/undefined|null|\[object/);
    }
  });

  it('ne promet pas que le reste fonctionne quand rien ne fonctionne', () => {
    // Relevé à la vérification : la frontière de l'application affichait
    // « le reste de l'application continue de fonctionner » alors que c'est
    // justement l'application qui est tombée. C'est une affirmation fausse.
    const racine = analyserIncident({ message: 'boum' }, 0, 'application');
    expect(racine.explication).not.toMatch(/continue de fonctionner|autres onglets/i);
    expect(racine.explication).toMatch(/enregistrées|enregistré/i);
    expect(racine.action).toBe('recharger');

    // Aux deux autres niveaux, c'est vrai — et c'est ce qui rassure.
    expect(analyserIncident({ message: 'boum' }, 0, 'onglet').explication).toMatch(/onglets/i);
    expect(analyserIncident({ message: 'boum' }, 0, 'page').explication).toMatch(
      /concours restent|reste de l'application/i,
    );
    expect(analyserIncident({ message: 'boum' }, 0, 'page').explication).not.toMatch(/onglets/i);
  });

  it('n\'annonce jamais une mise à jour à tort', () => {
    // « module » dans un message quelconque ne veut pas dire que le
    // déploiement a bougé : promettre qu'un rechargement répare serait faux.
    const incident = analyserIncident({ message: 'Le module de tirage a refusé une équipe' }, 0);
    expect(incident.genre).toBe('inconnu');
  });
});

describe('rapport d\'incident à recopier', () => {
  const base = {
    erreur: { name: 'TypeError', message: 'teams.map is not a function' },
    pile: PILE,
    version: '0.1.0',
    commit: '674fd89',
    chemin: '/concours/1d801e83-673e-4124-aa6f-8245488f52af/equipes',
    quand: '2026-07-29T13:40:00.000Z',
  };

  it('porte de quoi dépanner : version, écran, erreur, composants', () => {
    const rapport = rapportIncident(base);
    expect(rapport).toContain('0.1.0');
    expect(rapport).toContain('674fd89');
    expect(rapport).toContain('/concours/1d801e83-673e-4124-aa6f-8245488f52af/equipes');
    expect(rapport).toContain('TypeError');
    expect(rapport).toContain('teams.map is not a function');
    expect(rapport).toContain('2026-07-29T13:40:00.000Z');
  });

  it('nomme les composants sans recopier les URL du build', () => {
    // Un chemin de fichier local n'aide personne, et l'origine complète n'a
    // rien à faire dans un message recopié.
    const rapport = rapportIncident(base);
    expect(rapport).toContain('TeamsTab');
    expect(rapport).toContain('ConcoursPage');
    expect(rapport).not.toContain('http');
    expect(rapport).not.toContain('.tsx:35');
    // Les balises HTML ne sont pas des composants : elles noient la pile.
    expect(rapport).not.toMatch(/\bat div\b/);
  });

  it('écarte la plomberie qui est toujours là', () => {
    // Relevé réel : la frontière elle-même et les composants du routeur
    // apparaissent dans chaque pile et repoussent les vrais coupables hors du
    // rapport.
    const pileReelle = `
    at TeamsTab (http://localhost:5199/src/pages/tabs/TeamsTab.tsx:35:28)
    at FrontiereErreur (http://localhost:5199/src/components/FrontiereErreur.tsx:37:1)
    at ConcoursPage (http://localhost:5199/src/pages/ConcoursPage.tsx:67:23)
    at RenderedRoute (http://localhost:5199/node_modules/.vite/deps/react-router-dom.js:4122:5)
    at Outlet (http://localhost:5199/node_modules/.vite/deps/react-router-dom.js:4528:26)
    at Layout (http://localhost:5199/src/App.tsx:39:19)`;
    const rapport = rapportIncident({ ...base, pile: pileReelle });
    expect(rapport).toContain('TeamsTab ← ConcoursPage ← Layout');
    expect(rapport).not.toContain('FrontiereErreur');
    expect(rapport).not.toContain('RenderedRoute');
    expect(rapport).not.toContain('Outlet');
  });

  it('masque le jeton d\'un lien de partage', () => {
    // Le rapport se recopie dans un mail : un lien public ne doit pas fuir.
    const rapport = rapportIncident({ ...base, chemin: '/p/8f3c1a2b9d4e5f60' });
    expect(rapport).not.toContain('8f3c1a2b9d4e5f60');
    expect(rapport).toContain('/p/');
  });

  it('reste borné : un rapport illisible n\'est pas recopié', () => {
    const rapport = rapportIncident({
      ...base,
      erreur: { name: 'Error', message: 'x'.repeat(5000) },
      pile: Array.from({ length: 400 }, (_, i) => `    at Composant${i} (http://x/y.tsx:1:1)`).join('\n'),
    });
    expect(rapport.length).toBeLessThan(1200);
    expect(rapport.split('\n').length).toBeLessThan(20);
  });

  it('se contente de ce qu\'il a', () => {
    // Un build sans git n'a pas de commit, et une erreur peut arriver sans pile.
    const rapport = rapportIncident({
      erreur: { message: 'boum' },
      pile: undefined,
      version: '0.1.0',
      commit: '',
      chemin: '/',
      quand: '2026-07-29T13:40:00.000Z',
    });
    expect(rapport).toContain('boum');
    expect(rapport).not.toMatch(/undefined|null/);
  });
});
