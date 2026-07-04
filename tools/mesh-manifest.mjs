// Per-character 3D mesh + animation-clip sources for gen-mesh.mjs.
// Contract clip names (keys) come from src/renderer3d/clipContract.json plus
// per-move `attack/<moveId>` entries; values are source FBX FILENAMES matched
// case-insensitively against public/assets/meshes/<char>/animations/ (loose
// files win) and the extracted zip packs in assets/raw/mesh-clips/<char>/.
//
// `stripY: true` on a clip also flattens the hips' vertical travel (the engine
// owns jump arcs — SPEC V6); horizontal root motion is always stripped.

export const MESHES = {
  vincent: {
    rig: 'vincent-20k-tripo-mixamo-base-rig.fbx',
    basecolor: 'vince-20k-tripo-unrigged/stylized+human+character+3d+model_basecolor.jpg',
    clips: {
      idle: { file: 'Fight Idle.fbx' },
      'walk-forward': { file: 'Standing Walk Forward.fbx' },
      'walk-back': { file: 'Standing Walk Back.fbx' },
      crouch: { file: 'Crouch Idle.fbx' },
      prejump: { file: 'Standing Idle To Crouch.fbx' },
      jump: { file: 'Jumping Up.fbx', stripY: true },
      fall: { file: 'Falling Idle.fbx' },
      landing: { file: 'hard landing.fbx', stripY: true },
      getup: { file: 'cover to stand.fbx' },
      hit: { file: 'Head Hit.fbx' },
      'hit-front': { file: 'Standing React Small From Front.fbx' },
      'hit-back': { file: 'Standing React Small From Back.fbx' },
      'hit-front-heavy': { file: 'Standing React Large From Front.fbx' },
      'hit-back-heavy': { file: 'Standing React Large From Back.fbx' },
      'hit-air': { file: 'Standing React Large From Front.fbx' },
      'block-stand': { file: 'Standing Block Idle.fbx' },
      knockdown: { file: 'Fallen Idle.fbx' },
      ko: { file: 'Standing React Death Backward.fbx' },
      'ko-forward': { file: 'Standing React Death Forward.fbx' },
      dazed: { file: 'Stunned.fbx' },
      win: { file: 'Taunt Gesture.fbx' },
      'attack-generic': { file: 'Punching.fbx' },
      'attack-air': { file: 'Mutant Jump Attack.fbx', stripY: true },
      'attack/lp': { file: 'Lead Jab.fbx' },
      'attack/mp': { file: 'Hook.fbx' },
      'attack/hp': { file: 'Illegal Elbow Punch.fbx' },
      'attack/throw': { file: 'Illegal Headbutt.fbx' },
      'attack/sigil-bolt': { file: 'Standing 1H Magic Attack 01.fbx' },
      'attack/cloud-hands': { file: 'Standing 2H Magic Attack 01.fbx' },
      'attack/rising-glyph': { file: 'Standing 2H Magic Attack 03.fbx', stripY: true },
      'attack/redirect': { file: 'Standing 2H Cast Spell 01.fbx' },
    },
  },
};
