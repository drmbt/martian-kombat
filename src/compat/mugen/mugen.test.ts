// MUGEN / IKEMEN GO format parsers + porter, on a tiny SYNTHETIC character
// written for this test (no third-party content in the repo). The real-world
// check is the committed KFM port (src/bench/parity.test.ts).
import { describe, expect, it } from 'vitest';
import { actionLength, elemStart, parseAir } from './air';
import { motionOf, parseCmd, parseCns, parseCommandString } from './cns';
import { parseCharDef, parseSff, parseStageDef } from './files';
import { parseIni, stripComment } from './ini';
import { portMugenChar, slideDistance } from './port';

const DEF = `; test fighter
[Info]
name = "Test Dummy" ; trailing comment
displayname = "Dummy"
author = "Martian Kombat"
localcoord = 320,240
[Files]
cmd = t.cmd
cns = t.cns
anim = t.air
`;

const CNS = `[Data]
life = 900
airjuggle = 15
[Size]
ground.back = 15
ground.front = 16
height = 60
[Velocity]
walk.fwd = 2.5
walk.back = -2
jump.neu = 0,-8
jump.fwd = 2.5
run.fwd = 4.6, 0
run.back = -4.5,-3.8
[Movement]
yaccel = .5
stand.friction = .85
stand.friction.threshold = 2

[Statedef 200]
type = S
movetype = A
physics = S
juggle = 1
anim = 200

[State 200, hit]
type = HitDef
trigger1 = AnimElem = 2
attr = S, NA
damage = 30, 3
guardflag = MA
pausetime = 8, 8
ground.slidetime = 6
ground.hittime = 12
ground.velocity = -4

[State 200, end]
type = ChangeState
trigger1 = AnimTime = 0
value = 0
ctrl = 1

[Statedef 1000]
type = S
movetype = A
physics = S
anim = 1000

[State 1000, invuln]
type = NotHitBy
trigger1 = Time = 0
value = SCA
time = 5

[State 1000, hit]
type = HitDef
trigger1 = Time = 0
damage = 90
guardflag = MA
pausetime = 12, 12
ground.slidetime = 10
ground.hittime = 20
ground.velocity = -3, -6
fall = 1
`;

const CMD = `[Defaults]
command.time = 15
command.buffer.time = 1

[Command]
name = "upper_x"
command = ~F, D, DF, x

[Command]
name = "QCF_xy"
command = ~D, DF, F, x+y

[Command]
name = "x"
command = x
time = 1

[Statedef -1]

[State -1, Super]
type = ChangeState
value = 3000
triggerall = command = "QCF_xy"
triggerall = power >= 1000
trigger1 = ctrl

[State -1, Light Rising Upper]
type = ChangeState
value = 1000
triggerall = command = "upper_x"
trigger1 = ctrl
trigger2 = stateno = 200
trigger2 = movecontact

[State -1, Stand Light Punch]
type = ChangeState
value = 200
triggerall = command = "x"
trigger1 = statetype = S
trigger1 = ctrl
`;

const AIR = `[Begin Action 0]
Clsn2Default: 1
 Clsn2[0] = -15, 0, 16, -90
0,0, 0,0, 10
0,1, 0,0, 10

[Begin Action 11]
Clsn2: 1
 Clsn2[0] = -15, 0, 16, -60
11,0, 0,0, -1

[Begin Action 40]
40,0, 0,0, 3

[Begin Action 47]
47,0, 0,0, 3

[Begin Action 200]
Clsn2Default: 1
 Clsn2[0] = -15, 0, 16, -90
200,0, 0,0, 3
Clsn1: 1
 Clsn1[0] = 10, -80, 60, -66
200,1, 0,0, 3
200,2, 0,0, 6

[Begin Action 1000]
1000,0, 0,0, 4
Clsn1: 1
 Clsn1[0] = 0, -120, 40, -40
1000,1, 0,0, 6
LoopStart
1000,2, 0,0, 20
`;

describe('ini tokenizer', () => {
  it('strips comments outside quotes and lowercases keys', () => {
    expect(stripComment('name = "a;b" ; c')).toBe('name = "a;b" ');
    const [info] = parseIni(DEF);
    expect(info.lname).toBe('info');
    expect(info.entries.find((e) => e.key === 'name')?.value).toBe('"Test Dummy"');
  });
});

describe('AIR', () => {
  const air = parseAir(AIR);
  it('applies ClsnDefault to every element and plain Clsn to the next one only', () => {
    const a = air.get(200)!;
    expect(a.elements).toHaveLength(3);
    expect(a.elements.map((e) => e.clsn1.length)).toEqual([0, 1, 0]);
    expect(a.elements.every((e) => e.clsn2.length === 1)).toBe(true);
    expect(a.elements[1].clsn1[0]).toEqual({ l: 10, t: -80, r: 60, b: -66 });
  });
  it('tracks element timing and LoopStart', () => {
    const a = air.get(1000)!;
    expect(elemStart(a, 2)).toBe(10);
    expect(actionLength(a)).toBe(30);
    expect(a.loopStart).toBe(2);
    expect(air.get(11)!.elements[0].time).toBe(-1);
  });
});

describe('CNS / CMD', () => {
  it('parses constants, statedefs and grouped triggers', () => {
    const c = parseCns(CNS);
    expect(c.constants.data.life).toBe('900');
    const sd = c.statedefs.get(200)!;
    expect(sd.params.anim).toBe('200');
    expect(sd.controllers.map((x) => x.type)).toEqual(['hitdef', 'changestate']);
    expect(sd.controllers[0].triggers[1]).toEqual(['AnimElem = 2']);
  });
  it('maps command strings onto our Motion vocabulary', () => {
    const m = (c: string): string | null => motionOf(parseCommandString(c)).motion;
    expect(m('~D, DF, F, x')).toBe('qcf');
    expect(m('~D, DB, B, y')).toBe('qcb');
    expect(m('~F, D, DF, x')).toBe('dp');
    expect(m('~30$B, F, x')).toBe('cbf');
    expect(m('F, F, a')).toBe('ff');
    expect(m('x')).toBe('');
    expect(parseCommandString('~D, DF, F, x+y').at(-1)!.buttons).toEqual(['x', 'y']);
    const cmd = parseCmd(CMD);
    expect(cmd.defaults).toEqual({ time: 15, bufferTime: 1 });
    expect(cmd.commands.map((c) => c.name)).toEqual(['upper_x', 'QCF_xy', 'x']);
    expect(cmd.states.get(-1)!.controllers).toHaveLength(3);
  });
});

describe('DEF / stage / SFF', () => {
  it('reads the character DEF', () => {
    const d = parseCharDef(DEF);
    expect(d).toMatchObject({ name: 'Test Dummy', displayName: 'Dummy', localcoord: [320, 240] });
    expect(d.ikemenVersion).toBeUndefined();
    expect(d.files.cns).toBe('t.cns');
  });
  it('reads stage camera bounds and the floor line', () => {
    const st = parseStageDef(`[Camera]\nboundleft = -150\nboundright = 150\n[PlayerInfo]\np1startx = -70\np2startx = 70\n[Bound]\nscreenleft = 15\n[StageInfo]\nzoffset = 200\nlocalcoord = 320, 240\n[BG 1]\ntype = normal\n`);
    expect(st).toMatchObject({ boundLeft: -150, boundRight: 150, p1StartX: -70, zoffset: 200, bgLayers: 1 });
  });
  it('reads an SFF v2 header + sprite directory', () => {
    const buf = new Uint8Array(512 + 28);
    buf.set(new TextEncoder().encode('ElecbyteSpr\0'), 0);
    buf.set([0, 1, 0, 2], 12);
    const dv = new DataView(buf.buffer);
    dv.setUint32(36, 512, true); // sprite list offset
    dv.setUint32(40, 1, true); // sprite count
    dv.setUint32(48, 16, true); // palette count
    dv.setUint16(512, 9000, true); // group
    dv.setUint16(516, 64, true); // width
    buf[512 + 14] = 4; // LZ5
    const s = parseSff(buf);
    expect(s).toMatchObject({ version: '2.010', spriteCount: 1, paletteCount: 16 });
    expect(s.sprites[0]).toMatchObject({ group: 9000, width: 64, format: 4 });
  });
});

describe('porter', () => {
  const r = portMugenChar({ def: DEF, cns: [CNS], cmd: CMD, air: AIR }, { targetHeight: 270 });

  it('scales by standing Clsn2 height and maps physics', () => {
    expect(r.ref.standHeight).toBe(90);
    expect(r.scale).toBe(3);
    expect(r.def.health).toBe(900);
    expect(r.def.walkSpeed).toBe(7.5);
    expect(r.def.hurtStand).toEqual({ x: -45, y: -270, w: 93, h: 270 });
    expect(r.ref.physics.prejump).toBe(3);
  });

  it('computes MUGEN-semantics frame data for a normal', () => {
    const lp = r.ref.moves.find((m) => m.id === 'lp')!;
    // Clsn1 element starts at tick 3 → SF startup 4; anim length 12
    expect(lp).toMatchObject({ startup: 4, active: 3, total: 12, damage: 30, chip: 3, hitstop: [8, 8] });
    // MUGEN-era char: guard.hittime defaults to ground.SLIDETIME (6)
    expect(lp.blockstun).toBe(6);
    expect(lp.onHit).toBe(3 + 8 + 12 - (12 + 8)); // +3
    expect(lp.onBlock).toBe(3 + 8 + 6 - (12 + 8)); // −3
    expect(lp.pushHit).toBeCloseTo(slideDistance(4, 6, 0.85, 2));
    expect(r.def.moves.lp.hitbox).toEqual({ x: 30, y: -240, w: 150, h: 42 });
  });

  it('ports a motion special with its invulnerability and cancel source', () => {
    const up = r.def.moves['rising-upper'];
    expect(up.input).toEqual({ motion: 'dp', button: 'punch' });
    expect(up.invuln).toBe(5);
    expect(up.knockdown).toBe(true);
    expect(r.def.moves.lp.cancel).toBe(true); // stateno = 200 + movecontact
  });

  it('reports what it could not map', () => {
    expect(r.report.unsupported.join('\n')).toMatch(/power ≥ 1000/);
    expect(r.ref.standardAnims.missing).toContain(5000);
  });
});
