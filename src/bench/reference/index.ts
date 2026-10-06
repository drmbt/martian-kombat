// Committed benchmark references: characters ported from other engines by
// tools/fg/import-mugen.ts. `*.port.json` is a CharacterDef our engine runs;
// `*.ref.json` is the source's home-engine frame data (MUGEN/IKEMEN
// semantics). Numbers are measured facts about the source character; the
// source files themselves stay in the gitignored assets/raw/mugen/.
//
// Reference fighters are bench fixtures first. Since 2026-10-06 (user
// decision) KFM also ships as a SECRET roster entry with his real sprites —
// a generated copy in src/data/characters/kfm.json (npm run mugen:sprites),
// pinned to this port by parity.test.ts. KFM is CC BY-NC (Elecbyte): the
// game must stay non-commercial while he ships.
import type { CharacterDef } from '../../engine';
import type { RefTable } from '../../compat/mugen/port';
import kfmPort from './kfm.port.json';
import kfmRef from './kfm.ref.json';

export interface BenchReference {
  def: CharacterDef;
  ref: RefTable;
}

const strip = <T extends object>(o: T): T => {
  const { _source, ...rest } = o as T & { _source?: string };
  void _source;
  return rest as T;
};

export const REFERENCES: Record<string, BenchReference> = {
  kfm: { def: strip(kfmPort as unknown as CharacterDef), ref: strip(kfmRef as unknown as RefTable) },
};
