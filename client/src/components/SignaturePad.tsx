import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Signature déjà recueillie (image encodée), ou vide. */
  valeur: string;
  onSigner: (image: string) => void;
  /** Nom du signataire, affiché sous le tracé. */
  qui: string;
  /** Horodatage de la signature, une fois posée. */
  quand?: string;
  /** Empêche de signer, avec la raison. */
  empeche?: string;
}

const LARGEUR = 320;
const HAUTEUR = 110;

/**
 * Recueil d'une signature au doigt ou à la souris.
 *
 * Une signature n'est pas une décoration : sur une feuille de match, elle vaut
 * acceptation du résultat. Le pavé ne s'affiche donc que tant que la feuille est
 * signable ; une fois signée, on montre le tracé, pas le pavé — on ne repasse
 * pas par-dessus une signature.
 */
export function SignaturePad({ valeur, onSigner, qui, quand, empeche }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [trace, setTrace] = useState(false);
  const dessine = useRef(false);

  // Le canevas est dimensionné à la densité de l'écran, sinon le tracé bave.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ratio = window.devicePixelRatio || 1;
    el.width = LARGEUR * ratio;
    el.height = HAUTEUR * ratio;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#16203a';
  }, [valeur]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const commencer = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dessine.current = true;
    const [x, y] = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const tracer = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!dessine.current) return;
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const [x, y] = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setTrace(true);
  };

  const arreter = (): void => {
    dessine.current = false;
  };

  const effacerTrace = (): void => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    ctx.clearRect(0, 0, el.width, el.height);
    setTrace(false);
  };

  const valider = (): void => {
    const el = canvas.current;
    if (!el || !trace) return;
    onSigner(el.toDataURL('image/png'));
  };

  if (valeur) {
    return (
      <div className="signature-bloc">
        <img className="signature-trace" src={valeur} alt={`Signature de ${qui}`} />
        <p className="signature-qui">
          {qui}
          {quand && <span className="hint"> — signé le {quand}</span>}
        </p>
      </div>
    );
  }

  return (
    <div className="signature-bloc no-print">
      {empeche ? (
        <p className="form-error signature-empeche">{empeche}</p>
      ) : (
        <>
          <canvas
            ref={canvas}
            className="signature-canvas"
            style={{ width: LARGEUR, height: HAUTEUR }}
            onPointerDown={commencer}
            onPointerMove={tracer}
            onPointerUp={arreter}
            onPointerLeave={arreter}
          />
          <div className="signature-actions">
            <button className="btn btn-ghost btn-sm" onClick={effacerTrace} disabled={!trace}>
              Recommencer
            </button>
            <button className="btn btn-primary btn-sm" onClick={valider} disabled={!trace}>
              ✍ Valider la signature de {qui || '…'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
