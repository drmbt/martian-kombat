// Character registry. Characters are pure data — adding one means adding a
// JSON file here and registering it, never touching engine code.
// (JSON imports widen string literals, hence the cast; runtime schema
// validation is an Icebox item.)
import type { CharacterDef, Defs } from '../../engine';
import vincent from './vincent.json';
import yulia from './yulia.json';

export const characters: Defs = {
  vincent: vincent as unknown as CharacterDef,
  yulia: yulia as unknown as CharacterDef,
};
