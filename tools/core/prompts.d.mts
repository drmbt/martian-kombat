// Type declarations so browser TS (src/ui/creatorModel.ts) can import the
// shared prompt library. Keep in sync with prompts.mjs.
export const STYLE_ART: string;
export const CHROMA_BG: string;
export const FRAME_RULES: string;
export function spritePrompt(pose: string, always?: string): string;
export function canonicalFromPhoto(flavor?: string): string;
export function canonicalFromDescription(desc: string): string;
export function portraitPrompt(name: string, desc?: string): string;
export function defeatPrompt(): string;
export function defeatPromptSoft(): string;
export function fatalityBeats(name: string, fatalityName: string): string[];
