// Generate the announcer pack, per-character grunts (ElevenLabs TTS) and
// combat SFX (ElevenLabs sound-generation) into public/assets/audio/.
// Idempotent; --force regens.  node tools/gen-audio.mjs [--force]

import { join } from 'node:path';
import { ROOT, loadEnv, saveAsset, skip, pool, concurrencyArg, loadVoices, fishTTS, elevenTts, elevenSfx, ELEVEN_VOICES } from './lib.mjs';
import { withEmotion } from './core/vo-emotion.mjs';

const env = loadEnv();
const force = process.argv.includes('--force');
// --char <id> scopes generation to one fighter's grunts + name VO (skips the
// shared announcer pack and SFX) so a single-character run doesn't touch other
// in-flight characters' audio.
const only = process.argv.includes('--char') ? process.argv[process.argv.indexOf('--char') + 1] : null;
const KEY = env.ELEVENLABS_API_KEY;
// ElevenLabs caps concurrent requests by plan tier; keep this modest.
const CONCURRENCY = concurrencyArg(4);

// Characters with a cloned real voice (tools/voices.json via gen-voice.mjs)
// get their kiai/hurt/victory VO synthesized through the clone; everyone else
// stays on the stock ElevenLabs voices below. Announcer lines never route
// through clones.
const CLONED = loadVoices();

// shared voice table + TTS/SFX implementations live in tools/lib.mjs (one
// copy for the CLI and the creator's dev-middleware endpoints)
const ANNOUNCER = ELEVEN_VOICES.announcer;
const STAGE_VOICE = ELEVEN_VOICES.stage;
const VOICE_M = ELEVEN_VOICES.m; // (Vincent)
const VOICE_F = ELEVEN_VOICES.f; // (Yulia)
const VOICE_CATH = 'cgSgspJ2msm6clMCkdW9'; // Jessica — playful bright (Catherine)
const VOICE_KIRBY = 'FGY2WhTYpPnrIDTdsKH5'; // Laura — sassy (Kirby)
const VOICE_FLO = 'onwK4e9ZLuTAKqWW03F9'; // Daniel — deep gruff (Flo)

const tts = (voiceId, text, style = 0.7, stability = 0.4) =>
  elevenTts({ apiKey: KEY, voiceId, text, style, stability });
const sfx = (text, seconds) => elevenSfx({ apiKey: KEY, text, seconds });

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
  wins: 'WINS!', // played right after the winner's name at match-end ("<NAME>… WINS!")
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
  rapha: 'RAPHA!',
  vanessa: 'VANESSA!',
  earl: 'EARL!',
  ben: 'BEN!',
  tao: 'TAO!',
  rj: 'R J!',
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
  'stage-ai-kitchen': 'A I KITCHEN!',
  'stage-dojo': 'THE DOJO!',
  'stage-escapes': 'THE ESCAPES!',
  'stage-hyperion': 'HYPERION!',
  'stage-last-resort': 'LAST RESORT!',
  'stage-museum': 'THE MUSEUM!',
  'stage-star-beach': 'STAR BEACH!',
  'stage-tvs': 'TEE VEES!',
};

// Voice line takes an id, a voice, then per-category line lists so combat and
// the win screen can pick a random variant instead of looping one clip.
// kiai: attack grunts. hurt: pain reactions. victory: win-screen callouts
// (spoken alongside the winQuotes text on the post-match screen).
const VOICE_GENE = VOICE_M; // no dedicated ElevenLabs voice picked yet; reuse Harry
const VOICE_MARZ = VOICE_M; // male voice (Harry) — Marzipan is a man; tuned mellow/earthy below

// Slot counts are a contract with VOICE_COUNTS in src/scenes/BootScene.ts:
// 6 kiai / 6 hurt / 4 victory per character. Keep the arrays exactly that
// long — the loader requests that many numbered files.
export const voiceLines = {
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
    // dialed in on the soundboard: low-temp calm tracks his real reference.
    // (calm) overrides where the category default (relaxed/groaning) drifted.
    kiai: ['Hah!', 'Hyah!', 'Be still.', 'Breathe.', 'Release.', 'Hm!'],
    hurt: ['Ugh!', 'Ah!', 'Hmph!', '(calm) Unmoved.', 'Hnh!', 'Grounded.'],
    victory: ['Peace, achieved.', 'The mind bends steel.', '(calm) Namaste... now leave.', 'Stillness prevails.'],
    moves: { breathwork: '(calm) Inhale…', 'sun-salutation': 'Salute the sun.', presence: 'Be present.', 'yoga-float': 'Rise.', throw: 'CROW!' },
  },
  gene: {
    voice: VOICE_GENE,
    kiai: ['Ship it!', 'Force push!', 'Hah!', 'Deploy!', 'Zero-shot!', 'Hup!'],
    hurt: ['Ow!', 'Ugh!', 'Ah, fuck.', "Eden's down!", 'Segfault!', 'Bad output!'],
    victory: ['Yeah! Shipped it.', "Oh yeah — that's a merge.", "(excited) I'm bullish on this one!", 'Your context window just closed.'],
    // per-move call-outs: v-<char>-move-<moveId>, played when that move fires
    // (see soundDirector). rate-limit is the "Line Goes Up" special.
    moves: { 'diffusion-strike': 'Generating!', 'diffusion-escape': 'Diffusing out!', 'rate-limit': 'Line goes up!', hallucination: "That's not real.", 'mana-burst': 'Mana burst!', throw: 'Force pushed.' },
  },
  // Marzipan is a laid-back dreadlocked vegan biologist; mellow + earthy, not fierce
  marzipan: {
    voice: VOICE_MARZ,
    style: 0.35,
    stability: 0.6,
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
    // (shouting) on the attack HA!, (raw) leaves the short "Ui!" untagged
    kiai: ['Hyah!', 'Vai!', 'Draw!', 'Ha!', 'Voa!', '(shouting) HA!'],
    hurt: ['Ai!', 'Agh!', '(raw) Ui!', 'Não!', 'Tss!', 'Ei!'],
    victory: ['The deck never lies.', 'This outcome was foretold.', 'Sit. Have tea. Reflect.', 'You. Reversed.'],
    moves: { 'spirit-draw': 'Spirit, draw!', 'crescent-moon': 'Crescent moon!', ceremony: 'The ceremony begins.', 'unicycle-rush': 'Hold on!', throw: 'Reversed.' },
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
  // Rapha is a dry, laconic toymaker — minimal effort, total confidence.
  // Reuses Daniel (VOICE_FLO) but low style + high stability = deadpan, not angry.
  rapha: {
    voice: VOICE_FLO,
    style: 0.15,
    stability: 0.7,
    kiai: ['Tubs.', 'Ha!', 'Clamp!', 'Go, buddy!', 'Hup!', 'Fetch!'],
    hurt: ['Agh!', 'Ow!', 'Tubs—!', 'Hey!', 'Hnh!', 'My tabs!'],
    victory: ['The TabBastard has spoken.', "Tubs, we're done here.", 'Built to last.', 'Add it to the chain.'],
  },
  vanessa: {
    voice: VOICE_F, // fallback; her Fish clone (voices.json) overrides kiai/hurt/victory
    style: 0.3,
    kiai: ['Verdelis!', 'Little Martians!', 'Cacao!', 'Awaken!', 'The ancestors!', 'Hah!'],
    hurt: ['Ai!', 'Merda!', 'Caralho!', 'Porra!', 'Ai, não!', 'Puta que pariu!'],
    victory: ['The Little Martians dreamed this.', 'Say thank you. The ceremony requires it.', 'The ancestors are pleased.', 'Dear human: you are forgettable.'],
    moves: { teleportal: 'Dream.' },
  },
  // THE END BOSS — imperious Italian aristocrat, conducts the fight like a
  // symphony. His Fish clone (voices.json) overrides kiai/hurt/victory/moves.
  tao: {
    voice: VOICE_M, // fallback only; the registered clone carries his real voice
    style: 0.25,
    stability: 0.6,
    kiai: ['Presto!', 'Adagio!', 'Crescendo!', 'Fin!', 'Ancora!', 'Bravo!'],
    hurt: ['Crude.', 'Hmph.', 'Uncouth.', 'Tedious.', 'No...', 'Enough.'],
    victory: ['The performance is over.', 'A flawed composition.', 'You lack authenticity.', "Return when you've practiced."],
    moves: {
      'paparazzi-flash': 'Smile!',
      'directors-cut': 'Action!',
      'duende-kick': '¡Olé!',
      'maestros-advance': 'Andante!',
      throw: 'You bore me.',
    },
  },
  // THE SUB-BOSS — RJ "The Gatekeeper": laconic desert artist. Daniel
  // (VOICE_FLO) low style reads dry and weathered.
  // RJ v2 — cloned voice, dialed in on the soundboard. Deadpan desert raconteur:
  // the temperament default is (confident)/(groaning)/(sarcastic), and the
  // overrides below are the takes that actually landed. `(raw)` = no tag at all,
  // which is what finally worked for the short barks (tags mangle half-second
  // grunts). Low `style` (= fish temperature) tracks his real reference voice.
  rj: {
    voice: VOICE_FLO,
    style: 0.5,
    stability: 0.6,
    kiai: ['(shouting) Go on, git!!!', 'Hup!', '(shouting) YAW!!!', '(raw) Hyah!', '(raw) Hyee-YAH!', '(raw) Whooooa.'],
    hurt: ['(raw) Ngh!', 'Dang.', 'Rude.', 'Ow, hell.', 'Tsk.', '(screaming) FUUUCK!!!'],
    victory: [
      '(angry) Get. Off. My. Lot.',
      "Well, I reckon that's that.",
      'The ghosts saw everything.',
      "Your problem is, you've got no style",
    ],
    moves: {
      'bb-gun': 'Plink!',
      'excavator-charge': 'Dig in!',
      'tallest-ghost': 'Boo!',
      rattlebones: "C'mere.",
      throw: 'Evicted!',
    },
  },
};

// Route one grunt line: cloned fish voice when registered, ElevenLabs stock
// voice otherwise (style maps loosely onto fish temperature). `category`
// (kiai/hurt/victory/move) drives the Fish emotion tag — see core/vo-emotion.
// The tag is Fish-ONLY: ElevenLabs would read "(excited)" aloud, so the stock
// path gets the raw text and leans on its own style/stability instead.
function speak(charId, voice, text, style, stability, category) {
  const cloned = CLONED[charId];
  if (cloned?.provider === 'fish' && env.FISH_API_KEY) {
    return fishTTS({
      apiKey: env.FISH_API_KEY,
      referenceId: cloned.modelId,
      text: withEmotion(charId, category, text),
      temperature: style ?? 0.7,
    });
  }
  return tts(voice, text, style ?? 0.9, stability);
}

const grunts = Object.entries(voiceLines).flatMap(([id, def]) =>
  Object.entries({ kiai: def.kiai, hurt: def.hurt, victory: def.victory }).flatMap(
    ([category, lines]) =>
      lines.map((text, i) => [id, `${id}-${category}-${i + 1}`, def.voice, text, def.style, def.stability, category])
  )
);

// per-move voice call-outs (id `<char>-move-<moveId>`) — a character can name a
// line for a specific move; played instead of a random kiai when it fires
const moveGrunts = Object.entries(voiceLines).flatMap(([id, def]) =>
  Object.entries(def.moves ?? {}).map(([moveId, text]) => [
    id, `${id}-move-${moveId}`, def.voice, text, def.style, def.stability, 'move',
  ])
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
    // stage names get the dedicated radio-announcer voice; everything else
    // keeps Maverick
    run: () => tts(id.startsWith('stage-') ? STAGE_VOICE : ANNOUNCER, text, 0.9),
  }));
const gruntTasks = [...grunts, ...moveGrunts]
  .filter(([charId]) => !only || charId === only)
  .map(([charId, id, voice, text, style, stability, category]) => ({
    out: join(AUDIO, 'voice', `${id}.mp3`),
    label: `grunt ${id}${CLONED[charId] ? ' (cloned voice)' : ''}`,
    prompt: text,
    run: () => speak(charId, voice, text, style, stability, category),
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

// Only generate when run AS the CLI — importing this module for its tables
// (voiceLines is the recovery source for migrate-vo.mjs and the studio) must
// never fire an ElevenLabs batch.
const isMain = (process.argv[1] ?? '').endsWith('gen-audio.mjs');
if (isMain) {
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
}
