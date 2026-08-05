import { useEffect, useMemo, useRef, useState } from 'react';
import type { Concours, Licencie, Player, Team } from '@shared';
import { TAILLE_FORMATION, parseLicenceQr } from '@shared';
import { addTeam } from '../db/actions';
import { useLicencies } from '../db/hooks';
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
  const [camera, setCamera] = useState<'inactive' | 'demande' | 'active' | 'refusee'>('inactive');
  const [cameraErreur, setCameraErreur] = useState<string | null>(null);

  const champ = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const flux = useRef<MediaStream | null>(null);
  const boucle = useRef<number | null>(null);
  const dernierScan = useRef<{ brut: string; at: number }>({ brut: '', at: 0 });
  /**
   * jsQR n'est chargé qu'au moment où le repli est nécessaire : il pèse
   * 140 Ko, inutiles pour qui n'ouvre jamais ce module. Le morceau est
   * précaché par le service worker, donc disponible hors ligne ensuite.
   */
  const jsQr = useRef<typeof import('jsqr').default | null>(null);

  useEffect(() => {
    champ.current?.focus();
  }, []);

  /* ----------------------------- Traitement ----------------------------- */

  /**
   * Ajoute un contenu scanné à l'équipe en cours. La source compte : la
   * caméra relit le même QR à chaque image, il faut donc ignorer les
   * répétitions ; une saisie à la douchette est toujours volontaire et doit
   * recevoir une réponse, quitte à dire « déjà scannée ».
   */
  const traiter = (contenu: string, source: 'camera' | 'saisie'): void => {
    const decode = parseLicenceQr(contenu);
    if (!decode) return;

    if (source === 'camera') {
      const maintenant = Date.now();
      if (decode.brut === dernierScan.current.brut && maintenant - dernierScan.current.at < 2500) {
        return;
      }
      dernierScan.current = { brut: decode.brut, at: maintenant };
    }

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

  /* ------------------------------ Caméra -------------------------------- */

  const arreterCamera = (): void => {
    if (boucle.current !== null) {
      cancelAnimationFrame(boucle.current);
      boucle.current = null;
    }
    flux.current?.getTracks().forEach((t) => t.stop());
    flux.current = null;
  };

  useEffect(() => arreterCamera, []);

  const demarrerCamera = async (): Promise<void> => {
    setCamera('demande');
    setCameraErreur(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      flux.current = stream;
      if (video.current) {
        video.current.srcObject = stream;
        await video.current.play();
      }
      setCamera('active');
      lireImages();
    } catch (err) {
      setCamera('refusee');
      setCameraErreur(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Accès à la caméra refusé. Autorisez-le dans le navigateur, ou utilisez une douchette.'
          : 'Caméra indisponible sur cet appareil. Utilisez une douchette ou la saisie manuelle.',
      );
    }
  };

  /**
   * Décodage image par image. `BarcodeDetector` quand le navigateur l'offre
   * (Chrome, Android), sinon jsQR — embarqué dans l'application, donc
   * fonctionnel hors ligne.
   */
  const lireImages = (): void => {
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (o: { formats: string[] }) => {
          detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]>;
        };
      }
    ).BarcodeDetector;
    const detecteur = Detector ? new Detector({ formats: ['qr_code'] }) : null;

    const tick = async (): Promise<void> => {
      const v = video.current;
      const c = canvas.current;
      if (!v || !c || v.readyState !== v.HAVE_ENOUGH_DATA) {
        boucle.current = requestAnimationFrame(() => void tick());
        return;
      }
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(v, 0, 0, c.width, c.height);
        try {
          if (detecteur) {
            const codes = await detecteur.detect(c);
            if (codes[0]?.rawValue) traiter(codes[0].rawValue, 'camera');
          } else {
            if (!jsQr.current) jsQr.current = (await import('jsqr')).default;
            const image = ctx.getImageData(0, 0, c.width, c.height);
            const code = jsQr.current(image.data, image.width, image.height);
            if (code?.data) traiter(code.data, 'camera');
          }
        } catch {
          /* image illisible : on tentera la suivante */
        }
      }
      boucle.current = requestAnimationFrame(() => void tick());
    };
    boucle.current = requestAnimationFrame(() => void tick());
  };

  /* ------------------------------- Rendu -------------------------------- */

  const places = Array.from({ length: parEquipe }, (_, i) => encours[i]);

  return (
    <Modal
      title="📷 Inscription au lecteur de licences"
      onClose={() => {
        arreterCamera();
        onClose();
      }}
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
            traiter(v, 'saisie');
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

        <div className="scan-camera">
          {camera === 'inactive' && (
            <button className="btn btn-ghost btn-sm" onClick={() => void demarrerCamera()}>
              📷 Utiliser la caméra
            </button>
          )}
          {camera === 'demande' && <p className="hint">Autorisation de la caméra…</p>}
          {camera === 'refusee' && <p className="hint scan-alerte">{cameraErreur}</p>}
          <video
            ref={video}
            className={camera === 'active' ? 'scan-video' : 'scan-video scan-video-off'}
            muted
            playsInline
          />
          <canvas ref={canvas} className="scan-canvas" />
          {camera === 'active' && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                arreterCamera();
                setCamera('inactive');
              }}
            >
              ⏹ Arrêter la caméra
            </button>
          )}
        </div>

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
                  <button
                    className="btn-icon btn-icon-danger"
                    title="Retirer"
                    onClick={() => setEncours(encours.filter((_, k) => k !== i))}
                  >
                    🗑
                  </button>
                </>
              ) : (
                <span className="hint">Joueur {i + 1} — en attente d'un scan</span>
              )}
            </li>
          ))}
        </ol>

        {alerte && <p className="scan-alerte">⚠ {alerte}</p>}
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
