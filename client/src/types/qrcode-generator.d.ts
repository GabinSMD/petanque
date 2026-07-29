declare module 'qrcode-generator' {
  interface QRCode {
    addData(data: string): void;
    make(): void;
    createSvgTag(opts?: { cellSize?: number; margin?: number; scalable?: boolean }): string;
    /** Image GIF encodée : évite d'injecter du balisage dans la page. */
    createDataURL(cellSize?: number, margin?: number): string;
  }
  type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
  function qrcode(typeNumber: number, errorCorrectionLevel: ErrorCorrectionLevel): QRCode;
  export default qrcode;
}
