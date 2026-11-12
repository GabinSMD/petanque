import { Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Concours, Licencie, Player, Team } from '@shared';
import {
  TAILLE_FORMATION,
  aDesCriteresLicence,
  controlerEquipe,
  criteresDuConcours,
  parseLicenceQr,
} from '@shared';
import { addTeam } from '../db/actions';
import { useLicencies } from '../db/hooks';
import { ANOMALIE_EQUIPE_LABELS, ANOMALIE_LABELS } from '../lib/labels';
import { CameraQr } from './CameraQr';
import { Modal } from './Modal';

interface Props {
  concours: Concours;
  teams: Team[];
  onClose: () => void;
}

interface Scanne extends Player {
  /** Contenu brut du QR, gardé quand le numéro n'a pas été reconnu. */
  brut: string;
  /** Fiche trouvée dans le fichier des licenciés. */
  fiche?: Licencie;
}

/**
 * Inscription au lecteur de QR code (manuel §3.B.2 et §3.B.3).
 *
 * Deux entrées : la caméra de la tablette, et un champ qui reçoit aussi bien
 * une douchette USB (qui émule un clavier) qu'une saisie manuelle. Le mode
 * « à la volée » enchaîne les équipes sans rien cliquer, comme le logiciel
 * fédéral : dès que la formation est complète, l'équipe est inscrite et on
 * passe à la suivante.
 */
export function LicenceScanModal({ concours, teams, onClose }: Props) {
  const parEquipe = TAILLE_FORMATION[concours.format];
  const licencies = useLicencies() ?? [];
  const parLicence = useMemo(
    () => new Map(licencies.filter((l) => l.licence).map((l) => [l.licence!, l])),
    [licencies],
  );
  /** Licences déjà inscrites, pour prévenir un double scan. */
  const dejaInscrites = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of teams) {
      for (const p of t.players) if (p.licence) map.set(p.licence, t.number);
    }
    return map;
  }, [teams]);

  const [aLaVolee, setALaVolee] = useState(true);
  const [encours, setEncours] = useState<Scanne[]>([]);
  const [saisie, setSaisie] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [alerte, setAlerte] = useState<string | null>(null);
  const [inscrites, setInscrites] = useState(0);

  const champ = useRef<HTMLInputElement>(null);

  /**
   * Contrôle des critères du concours sur l'équipe en cours de scan, comme le
   * fait l'écran fédéral au moment même de la lecture. Il informe, il ne bloque
   * pas : le dépôt des licences reste l'endroit où l'arbitre tranche, et un
   * fichier des licenciés en retard ne doit pas empêcher d'inscrire.
   */
  const controle = useMemo(() => {
    if (!aDesCriteresLicence(concours) || encours.length === 0) return null;
    return controlerEquipe(encours, parLicence, criteresDuConcours(concours));
  }, [concours, encours, parLicence]);
  // Sans club d'équipe saisi, les anomalies qui en dépendent n'ont pas de sens ici.
  const anomaliesEquipe = (controle?.anomaliesEquipe ?? []).filter(
    (a) => a !== 'clubEquipeErrone' && a !== 'clubEquipeNonHomogene',
  );

  useEffect(() => {
    champ.current?.focus();
  }, []);

  /* ----------------------------- Traitement ----------------------------- */

  /**
   * Ajoute un contenu scanné à l'équipe en cours. Les relectures du même QR
   * par la caméra sont écartées par `CameraQr` ; une saisie à la douchette est
   * toujours volontaire et reçoit une réponse, quitte à dire « déjà scannée ».
   */
  const traiter = (contenu: string): void => {
    const decode = parseLicenceQr(contenu);
    if (!decode) return;

    if (!decode.licence) {
      setAlerte(
        `Contenu non reconnu comme une licence : « ${decode.brut.slice(0, 60)} ». ` +
          'Saisissez le joueur à la main, ou envoyez-moi ce contenu pour que je le décode.',
      );
      return;
    }

    if (encours.some((j) => j.licence === decode.licence)) {
      setAlerte(`Licence ${decode.licence} déjà scannée pour cette équipe.`);
      return;
    }
    const equipe = dejaInscrites.get(decode.licence);
    if (equipe !== undefined) {
      setAlerte(`Licence ${decode.licence} déjà inscrite dans l'équipe n°${equipe}.`);
      return;
    }

    const fiche = parLicence.get(decode.licence);
    const nom = fiche?.name ?? decode.name ?? '';
    if (!fiche && !nom) {
      setAlerte(
        `Licence ${decode.licence} inconnue du fichier des licenciés : ` +
          'complétez le nom à la main.',
      );
    } else {
      setAlerte(null);
    }

    const joueur: Scanne = { name: nom, licence: decode.licence, brut: decode.brut, fiche };
    const suivant = [...encours, joueur].slice(0, parEquipe);
    setEncours(suivant);
    setMessage(null);

    // À la volée, on n'inscrit que si chaque joueur porte un nom : une licence
    // inconnue du fichier doit être complétée à la main, pas abandonnée.
    if (suivant.length === parEquipe && aLaVolee) {
      if (suivant.every((j) => j.name.trim())) void inscrire(suivant);
      else
        setAlerte(
          'Équipe complète, mais un nom manque : complétez-le puis validez avec « Inscrire l\'équipe ».',
        );
    }
  };

  const inscrire = async (joueurs: Scanne[]): Promise<void> => {
    if (joueurs.length === 0) return;
    // Aucun joueur n'est abandonné en route : on refuse plutôt d'inscrire.
    if (joueurs.some((j) => !j.name.trim())) {
      setAlerte('Complétez le nom de chaque joueur avant d\'inscrire l\'équipe.');
      return;
    }
    const club = joueurs.find((j) => j.fiche?.club)?.fiche?.club;
    await addTeam(
      concours.id,
      joueurs.map((j) => ({ name: j.name.trim(), licence: j.licence })),
      club,
    );
    setEncours([]);
    setInscrites((n) => n + 1);
    setAlerte(null);
    setMessage(`Équipe inscrite (${joueurs.length} joueur${joueurs.length > 1 ? 's' : ''}).`);
    champ.current?.focus();
  };

  const valider = (): void => {
    void inscrire(encours);
  };


  /* ------------------------------- Rendu -------------------------------- */

  const places = Array.from({ length: parEquipe }, (_, i) => encours[i]);

  return (
    <Modal
      title="Inscription au lecteur de licences"
      onClose={onClose}
    >
      <div className="scan-modal">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={aLaVolee}
            onChange={(e) => setALaVolee(e.target.checked)}
          />
          À la volée : inscrire l'équipe dès que la formation est complète
        </label>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = saisie.trim();
            if (!v) return;
            traiter(v);
            setSaisie('');
          }}
        >
          <label>
            Douchette ou saisie manuelle
            <input
              ref={champ}
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Scannez une licence, ou tapez un n° puis Entrée"
              autoComplete="off"
            />
          </label>
        </form>

        <CameraQr onCode={(contenu) => traiter(contenu)} />

        <ol className="scan-places">
          {places.map((joueur, i) => (
            <li key={i} className={joueur ? 'scan-place scan-place-prise' : 'scan-place'}>
              {joueur ? (
                <>
                  <input
                    value={joueur.name}
                    onChange={(e) =>
                      setEncours(
                        encours.map((j, k) => (k === i ? { ...j, name: e.target.value } : j)),
                      )
                    }
                    placeholder="Nom du joueur"
                    aria-label={`Joueur ${i + 1}`}
                  />
                  <span className="scan-licence">{joueur.licence}</span>
                  {!joueur.fiche && <span className="tag tag-warn">hors fichier</span>}
                  {controle?.joueurs[i]?.anomalies.map((a) => (
                    <span key={a} className="tag tag-danger">
                      {ANOMALIE_LABELS[a]}
                    </span>
                  ))}
                  <button
                    className="btn-icon btn-icon-danger"
                    title="Retirer"
                    onClick={() => setEncours(encours.filter((_, k) => k !== i))}
                  >
                    <Trash2 className="ic" aria-hidden />
                  </button>
                </>
              ) : (
                <span className="hint">Joueur {i + 1} — en attente d'un scan</span>
              )}
            </li>
          ))}
        </ol>

        {anomaliesEquipe.length > 0 && (
          <p className="scan-alerte">
            <TriangleAlert className="ic" aria-hidden />{' '}
            {anomaliesEquipe.map((a) => ANOMALIE_EQUIPE_LABELS[a]).join(', ')}
          </p>
        )}
        {alerte && <p className="scan-alerte"><TriangleAlert className="ic" aria-hidden /> {alerte}</p>}
        {message && <p className="hint scan-message">{message}</p>}

        <div className="form-actions">
          <span className="hint">
            {inscrites > 0
              ? `${inscrites} équipe${inscrites > 1 ? 's' : ''} inscrite${inscrites > 1 ? 's' : ''} pendant cette session`
              : ''}
          </span>
          {encours.length > 0 && (
            <button className="btn btn-ghost" onClick={() => setEncours([])}>
              Vider
            </button>
          )}
          {/* Toujours proposé : en « à la volée », c'est le seul recours quand
              l'inscription automatique est bloquée par un nom manquant. */}
          <button className="btn btn-primary" onClick={valider} disabled={encours.length === 0}>
            Inscrire l'équipe
          </button>
        </div>
      </div>
    </Modal>
  );
}
