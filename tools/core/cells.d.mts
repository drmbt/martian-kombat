// Type declarations so browser TS (src/ui/creatorModel.ts) can import the
// shared cell contract. Keep in sync with cells.mjs.
export const CELL_W: number;
export const CELL_H: number;
export const COLS: number;
export const ROWS: number;
export const LOW: string;
export const LYING: string;
export const CELLS: { id: string; pose: string }[];
export const MOVES: string[];
export const V2_BUTTONS: string[];
export function buildJobs(spec: unknown): { id: string; pose: string }[];
export function gridFor(spec: unknown): { cols: number; rows: number };
