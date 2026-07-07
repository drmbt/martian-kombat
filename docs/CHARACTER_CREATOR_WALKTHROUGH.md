# Character Creator Wizard — worked walkthrough (dummy data)

Companion to `CHARACTER_CREATOR.md`. A concrete dry-run of every dialog with a **fictional** character
so the state transitions are legible. At each step: **UI**, **assets list**, **JSON template**, and the
**exact prompt + images** sent to the model.

**Legend (assets):** ✎ user-provided · ⏳ generating (jobId) · ✅ done · ⬜ pending · 🅱️ background job
**All character prompts append** `STYLE_BASE` + `FRAME_RULES` from `tools/style.md` (painted cel,
`#00B140` green, full body, feet on invisible ground, facing right) — shown as `+STYLE` for brevity.

## Given inputs (the four the user brings)
```
name:        "Mirage"
description: "a heat-shimmer desert illusionist who fights with sand and mirror-doubles"
image A:     fullbody.jpg   (required)
image B:     face.jpg       (optional close-up)
voice:       sample.wav     (optional)
stage image: saltflat.jpg   (optional landscape)
```

---

## D1 · SEED

**UI**
```
Name          [ Mirage                                   ]  → id: mirage
Full-body img [ fullbody.jpg ✎ ]   Face img [ face.jpg ✎ ]  (or: "generate from prompt…")
Description   [ a heat-shimmer desert illusionist who fights with sand and mirror-doubles ]
Voice sample  [ sample.wav ✎ ]     Stage image [ saltflat.jpg ✎ ]
                                                   [ Begin ▸ ]
```

**Assets after D1**
```
✎ assets/character-inspo/mirage.jpg           (from fullbody.jpg)
✎ assets/character-inspo/face/mirage.jpg      (from face.jpg)
✎ assets/voice-inspo/mirage/sample.wav
✎ assets/stage-inspo/mirage-mirage-flats/saltflat.jpg   (stage folder id: mirage-flats)
⏳ raw/canonical/mirage.png                    (job canonical#a1)
🅱️ Fish voice clone                            (job voice#a2)
```

**JSON template after D1** (skeleton only)
```jsonc
{ "id": "mirage", "name": "MIRAGE" }
```

**Prompts sent at D1**

*T1 — design draft (Gemini text, images attached: fullbody.jpg + face.jpg). Seeds the context cache.*
```
SYSTEM: You are designing a Martian Kombat fighter. Output STRICT JSON matching the CharacterDef
schema + the extension blocks (lore, specialPool, imagePrompts, vo, stage, fatality). Choose special
archetypes ONLY from this catalog: [projectile, anti-air-dp, charge-projectile, command-grab,
advancing-rush, reversal, teleport, mash, …]. Frame data in engine ticks (60/s). All boxes feet-origin.
Ground flavor in the attached photos + description. Over-generate pools (≥8 special ideas, ≥6 of each
VO type) for instant rerolls. Also emit every per-cell IMAGE PROMPT (canonical, idle/walk, 5 pose
bases, 9 standing + 6 jump + 6 crouch normals, per-special projectile/active/startup/recovery,
portraits, KO, 4 fatality panels, stage) and a stage MUSIC prompt.
USER: name="Mirage"; desc="a heat-shimmer desert illusionist who fights with sand and mirror-doubles".
[image: fullbody.jpg] [image: face.jpg]
```
→ returns the full bible (used to fill D2→D8; abbreviated inline below).

*I1 — canonical (nano-banana, refs: fullbody.jpg + face.jpg)*
```
Full-body fighting-game character sheet of a lean desert illusionist in sun-bleached wrapped linens and
a mirrored half-mask, heat-shimmer aura, faint sand swirling at the hem; neutral confident standing
pose, arms relaxed, facing right. Identical face to the close-up reference. +STYLE. Solid flat
chroma-green background.
```

---

## D2 · PROFILE + STAGE  *(canonical baking; the big latency window)*

**UI** (values pre-filled from T1; every field editable; lock-grids for the candidate sets)
```
Archetype  [ Zoner / trickster ]     Color [ #e0b062 ▓ ]     Home stage [ mirage-flats ]
Personality[ aloof, playful, talks in riddles ]
Backstory  [ a surveyor who wandered too long in the heat and came back… doubled ]   (arcade)

Victory quotes   🔒[ "Now you saw me." ]  □[ "You were fighting the wrong one." ]  □[ "Heat does that." ]
                 □[ "I was never there." ] □[ "Blink again." ]                      [ Reroll unlocked ]
Kiai (6)  🔒 … □ …                                                                  [ Reroll unlocked ]
Hurt (6)  □ …                                                                       [ Reroll unlocked ]

Stage  ⏳ generating from saltflat.jpg …  →  ✅ [thumb]  [ place on map ✚ ]
Music  [ prompt ▾ ]  ⏳ compose …
Fatality  name[ Heat Death ]  input[ hcb + P ▾ ]
                                                                     [ Confirm profile ▸ ]
```

**Assets after D2**
```
✅ raw/canonical/mirage.png                    (canonical#a1 finished — gates D3)
⏳ backgrounds/stages/mirage-flats.jpg         (stage#b1)  → ✅
⏳ audio/music/stages/mirage-flats/theme.mp3   (music#b2)
✅ Fish voice model id → tools/voices.json
```

**JSON template after D2** (identity + profile + physics + copy + moves *skeleton*; no boxes/specials yet)
```jsonc
{
  "id": "mirage", "name": "MIRAGE",
  "color": "#e0b062",                                   // ← T1, user-editable
  "stage": "mirage-flats",                              // ← set on map-place
  "lore": { "tagline": "Now you see me.",               // ← NEW block, T1 + edits
            "personality": "aloof, playful, talks in riddles",
            "backstory": "a surveyor who wandered too long in the heat and came back… doubled" },
  "winQuotes": ["Now you saw me.", "You were fighting the wrong one.", "Heat does that."], // ← locked set
  "health": 950, "walkSpeed": 3.4, "backSpeed": 3.5,    // ← T1 archetype defaults, editable
  "jumpVel": 18, "gravity": 0.9, "prejumpFrames": 4, "scale": 1.0,
  "moves": {                                            // ← frame-data skeleton (no hitboxes yet)
    "lp": { "startup": 4, "active": 3, "recovery": 8, "damage": 30, "hitstun": 12,
            "blockstun": 8, "knockback": 3, "hitbox": null, "height": "mid" }
    /* …26 more normals, frame data from T1, hitbox:null until D6… */
  },
  "fatality": { "id": "heat-death", "name": "Heat Death",
                "input": { "motion": "hcb", "button": "punch" }, "panels": 4 }  // ← concept only
}
```
*(Written to the in-browser working model + sidecar `mirage.creator.json` holding the reroll pools.)*

**Prompts sent at D2**

*I9 — stage (nano-banana, refs: `style-ref-salton.jpg` FIRST, then saltflat.jpg)*
```
A cracked white salt-flat under a blinding noon sun, distant heat-mirage shimmer on the horizon, a lone
leaning survey marker. Redraw as gritty 16-bit retro pixel-art anchored on the first style reference.
21:9. The bottom quarter is a continuous textured walkable salt-crust ground plane, edge to edge,
touching the bottom of the frame; no props or people in the fighter strip.
```
*A3 — stage music (ElevenLabs compose, text only)*
```
A loopable ~75s instrumental battle theme for a sun-scorched salt-flat duel stage. Parched desert
dub-techno: heat-warped synth drones, distant tabla-ish percussion, mid-tempo ~92 BPM, strong rhythmic
loop, no vocals, clean loop point, mixed to sit under SFX.
```
*(Rerolls of quotes/kiai/hurt draw from the `mirage.creator.json` pool — **no model call**.)*

---

## D3 · CANONICAL GATE  *(the one hard stop)*

**UI**
```
        ┌─────────────── raw/canonical/mirage.png ───────────────┐
        │  [ big green preview ]                                  │
        └────────────────────────────────────────────────────────┘
  [ ✓ Accept ]   [ ↻ Re-roll (tweak prompt…) ]   [ ⤒ Upload my own ]
```

**On Accept:** measure geometry (§11b) + fan out background jobs.

**Assets after D3**
```
✅ raw/canonical/mirage.png                    (accepted → cache grows with it)
🅱️ portraits/mirage.png        (icon#c1)
🅱️ portraits/mirage-ko.png     (ko#c2)
🅱️ portraits/mirage-bust.png   (crop#c3 — no gen)
🅱️ fatalities/mirage/heat-death-{1..4}.jpg     (fatality#c4)
🅱️ audio/announcer/mirage.mp3 + voice/mirage-{kiai,hurt,victory}-N.mp3   (audio#c5, via clone)
```

**JSON template after D3** (measured boxes added)
```jsonc
{
  /* …unchanged from D2… */
  "spriteOffsetY": -12,                                 // ← MEASURED (sole→floor at scale)
  "bodyBox":   { "x": -42, "y": -240, "w": 84,  "h": 240 },  // ← MEASURED (torso)
  "hurtStand": { "x": -52, "y": -256, "w": 104, "h": 256 }   // ← MEASURED (silhouette)
  // hurtCrouch still pending → set in D4-B2
}
```

**Prompts sent at D3** (all background; all reference the cached canonical)

*I2 — portrait icon* `Head-and-shoulders portrait of MIRAGE, straight-on, neutral confident, mirrored half-mask. +STYLE, chroma-green.`
*I3 — KO portrait* `MIRAGE beaten and exhausted, mask cracked, head bowed, bruised, downcast. +STYLE, chroma-green.`
*I8 — fatality panels (refs: canonical + generic burnt-husk victim)* e.g. panel 1: `16:9 cinematic cutscene — MIRAGE raising both hands as the air ripples with heat; the opponent staggering in a shimmering haze. Dramatic desert light.`
*A1/A2 — TTS:* announcer says `"MIRAGE"`; VO lines are the T1 text through the Fish clone.

---

## D4 · BASE SPRITES + NORMALS  *(staged batches, live preview lower-left)*

**UI** (grid fills as cells land; per-cell warning badge from advisory QA; single-cell reroll)
```
 B1 ▸ idle-a ✅  idle-b ✅  walk-a ✅  walk-b ⚠️edge  [ Approve batch ]   ↻ single: [from canonical|img2img]
 B2 ▸ jump ✅  crouch ✅  block ✅  fall ✅  down ⏳    [ Approve batch ]
 B3 ▸ 9 standing ⏳  6 jump ⬜  6 crouch ⬜
 ┌ live preview ┐   move: [ lp ▾ ]   startup[4] active[3] recovery[8]  ◀▶ tune
 │  (looping)   │
 └──────────────┘
```

**Assets after D4** (accumulating into the working sheet; packed on WRITE)
```
✅ working cells: idle-a/b, walk-a/b, jump, crouch, block, fall, down, lp…hk, clp…chk, jlp…jhk
⚠️ walk-b flagged (edge bleed) — user regenerated with note "arms tucked in, keep inside frame"
```

**JSON template after D4** (hurtCrouch measured; timing tuned live — hitboxes still null)
```jsonc
{
  /* … */
  "hurtCrouch": { "x": -52, "y": -150, "w": 104, "h": 150 },   // ← MEASURED from approved crouch base
  "moves": { "lp": { "startup": 4, "active": 3, "recovery": 8, /*…*/ "hitbox": null } /* tuned live */ }
}
```

**Prompts sent at D4**

*I4 idle-b (ref: canonical)* `Same character as the reference, relaxed fighting idle, BOTH feet flat, chest risen on the breath. NOT an attack — no raised knee, kick or lunge. +STYLE.`
*I5 crouch (ref: canonical)* `Same character, squatting EXTREMELY low, knees folded, hips at heel height — the whole figure occupies ONLY the BOTTOM HALF of the frame. +STYLE.`
*I6a st.HP (ref: canonical)* `Same character throwing a heavy overhand palm strike (active frame, full extension), weight forward on the front foot, one clear action, no extra limbs. +STYLE.`
*I6b j.HK (ref: **approved jump image**)* `The SAME airborne pose as the reference, now a heavy downward air kick; copy the body height and airborne framing of the reference. +STYLE.`
*I6c cr.MK (ref: **approved crouch image**)* `The SAME low crouch as the reference, now a low sweeping mid kick while staying low; copy the body height of the reference — do NOT stand up. +STYLE.`
*Single-cell reroll (walk-b, img2img — feeds the bad cell back)* `Fix this frame: tuck the arms in so nothing crosses the frame edge; keep the mid-stride left-foot-forward walk. +STYLE.`

---

## D5 · SPECIALS  *(4-slot table; cook in parallel; projectile-first chains)*

**UI**
```
# Name          Controls        Description                         State        Actions
1 Sand Blast    [ qcf+P ▾ ]     ranged blinding sand projectile     ✅ done ▸play [↻ pool][gen]
2 Mirage Step   [ qcb+K ▾ ]     teleport behind, leave a shimmer    ⏳ active…    [↻ pool][gen]
3 Sun Pillar    [ dp+P  ▾ ]     rising anti-air heat column         ⬜ idle       [↻ pool][gen]
4 Doppelgänger  [ qcf+K ▾ ]     dash forward as a mirror-double     ⬜ idle       [↻ pool][gen]
   ↻ pool = instant swap from mirage.creator.json → then moveIdeas.json (no LLM call)
```
*(Controls dropdown offers only archetype-legal combos: projectile→[qcf+P, qcf+K, hcf+P]; anti-air→[dp+P, dp+K]; etc.)*

**Assets after D5**
```
✅ sprites cells: sand-blast-{startup,active,recovery}, mirage-step-*, sun-pillar-*, doppelganger-*
✅ sprites/mirage/projectile-sand-blast.png    (approved projectile art)
```

**JSON template after D5** (specials filled with archetype params from T1)
```jsonc
"sand-blast": {
  "name": "Sand Blast", "input": { "motion": "qcf", "button": "punch" },
  "startup": 13, "active": 2, "recovery": 24, "damage": 0, "hitstun": 0, "blockstun": 0,
  "knockback": 0, "hitbox": null, "height": "mid",
  "projectile": { "vx": 9, "spawnX": 92, "spawnY": -170,
                  "box": { "x": -26, "y": -26, "w": 52, "h": 52 },
                  "damage": 60, "hitstun": 18, "blockstun": 12, "knockback": 8 },
  "variants": { "l": { "projectile": { "vx": 6 } }, "h": { "projectile": { "vx": 13 } } }
},
"mirage-step": { "name": "Mirage Step", "input": { "motion": "qcb", "button": "kick" },
  "startup": 10, "active": 1, "recovery": 18, "hitbox": null, "height": "mid",
  "teleport": { "mode": "behind", "mirror": true }, "invulnFrom": 6, "invuln": 12 }
/* + sun-pillar (leap anti-air), doppelganger (forwardVel rush) */
```

**Prompts sent at D5** (Sand Blast chain — projectile first, then phases cross-reference)

*projectile (refs: **inspo images ONLY**, never canonical)* `A dense spinning disc of blinding golden desert sand and heat-glare, keyable gold energy, no character, side view travelling right. Solid flat chroma-green background.`
*active (refs: projectile + inspo)* `MIRAGE at the release of Sand Blast — front hand thrust forward, body coiled behind it, the spinning sand disc leaving the palm. +STYLE.`
*startup (ref: approved active frame)* `The frame just BEFORE the active pose above — MIRAGE gathering sand, hand drawn back, coiling. Same character, same scale. +STYLE.`
*recovery (ref: approved active frame)* `The frame just AFTER the active pose above — MIRAGE settling from the throw, arm extended and dropping. Same character, same scale. +STYLE.`

---

## D6 · RIG  *(skeleton + auto-hitboxes, now that every cell exists)*

**UI**
```
[ Run skeleton (fal DWPose) ]  → keypoints overlaid on every cell
Auto-hitboxes from hand/foot clusters  → editable boxes on-canvas
 move [ st.HP ▾ ]  hitbox drag ⬚   timing startup[9] active[4] recovery[17]
```

**Assets after D6**
```
✅ meta.skeletons (per-cell keypoints, un-normalized)
✅ every attacking move now has a measured hitbox
```

**JSON template after D6** (hitboxes filled)
```jsonc
"lp": { "startup": 4, "active": 3, "recovery": 8, "damage": 30, "hitstun": 12, "blockstun": 8,
        "knockback": 3, "hitbox": { "x": 40, "y": -196, "w": 64, "h": 40 }, "height": "mid" }  // ← AUTO, editable
```

*(No image prompts here — pure measurement/edit. fal endpoint call, not nano-banana.)*

---

## D7 · POLISH  *(review background-baked assets)*

**UI:** filmstrips for portraits / KO / fatality panels / VO clips (play) / optional per-move VFX.
Approve or ↻ reroll each. Nothing here blocks; warnings only.

**Assets after D7:** all D3-background jobs reviewed ✅; optional `sprites/mirage/vfx-sun-pillar.png` added if user opts in.

**Prompt (only if VFX opted-in), I10** `A vertical burst of golden heat-haze and rising embers, keyable gold, on solid flat magenta. Single impact flash.`

---

## D8 · SHIP

**UI**
```
[ Final normalize floor pass ]  → all cells aligned to one plane, meta.skeletons shifted by dy
Write:  ✅ characters/mirage.json   ✅ sprites/mirage/{sheet.png,meta.json}   ✅ roster/index/manifest
        [ Run audit ]  → 0 gaps ✅
        [ ▶ PLAY NOW (test fight) ]     [ ☁ PUBLISH to R2 ]
```

**Assets after D8** (final, audit-green)
```
✅ src/data/characters/mirage.json           (import added to characters/index.ts)
✅ src/data/roster.ts                          (+{ id:'mirage', name:'MIRAGE', playable:true })
✅ public/assets/sprites/mirage/sheet.png + meta.json   (NORMALIZED, single lean pack path §11a)
✅ public/assets/portraits/mirage{,-bust,-ko}.png
✅ public/assets/audio/announcer/mirage.mp3 + voice/mirage-*.mp3 (17)
✅ public/assets/fatalities/mirage/heat-death-{1..4}.jpg
✅ public/assets/backgrounds/stages/mirage-flats.jpg + audio/music/stages/mirage-flats/theme.mp3
✅ src/data/assetManifest.json                 (rescanned)
✅ tools/frames-manifest.mjs + gen-audio.mjs   (entries written for repo reproducibility)
```

**Final JSON** = the complete CharacterDef (identity + lore + physics + measured boxes + 27 normals with
timing & hitboxes + 4 specials with archetype params + fatality) — the in-browser working model
serialized verbatim. Audit passes → Mirage is playable.
