export function isLoopbackHost(host: unknown): boolean;
export function isLoopbackOrigin(origin: unknown): boolean;
export type GuardResult = { ok: true } | { ok: false; status: 403 | 415; error: string };
export function checkEditorRequest(method: string | undefined, headers?: Record<string, string | string[] | undefined>): GuardResult;
export const SAFE_ID: RegExp;
export const SAFE_FILE: RegExp;
export function tsString(s: unknown): string;
export function importPathAllowed(rel: string, id: string, stageId?: string, stageExists?: boolean): boolean;
