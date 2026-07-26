declare module 'qrcode-generator' {
  interface QRCode {
    addData(data: string): void;
    make(): void;
    createSvgTag(opts?: { cellSize?: number; margin?: number; scalable?: boolean }): string;
  }
  type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
  function qrcode(typeNumber: number, errorCorrectionLevel: ErrorCorrectionLevel): QRCode;
  export default qrcode;
}
