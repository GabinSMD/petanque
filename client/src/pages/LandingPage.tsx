import { useEffect, useState } from 'react';
import { BouleLogo } from '../components/BouleLogo';
import { appIsElsewhere, appUrl } from '../lib/appUrl';
import '../landing.css';

/**
 * Données locales laissées par l'application à l'époque où elle vivait sur ce
 * nom de domaine. Elles appartiennent à cette origine : le navigateur ne les
 * donnera jamais à l'application déménagée, et le dire vaut mieux que de
 * laisser quelqu'un croire ses concours perdus.
 */
function aUneAncienneInstallation(): boolean {
  if (!appIsElsewhere()) return false;
  try {
    return window.localStorage.getItem('petanque.session') !== null;
  } catch {
    return false;
  }
}

/**
 * Vrai si un service worker contrôle encore cette origine — donc si
 * l'application y est toujours ouvrable depuis son cache.
 *
 * C'est ce qui rend l'échappatoire `?ancienne=1` proposable : sans elle, un
 * utilisateur en mode invité n'aurait plus aucun moyen d'atteindre ses concours
 * pour les exporter, alors qu'ils sont encore dans ce navigateur.
 */
function useAncienneVersionDisponible(): boolean {
  const [dispo, setDispo] = useState(false);
  useEffect(() => {
    if (!appIsElsewhere()) return;
    setDispo(navigator.serviceWorker?.controller != null);
  }, []);
  return dispo;
}

/** Une fonctionnalité de la grille : un pictogramme, un titre, une phrase. */
interface Feature {
  icon: string;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: '🎲',
    title: 'Toutes les formules',
    body:
      'Poules puis élimination, élimination directe, formules fédérales A-B-C, ' +
      'formule par groupes, mêlée tournante, système suisse, championnat toutes ' +
      'rondes. Chacune avec ses règles, pas une approximation commune.',
  },
  {
    icon: '🏆',
    title: 'Poules et tableaux à la règle',
    body:
      'Poules de 4 complétées par des poules de 3, enchaînement gagnants / ' +
      'perdants / barrage, cadrage automatique quand l’effectif n’est pas une ' +
      'puissance de 2, 1er et 2e d’une même poule séparés dans le tableau.',
  },
  {
    icon: '✍️',
    title: 'Scores et corrections',
    body:
      'Saisie contrôlée (13 points, pas de nul) et correction en cascade : ' +
      'reprendre une partie amont réinitialise proprement tout ce qui en ' +
      'dépendait, au lieu de laisser un tableau à moitié faux.',
  },
  {
    icon: '📺',
    title: 'Affichage sur écran',
    body:
      'Une page en lecture seule pour la télévision du club ou le ' +
      'vidéoprojecteur : grandes polices, poules et tableaux, mise à jour en ' +
      'direct pendant que la table de marque saisit.',
  },
  {
    icon: '🖨',
    title: 'Tout ce qui s’imprime',
    body:
      'Feuilles de poules officielles, tickets de parties à distribuer, liste ' +
      'des inscrits, liste des capitaines, tableaux et résultats.',
  },
  {
    icon: '🔗',
    title: 'Lien public et QR code',
    body:
      'Les joueurs suivent le concours sur leur téléphone, sans compte. ' +
      '« Je joue » ne montre que sa partie et sa convocation ; « je consulte » ' +
      'montre tout. Le lien est révocable.',
  },
  {
    icon: '🔔',
    title: 'Convocations notifiées',
    body:
      'Une équipe s’abonne avec son numéro et reçoit une alerte sur son ' +
      'téléphone à chaque convocation — barrage, tour suivant — même ' +
      'application fermée. La table de marque n’a rien à faire.',
  },
  {
    icon: '📋',
    title: 'Championnat des clubs',
    body:
      'Contrôle des compositions (mutés, joueurs hors Union européenne), ' +
      'feuille de match signée au doigt avec empreinte du contenu signé, et ' +
      'échange des compositions entre les deux clubs par QR code.',
  },
  {
    icon: '🗂',
    title: 'Licenciés et palmarès',
    body:
      'Import CSV du fichier des licenciés, autocomplétion aux inscriptions, ' +
      'palmarès du club, classement des clubs, répartition des indemnités.',
  },
];

/** Le déroulé d’une journée, tel qu’il se vit. */
const STEPS: { title: string; body: string }[] = [
  {
    title: 'La veille, au club',
    body:
      'Vous créez le concours en trois étapes et saisissez les inscriptions — ' +
      'ou vous ouvrez le lien public et laissez les équipes s’inscrire ' +
      'elles-mêmes, à valider d’un clic.',
  },
  {
    title: 'Au boulodrome, sans réseau',
    body:
      'Vous ouvrez l’application : elle se charge depuis le cache. Tirage des ' +
      'poules, impression des feuilles, saisie des scores, génération du ' +
      'tableau, consolante — tout fonctionne hors connexion.',
  },
  {
    title: 'Sur l’écran du club',
    body:
      'La page d’affichage montre poules et tableaux en direct. Les joueurs ' +
      'regardent l’écran au lieu de venir demander à la table de marque.',
  },
  {
    title: 'Au retour du réseau',
    body:
      'Les modifications partent, celles des autres appareils arrivent. Le ' +
      'compteur dit ce qui reste en attente : rien n’est cru synchronisé avant ' +
      'que le serveur l’ait accepté.',
  },
];

/** Questions qu’un club se pose avant d’essayer. */
const FAQ: { q: string; a: string }[] = [
  {
    q: 'Faut-il créer un compte pour essayer ?',
    a:
      'Non. Le mode invité ouvre l’application immédiatement ; les concours ' +
      'restent sur l’appareil. Si vous créez un compte ensuite, l’application ' +
      'propose de les y rattacher plutôt que de les perdre.',
  },
  {
    q: 'Où sont mes données ?',
    a:
      'D’abord dans le navigateur de l’appareil — c’est ce qui permet de ' +
      'travailler sans réseau. Avec un compte club, elles sont aussi répliquées ' +
      'sur le serveur : le second appareil du club les voit, et la perte d’une ' +
      'tablette ne perd pas le concours.',
  },
  {
    q: 'Faut-il installer un logiciel ?',
    a:
      'Non, un navigateur suffit. Sur mobile et tablette, l’application peut ' +
      's’ajouter à l’écran d’accueil et s’ouvrir en plein écran, comme une ' +
      'application installée.',
  },
  {
    q: 'Plusieurs personnes peuvent-elles tenir la table de marque ?',
    a:
      'Oui. Un code d’invitation fait rejoindre le club, et tous les appareils ' +
      'connectés au même compte voient les mêmes données — l’ordinateur de la ' +
      'table de marque comme la tablette du terrain.',
  },
  {
    q: 'Est-ce un logiciel officiel de la FFPJP ?',
    a:
      'Non. L’application applique les règles du manuel de l’arbitrage et des ' +
      'concours, mais elle est indépendante : elle n’est ni éditée ni validée ' +
      'par la fédération.',
  },
];

/**
 * Page vitrine servie à la racine aux visiteurs sans session.
 *
 * Elle vit hors du `Layout` applicatif (pas d’en-tête de synchronisation, pas
 * d’assistant) et porte sa propre en-tête.
 */
export function LandingPage() {
  const demenage = aUneAncienneInstallation();
  const ancienneVersion = useAncienneVersionDisponible();

  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-header-inner">
          <span className="lp-brand">
            <BouleLogo />
            <span>
              Pétanque <strong>Concours</strong>
            </span>
          </span>
          <nav className="lp-nav" aria-label="Sections de la page">
            <a href="#hors-ligne">Hors ligne</a>
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#deroule">Le jour J</a>
            <a href="#questions">Questions</a>
          </nav>
          <div className="lp-header-cta">
            <a className="btn btn-sm" href={appUrl('/login')}>
              Se connecter
            </a>
            <a className="btn btn-primary btn-sm" href={appUrl('/login?mode=inscription')}>
              Créer un compte
            </a>
          </div>
        </div>
      </header>

      <main>
        {demenage && (
          <div className="lp-moved" role="status">
            <div className="lp-container">
              <strong>L’application a déménagé.</strong> Cet appareil garde des données
              de l’époque où elle était à cette adresse ; elles restent attachées à
              celle-ci. Vos concours <strong>synchronisés</strong> vous attendent à la
              nouvelle adresse dès votre connexion — ceux créés en mode invité, jamais
              envoyés au serveur, sont à exporter depuis l’ancienne installation avant
              de la quitter.{' '}
              <a href={appUrl('/login')}>Aller à l’application →</a>
              {ancienneVersion && (
                <>
                  {' · '}
                  <a href="?ancienne=1">Rouvrir l’ancienne version pour exporter</a>
                </>
              )}
            </div>
          </div>
        )}
        <section className="lp-hero">
          <div className="lp-container lp-hero-inner">
            <p className="lp-eyebrow">Gestion de concours de pétanque</p>
            <h1>
              De la feuille d’inscription au palmarès,
              <br />
              <span className="lp-accent">même sans réseau au boulodrome.</span>
            </h1>
            <p className="lp-lead">
              Tirage des poules, barrages, cadrage, tableaux, consolante, saisie des
              scores, affichage sur écran, impression des feuilles. Tout se fait sur
              place, et se synchronise quand le réseau revient.
            </p>
            <div className="lp-cta">
              <a className="btn btn-primary lp-btn-lg" href={appUrl('/login?mode=inscription')}>
                Créer un compte club
              </a>
              <a className="btn lp-btn-lg" href={appUrl('/login')}>
                🚀 Essayer sans compte
              </a>
            </div>
            <p className="lp-cta-note">
              Rien à installer : l’application s’ouvre dans le navigateur, sur
              l’ordinateur de la table de marque comme sur la tablette du terrain.
            </p>
          </div>
          <div className="lp-container">
            <figure className="lp-shot lp-shot-hero">
              <div className="lp-shot-bar" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <div className="lp-shot-scroll">
                <img
                  src="/vitrine/tableau.webp"
                  width={1280}
                  height={760}
                  alt="Le tableau final d’un concours en doublettes : demi-finales et
                    finale avec les scores, le vainqueur annoncé en tête, et
                    l’indicateur « hors ligne » avec 27 modifications en attente de
                    synchronisation."
                />
              </div>
            </figure>
          </div>
        </section>

        <section className="lp-section lp-offline" id="hors-ligne">
          <div className="lp-container">
            <h2>Le réseau manque au boulodrome. L’application n’en a pas besoin.</h2>
            <p className="lp-section-lead">
              Ce n’est pas un mode dégradé qu’on active en cas de problème : c’est la
              façon normale dont l’application fonctionne.
            </p>
            <div className="lp-offline-grid">
              <div className="lp-offline-item">
                <h3>Tout s’écrit d’abord sur l’appareil</h3>
                <p>
                  L’interface lit et écrit dans le navigateur. Tirer les poules,
                  saisir un score, générer un tableau : aucune de ces opérations
                  n’attend la réponse d’un serveur.
                </p>
              </div>
              <div className="lp-offline-item">
                <h3>Rechargez la page sans réseau : tout est là</h3>
                <p>
                  L’application est mise en cache et le navigateur a l’interdiction de
                  purger vos données. Elle s’installe sur mobile et tablette et
                  s’ouvre en plein écran.
                </p>
              </div>
              <div className="lp-offline-item">
                <h3>La synchronisation attend son heure</h3>
                <p>
                  Au retour du réseau, vos modifications partent et celles des autres
                  appareils du club arrivent. Le compteur affiche ce qui reste en
                  attente — une entité refusée reste visible plutôt que d’être crue
                  sauvegardée.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section" id="fonctionnalites">
          <div className="lp-container">
            <h2>Ce que l’application sait faire</h2>
            <p className="lp-section-lead">
              Les règles du manuel de l’arbitrage et des concours, appliquées là où
              elles se jouent.
            </p>
            <ul className="lp-features">
              {FEATURES.map((f) => (
                <li key={f.title} className="lp-feature">
                  <span className="lp-feature-icon" aria-hidden>
                    {f.icon}
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </li>
              ))}
            </ul>

            <figure className="lp-shot lp-shot-wide">
              <div className="lp-shot-scroll">
                <img
                  src="/vitrine/poules.webp"
                  width={1280}
                  height={1118}
                  loading="lazy"
                  decoding="async"
                  alt="Deux poules de quatre équipes terminées : 1ère partie, 2e partie,
                    gagnants, perdants et barrage, chacune avec son terrain, son heure
                    et son score ; les qualifiés 1er et 2e sont marqués."
                />
              </div>
              <figcaption>
                Une poule de 4 jusqu’au barrage : l’enchaînement se construit tout
                seul au fil des scores, et les qualifiés se marquent d’eux-mêmes.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="lp-section lp-usages">
          <div className="lp-container">
            <h2>Deux usages, une seule application</h2>
            <p className="lp-section-lead">
              Un club qui organise des concours amicaux n’a que faire du fichier des
              licenciés ou du championnat des clubs. Un réglage les fait disparaître.
            </p>
            <div className="lp-usages-grid">
              <div className="lp-usage">
                <h3>Concours amicaux</h3>
                <p>
                  Mode fédéral décoché, il ne reste que ce qui sert : inscriptions,
                  tirage, poules, tableaux, scores, indemnités. Ni fichier des
                  licenciés, ni championnat des clubs, ni documents pour le comité.
                </p>
              </div>
              <div className="lp-usage">
                <h3>Concours officiels</h3>
                <p>
                  Critères d’âge, de sexe et de classification, contrôle des licences,
                  catégories fédérales, championnat des clubs et feuilles de match. Le
                  réglage ne change que l’affichage : un concours déclaré officiel
                  continue de contrôler ses licences.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section" id="deroule">
          <div className="lp-container">
            <h2>Le jour du concours</h2>
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="lp-step-num" aria-hidden>
                    {i + 1}
                  </span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>

            <figure className="lp-shot lp-shot-dark">
              <div className="lp-shot-scroll">
                <img
                  src="/vitrine/affichage.webp"
                  width={1200}
                  height={659}
                  loading="lazy"
                  decoding="async"
                  alt="La page d’affichage public sur fond sombre : le vainqueur annoncé
                    en bandeau, puis les tableaux du concours principal et de la
                    consolante avec leurs scores, en grandes polices."
                />
              </div>
              <figcaption>
                L’écran d’affichage : ce que les joueurs lisent sur la télévision du
                club pendant que la table de marque saisit.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="lp-section lp-faq" id="questions">
          <div className="lp-container">
            <h2>Questions</h2>
            <div className="lp-faq-list">
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-container">
            <h2>Essayez-la sur votre prochain concours</h2>
            <p>
              Le mode invité ouvre l’application tout de suite, sans compte et sans
              engagement. Un concours d’exemple est fourni pour s’entraîner sans
              risque.
            </p>
            <div className="lp-cta lp-cta-center">
              <a className="btn btn-primary lp-btn-lg" href={appUrl('/login?mode=inscription')}>
                Créer un compte club
              </a>
              <a className="btn lp-btn-lg lp-btn-invert" href={appUrl('/login')}>
                🚀 Essayer sans compte
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <span className="lp-brand lp-brand-footer">
            <BouleLogo />
            <span>
              Pétanque <strong>Concours</strong>
            </span>
          </span>
          <p className="lp-footer-note">
            Application indépendante, non affiliée à la FFPJP : elle applique les
            règles publiées du manuel de l’arbitrage et des concours, sans être
            éditée ni validée par la fédération. Les marques et logos fédéraux
            appartiennent à leurs titulaires.
          </p>
          <nav className="lp-footer-links" aria-label="Liens">
            <a href={appUrl('/login')}>Se connecter</a>
            <a href={appUrl('/login?mode=inscription')}>Créer un compte club</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
