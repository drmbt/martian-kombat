// Type declarations for the dependency-free PNG codec (png.mjs). Keep in sync.
export interface RgbaImage { width: number; height: number; data: Uint8Array }
export function decodePng(buf: Uint8Array): RgbaImage;
export function encodePng(img: RgbaImage): Buffer;
export function zeroTransparentRgb(img: RgbaImage): number;
export function assertVisiblyIdentical(a: RgbaImage, b: RgbaImage, label?: string): void;
export function regrid(img: RgbaImage, cellW: number, cellH: number, cols: number, newCols: number, nCells?: number): { img: RgbaImage; rows: number };
export function cleanSheetFile(buf: Uint8Array, label?: string): { out: Buffer; changed: number };
export function cleanPngBuffer(buf: Buffer): Buffer;
