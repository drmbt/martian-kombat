// Named CPU difficulty — just labels for the CpuDriver `aggression` dial so
// the tuner, arcade mode (later), and attract-mode demo can all speak the
// same three levels instead of picking floats by hand.
export type Difficulty = 'low' | 'medium' | 'high';

export const DIFFICULTY_AGGRESSION: Record<Difficulty, number> = {
  low: 0.5,
  medium: 1,
  high: 1.7,
};

export const DIFFICULTIES: Difficulty[] = ['low', 'medium', 'high'];
