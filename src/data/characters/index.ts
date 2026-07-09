// Character registry. Characters are pure data — adding one means adding a
// JSON file here and registering it, never touching engine code.
// (JSON imports widen string literals, hence the cast; runtime schema
// validation is an Icebox item.)
import type { CharacterDef, Defs } from '../../engine';
import { applyScale } from '../characterScale';
import vincent from './vincent.json';
import yulia from './yulia.json';
import catherine from './catherine.json';
import kirby from './kirby.json';
import flo from './flo.json';
import freeman from './freeman.json';
import marzipan from './marzipan.json';
import gene from './gene.json';
import bodhi from './bodhi.json';
import cat from './cat.json';
import chebel from './chebel.json';
import ygor from './ygor.json';
import rapha from './rapha.json';
import vanessa from './vanessa.json';
import ben from './ben.json';
import earl from './earl.json';
import tao from './tao.json';

// Bake each character's optional `scale` into its geometry at load (see
// src/data/characterScale.ts — the same math the dev editor re-applies live).
const load = (def: unknown): CharacterDef => applyScale(def as CharacterDef);

export const characters: Defs = {
  vincent: load(vincent),
  yulia: load(yulia),
  catherine: load(catherine),
  kirby: load(kirby),
  flo: load(flo),
  freeman: load(freeman),
  marzipan: load(marzipan),
  gene: load(gene),
  bodhi: load(bodhi),
  cat: load(cat),
  chebel: load(chebel),
  ygor: load(ygor),
  rapha: load(rapha),
  vanessa: load(vanessa),
  'earl': load(earl),
  'ben': load(ben),
  'tao': load(tao), // THE END BOSS (arcade M. Bison analog)
};
