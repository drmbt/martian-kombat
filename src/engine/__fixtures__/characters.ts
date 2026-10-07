// FROZEN character data for engine tests (P3.0). The engine tests used to read
// the LIVE roster JSON, so a Move Tuner / Studio write to e.g. vincent.json
// silently changed what the engine tests covered (or broke them for a balance
// edit). These are copies taken 2026-10-07; they never change with the roster.
// Live-roster coverage lives in a separate smoke test (engine.roster.test.ts)
// and in the bench ratchet (src/bench/balance.audit.test.ts).
//
// Loaded through the same applyScale() path as src/data/characters, so a
// fixture behaves exactly like the shipped fighter did when it was frozen.
import type { CharacterDef, Defs } from '../index';
import { applyScale } from '../../data/characterScale';
import cat from './cat.json';
import catherine from './catherine.json';
import chebel from './chebel.json';
import flo from './flo.json';
import freeman from './freeman.json';
import gene from './gene.json';
import kirby from './kirby.json';
import marzipan from './marzipan.json';
import vincent from './vincent.json';
import yulia from './yulia.json';

const load = (def: unknown): CharacterDef => applyScale(def as CharacterDef);

export const characters: Defs = {
  cat: load(cat),
  catherine: load(catherine),
  chebel: load(chebel),
  flo: load(flo),
  freeman: load(freeman),
  gene: load(gene),
  kirby: load(kirby),
  marzipan: load(marzipan),
  vincent: load(vincent),
  yulia: load(yulia),
};
