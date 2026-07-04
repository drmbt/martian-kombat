// Per-character 3D mesh + animation-clip sources for gen-mesh.mjs.
// Contract clip names (keys) come from src/renderer3d/clipContract.json plus
// per-move `attack/<moveId>` entries; values are source FBX FILENAMES matched
// case-insensitively against the SHARED public/assets/animations/ library
// (one Mixamo skeleton fits all rigs), overridable per character via
// public/assets/meshes/<char>/animations/. Zip packs auto-extract to
// assets/raw/mesh-clips/.
//
// `stripY: true` on a clip also flattens the hips' vertical travel (the engine
// owns jump arcs — SPEC V6); horizontal root motion is always stripped.

// clips every character shares (base kit + reactions + gestures); characters
// spread this and override/extend with their per-move specials
const BASE_CLIPS = {
  idle: { file: 'Fight Idle.fbx' },
  'walk-forward': { file: 'Standing Walk Forward.fbx' },
  'walk-back': { file: 'Standing Walk Back.fbx' },
  'dash-forward': { file: 'Short Step Forward.fbx' },
  'dash-forward#2': { file: 'Medium Step Forward.fbx' },
  'dash-back': { file: 'Drunk Walk Backwards.fbx' },
  crouch: { file: 'Crouch Idle.fbx' },
  prejump: { file: 'Standing Idle To Crouch.fbx' },
  jump: { file: 'Jumping Up.fbx', stripY: true },
  fall: { file: 'Falling Idle.fbx' },
  landing: { file: 'hard landing.fbx', stripY: true },
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
  'attack-generic': { file: 'Punching.fbx' },
  'attack-air': { file: 'Mutant Jump Attack.fbx', stripY: true },
  'attack/lp': { file: 'Lead Jab.fbx' },
  'attack/lp#2': { file: 'Lead Jab (2).fbx' },
  'attack/lp#3': { file: 'Lead Jab (3).fbx' },
  'attack/mp': { file: 'Hook.fbx' },
  'attack/mp#2': { file: 'Hook Punch.fbx' },
  'attack/hp': { file: 'Illegal Elbow Punch.fbx' },
  'attack/hp#2': { file: 'Illegal Elbow Punch (1).fbx' },
  'attack/lk': { file: 'Illegal Knee.fbx' },
  'attack/mk': { file: 'Jab Cross.fbx' },
  'attack/hk': { file: 'Body Jab Cross.fbx' },
  'attack/throw': { file: 'Illegal Headbutt.fbx' },
};

export const MESHES = {
  vincent: {
    rig: 'vincent-20k-tripo-mixamo-base-rig.fbx',
    basecolor: 'vince-20k-tripo-unrigged/stylized+human+character+3d+model_basecolor.jpg',
    clips: {
      ...BASE_CLIPS,
      'attack/sigil-bolt': { file: 'Standing 1H Magic Attack 01.fbx' },
      'attack/cloud-hands': { file: 'Standing 2H Magic Attack 01.fbx' },
      'attack/rising-glyph': { file: 'Uppercut.fbx', stripY: true },
      'attack/redirect': { file: 'Standing 2H Cast Spell 01.fbx' },
    },
  },
  flo: {
    rig: 'flo-20k-tripo-mixamo-base-rig.fbx',
    basecolor: 'flo-20k-tripo-unrigged/flo-20k-tripo-unrigged_basecolor.PNG',
    clips: {
      ...BASE_CLIPS,
      'attack/sudo-kill': { file: 'Standing 1H Magic Attack 02.fbx' },
      'attack/fork-bomb': { file: 'Standing 2H Cast Spell 01.fbx' },
      'attack/smokescreen': { file: 'Standing 2H Magic Area Attack 01.fbx' },
      'attack/root-access': { file: 'Standing 2H Magic Attack 02.fbx' },
      'attack/blunt-puff': { file: 'standing 1H cast spell 01.fbx' },
    },
  },
  yulia: {
    rig: 'yulia-20k-tripo-mixamo-base-rig.fbx',
    basecolor: 'yulia-20k-tripo-unrigged/yulia-20k-tripo-unrigged_basecolor.PNG',
    clips: {
      ...BASE_CLIPS,
      'attack/cossack-spiral': { file: 'Back Flip To Uppercut.fbx', stripY: true },
      'attack/backbend-guillotine': { file: 'Body Jab Cross.fbx' },
      'attack/volga-piledriver': { file: 'Illegal Headbutt.fbx' },
      'attack/braid-lariat': { file: 'Hook Punch.fbx' },
      'attack/spinning-star-kick': { file: 'Mutant Jump Attack.fbx', stripY: true },
    },
  },
};
