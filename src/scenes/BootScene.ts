// Loads every asset up front (missing files 404 harmlessly — the game
// degrades to capsules/silence), then hands off to the menu.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { ROSTER } from '../data/roster';
import { characters } from '../data/characters';
import { STAGES } from '../data/stages';
import { initMusic } from '../audio/music';
import { applyMusicVolume, effectiveSfxVolume } from '../audio/volume';

const CELL_W = 288;
const CELL_H = 384;

const ANNOUNCER = [
  'round-1', 'round-2', 'final-round', 'fight', 'ko', 'time-up',
  'double-ko', 'perfect', 'victory', 'finish-them', 'fatality',
  ...ROSTER.map((r) => r.id),
];
// kiai+hurt for every playable fighter (missing files 404 harmlessly)
const VOICES = ROSTER.filter((r) => r.playable).flatMap((r) => [`${r.id}-kiai`, `${r.id}-hurt`]);
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
    for (const st of STAGES) this.load.image(`bg-stage-${st.id}`, st.file);
    for (const { id } of ROSTER) {
      this.load.spritesheet(`sheet-${id}`, `assets/sprites/${id}/sheet.png`, {
        frameWidth: CELL_W,
        frameHeight: CELL_H,
      });
      this.load.json(`meta-${id}`, `assets/sprites/${id}/meta.json`);
      this.load.image(`proj-${id}`, `assets/sprites/${id}/projectile.png`);
      this.load.image(`portrait-${id}`, `assets/portraits/${id}.png`);
      // beaten-and-bloodied portrait for the post-match win-quote screen
      this.load.image(`portrait-ko-${id}`, `assets/portraits/${id}-ko.png`);
    }
    // fatality cutscene panels + per-special projectile art
    for (const [id, def] of Object.entries(characters)) {
      for (const [moveId, mv] of Object.entries(def.moves)) {
        if (mv.projectile) {
          this.load.image(`proj-${id}-${moveId}`, `assets/sprites/${id}/projectile-${moveId}.png`);
          if (mv.projectile.detonate) {
            this.load.image(`proj-${id}-${moveId}-burst`, `assets/sprites/${id}/projectile-${moveId}-burst.png`);
          }
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
    this.scene.start('Menu');
  }
}

/** Play a sound if it loaded; silently skip if the asset doesn't exist.
 *  `volume` is per-sound emphasis, scaled by master+SFX settings (and mute). */
export function play(scene: Phaser.Scene, key: string, volume = 0.8): void {
  const v = volume * effectiveSfxVolume();
  if (v > 0 && scene.cache.audio.exists(key)) scene.sound.play(key, { volume: v });
}
