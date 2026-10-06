// Type declarations for the raw-sync helpers. Keep in sync with raw-sync.mjs.
export interface RawEntry {
  path: string;
  bytes: number;
  sha256: string;
}

export interface RawManifest {
  version: 1;
  bucket: string;
  prefix: string;
  generatedAt: string;
  sourceHost: string;
  ignored: RawEntry[];
  trackedMirrored: { files: number; bytes: number };
  snapshots: string[];
}

export interface VerifyResult {
  ok: number;
  missing: string[];
  mismatched: string[];
  skipped: string[];
}

export const ROOT: string;
export const MANIFEST_PATH: string;
export const DEFAULT_BUCKET: string;
export const PREFIX: string;
export const REMOTE: string;
export const JOBS_PREFIX: string;
export const R2_ENV_NAMES: string[];

export function isJunk(path: string): boolean;
export function selectIgnored(paths: string[]): string[];
export function selectTracked(paths: string[]): string[];
export function categoryOf(path: string): string;
export function summarize(entries: { path: string; bytes: number }[]): Record<string, { files: number; bytes: number }>;
export function buildManifest(opts: {
  ignored: RawEntry[];
  trackedMirrored?: { files: number; bytes: number };
  snapshots?: string[];
  bucket?: string;
  generatedAt: string;
  sourceHost: string;
}): RawManifest;
export function serializeManifest(m: RawManifest): string;
export function parseEnv(text: string): Record<string, string>;
export function loadRawEnv(root?: string, env?: Record<string, string | undefined>): Record<string, string>;
export function rcloneEnv(env: Record<string, string | undefined>): Record<string, string>;
export function sha256File(abs: string): Promise<string>;
export function hashEntries(root: string, paths: string[], concurrency?: number): Promise<RawEntry[]>;
export function verifyEntries(root: string, entries: RawEntry[], opts?: { includeJobs?: boolean }): Promise<VerifyResult>;
