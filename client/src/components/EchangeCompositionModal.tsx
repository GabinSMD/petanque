import { useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import type { CompositionEchangee, FeuilleMatch, Player } from '@shared';
import { decoderComposition, encoderComposition } from '@shared';
import { decoderImageQr } from '../lib/qr';
import { Modal } from './Modal';

interface Props {
  feuille: FeuilleMatch;
  /** Notre composition, noms résolus depuis le fichier des licenciés. */
  joueurs: Player[];
  onRecevoir: (composition: CompositionEchangee) => void;
  onClose: () => void;
}

/** Nombre de lignes que la feuille réserve à une composition. */
const LIGNES_FEUILLE = 8;

/**
 * Échange de composition entre les deux clubs d'une rencontre.
 *
 * Le club visiteur montre un QR, l'hôte le scanne : les huit lignes se
 * remplissent avec les licences, au lieu d'être recopiées à la main alors que
 * l'autre club les a déjà saisies et contrôlées chez lui.
 *
 * Tout se passe entre les deux appareils, sans réseau ni compte commun — au
 * boulodrome il n'y a souvent ni l'un ni l'autre. Et pour le cas où une caméra
 * fait défaut, le code se recopie : c'est du texte lisible.
 */
export function EchangeCompositionModal({ feuille, joueurs, onRecevoir, onClose }: Props) {
  const [mode, setMode] = useState<'envoyer' | 'recevoir'>('envoyer');
  return (
    <Modal title="🔁 Échanger les compositions" onClose={onClose}>
      <div className="echange-modal">
        <div className="stage-tabs">
          <button
            className={mode === 'envoyer' ? 'tab active' : 'tab'}
            onClick={() => setMode('envoyer')}
          >
            Montrer la nôtre
          </button>
          <button
            className={mode === 'recevoir' ? 'tab active' : 'tab'}
            onClick={() => setMode('recevoir')}
          >
            Recevoir la sienne
          </button>
        </div>
        {mode === 'envoyer' ? (
          <Envoyer feuille={feuille} joueurs={joueurs} />
        ) : (
          <Recevoir onRecevoir={onRecevoir} onClose={onClose} />
        )}
      </div>
    </Modal>
  );
}

function Envoyer({ feuille, joueurs }: { feuille: FeuilleMatch; joueurs: Player[] }) {
  const [copie, setCopie] = useState(false);

  const code = useMemo(
    () =>
      encoderComposition({
        club: feuille.club,
        numeroClub: feuille.numeroClub,
        competition: feuille.competition,
        date: feuille.date,
        capitaine: feuille.capitaineNom.trim()
          ? { nom: feuille.capitaineNom, licence: feuille.capitaineLicence }
          : undefined,
        joueurs: joueurs
          .filter((p) => p.name.trim())
          .map((p) => ({ nom: p.name, licence: p.licence ?? '' })),
      }),
    [feuille, joueurs],
  );

  /**
   * Image encodée plutôt que balisage injecté : le contenu vient de nos propres
   * données, mais une balise `img` ne peut rien exécuter, alors qu'injecter du
   * HTML dans la page demanderait de faire confiance à ce qui le produit.
   */
  const image = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(code);
    qr.make();
    return qr.createDataURL(6, 2);
  }, [code]);

  const copier = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      /* presse-papiers refusé : le code reste sélectionnable à la main */
    }
  };

  if (joueurs.filter((p) => p.name.trim()).length === 0) {
    return (
      <p className="hint">
        Composez d'abord votre équipe : il n'y a rien à montrer pour l'instant.
      </p>
    );
  }

  return (
    <>
      <p className="hint">
        Faites scanner ce code par l'autre club. Rien ne passe par le réseau : les deux appareils
        suffisent.
      </p>
      <img className="echange-qr" src={image} alt="QR code de notre composition" />
      <details>
        <summary>Ou recopier le code</summary>
        <textarea className="echange-code" readOnly value={code} rows={6} />
        <button className="btn btn-ghost btn-sm" onClick={() => void copier()}>
          {copie ? '✓ Copié' : '📋 Copier le code'}
        </button>
      </details>
    </>
  );
}

function Recevoir({
  onRecevoir,
  onClose,
}: {
  onRecevoir: (c: CompositionEchangee) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const boucle = useRef<number | null>(null);
  const [colle, setColle] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [camera, setCamera] = useState<'attente' | 'active' | 'refusee'>('attente');

  const appliquer = (texte: string): void => {
    const lu = decoderComposition(texte);
    if (!lu.ok) {
      setErreur(lu.raison);
      return;
    }
    onRecevoir(lu.composition);
    onClose();
  };

  useEffect(() => {
    let flux: MediaStream | null = null;
    let vivant = true;

    const demarrer = async (): Promise<void> => {
      try {
        flux = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (!vivant || !video.current) return;
        video.current.srcObject = flux;
        await video.current.play();
        setCamera('active');
        const tick = async (): Promise<void> => {
          const v = video.current;
          const c = canvas.current;
          if (!vivant) return;
          if (v && c && v.readyState === v.HAVE_ENOUGH_DATA) {
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
            const contenu = await decoderImageQr(c);
            if (contenu && vivant) {
              appliquer(contenu);
              return;
            }
          }
          boucle.current = requestAnimationFrame(() => void tick());
        };
        boucle.current = requestAnimationFrame(() => void tick());
      } catch {
        // Pas de caméra, ou refusée : le code recopié reste possible.
        setCamera('refusee');
      }
    };
    void demarrer();

    return () => {
      vivant = false;
      if (boucle.current !== null) cancelAnimationFrame(boucle.current);
      flux?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <p className="hint">
        Scannez le code affiché par l'autre club, ou collez-le ci-dessous. Sa composition remplira
        les lignes de l'équipe adverse.
      </p>
      {camera !== 'refusee' && (
        <div className="echange-camera">
          <video ref={video} playsInline muted />
          <canvas ref={canvas} hidden />
          {camera === 'attente' && <p className="hint">Ouverture de la caméra…</p>}
        </div>
      )}
      {camera === 'refusee' && (
        <p className="hint">
          Caméra indisponible — collez le code, il est fait pour être recopié.
        </p>
      )}
      <textarea
        className="echange-code"
        value={colle}
        onChange={(e) => {
          setColle(e.target.value);
          setErreur(null);
        }}
        rows={5}
        placeholder="PETANQUE-COMPO/1…"
      />
      {erreur && <p className="form-error">{erreur}</p>}
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Annuler
        </button>
        <button
          className="btn btn-primary"
          disabled={!colle.trim()}
          onClick={() => appliquer(colle)}
        >
          Lire le code
        </button>
      </div>
    </>
  );
}

/** Ce que l'application retient d'une composition reçue, et ce qu'elle en dit. */
export function appliquerComposition(
  feuille: FeuilleMatch,
  c: CompositionEchangee,
): { patch: Partial<FeuilleMatch>; message: string } {
  const gardes = c.joueurs.slice(0, LIGNES_FEUILLE);
  const adversaireJoueurs = Array.from({ length: LIGNES_FEUILLE }, (_, i) => ({
    nom: gardes[i]?.nom ?? '',
    licence: gardes[i]?.licence ?? '',
  }));
  const trop = c.joueurs.length - gardes.length;
  return {
    patch: {
      adversaire: c.club || feuille.adversaire,
      numeroClubAdverse: c.numeroClub || feuille.numeroClubAdverse,
      adversaireJoueurs,
    },
    message:
      `Composition de ${c.club || 'l\'adversaire'} reçue : ${gardes.length} joueur` +
      `${gardes.length > 1 ? 's' : ''}.` +
      (trop > 0
        ? ` ${trop} joueur${trop > 1 ? 's' : ''} en trop non repris : la feuille en compte ${LIGNES_FEUILLE}.`
        : ''),
  };
}
