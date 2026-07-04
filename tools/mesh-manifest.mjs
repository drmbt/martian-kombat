// Per-character 3D mesh + animation-clip sources for gen-mesh.mjs.
// Contract clip names (keys) come from src/renderer3d/clipContract.json plus
// per-move `attack/<moveId>` entries; values are source FBX FILENAMES matched
// case-insensitively against the canonical public/assets/animations/ library
// (one Mixamo skeleton fits all rigs), searched recursively so category/pack
// subfolders resolve with no extra wiring — overridable per character via
// public/assets/meshes/<char>/animations/.
//
// `stripY: true` on a clip also flattens the hips' vertical travel (the engine
// owns jump arcs — SPEC V6); horizontal root motion is always stripped.

// Clips every character shares regardless of fighting style: locomotion,
// reactions, gestures, and the generic attack fallbacks. The six attack NORMALS
// (lp/mp/hp/lk/mk/hk) are NOT here — they come from the character's ARCHETYPE
// below, so how a fighter punches/kicks is a fixed, tunable property of its
// style rather than a per-character copy-paste. `#N` variant keys stay: the 3D
// renderer picks them deterministically (punches alternate L/R by instance
// counter; reactions/taunts shuffle by tick-hash) — never at random.
const SHARED_CLIPS = {
  idle: { file: 'Fight Idle.fbx' },
  'walk-forward': { file: 'Standing Walk Forward.fbx' },
  'walk-back': { file: 'Standing Walk Back.fbx' },
  'dash-forward': { file: 'Short Step Forward.fbx' },
  'dash-forward#2': { file: 'Medium Step Forward.fbx' },
  'dash-back': { file: 'Drunk Walk Backwards.fbx' },
  crouch: { file: 'Crouch Idle.fbx' },
  prejump: { file: 'Jumping Up.fbx', stripY: true }, // same clip as jump: anticipation flows into takeoff
  jump: { file: 'Jumping Up.fbx', stripY: true },
  fall: { file: 'Falling Idle.fbx' },
  landing: { file: 'Standing Land To Standing Idle.fbx', stripY: true },
  getup: { file: 'cover to stand.fbx' },
  hit: { file: 'Head Hit.fbx' },
  'hit#2': { file: 'Head Hit (2).fbx' },
  'hit#3': { file: 'Head Hit (3).fbx' },
  'hit-front': { file: 'Standing React Small From Front.fbx' },
  'hit-front#2': { file: 'Light Hit To Head.fbx' },
  'hit-back': { file: 'Standing React Small From Back.fbx' },
  'hit-front-heavy': { file: 'Standing React Large From Front.fbx' },
  'hit-front-heavy#2': { file: 'Receive Uppercut To The Face.fbx' },
  'hit-front-heavy#3': { file: 'Receiving A Big Uppercut.fbx' },
  'hit-back-heavy': { file: 'Standing React Large From Back.fbx' },
  'hit-air': { file: 'Flying Back Death.fbx' }, // launched: fly back, land on back
  'hit-body': { file: 'Big Stomach Hit.fbx' },
  'hit-body#2': { file: 'Rib Hit.fbx' },
  'hit-body#3': { file: 'Hit To Body.fbx' },
  'hit-body-heavy': { file: 'Livershot Knockdown.fbx' },
  'block-stand': { file: 'Standing Block Idle.fbx' },
  knockdown: { file: 'Fallen Idle.fbx' },
  ko: { file: 'Standing React Death Backward.fbx' },
  'ko-forward': { file: 'Standing React Death Forward.fbx' },
  dazed: { file: 'Stunned.fbx' },
  win: { file: 'Victory.fbx' },
  intro: { file: 'Charge.fbx' },
  'intro#2': { file: 'Yawn.fbx' },
  'intro#3': { file: 'Whatever Gesture.fbx' },
  taunt: { file: 'Whatever Gesture.fbx' },
  'taunt#2': { file: 'Yawn.fbx' },
  'taunt#3': { file: 'Charge.fbx' },
  // dance clips (attract / Thriller formation scene) — no engine action maps to
  // these; scenes drive them directly by name. `keepRoot` preserves the clip's
  // full root travel (both horizontal axes + object transform) so the dance can
  // roam the floor — fight clips still strip it (the engine owns translation).
  'dance-thriller-1': { file: 'Thriller Part 2.fbx', keepRoot: true },
  'dance-thriller-2': { file: 'Thriller Part 3.fbx', keepRoot: true },
  'dance-thriller-3': { file: 'Thriller Part 4.fbx', keepRoot: true },
  'dance-hiphop': { file: 'Hip Hop Dancing.fbx', keepRoot: true },
  'dance-twist': { file: 'Twist Dance.fbx', keepRoot: true },
  'dance-wave': { file: 'Wave Hip Hop Dance.fbx', keepRoot: true },
  'attack-generic': { file: 'Punching.fbx' },
  'attack-air': { file: 'Flying Bicycle Kick.fbx', stripY: true },
  'attack-air#2': { file: 'Mutant Jump Attack.fbx', stripY: true },
  'attack/throw': { file: 'Illegal Headbutt.fbx' },
};

// Animation ARCHETYPES: a fixed six-button normals kit that defines HOW a style
// throws lp/mp/hp/lk/mk/hk. A character picks ONE archetype (see MESHES) and
// inherits its normals; named specials stay per-character. Add/tune archetypes
// freely — assignments are placeholder-but-thematic for now (mesh regen with
// `gen:mesh --char <id> --force` bakes a changed kit). Punch `#2` = the "other
// hand" the L/R alternation cycles into.
const ARCHETYPES = {
  // dirty-boxer: MMA striker — jab/hook/elbow up top, knee + MMA kicks below
  // (this kit == the pre-archetype BASE_CLIPS normals, so it bakes unchanged).
  'dirty-boxer': {
    'attack/lp': { file: 'Lead Jab.fbx' },
    'attack/lp#2': { file: 'Lead Jab (2).fbx' },
    'attack/lp#3': { file: 'Lead Jab (3).fbx' },
    'attack/mp': { file: 'Hook.fbx' },
    'attack/mp#2': { file: 'Jab Cross.fbx' },
    'attack/hp': { file: 'Illegal Elbow Punch.fbx' },
    'attack/hp#2': { file: 'Body Jab Cross.fbx' },
    'attack/lk': { file: 'Illegal Knee.fbx' },
    'attack/lk#2': { file: 'Mma Kick (1).fbx' },
    'attack/mk': { file: 'Mma Kick.fbx' },
    'attack/mk#2': { file: 'Mma Kick (2).fbx' },
    'attack/hk': { file: 'Roundhouse Kick.fbx' },
    'attack/hk#2': { file: 'Inside Crescent Kick.fbx' },
  },
  // tai-chi: circular, flowing hands (hook punch, rising uppercut) + crescent
  'tai-chi': {
    'attack/lp': { file: 'Lead Jab.fbx' },
    'attack/lp#2': { file: 'Jab Cross.fbx' },
    'attack/mp': { file: 'Hook Punch.fbx' },
    'attack/hp': { file: 'Uppercut.fbx', stripY: true },
    'attack/lk': { file: 'Illegal Knee.fbx' },
    'attack/mk': { file: 'Inside Crescent Kick.fbx' },
    'attack/hk': { file: 'Roundhouse Kick.fbx' },
  },
  // acrobat: spinning, aerial legwork — hurricane + crescent kicks lead
  acrobat: {
    'attack/lp': { file: 'Lead Jab.fbx' },
    'attack/lp#2': { file: 'Jab Cross.fbx' },
    'attack/mp': { file: 'Hook.fbx' },
    'attack/hp': { file: 'Body Jab Cross.fbx' },
    'attack/lk': { file: 'Illegal Knee.fbx' },
    'attack/mk': { file: 'Hurricane Kick.fbx', stripY: true },
    'attack/mk#2': { file: 'Hurricane Kick (1).fbx', stripY: true },
    'attack/hk': { file: 'Inside Crescent Kick.fbx' },
  },
};

// A character's full base kit = shared clips + its archetype's normals.
const kit = (archetype) => ({ ...SHARED_CLIPS, ...ARCHETYPES[archetype] });

export const MESHES = {
  vincent: {
    rig: 'vincent-20k-tripo-mixamo-base-rig.fbx',
    basecolor: 'vince-20k-tripo-unrigged/stylized+human+character+3d+model_basecolor.jpg',
    archetype: 'tai-chi',
    clips: {
      ...kit('tai-chi'),
      'attack/sigil-bolt': { file: 'Standing 1H Magic Attack 01.fbx' },
      'attack/cloud-hands': { file: 'Standing 2H Magic Attack 01.fbx' },
      'attack/rising-glyph': { file: 'Uppercut.fbx', stripY: true },
      'attack/redirect': { file: 'Standing 2H Cast Spell 01.fbx' },
      'attack/matrix-teleport': { file: 'standing 1H cast spell 01.fbx' },
    },
  },
  flo: {
    rig: 'tripo_convert_ae41a37c-baaf-4cc6-b9f8-15f44575777e.fbx',
    bakeTransform: true, // meter-vert export: force the exporter's skin-bake path
    basecolor: 'flo-20k-tripo-unrigged/flo-20k-tripo-unrigged_basecolor.PNG',
    archetype: 'dirty-boxer',
    clips: {
      ...kit('dirty-boxer'),
      'attack/sudo-kill': { file: 'Standing 1H Magic Attack 02.fbx' },
      'attack/fork-bomb': { file: 'Standing 2H Cast Spell 01.fbx' },
      'attack/smokescreen': { file: 'Standing 2H Magic Area Attack 01.fbx' },
      'attack/root-access': { file: 'Standing 2H Magic Attack 02.fbx' },
      'attack/blunt-puff': { file: 'standing 1H cast spell 01.fbx' },
    },
  },
  yulia: {
    rig: 'yulia-v2.fbx',
    bakeTransform: true, // meter-vert export: force the exporter's skin-bake path
    basecolor: 'yulia-20k-tripo-unrigged/yulia-20k-tripo-unrigged_basecolor.PNG',
    archetype: 'acrobat',
    clips: {
      ...kit('acrobat'),
      'attack/cossack-spiral': { file: 'Cross Jumps Rotation.fbx', stripY: true },
      'attack/backbend-guillotine': { file: 'Back Flip To Uppercut.fbx', stripY: true },
      'attack/volga-piledriver': { file: 'Illegal Headbutt.fbx' },
      'attack/braid-lariat': { file: 'Hook Punch.fbx' },
      'attack/spinning-star-kick': { file: 'Hurricane Kick.fbx', stripY: true },
      'attack/spinning-star-kick#2': { file: 'Hurricane Kick (1).fbx', stripY: true },
    },
  },
  rapha: {
    rig: 'rapha-20k-tripo-mixamo-base-rig.fbx',
    basecolor: 'rapha-20k-tripo-unrigged/rapha-20k-tripo-unrigged_basecolor.PNG',
    archetype: 'dirty-boxer',
    clips: { ...kit('dirty-boxer') },
  },
};
