type Cat = 'kiai' | 'hurt' | 'victory' | 'move';
export const DEFAULT_BY_CATEGORY: Record<Cat, string>;
export const TEMPERAMENT: Record<string, Partial<Record<Cat, string>>>;
export const LINE_TAGS: Record<string, Partial<Record<Cat, Record<string, string>>>>;
export function emotionTag(charId: string, category: string): string;
export function withEmotion(charId: string, category: string, text: string): string;
