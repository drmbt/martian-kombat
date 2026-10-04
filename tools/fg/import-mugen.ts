// npm run mugen:import -- --def assets/raw/mugen/chars/kfm/kfm.def [--id kfm]
//                         [--height 284] [--out src/bench/reference] [--fit]
//
// Ports a MUGEN / IKEMEN GO character (DEF + CNS + CMD + AIR [+ SFF header])
// into src/bench/reference/<id>.port.json (a CharacterDef our engine runs)
// and <id>.ref.json (its home-engine frame data, MUGEN/IKEMEN semantics),
// then prints the lossy-mapping report. --fit closes the port's timing gap
// against the reference by measuring it in OUR engine (src/bench/parity.ts).
//
// Source files are third-party (KFM: Elecbyte, CC BY-NC) and stay in the
// gitignored assets/raw/mugen/ (npm run mugen:fetch). Only the derived
// numeric tables are committed, with attribution.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { portMugenChar } from '../../src/compat/mugen/port';
import { parseCharDef } from '../../src/compat/mugen/files';
import { fitPort, parityReport, formatParity } from '../../src/bench/parity';

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name: string): boolean => args.includes(`--${name}`);

const defPath = opt('def');
if (!defPath || !existsSync(defPath)) {
  console.error('usage: npm run mugen:import -- --def <path/to/char.def> [--id x] [--height 284] [--out dir] [--fit]');
  console.error('       (fetch the reference first: npm run mugen:fetch)');
  process.exit(1);
}
const dir = dirname(resolve(defPath));
const read = (f: string): string => readFileSync(join(dir, f), 'latin1');
const defText = readFileSync(defPath, 'latin1');
const charDef = parseCharDef(defText);
const files = charDef.files;
// cns = constants, st/st0..st9 = state files (often the same file)
const cnsFiles = [files.cns, files.st, ...Array.from({ length: 10 }, (_, i) => files[`st${i}`])]
  .filter((f): f is string => !!f)
  .filter((f, i, a) => a.indexOf(f) === i)
  .filter((f) => existsSync(join(dir, f)));
const sffPath = files.sprite ? join(dir, files.sprite) : '';
const readme = existsSync(join(dir, 'readme.txt')) ? read('readme.txt') : '';
const license = /creative commons noncommercial/i.test(readme)
  ? 'CC BY-NC (Creative Commons Noncommercial) — see source readme'
  : 'see source readme';

const result = portMugenChar(
  {
    def: defText,
    cns: cnsFiles.map(read),
    cmd: files.cmd ? read(files.cmd) : '',
    air: files.anim ? read(files.anim) : '',
    sff: sffPath && existsSync(sffPath) ? new Uint8Array(readFileSync(sffPath)) : undefined,
  },
  { id: opt('id'), targetHeight: opt('height') ? Number(opt('height')) : undefined, license },
);

let def = result.def;
if (flag('fit')) {
  const fitted = fitPort(def, result.ref);
  def = fitted.def;
  for (const line of fitted.log) console.log(`  fit: ${line}`);
}

const outDir = opt('out') ?? 'src/bench/reference';
mkdirSync(outDir, { recursive: true });
const header = {
  _source: `${result.ref.name} by ${result.ref.author} — ${result.ref.license}. Ported by tools/fg/import-mugen.ts; numbers are measured facts about the source character. Do not hand-edit: re-run npm run mugen:import.`,
};
writeFileSync(join(outDir, `${def.id}.port.json`), `${JSON.stringify({ ...header, ...def }, null, 2)}\n`);
writeFileSync(join(outDir, `${def.id}.ref.json`), `${JSON.stringify({ ...header, ...result.ref }, null, 2)}\n`);

console.log(`\nported ${result.ref.name} (${result.ref.engine}, localcoord ${result.ref.localcoord.join('x')}) → ${def.id}`);
console.log(`scale ×${result.scale.toFixed(3)} (stand height ${result.ref.standHeight}px → ${def.hurtStand.h}px)`);
console.log(`wrote ${join(outDir, `${def.id}.port.json`)} + .ref.json\n`);
console.log(`MAPPED (${result.report.mapped.length})`);
for (const l of result.report.mapped) console.log(`  ✓ ${l}`);
console.log(`\nLOSSY (${result.report.lossy.length}) — engine-parity backlog`);
for (const l of result.report.lossy) console.log(`  ~ ${l}`);
console.log(`\nUNSUPPORTED (${result.report.unsupported.length})`);
for (const l of result.report.unsupported) console.log(`  ✗ ${l}`);
const sa = result.ref.standardAnims;
console.log(`\nstandard anims: ${sa.present.length} present, missing required: ${sa.missing.join(', ') || 'none'}`);
if (result.ref.sprites) console.log(`sprites: ${result.ref.sprites.count} (SFF v${result.ref.sprites.version}, ${result.ref.sprites.palettes} palettes)`);
console.log('');
console.log(formatParity(parityReport(def, result.ref)));
