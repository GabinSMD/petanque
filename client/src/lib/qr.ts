/**
 * Décodage d'un QR code depuis une image de caméra.
 *
 * `BarcodeDetector` quand le navigateur l'offre (Chrome, Android) ; sinon jsQR,
 * embarqué dans l'application et chargé seulement au moment du repli — il pèse
 * lourd, et un navigateur sur trois n'en a pas besoin.
 *
 * Le lecteur de licences (`LicenceScanModal`) garde pour l'instant sa propre
 * copie de cette boucle : elle ne se vérifie qu'avec une vraie caméra, et je ne
 * refais pas à l'aveugle un code qui fonctionne. À réunir dans un lot où la
 * caméra peut être éprouvée.
 */

type Detecteur = { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };

let jsQr: typeof import('jsqr').default | null = null;
let detecteur: Detecteur | null | undefined;

function obtenirDetecteur(): Detecteur | null {
  if (detecteur !== undefined) return detecteur;
  const Detector = (
    window as unknown as {
      BarcodeDetector?: new (o: { formats: string[] }) => Detecteur;
    }
  ).BarcodeDetector;
  detecteur = Detector ? new Detector({ formats: ['qr_code'] }) : null;
  return detecteur;
}

/**
 * Cherche un QR dans l'image du canevas. Rend son contenu, ou `null` si l'image
 * n'en porte pas — ce qui est le cas le plus fréquent, une image sur deux
 * pendant qu'on cadre.
 */
export async function decoderImageQr(canvas: HTMLCanvasElement): Promise<string | null> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    const natif = obtenirDetecteur();
    if (natif) {
      const codes = await natif.detect(canvas);
      return codes[0]?.rawValue ?? null;
    }
    if (!jsQr) jsQr = (await import('jsqr')).default;
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQr(image.data, image.width, image.height)?.data ?? null;
  } catch {
    // Image illisible : on tentera la suivante.
    return null;
  }
}
