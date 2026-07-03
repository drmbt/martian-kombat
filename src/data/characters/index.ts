// Character registry. Characters are pure data — adding one means adding a
// JSON file here and registering it, never touching engine code.
// (JSON imports widen string literals, hence the cast; runtime schema
// validation is an Icebox item.)
import type { CharacterDef, Defs } from '../../engine';
import vincent from './vincent.json';
import yulia from './yulia.json';
import catherine from './catherine.json';
import kirby from './kirby.json';
import flo from './flo.json';
import freeman from './freeman.json';
import marzipan from './marzipan.json';
import gene from './gene.json';

export const characters: Defs = {
  vincent: vincent as unknown as CharacterDef,
  yulia: yulia as unknown as CharacterDef,
  catherine: catherine as unknown as CharacterDef,
  kirby: kirby as unknown as CharacterDef,
  flo: flo as unknown as CharacterDef,
  freeman: freeman as unknown as CharacterDef,
  marzipan: marzipan as unknown as CharacterDef,
  gene: gene as unknown as CharacterDef,
};
