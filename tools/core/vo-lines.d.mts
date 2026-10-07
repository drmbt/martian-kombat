export const SFX_MARK: '(SFX)';
export type VoCategory = 'kiai' | 'hurt' | 'victory' | 'move';
export const RECORDED: Record<string, Partial<Record<VoCategory, true | string[]>>>;
export function isRecorded(id: string, category: VoCategory, moveId?: string): boolean;
export function playableIds(): string[];
export function readCharacter(id: string): Record<string, any>;
export interface FighterVo {
  kiai: string[];
  hurt: string[];
  victory: string[];
  moves: Record<string, string>;
}
export function fighterVo(id: string, def?: Record<string, any>): FighterVo;
