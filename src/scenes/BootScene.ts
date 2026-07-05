// Loads every asset up front (missing files 404 harmlessly — the game
// degrades to capsules/silence), then hands off to the menu.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { ROSTER } from '../data/roster';
import { characters } from '../data/characters';
import { STAGES } from '../data/stages';
import { initMusic } from '../audio/music';
import { applyMusicVolume, effectiveSfxVolume } from '../audio/volume';
import { devBootTarget, rememberDevLaunch } from '../devLaunch';

const CELL_W = 288;
const CELL_H = 384;

const ANNOUNCER = [
  'round-1', 'round-2', 'final-round', 'fight', 'ko', 'time-up',
  'double-ko', 'perfect', 'victory', 'finish-them', 'fatality',
  // per-fighter name calls — only for fighters with generated VO. A 404'd mp3
  // decodes to an uncaught EncodingError (not harmless), so gate like VOICES.
  ...ROSTER.filter((r) => r.playable).map((r) => r.id),
  // stage name call-outs on the select screen — every STAGES id has a clip
  // (tools/gen-audio.mjs `stage-*` lines). Same 404-gating rule: keep in sync.
  ...STAGES.map((s) => `stage-${s.id}`),
];
// several numbered variants per category so combat/win-screen audio doesn't
// loop the same clip every hit; missing files 404 harmlessly, so characters
// with fewer generated lines than the count just degrade to repeats.
export const VOICE_COUNTS = { kiai: 6, hurt: 6, victory: 4 } as const;
const VOICES = ROSTER.filter((r) => r.playable).flatMap((r) =>
  (Object.keys(VOICE_COUNTS) as (keyof typeof VOICE_COUNTS)[]).flatMap((cat) =>
    Array.from({ length: VOICE_COUNTS[cat] }, (_, i) => `${r.id}-${cat}-${i + 1}`)
  )
);
const SFX = ['hit', 'block', 'whoosh', 'jump', 'projectile', 'blip'];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const bar = this.add.graphics();
    this.load.on('progress', (p: number) => {
      bar.clear();
      bar.fillStyle(0xff5a48, 1).fillRect(STAGE_W / 4, STAGE_H / 2 - 6, (STAGE_W / 2) * p, 12);
    });

    this.load.image('bg-salton', 'assets/backgrounds/salton-shoreline.jpg');
    this.load.image('ui-world-map', 'assets/ui/world-map.png');
    for (const st of STAGES) {
      this.load.image(`bg-stage-${st.id}`, st.file);
      if (st.layers?.sky) this.load.image(`bg-stage-${st.id}-sky`, st.layers.sky.file);
      if (st.layers?.far) this.load.image(`bg-stage-${st.id}-far`, st.layers.far.file);
      if (st.layers?.near) this.load.image(`bg-stage-${st.id}-near`, st.layers.near.file);
      if (st.layers?.floor) this.load.image(`bg-stage-${st.id}-floor`, st.layers.floor.file);
    }
    for (const { id, playable } of ROSTER) {
      // 3D-only fighters (mesh but no packed 2D sheet) have none of these files
      // — skip so their absence isn't a wall of 404s at boot
      if (!playable) continue;
      this.load.spritesheet(`sheet-${id}`, `assets/sprites/${id}/sheet.png`, {
        frameWidth: CELL_W,
        frameHeight: CELL_H,
      });
      this.load.json(`meta-${id}`, `assets/sprites/${id}/meta.json`);
      this.load.image(`proj-${id}`, `assets/sprites/${id}/projectile.png`);
      // front-facing head icon — select grid, health-bar mugshots, VS card
      this.load.image(`portrait-${id}`, `assets/portraits/${id}.png`);
      // side-profile bust — big per-player portrait on the select-screen edges
      this.load.image(`bust-${id}`, `assets/portraits/${id}-bust.png`);
      // beaten-and-bloodied portrait for the post-match win-quote screen
      this.load.image(`portrait-ko-${id}`, `assets/portraits/${id}-ko.png`);
    }
    // generic impact sparks (greyscale, tinted per character at spawn)
    // + the circling dizzy-stars loop drawn over a dazed fighter's head
    for (const v of ['spark-hit', 'spark-heavy', 'spark-block', 'dizzy']) {
      this.load.image(`vfx-${v}`, `assets/vfx/${v}.png`);
    }
    // fatality cutscene panels + per-special projectile art + per-move VFX
    for (const [id, def] of Object.entries(characters)) {
      for (const [moveId, mv] of Object.entries(def.moves)) {
        if (mv.projectile) {
          this.load.image(`proj-${id}-${moveId}`, `assets/sprites/${id}/projectile-${moveId}.png`);
          if (mv.projectile.detonate) {
            this.load.image(`proj-${id}-${moveId}-burst`, `assets/sprites/${id}/projectile-${moveId}-burst.png`);
          }
        }
        if (mv.vfx) {
          this.load.image(`vfx-${id}-${moveId}`, `assets/sprites/${id}/vfx-${moveId}.png`);
        }
      }
      if (!def.fatality) continue;
      for (let n = 1; n <= def.fatality.panels; n++) {
        this.load.image(`fat-${id}-${def.fatality.id}-${n}`, `assets/fatalities/${id}/${def.fatality.id}-${n}.jpg`);
      }
    }
    for (const a of ANNOUNCER) this.load.audio(`ann-${a}`, `assets/audio/announcer/${a}.mp3`);
    for (const v of VOICES) this.load.audio(`v-${v}`, `assets/audio/voice/${v}.mp3`);
    for (const s of SFX) this.load.audio(`s-${s}`, `assets/audio/sfx/${s}.mp3`);
  }

  create(): void {
    initMusic(); // fetches music/manifest.json; playback degrades to silence if absent
    applyMusicVolume();
    this.scene.launch('Volume'); // persistent quick-volume overlay, above every scene
    const target = devBootTarget();
    if (target) {
      this.scene.start(target.scene, target.data);
    } else {
      rememberDevLaunch('Menu');
      this.scene.start('Menu');
    }
  }
}

/** Play a sound if it loaded; silently skip if the asset doesn't exist.
 *  `volume` is per-sound emphasis, scaled by master+SFX settings (and mute). */
export function play(scene: Phaser.Scene, key: string, volume = 0.8): void {
  // Drop SFX/VO while the tab is unfocused. A backgrounded tab suspends the
  // WebAudio context but the sim keeps ticking (throttled) — sounds scheduled
  // into the suspended context bank up and ALL fire at once on refocus. Gating
  // centrally here covers every caller (2D + 3D), not just the few that used to
  // wrap it. Music is a raw <audio> element elsewhere, so it's unaffected.
  if (typeof document !== 'undefined' && !document.hasFocus()) return;
  const v = volume * effectiveSfxVolume();
  if (v > 0 && scene.cache.audio.exists(key)) scene.sound.play(key, { volume: v });
}

/** Play a random numbered variant of a character voice line (kiai/hurt/victory)
 *  so combat and the win screen don't loop the same clip every time. */
export function playVoice(
  scene: Phaser.Scene,
  charId: string,
  category: keyof typeof VOICE_COUNTS,
  volume = 0.8
): void {
  const n = Phaser.Math.Between(1, VOICE_COUNTS[category]);
  play(scene, `v-${charId}-${category}-${n}`, volume);
}
