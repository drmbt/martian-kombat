// Generate the announcer pack, per-character grunts (ElevenLabs TTS) and
// combat SFX (ElevenLabs sound-generation) into public/assets/audio/.
// Idempotent; --force regens.  node tools/gen-audio.mjs [--force]

import { join } from 'node:path';
import { ROOT, loadEnv, saveAsset, skip, pool, concurrencyArg } from './lib.mjs';

const env = loadEnv();
const force = process.argv.includes('--force');
// --char <id> scopes generation to one fighter's grunts + name VO (skips the
// shared announcer pack and SFX) so a single-character run doesn't touch other
// in-flight characters' audio.
const only = process.argv.includes('--char') ? process.argv[process.argv.indexOf('--char') + 1] : null;
const KEY = env.ELEVENLABS_API_KEY;
// ElevenLabs caps concurrent requests by plan tier; keep this modest.
const CONCURRENCY = concurrencyArg(4);

const ANNOUNCER = 'V33LkP9pVLdcjeB2y5Na'; // Maverick — epic heroic legend
const VOICE_M = 'SOYHLrjzK2X1ezoPC6cr'; // Harry — fierce warrior (Vincent)
const VOICE_F = 'EXAVITQu4vr4xnSDxMaL'; // Sarah — mature confident (Yulia)
const VOICE_CATH = 'cgSgspJ2msm6clMCkdW9'; // Jessica — playful bright (Catherine)
const VOICE_KIRBY = 'FGY2WhTYpPnrIDTdsKH5'; // Laura — sassy (Kirby)
const VOICE_FLO = 'onwK4e9ZLuTAKqWW03F9'; // Daniel — deep gruff (Flo)

async function tts(voiceId, text, style = 0.7, stability = 0.4) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability, similarity_boost: 0.75, style },
    }),
  });
  if (!res.ok) throw new Error(`tts ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function sfx(text, seconds) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, duration_seconds: seconds, prompt_influence: 0.6 }),
  });
  if (!res.ok) throw new Error(`sfx ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

const AUDIO = join(ROOT, 'public/assets/audio');

const announcerLines = {
  'round-1': 'ROUND ONE!',
  'round-2': 'ROUND TWO!',
  'final-round': 'FINAL ROUND!',
  fight: 'FIGHT!',
  ko: 'K! O!',
  'time-up': 'TIME UP!',
  'double-ko': 'DOUBLE K O!',
  perfect: 'PERFECT!',
  victory: 'MARTIAN VICTORY!',
  vincent: 'VINCENT!',
  yulia: 'YULIA!',
  catherine: 'CATHERINE!',
  flo: 'FLO!',
  freeman: 'FREEMAN!',
  gene: 'GENE!',
  kirby: 'KIRBY!',
  marzipan: 'MARZIPAN!',
  bodhi: 'BODHI!',
  cat: 'CAT!',
  chebel: 'CHEBEL!',
  ygor: 'YGOR!',
  'finish-them': 'FINISH THEM!',
  fatality: 'FATALITY!',
  // stage-name call-outs (announced on stage select, mirrors the fighter
  // names). Keys must stay in sync with STAGES ids in src/data/stages.ts.
  // NOTE the announcer voice (Maverick) is an ElevenLabs *library* voice — it
  // needs a paid plan; on the free tier these 402. Regen when the plan allows.
  'stage-salton': 'SALTON SHORELINE!',
  'stage-altar': 'ALTAR!',
  'stage-bbac': 'B B A C!',
  'stage-chiba': 'CHIBA!',
  'stage-chiba-roof': 'CHIBA ROOFTOP!',
  'stage-dodecahedron': 'DODECAHEDRON!',
  'stage-dome': 'THE DOME!',
  'stage-drive-in': 'DRIVE IN!',
  'stage-estates': 'THE ESTATES!',
  'stage-institute': 'THE INSTITUTE!',
  'stage-mars': 'MARS!',
  'stage-mimos': 'MIMOS!',
  'stage-neptune': 'NEPTUNE!',
  'stage-painted-canyon': 'PAINTED CANYON!',
  'stage-saturn': 'SATURN!',
  'stage-ski-inn': 'SKI INN!',
  'stage-shipwreck': 'SHIPWRECK!',
  'stage-the-range': 'THE RANGE!',
  'stage-van': 'THE VAN!',
};

// Voice line takes an id, a voice, then per-category line lists so combat and
// the win screen can pick a random variant instead of looping one clip.
// kiai: attack grunts. hurt: pain reactions. victory: win-screen callouts
// (spoken alongside the winQuotes text on the post-match screen).
const VOICE_GENE = VOICE_M; // no dedicated ElevenLabs voice picked yet; reuse Harry
const VOICE_MARZ = VOICE_F; // ditto, reuse Sarah

// Slot counts are a contract with VOICE_COUNTS in src/scenes/BootScene.ts:
// 6 kiai / 6 hurt / 4 victory per character. Keep the arrays exactly that
// long — the loader requests that many numbered files.
const voiceLines = {
  vincent: {
    voice: VOICE_M,
    kiai: ['Hyah!', 'Ha!', 'Feel the flow!', 'Witness!', 'Redirect!', 'Sha!'],
    hurt: ['Ugh!', 'Argh!', 'Tch!', 'Hnh!', 'Gah!', 'Nngh!'],
    victory: ['Balance restored.', 'The circuit is complete.', 'As it was written.', 'You were only noise.'],
  },
  yulia: {
    voice: VOICE_F,
    kiai: ['Hyaaa!', 'Ha!', 'Yes!', 'Come on!', 'Davai!', 'Opa!'],
    hurt: ['Agh!', 'Ah!', 'Ow!', 'Hmph!', 'Nyet!', 'Tss!'],
    victory: ['Fantastic!', 'Too easy.', 'Breathe, and win.', 'Weakness is a choice.'],
  },
  catherine: {
    voice: VOICE_CATH,
    kiai: ['Order up!', 'Hyah!', 'Coming through!', 'Special of the day!', 'Jazzper, go!', 'Yes, chef!'],
    hurt: ['Agh!', 'Ow!', 'Ouch!', 'Hey!', 'My apron!', 'Watch it!'],
    victory: ["Table for one — the loser's!", 'Check, please!', "That's how we plate it!", 'Compliments to the chef!'],
  },
  kirby: {
    voice: VOICE_KIRBY,
    kiai: ['Hyah!', 'Ha!', 'Watch this!', 'Whoo!', 'Flambé!', 'Ta-da!'],
    hurt: ['Oof!', 'Ow!', 'Ugh!', 'Hey!', 'Rude!', 'My hair!'],
    victory: ['Too flexible for you!', 'Stick the landing!', 'Encore?', 'Darling, please.'],
  },
  // Flo speaks German; low stability + max style = angry, not read-aloud
  flo: {
    voice: VOICE_FLO,
    style: 1.0,
    stability: 0.25,
    kiai: ['Verdammt!', 'Genau!', 'Ha!', 'Root access!', 'Los!', 'Sudo!'],
    hurt: ['Ah! Scheiße!', 'Ah, OK!', 'Argh!', 'Verdammt nochmal!', 'Mist!', 'Ey!'],
    victory: ['Genau. Predictable.', 'Ah, OK — pwned.', 'Root access granted.', 'Works on my machine.'],
  },
  // Freeman is a serene warrior yogi; high stability + low style = calm/centered
  freeman: {
    voice: VOICE_M,
    style: 0.3,
    stability: 0.7,
    kiai: ['Hmm... hah!', 'Ha.', 'Be still.', 'Hah!', 'Breathe.', 'Release.'],
    hurt: ['Hmph!', 'Mm.', 'Hnh.', '...ah.', 'Unmoved.', 'Hm!'],
    victory: ['Peace, achieved.', 'The mind bends steel.', 'Namaste... now leave.', 'Stillness prevails.'],
  },
  gene: {
    voice: VOICE_GENE,
    kiai: ['Ship it!', 'Mana Blast!', 'Yeah!', 'Oh yeah!', 'Deploy!', 'Zero-shot!'],
    hurt: ['Ow!', 'Ugh, 429.', 'Nope!', 'Rate limited!', 'Segfault!', 'Bad output!'],
    victory: ['Yeah! Shipped it.', "Oh yeah — that's a merge.", 'Mana Blast secured.', 'Your context window just closed.'],
  },
  marzipan: {
    voice: VOICE_MARZ,
    kiai: ['Grow!', 'Bloom!', 'Ha!', 'Symbiosis!', 'Photosynthesize!', 'Take root!'],
    hurt: ['Oh!', 'Ow!', 'Ugh!', 'Hey now!', 'Aah!', 'My roots!'],
    victory: ['Please, collaborate with me.', 'Nature always wins.', 'Grow with me, or don\'t.', 'Everything composts eventually.'],
  },
  // Bodhi is a calm bodywork grappler; high stability + low style = warm/centered
  bodhi: {
    voice: VOICE_M,
    style: 0.3,
    stability: 0.7,
    kiai: ['Hyah!', 'Breathe.', 'Release!', 'Deep tissue!', 'Hold still.', 'Ha!'],
    hurt: ['Oof!', 'Agh!', "That's a knot—!", 'Hnh!', 'Okay—', 'Mercury retrograde!'],
    victory: ['Realigned.', "Session's over.", 'The stars are aligned.', 'Not today.'],
  },
  // Cat is a sassy Portuguese painter-dancer trickster; bright + expressive
  cat: {
    voice: VOICE_KIRBY,
    style: 0.6,
    stability: 0.35,
    kiai: ['Sai da frente!', 'Ha!', 'Opa!', 'Voilà!', 'Toma!', 'Hup!'],
    hurt: ['Ai!', 'Ui!', 'Ah!', 'Nossa!', 'Ai, não!', 'Ei!'],
    victory: ['I painted you better than you fought.', 'Obrigada, querido.', 'You blinked first.', 'Que tempo horrível…'],
  },
  // Chebel is a warm Brazilian mystic tarot-reader; centered but sharp on attack
  chebel: {
    voice: VOICE_F,
    style: 0.5,
    stability: 0.45,
    kiai: ['Hyah!', 'Vai!', 'Draw!', 'Ha!', 'Voa!', 'Toma!'],
    hurt: ['Ai!', 'Agh!', 'Ui!', 'Não!', 'Tss!', 'Ei!'],
    victory: ['The deck never lies.', 'This outcome was foretold.', 'Sit. Have tea. Reflect.', 'You. Reversed.'],
  },
  // Ygor is a laid-back, permanently-unbothered Brazilian projection artist
  ygor: {
    voice: VOICE_M,
    style: 0.2,
    stability: 0.6,
    kiai: ['Suave!', 'Ha!', 'Vai, Appa!', 'Projeta!', 'Whoa!', 'Toma!'],
    hurt: ['Ai!', 'Whoa—', 'Agh!', 'Mano...', 'Ei!', 'Hnh!'],
    victory: ['Não foi microdose!', 'Suave, mano. Suave.', 'Mais Amor Por Favor.', 'Nice render.'],
  },
};

const grunts = Object.entries(voiceLines).flatMap(([id, def]) =>
  Object.entries({ kiai: def.kiai, hurt: def.hurt, victory: def.victory }).flatMap(
    ([category, lines]) =>
      lines.map((text, i) => [`${id}-${category}-${i + 1}`, def.voice, text, def.style, def.stability])
  )
);

const sounds = [
  ['hit', 'a single punchy fighting game punch impact, meaty thwack, very short', 1],
  ['block', 'a single short muffled thud of a blocked martial arts strike', 1],
  ['whoosh', 'a single fast sharp martial arts whoosh, arm swinging through air, very short', 1],
  ['jump', 'a single quick soft whoosh of a person leaping, very short', 1],
  ['projectile', 'a single magical energy bolt launch, arcane zap with a slight shimmer, short', 1.5],
  ['blip', 'a single retro arcade menu selection blip, clean and short', 0.7],
];

// Flatten every clip into one task list so announcer/voice/sfx generate
// concurrently instead of three serial passes.
const announcerTasks = Object.entries(announcerLines)
  .filter(([id]) => !only || id === only)
  .map(([id, text]) => ({
    out: join(AUDIO, 'announcer', `${id}.mp3`),
    label: `announcer ${id}`,
    prompt: text,
    run: () => tts(ANNOUNCER, text, 0.9),
  }));
const gruntTasks = grunts
  .filter(([id]) => !only || id.startsWith(`${only}-`))
  .map(([id, voice, text, style, stability]) => ({
    out: join(AUDIO, 'voice', `${id}.mp3`),
    label: `grunt ${id}`,
    prompt: text,
    run: () => tts(voice, text, style ?? 0.9, stability),
  }));
const soundTasks = only
  ? []
  : sounds.map(([id, text, secs]) => ({
      out: join(AUDIO, 'sfx', `${id}.mp3`),
      label: `sfx ${id}`,
      prompt: text,
      run: () => sfx(text, secs),
    }));
const tasks = [...announcerTasks, ...gruntTasks, ...soundTasks];

const pending = tasks.filter((t) => !skip(t.out, force));
await pool(pending, CONCURRENCY, async (t) => {
  console.log(`${t.label} ...`);
  try {
    saveAsset(t.out, await t.run(), t.prompt);
  } catch (e) {
    console.error(`  FAILED ${t.label}: ${e.message}`);
  }
});
console.log('done.');
