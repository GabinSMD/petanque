import { useEffect, useState } from 'react';
import { BouleLogo } from '../components/BouleLogo';
import { JOURNAL } from '../help/nouveautes';
import { ROADMAP, lienIssue } from '../help/roadmap';
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

/**
 * Révélation au défilement.
 *
 * Le masquage initial est porté par une classe sur la racine, décidée **au
 * rendu** : sans JavaScript, ou avec « animations réduites », la classe n'est
 * jamais posée et rien n'est caché. Une page dont le contenu dépend d'un script
 * pour devenir visible est une page qui disparaît au premier incident.
 *
 * On mesure la position à chaque image plutôt que d'écouter des intersections :
 * un `IntersectionObserver` ne signale que ce qui *traverse* la fenêtre, donc il
 * rate ce qu'on saute — et on saute beaucoup, en cliquant une ancre du menu ou
 * en jetant le doigt sur un écran tactile. Ce qui est sauté resterait invisible
 * pour toujours. Ici, tout ce qui est passé sous le bas de la fenêtre se révèle,
 * qu'on l'ait vu arriver ou non.
 */
function useRevelation(anime: boolean): void {
  useEffect(() => {
    if (!anime) return;
    const cibles = Array.from(document.querySelectorAll('[data-revele]'));
    let planifie = false;

    const retirer = () => {
      window.removeEventListener('scroll', planifier);
      window.removeEventListener('resize', planifier);
    };

    const passer = () => {
      planifie = false;
      const limite = window.innerHeight * 0.94;
      for (let i = cibles.length - 1; i >= 0; i--) {
        const cible = cibles[i]!;
        if (cible.getBoundingClientRect().top >= limite) continue;
        cible.classList.add('lp-vu');
        cibles.splice(i, 1);
      }
      if (cibles.length === 0) retirer();
    };

    function planifier(): void {
      if (planifie) return;
      planifie = true;
      requestAnimationFrame(passer);
    }

    window.addEventListener('scroll', planifier, { passive: true });
    window.addEventListener('resize', planifier);
    passer(); // ce qui est déjà à l'écran ne doit pas attendre un geste
    return retirer;
  }, [anime]);
}

function animationsPossibles(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Une famille de fonctionnalités : un pictogramme, un titre, ce qu'elle couvre. */
interface Famille {
  icone: string;
  titre: string;
  chapeau: string;
  points: string[];
}

/**
 * L'inventaire, groupé par famille.
 *
 * Il doit rester le miroir de la section « Fonctionnalités » du README : c'est
 * là qu'on tient le compte, et une vitrine qui en montre le tiers laisse croire
 * à un logiciel trois fois plus petit qu'il n'est.
 */
const FAMILLES: Famille[] = [
  {
    icone: '🎲',
    titre: 'Formules et tirages',
    chapeau: 'Chaque formule avec ses règles, pas une approximation commune.',
    points: [
      'Poules puis élimination, élimination directe, formules fédérales A-B-C, formule par groupes',
      'Mêlée tournante, système suisse, championnat toutes rondes',
      'Tête-à-tête, doublette, triplette — parties en 13 points',
      'Têtes de série réparties dans des poules ou des moitiés de tableau différentes',
      'Protection de club : deux équipes du même club séparées au tirage',
      'Cadrage automatique quand l’effectif n’est pas une puissance de 2, exempts prioritaires',
    ],
  },
  {
    icone: '🏆',
    titre: 'Poules, tableaux, classements',
    chapeau: 'L’enchaînement se construit tout seul, au fil des scores.',
    points: [
      'Poules de 4 complétées par des poules de 3, gagnants / perdants / barrage',
      'Qualifiés entrant au tableau au fil des poules, sans attendre la dernière',
      '1er et 2e d’une même poule séparés dans le tableau',
      'Consolante : repêchage des éliminés de poules ou des perdants du 1er tour',
      'Classement en rondes : victoires, puis goal-average, puis points',
      'Phases finales après les rondes (manuel §3.D.15)',
      'Classement final : vainqueur, finaliste, demi-finalistes, éliminés par tour',
    ],
  },
  {
    icone: '✍️',
    titre: 'La table de marque',
    chapeau: 'Ce qu’on fait cent fois dans une journée doit être rapide et rattrapable.',
    points: [
      'Saisie contrôlée : 13 points, pas de match nul',
      'Saisie rapide au numéro d’équipe, sans chercher la partie',
      'Correction en cascade : reprendre une partie amont réinitialise proprement ce qui en dépendait',
      'Terrains affectés automatiquement aux premières parties, modifiables ensuite',
      'Plan des terrains : plateau libre ou occupé, en direct',
      'Statistiques des poules (manuel §3.D.1.G) : repérer d’un coup d’œil la poule qui retarde tout le monde',
      'Chronomètre de tour et signalement des retards',
    ],
  },
  {
    icone: '📋',
    titre: 'Inscriptions',
    chapeau: 'La file d’attente du matin est le vrai goulot d’étranglement.',
    points: [
      'Équipes numérotées, joueurs avec numéro de licence facultatif',
      'Import d’une liste d’inscrits en CSV (manuel §3.B.10.B)',
      'Pré-inscriptions en ligne : les équipes s’inscrivent elles-mêmes, à valider d’un clic',
      'Fichier des licenciés importé en CSV, autocomplétion à la saisie',
      'Forfaits déclarés sans casser un tirage déjà fait',
      'Composition modifiable après le tirage — sauf ce sur quoi le tirage repose (manuel §3.B.8)',
    ],
  },
  {
    icone: '📺',
    titre: 'Suivre et partager',
    chapeau: 'Les joueurs cherchent l’information ; autant la leur donner.',
    points: [
      'Affichage TV ou vidéoprojecteur : page en lecture seule, grandes polices, en direct',
      'Lien public par concours, révocable, avec QR code à afficher au boulodrome',
      '« Je joue » ne montre que sa partie et sa convocation ; « je consulte » montre tout',
      'Notifications push de convocation, même application fermée',
      'Auto-déclaration des scores : une équipe déclare, l’adversaire confirme',
    ],
  },
  {
    icone: '🖨',
    titre: 'Tout ce qui s’imprime',
    chapeau: 'Le papier reste roi au boulodrome, et la mise en page le sait.',
    points: [
      'Feuilles de poules officielles, tickets de parties à distribuer',
      'Liste des inscrits, liste des capitaines',
      'Tableaux et résultats',
      'Répartition des indemnités',
    ],
  },
  {
    icone: '🏅',
    titre: 'Concours fédéraux',
    chapeau: 'Le manuel de l’arbitrage et des concours, appliqué à la lettre.',
    points: [
      'Contrôle des licences, dépôt équipe par équipe',
      'Critères d’âge, de sexe et de classification, catégories fédérales',
      'Championnat des clubs : les cinq compétitions, contrôle des mutés et des joueurs hors Union européenne (manuel §3.E)',
      'Feuille de match remplie dans l’application, signée au doigt par les deux capitaines, avec empreinte du contenu signé',
      'Échange des compositions entre les deux clubs par QR code',
      'Retour au comité : courriel préparé, feuille exportable en fichier autonome',
    ],
  },
  {
    icone: '🗂',
    titre: 'La saison du club',
    chapeau: 'Un concours n’est pas un événement isolé.',
    points: [
      'Palmarès du club et classement des clubs',
      'Catégories et vue « journée » : plusieurs concours le même jour, rangés',
      'Archivage (manuel §3.F.3) : un concours rangé sort de la liste courante sans être perdu',
      'Fractionnement multisite (manuel §3.B.10.D) : un concours réparti sur plusieurs boulodromes',
      'Tir de précision : séries de 20 boules, 100 points maximum, classement à la volée',
      'Sauvegarde et réimport d’un concours en fichier (manuel §3.F.2)',
    ],
  },
  {
    icone: '👥',
    titre: 'À plusieurs, sur plusieurs appareils',
    chapeau: 'Une table de marque, ce n’est jamais une seule personne.',
    points: [
      'Codes d’invitation (7 jours) pour rejoindre le club',
      'Même compte sur l’ordinateur de la table de marque et la tablette du terrain',
      'Synchronisation dans les deux sens, avec compteur de ce qui reste en attente',
      'Chaque organisation a ses concours, ses utilisateurs et son journal de modifications',
    ],
  },
  {
    icone: '🎓',
    titre: 'Prise en main',
    chapeau: 'Un bénévole doit pouvoir tenir un concours sans avoir lu de mode d’emploi.',
    points: [
      'Création guidée en trois étapes, formules décrites en langage de joueur',
      'Bandeau « prochaine étape » : chaque concours dit où il en est et ce qui vient',
      'Assistant intégré : une vingtaine de guides pas-à-pas, qui accompagne au lieu de cataloguer',
      'Parcours guidés interactifs : l’application fait faire, elle ne raconte pas',
      'Concours d’exemple pour s’entraîner sans risque',
      'Pop-up « Nouveautés » après une mise à jour, version affichée en pied de page',
    ],
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
    q: 'Et si le concours a déjà commencé quand une équipe se désiste ?',
    a:
      'Le forfait se déclare sans casser le tirage, et la correction d’un score ' +
      'déjà saisi réinitialise proprement ce qui en dépendait — au lieu de ' +
      'laisser un tableau à moitié faux.',
  },
  {
    q: 'Est-ce un logiciel officiel de la FFPJP ?',
    a:
      'Non. L’application applique les règles du manuel de l’arbitrage et des ' +
      'concours, mais elle est indépendante : elle n’est ni éditée ni validée ' +
      'par la fédération.',
  },
];

/** « 2026-07-29 » → « 29 juillet 2026 », et la date brute si elle est illisible. */
function dateLongue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Capture d'écran : version ordinateur, et version mobile sous 780 px. */
function Capture({
  nom,
  largeur,
  hauteur,
  largeurMobile,
  hauteurMobile,
  alt,
  differee = true,
}: {
  nom: string;
  largeur: number;
  hauteur: number;
  largeurMobile: number;
  hauteurMobile: number;
  alt: string;
  differee?: boolean;
}) {
  return (
    <picture>
      <source
        media="(max-width: 780px)"
        srcSet={`/vitrine/${nom}-mobile.webp`}
        width={largeurMobile}
        height={hauteurMobile}
      />
      <img
        src={`/vitrine/${nom}.webp`}
        width={largeur}
        height={hauteur}
        loading={differee ? 'lazy' : undefined}
        decoding="async"
        alt={alt}
      />
    </picture>
  );
}

/**
 * Page vitrine servie aux visiteurs.
 *
 * Elle vit hors du `Layout` applicatif (pas d’en-tête de synchronisation, pas
 * d’assistant) et porte sa propre en-tête. Sur un déploiement à deux noms de
 * domaine, elle est un document à part entière (`vitrine.html`).
 */
export function LandingPage() {
  const demenage = aUneAncienneInstallation();
  const ancienneVersion = useAncienneVersionDisponible();
  const [anime] = useState(animationsPossibles);
  useRevelation(anime);

  return (
    <div className={anime ? 'lp lp-anime' : 'lp'}>
      <header className="lp-header">
        <div className="lp-header-inner">
          <span className="lp-brand">
            <BouleLogo />
            <span>
              Pétanque <strong>Concours</strong>
            </span>
          </span>
          <nav className="lp-nav" aria-label="Sections de la page">
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#hors-ligne">Hors ligne</a>
            <a href="#deroule">Le jour J</a>
            <a href="#evolution">Nouveautés</a>
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
              <a className="btn lp-btn-lg" href={appUrl('/login?invite=1')}>
                🚀 Essayer sans compte
              </a>
            </div>
            <p className="lp-cta-note">
              Le mode invité ouvre l’application <strong>immédiatement</strong>, sans
              formulaire. Rien à installer : elle s’ouvre dans le navigateur, sur
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
              <Capture
                nom="tableau"
                largeur={1280}
                hauteur={760}
                largeurMobile={390}
                hauteurMobile={844}
                differee={false}
                alt="Le tableau final d’un concours en doublettes : demi-finales et finale
                  avec les scores, le vainqueur annoncé en tête, et l’indicateur
                  « hors ligne » avec les modifications en attente de synchronisation."
              />
            </figure>
          </div>
        </section>

        <section className="lp-section lp-offline" id="hors-ligne">
          <div className="lp-container">
            <h2 data-revele>
              Le réseau manque au boulodrome. L’application n’en a pas besoin.
            </h2>
            <p className="lp-section-lead" data-revele>
              Ce n’est pas un mode dégradé qu’on active en cas de problème : c’est la
              façon normale dont l’application fonctionne.
            </p>
            <div className="lp-offline-grid">
              <div className="lp-offline-item" data-revele>
                <h3>Tout s’écrit d’abord sur l’appareil</h3>
                <p>
                  L’interface lit et écrit dans le navigateur. Tirer les poules,
                  saisir un score, générer un tableau : aucune de ces opérations
                  n’attend la réponse d’un serveur.
                </p>
              </div>
              <div className="lp-offline-item" data-revele>
                <h3>Rechargez la page sans réseau : tout est là</h3>
                <p>
                  L’application est mise en cache et le navigateur a l’interdiction de
                  purger vos données. Elle s’installe sur mobile et tablette et
                  s’ouvre en plein écran.
                </p>
              </div>
              <div className="lp-offline-item" data-revele>
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
            <h2 data-revele>Ce que l’application sait faire</h2>
            <p className="lp-section-lead" data-revele>
              L’inventaire complet, groupé par moment de la journée. Les références au
              manuel de l’arbitrage et des concours sont celles des règles réellement
              appliquées.
            </p>
            <ul className="lp-familles">
              {FAMILLES.map((f) => (
                <li key={f.titre} className="lp-famille" data-revele>
                  <span className="lp-famille-icone" aria-hidden>
                    {f.icone}
                  </span>
                  <h3>{f.titre}</h3>
                  <p className="lp-famille-chapeau">{f.chapeau}</p>
                  <ul>
                    {f.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>

            <figure className="lp-shot lp-shot-wide" data-revele>
              <Capture
                nom="poules"
                largeur={1280}
                hauteur={1118}
                largeurMobile={390}
                hauteurMobile={844}
                alt="Deux poules de quatre équipes terminées : 1ère partie, 2e partie,
                  gagnants, perdants et barrage, chacune avec son terrain, son heure
                  et son score ; les qualifiés 1er et 2e sont marqués."
              />
              <figcaption>
                Une poule de 4 jusqu’au barrage : l’enchaînement se construit tout
                seul au fil des scores, et les qualifiés se marquent d’eux-mêmes.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="lp-section lp-usages">
          <div className="lp-container">
            <h2 data-revele>Deux usages, une seule application</h2>
            <p className="lp-section-lead" data-revele>
              Un club qui organise des concours amicaux n’a que faire du fichier des
              licenciés ou du championnat des clubs. Un réglage les fait disparaître.
            </p>
            <div className="lp-usages-grid">
              <div className="lp-usage" data-revele>
                <h3>Concours amicaux</h3>
                <p>
                  Mode fédéral décoché, il ne reste que ce qui sert : inscriptions,
                  tirage, poules, tableaux, scores, indemnités. Ni fichier des
                  licenciés, ni championnat des clubs, ni documents pour le comité.
                </p>
              </div>
              <div className="lp-usage" data-revele>
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
            <h2 data-revele>Le jour du concours</h2>
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.title} data-revele>
                  <span className="lp-step-num" aria-hidden>
                    {i + 1}
                  </span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>

            <figure className="lp-shot lp-shot-dark" data-revele>
              <Capture
                nom="affichage"
                largeur={1200}
                hauteur={659}
                largeurMobile={390}
                hauteurMobile={844}
                alt="La page d’affichage public sur fond sombre : le vainqueur annoncé en
                  bandeau, puis les tableaux du concours principal et de la consolante
                  avec leurs scores, en grandes polices."
              />
              <figcaption>
                L’écran d’affichage : ce que les joueurs lisent sur la télévision du
                club pendant que la table de marque saisit.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="lp-section lp-evolution" id="evolution">
          <div className="lp-container">
            <h2 data-revele>Ce qui bouge</h2>
            <p className="lp-section-lead" data-revele>
              L’application est vivante : elle se met à jour toute seule, et vous dit ce
              qu’elle a gagné. Voici ce qui vient, et ce qui est déjà arrivé.
            </p>

            <div className="lp-evolution-grid">
              <div className="lp-roadmap" data-revele>
                <h3>
                  <span aria-hidden>🛠</span> En chantier
                </h3>
                <p className="lp-roadmap-note">
                  Sans dates : on annonce l’intention, pas un calendrier de livraison.
                  Chaque ligne renvoie à son suivi public.
                </p>
                <ul>
                  {ROADMAP.map((c) => (
                    <li key={c.titre}>
                      <span className="lp-roadmap-icone" aria-hidden>
                        {c.icone}
                      </span>
                      <div>
                        <strong>{c.titre}</strong>
                        <p>{c.texte}</p>
                        <a
                          className="lp-roadmap-lien"
                          href={lienIssue(c.issue)}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Suivre le sujet #{c.issue} ↗
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lp-changelog" data-revele>
                <h3>
                  <span aria-hidden>✨</span> Déjà livré
                </h3>
                <p className="lp-roadmap-note">
                  Le même journal que celui affiché dans l’application après une mise à
                  jour — une seule source, donc rien à tenir à deux endroits.
                </p>
                {JOURNAL.map((entree, index) => (
                  <details key={entree.version} open={index === 0}>
                    <summary>
                      <span className="lp-version">Version {entree.version}</span>
                      <small>{dateLongue(entree.date)}</small>
                    </summary>
                    <ul>
                      {entree.items.map((item) => (
                        <li key={item.titre}>
                          {item.icone && <span aria-hidden>{item.icone}</span>}
                          <div>
                            <strong>{item.titre}</strong>
                            <p>{item.texte}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section lp-faq" id="questions">
          <div className="lp-container">
            <h2 data-revele>Questions</h2>
            <div className="lp-faq-list" data-revele>
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
            <h2 data-revele>Essayez-la sur votre prochain concours</h2>
            <p data-revele>
              Le mode invité ouvre l’application tout de suite, sans compte et sans
              engagement. Un concours d’exemple est fourni pour s’entraîner sans
              risque.
            </p>
            <div className="lp-cta lp-cta-center" data-revele>
              <a className="btn btn-primary lp-btn-lg" href={appUrl('/login?mode=inscription')}>
                Créer un compte club
              </a>
              <a className="btn lp-btn-lg lp-btn-invert" href={appUrl('/login?invite=1')}>
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
            <a href={appUrl('/login?invite=1')}>Essayer sans compte</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
