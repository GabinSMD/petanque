import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  SEUIL_EGARE_MS,
  etapeApres,
  phaseEtape,
  premiereEtapeUtile,
  type EtatParcours,
} from '@shared';
import { useConcours, useMatches, usePoules, useTeams } from '../db/hooks';
import { arreterParcours, getParcoursActif, subscribeParcours } from '../help/parcoursState';

/**
 * Hôte des parcours guidés : met la cible en lumière, et surtout **attend**.
 *
 * L'ancienne visite guidée sautait une étape dont la cible était absente, ce qui
 * la rendait inutilisable dès qu'un élément n'apparaissait qu'après une action
 * (les poules après le tirage). Ici l'absence de cible est un état normal :
 * on patiente, puis au bout d'un délai on admet que l'utilisateur est ailleurs
 * et on lui propose de reprendre.
 */
export function ParcoursHost() {
  const actif = useSyncExternalStore(subscribeParcours, getParcoursActif);
  if (!actif) return null;
  return <ParcoursOverlay key={actif.parcours.id} />;
}

function ParcoursOverlay() {
  const actif = getParcoursActif()!;
  const { parcours } = actif;
  const navigate = useNavigate();
  const location = useLocation();

  // Le concours suit l'URL : un parcours peut commencer sans concours (création)
  // et se poursuivre dedans.
  const concoursId = location.pathname.match(/^\/concours\/([^/]+)/)?.[1] ?? actif.concoursId ?? undefined;
  const concours = useConcours(concoursId);
  const teams = useTeams(concoursId);
  const poules = usePoules(concoursId);
  const matches = useMatches(concoursId);

  const etat: EtatParcours = useMemo(
    () => ({
      concours: concours ?? null,
      teams: teams ?? [],
      poules: poules ?? [],
      matches: matches ?? [],
    }),
    [concours, teams, poules, matches],
  );

  /**
   * Les lectures IndexedDB rendent `undefined` le temps de charger. Choisir
   * l'étape de départ avant qu'elles aient répondu ferait croire à un concours
   * vierge, et reprendrait toujours à la première étape.
   */
  const donneesPretes = teams !== undefined && poules !== undefined && matches !== undefined;

  // Étape de départ : la première qui reste à faire. Si tout est déjà acquis, on
  // atterrit sur la dernière — celle qui conclut, jamais un jalon en attente.
  const [idx, setIdx] = useState<number | null>(null);
  useEffect(() => {
    if (idx !== null || !donneesPretes) return;
    const depart = premiereEtapeUtile(parcours, etat);
    setIdx(Math.min(depart, parcours.etapes.length - 1));
  }, [idx, donneesPretes, parcours, etat]);

  const etape = idx === null ? undefined : parcours.etapes[idx];
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [attenteMs, setAttenteMs] = useState(0);
  const debutEtape = useRef<number>(0);

  // Arrêter le parcours prévient le magasin, donc le composant parent : à faire
  // en dehors d'un calcul de rendu, jamais depuis un `setIdx(i => …)`.
  const avancer = useCallback(() => {
    if (idx === null) return;
    const suivant = etapeApres(parcours, idx, etat);
    if (suivant === null) arreterParcours();
    else setIdx(suivant);
  }, [idx, parcours, etat]);

  /**
   * Reprise après égarement : on recalcule où l'utilisateur en est **et** on le
   * ramène sur l'écran de l'étape. Recalculer seul ne suffit pas — si l'indice
   * ne change pas, aucune navigation ne se déclenche et le guide reste sur son
   * écran d'excuses.
   */
  const reprendre = useCallback(() => {
    const suivant = Math.min(premiereEtapeUtile(parcours, etat), parcours.etapes.length - 1);
    const ou = parcours.etapes[suivant]?.route ?? parcours.retour;
    const cible = ou.replace(':id', concoursId ?? '');
    if (location.pathname !== cible) navigate(cible);
    debutEtape.current = performance.now();
    setAttenteMs(0);
    setIdx(suivant);
  }, [parcours, etat, concoursId, location.pathname, navigate]);

  // Changement d'étape : on remet le chronomètre d'attente à zéro et on ouvre
  // l'écran demandé.
  useEffect(() => {
    if (!etape) return;
    debutEtape.current = performance.now();
    setAttenteMs(0);
    setRect(null);
    if (etape.route) {
      const cible = etape.route.replace(':id', concoursId ?? '');
      if (location.pathname !== cible) navigate(cible);
    }
    // `location.pathname` volontairement absent : rouvrir l'écran à chaque
    // navigation empêcherait l'utilisateur d'aller voir ailleurs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etape, concoursId, navigate]);

  // Mesure de la cible, et chronomètre d'attente tant qu'elle manque.
  // On ne remplace le rectangle que s'il a bougé : sinon chaque battement de
  // l'horloge provoquerait un rendu, et tout ce qui en dépend se réabonnerait
  // 4 fois par seconde.
  const mesurer = useCallback(() => {
    if (!etape) return;
    if (!etape.cible) {
      setRect((r) => (r === null ? r : null));
      return;
    }
    const el = document.querySelector(etape.cible);
    const suivant = el ? el.getBoundingClientRect() : null;
    setRect((r) => (memeRect(r, suivant) ? r : suivant));
    // Le chronomètre n'avance que pendant l'attente — cas exceptionnel : un
    // rendu par battement d'horloge y est sans conséquence.
    if (!el) setAttenteMs(performance.now() - debutEtape.current);
  }, [etape]);

  useEffect(() => {
    if (etape?.cible) document.querySelector(etape.cible)?.scrollIntoView({ block: 'center' });
    mesurer();
    const tick = window.setInterval(mesurer, 250);
    window.addEventListener('resize', mesurer);
    window.addEventListener('scroll', mesurer, true);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener('resize', mesurer);
      window.removeEventListener('scroll', mesurer, true);
    };
  }, [mesurer, etape]);

  // Déclencheur « clic » : le geste de l'utilisateur sur la cible fait avancer.
  //
  // L'écouteur est posé **une seule fois** et lit l'étape courante dans une
  // référence. Le faire dépendre de l'étape ou de `avancer` le ferait se
  // réabonner à chaque rendu — et un clic tombé au mauvais moment était perdu.
  const courant = useRef<{ cible: string | null; clic: boolean; avancer: () => void }>({
    cible: null,
    clic: false,
    avancer: () => {},
  });
  courant.current = {
    cible: etape?.cible ?? null,
    clic: etape?.declencheur.type === 'clic',
    avancer,
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const { cible, clic, avancer: suite } = courant.current;
      if (!clic || !cible) return;
      const el = document.querySelector(cible);
      if (el && e.target instanceof Node && el.contains(e.target)) {
        // Laisser l'action du clic se produire avant de mesurer la suite.
        window.setTimeout(suite, 120);
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Déclencheur « jalon » : ce sont les données qui font avancer, quel que soit
  // le chemin pris par l'utilisateur.
  useEffect(() => {
    if (etape?.declencheur.type !== 'jalon') return;
    if (etape.declencheur.atteint(etat)) avancer();
  }, [etape, etat, avancer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') arreterParcours();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!etape || idx === null) return null;

  const phase = phaseEtape({
    aUneCible: Boolean(etape.cible),
    ciblePresente: rect !== null,
    attenteMs,
  });

  const pad = 7;
  const spot =
    rect && phase.phase === 'guide'
      ? {
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        }
      : null;

  const cardW = 360;
  let cardStyle: CSSProperties;
  if (spot) {
    const dessous = spot.top + spot.height + 16;
    const place = window.innerHeight - dessous;
    const left = Math.min(Math.max(12, spot.left), Math.max(12, window.innerWidth - cardW - 12));
    cardStyle = place > 210 ? { top: dessous, left } : { top: Math.max(12, spot.top - 220), left };
  } else {
    cardStyle = {
      top: Math.max(60, window.innerHeight * 0.26),
      left: Math.max(12, (window.innerWidth - cardW) / 2),
    };
  }

  const dernier = idx === parcours.etapes.length - 1;

  return (
    <div className="tour-layer" role="dialog" aria-label={`Parcours guidé : ${parcours.titre}`}>
      <div className={`tour-backdrop${spot ? '' : ' tour-backdrop-dim'}`} onClick={arreterParcours} />
      {spot && (
        <div
          className="tour-spotlight"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
      )}
      <div className="tour-card" style={cardStyle}>
        {phase.phase === 'egare' ? (
          <>
            <h3>Je vous ai perdu ?</h3>
            <p>
              L'écran attendu pour « {etape.titre} » n'est pas affiché. Vous êtes peut-être
              passé à autre chose — ce n'est pas un problème.
            </p>
            <div className="tour-controls">
              <span className="tour-progress">
                {idx + 1} / {parcours.etapes.length}
              </span>
              <span className="tour-buttons">
                <button className="btn btn-ghost btn-sm" onClick={arreterParcours}>
                  Quitter le guide
                </button>
                <button className="btn btn-primary btn-sm" onClick={reprendre}>
                  Reprendre où j'en suis
                </button>
              </span>
            </div>
          </>
        ) : (
          <>
            <h3>{etape.titre}</h3>
            <p>{etape.texte}</p>
            {phase.phase === 'attente' && (
              <p className="tour-attente">⏳ J'attends que l'écran s'affiche…</p>
            )}
            <div className="tour-controls">
              <span className="tour-progress">
                {idx + 1} / {parcours.etapes.length}
              </span>
              <span className="tour-buttons">
                <button className="btn btn-ghost btn-sm" onClick={arreterParcours}>
                  {dernier ? 'Fermer' : 'Quitter'}
                </button>
                {etape.declencheur.type === 'lecture' ? (
                  <button className="btn btn-primary btn-sm" onClick={avancer}>
                    {dernier ? 'Terminer ✓' : 'Suivant →'}
                  </button>
                ) : (
                  <span className="tour-consigne">
                    {etape.declencheur.type === 'clic' ? '👆 à vous de cliquer' : '👉 à vous de faire'}
                  </span>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Deux rectangles au pixel près : évite les rendus pour rien. */
function memeRect(a: DOMRect | null, b: DOMRect | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.abs(a.top - b.top) < 1 &&
    Math.abs(a.left - b.left) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
}
