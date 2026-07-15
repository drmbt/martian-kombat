// Loads every asset up front (missing files 404 harmlessly — the game
// degrades to capsules/silence), then hands off to the menu.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { ROSTER } from '../data/roster';
import { characters } from '../data/characters';
import { STAGES } from '../data/stages';
// which optional/drift-prone assets ACTUALLY exist on disk (generated at
// predev/prebuild by tools/gen-asset-manifest.mjs) — the loader gates on this
// so a missing sprite/VO never 404s (a 404'd mp3 throws an uncaught error)
import assetManifest from '../data/assetManifest.json';
import { initMusic, duckMusic, nextTrack, playMusic } from '../audio/music';
import type { AudioCue } from '../presentation/soundDirector';
import { applyMusicVolume, effectiveSfxVolume } from '../audio/volume';
import { devBootTarget, rememberDevLaunch } from '../devLaunch';
import { CELL_H, CELL_W } from '../render/coords';

const ANNOUNCER = [
  'round-1', 'round-2', 'final-round', 'fight', 'ko', 'time-up',
  'double-ko', 'perfect', 'victory', 'wins', 'finish-them', 'fatality',
  // per-fighter name calls — only for fighters with generated VO. A 404'd mp3
  // decodes to an uncaught EncodingError (not harmless), so gate like VOICES.
  ...ROSTER.filter((r) => r.playable).map((r) => r.id),
  // stage name call-outs on the select screen — only stages whose VO was
  // actually generated (the manifest; not every stage has one yet)
  ...STAGES.filter((s) => assetManifest.stageVo.includes(s.id)).map((s) => `stage-${s.id}`),
];
/** membership sets for the per-move art gates below */
const HAS = {
  legacyProj: new Set<string>(assetManifest.legacyProj),
  moveProj: new Set(assetManifest.moveProj),
  moveBurst: new Set(assetManifest.moveBurst),
  moveVfx: new Set(assetManifest.moveVfx),
};
// several numbered variants per category so combat/win-screen audio doesn't
// loop the same clip every hit; missing files 404 harmlessly, so characters
// with fewer generated lines than the count just degrade to repeats.
export const VOICE_COUNTS = { kiai: 6, hurt: 6, victory: 4 } as const;
const VOICES = ROSTER.filter((r) => r.playable).flatMap((r) =>
  (Object.keys(VOICE_COUNTS) as (keyof typeof VOICE_COUNTS)[]).flatMap((cat) =>
    Array.from({ length: VOICE_COUNTS[cat] }, (_, i) => `${r.id}-${cat}-${i + 1}`)
  )
);
// per-move VO call-outs (v-<char>-move-<moveId>) — only moves flagged `voice`
// in their JSON have a file, so this list never 404s (a missing mp3 throws)
const MOVE_VOICES = ROSTER.filter((r) => r.playable).flatMap((r) =>
  Object.entries(characters[r.id]?.moves ?? {})
    .filter(([, m]) => m.voice)
    .map(([moveId]) => `${r.id}-move-${moveId}`)
);
const SFX = ['hit', 'block', 'whoosh', 'jump', 'projectile', 'blip'];

/** Map a loader key prefix to a human phase label for the preloader HUD. */
function phaseLabel(key: string): string {
  if (key.startsWith('sheet-') || key.startsWith('meta-')) return 'LOADING FIGHTERS';
  if (key.startsWith('portrait-') || key.startsWith('bust-')) return 'LOADING PORTRAITS';
  if (key.startsWith('bg-') || key === 'ui-world-map') return 'LOADING STAGES';
  if (key.startsWith('fat-')) return 'LOADING FATALITIES';
  if (key.startsWith('proj-') || key.startsWith('vfx-')) return 'LOADING EFFECTS';
  if (key.startsWith('ann-')) return 'LOADING ANNOUNCER';
  if (key.startsWith('v-')) return 'LOADING VOICES';
  if (key.startsWith('s-')) return 'LOADING SOUND';
  return 'LOADING ASSETS';
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.buildPreloader();

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
      // legacy single projectile — only a couple chars still have one
      if (HAS.legacyProj.has(id)) this.load.image(`proj-${id}`, `assets/sprites/${id}/projectile.png`);
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
        const ref = `${id}/${moveId}`;
        if (mv.projectile && HAS.moveProj.has(ref)) {
          this.load.image(`proj-${id}-${moveId}`, `assets/sprites/${id}/projectile-${moveId}.png`);
          if (mv.projectile.detonate && HAS.moveBurst.has(ref)) {
            this.load.image(`proj-${id}-${moveId}-burst`, `assets/sprites/${id}/projectile-${moveId}-burst.png`);
          }
        }
        if (mv.vfx && HAS.moveVfx.has(ref)) {
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
    for (const v of MOVE_VOICES) this.load.audio(`v-${v}`, `assets/audio/voice/${v}.mp3`);
    for (const s of SFX) this.load.audio(`s-${s}`, `assets/audio/sfx/${s}.mp3`);

    // now that the whole manifest is queued, publish the file count so the
    // preloader can show "N / TOTAL assets" (totalToLoad is final here)
    this.preloadTotal = this.load.totalToLoad;
    // bucket every queued file into its phase so the preloader can show the
    // EARLIEST still-loading category instead of flickering between the ~32
    // files streaming in parallel (see buildPreloader's monotonic label)
    this.load.list.iterate((file: Phaser.Loader.File) => {
      const label = phaseLabel(file.key);
      this.phaseTotals.set(label, (this.phaseTotals.get(label) ?? 0) + 1);
      return true;
    });
  }

  /** Total files queued for load — read by the preloader HUD once known. */
  private preloadTotal = 0;
  /** Canonical display order of load phases — the label walks this list. */
  private phaseOrder = [
    'LOADING FIGHTERS', 'LOADING PORTRAITS', 'LOADING STAGES', 'LOADING EFFECTS',
    'LOADING FATALITIES', 'LOADING ANNOUNCER', 'LOADING VOICES', 'LOADING SOUND',
    'LOADING ASSETS',
  ];
  /** files queued / completed per phase — drives the sequential-seeming label */
  private phaseTotals = new Map<string, number>();
  private phaseDone = new Map<string, number>();

  /** A slick boot HUD: the game logo, a bevelled gradient progress bar with a
   *  travelling shimmer, live percent, the asset class currently streaming in,
   *  and a rolling ETA. Everything is torn down automatically on scene start. */
  private buildPreloader(): void {
    const cx = STAGE_W / 2;
    const barW = 560;
    const barH = 20;
    const barX = cx - barW / 2;
    const barY = 372;

    // backdrop: near-black with a faint warm vignette + a couple of scanlines
    this.add.rectangle(cx, STAGE_H / 2, STAGE_W, STAGE_H, 0x0c0910).setOrigin(0.5);
    this.add.rectangle(cx, 210, STAGE_W, 260, 0x2a0a0a, 0.35).setOrigin(0.5);
    const scan = this.add.graphics();
    scan.fillStyle(0xffffff, 0.02);
    for (let y = 0; y < STAGE_H; y += 3) scan.fillRect(0, y, STAGE_W, 1);

    // logo (styled text — no logo asset exists yet; matches the menu treatment)
    const logo = this.add
      .text(cx, 168, 'MARTIAN\nKOMBAT', {
        fontFamily: 'monospace', fontSize: '80px', fontStyle: 'bold', color: '#ffb347',
        stroke: '#2a0a0a', strokeThickness: 12, align: 'center',
      })
      .setOrigin(0.5);
    logo.setShadow(0, 0, '#ff5a48', 18, false, true);
    this.tweens.add({
      targets: logo, scale: { from: 0.985, to: 1.015 }, duration: 1600,
      yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
    this.add
      .text(cx, 300, 'a Mars College fighting game · Bombay Beach, CA', {
        fontFamily: 'monospace', fontSize: '15px', color: '#e8dcc8', stroke: '#000', strokeThickness: 3,
      })
      .setOrigin(0.5);

    // percent (big, right-aligned above the bar) + phase label (left)
    const pct = this.add
      .text(barX + barW, barY - 14, '0%', {
        fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color: '#ffb347',
        stroke: '#000', strokeThickness: 4,
      })
      .setOrigin(1, 1);
    const phase = this.add
      .text(barX, barY - 16, 'INITIALISING', {
        fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#f5ead9',
        stroke: '#000', strokeThickness: 3,
      })
      .setOrigin(0, 1);

    // status line (files done + ETA) below the bar
    const status = this.add
      .text(cx, barY + barH + 16, '', {
        fontFamily: 'monospace', fontSize: '12px', color: '#9b8ea8', stroke: '#000', strokeThickness: 2,
      })
      .setOrigin(0.5, 0);

    const bar = this.add.graphics();
    // a travelling shimmer that rides the filled portion of the bar
    const shimmer = { t: 0 };
    this.tweens.add({ targets: shimmer, t: 1, duration: 1100, repeat: -1, ease: 'Sine.inOut' });

    let started = -1; // performance.now() of first progress tick, for ETA
    let curPhase = 'INITIALISING';
    let lastPct = 0;

    const draw = (p: number) => {
      bar.clear();
      // bevel / border
      bar.fillStyle(0x241b2e, 1).fillRoundedRect(barX - 3, barY - 3, barW + 6, barH + 6, 12);
      // recessed track
      bar.fillStyle(0x120c18, 1).fillRoundedRect(barX, barY, barW, barH, 9);
      const fw = Math.max(0, barW * p);
      if (fw > 6) {
        // two-tone fill for depth: hot core + warm top highlight
        bar.fillStyle(0xff5a48, 1).fillRoundedRect(barX, barY, fw, barH, 9);
        bar.fillStyle(0xffb347, 0.55).fillRoundedRect(barX, barY, fw, barH / 2, 9);
        // travelling shimmer clamped to the filled region
        const sx = barX + shimmer.t * fw;
        bar.fillStyle(0xffffff, 0.28).fillRect(Math.min(sx, barX + fw - 3), barY + 2, 3, barH - 4);
      }
    };
    draw(0);
    // keep the shimmer animating even between file-complete ticks
    this.events.on('update', () => draw(lastPct));

    // Files stream in CONCURRENTLY, so a naive per-file label ping-pongs between
    // categories. Instead, on each file finishing (success OR 404), advance the
    // label to the FIRST category (in canonical order) that still has files
    // pending. It only ever moves forward → reads as ordered, sequential phases.
    const bump = (key: string) => {
      const label = phaseLabel(key);
      this.phaseDone.set(label, (this.phaseDone.get(label) ?? 0) + 1);
      const next = this.phaseOrder.find(
        (l) =>
          (this.phaseTotals.get(l) ?? 0) > 0 &&
          (this.phaseDone.get(l) ?? 0) < (this.phaseTotals.get(l) ?? 0),
      );
      if (next && next !== curPhase) {
        curPhase = next;
        phase.setText(curPhase);
      }
    };
    this.load.on('filecomplete', (key: string) => bump(key));
    this.load.on('loaderror', (file: Phaser.Loader.File) => bump(file.key));
    this.load.on('progress', (p: number) => {
      lastPct = p;
      if (started < 0 && p > 0) started = performance.now();
      pct.setText(`${Math.round(p * 100)}%`);
      const total = this.preloadTotal;
      const done = total ? Math.round(p * total) : 0;
      let eta = '';
      if (started >= 0 && p > 0.02 && p < 1) {
        const secs = ((performance.now() - started) / p) * (1 - p) / 1000;
        eta = secs > 1 ? `  ·  ~${Math.ceil(secs)}s left` : '  ·  almost there';
      }
      status.setText(total ? `${done} / ${total} assets${eta}` : `loading…${eta}`);
    });
    this.load.once('complete', () => {
      lastPct = 1;
      draw(1);
      pct.setText('100%');
      phase.setText('READY');
      status.setText(`${this.preloadTotal} / ${this.preloadTotal} assets  ·  entering`);
    });
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

/** Play an announcer-style voice-over (fighter names, stage names, "FIGHT!"):
 *  louder than a normal SFX and it DUCKS the music for the clip's length so
 *  the callout cuts through. Use this for any spoken callout, not play(). */
export function announce(scene: Phaser.Scene, key: string, volume = 1.3): void {
  if (typeof document !== 'undefined' && !document.hasFocus()) return;
  const v = volume * effectiveSfxVolume();
  if (v <= 0 || !scene.cache.audio.exists(key)) return;
  const snd = scene.sound.add(key);
  const durMs = ((snd as Phaser.Sound.BaseSound & { duration?: number }).duration ?? 1.4) * 1000;
  duckMusic(durMs + 250);
  snd.once('complete', () => snd.destroy());
  snd.play({ volume: v });
}

/** Execute the pure sound director's cues (see presentation/soundDirector).
 *  Shared by both fight presenters — the only per-scene difference is what
 *  the one-shot victory theme does when it ends (2D navigates away). */
export function runCues(
  scene: Phaser.Scene,
  cues: AudioCue[],
  opts: { onVictoryMusic?: () => void } = {},
): void {
  for (const c of cues) {
    switch (c.kind) {
      case 'sfx':
        if (c.delayMs) {
          const { key, volume } = c;
          scene.time.delayedCall(c.delayMs, () => play(scene, key, volume));
        } else play(scene, c.key, c.volume);
        break;
      case 'voice':
        playVoice(scene, c.charId, c.line, c.volume);
        break;
      case 'music':
        if (c.action === 'next') nextTrack();
        else if (opts.onVictoryMusic) opts.onVictoryMusic();
        else playMusic('victory', { keepOnMiss: true, once: true });
        break;
    }
  }
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
