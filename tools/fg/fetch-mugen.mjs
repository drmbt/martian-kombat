// npm run mugen:fetch [-- --force]
//
// Downloads the benchmark reference content into the GITIGNORED
// assets/raw/mugen/ — never into the repo. Default set: Kung Fu Man (MUGEN's
// sample character, Elecbyte, CC BY-NC — attribution optional, non-commercial)
// and his two stages, from the IKEMEN GO screenpack repo, plus IKEMEN GO's
// common state/constant files (MIT) for semantics reference.
//
// Idempotent: existing files are skipped (--force re-downloads). Add more
// references by extending SETS; then `npm run mugen:import -- --def <path>`.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SCREENPACK = 'https://raw.githubusercontent.com/ikemen-engine/Ikemen-GO-Screenpack/master';
const ENGINE = 'https://raw.githubusercontent.com/ikemen-engine/Ikemen-GO/master';
const OUT = 'assets/raw/mugen';

const SETS = {
  kfm: {
    base: `${SCREENPACK}/chars/kfm`,
    dir: 'chars/kfm',
    files: ['kfm.def', 'kfm.cns', 'kfm.cmd', 'kfm.air', 'kfm.sff', 'kfm.snd', 'readme.txt', 'movelist.dat'],
  },
  kfm720: {
    base: `${SCREENPACK}/chars/kfm720`,
    dir: 'chars/kfm720',
    files: ['kfm720.def', 'kfm720.cns', 'kfm720.cmd', 'kfm720.air', 'kfm720.sff', 'readme.txt'],
  },
  stages: {
    base: `${SCREENPACK}/stages`,
    dir: 'stages',
    files: ['kfm.def', 'kfm.sff', 'stage0.def', 'stage0.sff', 'stage0-720.def'],
  },
  ikemen: {
    base: `${ENGINE}/data`,
    dir: 'ikemen-data',
    files: ['common.const', 'common1.cns.zss', 'common.cmd', 'dizzy.zss', 'guardbreak.zss', 'training.zss'],
  },
};

const force = process.argv.includes('--force');
const only = process.argv.find((a) => a.startsWith('--set='))?.slice(6);

let got = 0;
let skipped = 0;
for (const [name, set] of Object.entries(SETS)) {
  if (only && only !== name) continue;
  for (const f of set.files) {
    const dest = join(OUT, set.dir, f);
    if (existsSync(dest) && !force) {
      skipped++;
      continue;
    }
    const res = await fetch(`${set.base}/${f}`);
    if (!res.ok) {
      console.warn(`  ✗ ${set.dir}/${f}: HTTP ${res.status}`);
      continue;
    }
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    got++;
    console.log(`  ✓ ${dest}`);
  }
}
console.log(`mugen:fetch — ${got} downloaded, ${skipped} already present → ${OUT}/ (gitignored)`);
console.log('next: npm run mugen:import -- --def assets/raw/mugen/chars/kfm/kfm.def --id kfm --fit');
