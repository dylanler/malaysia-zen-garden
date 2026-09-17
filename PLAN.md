# Taman Kenangan — a Malaysian Zen Garden

> Title chosen: *Taman Kenangan* (garden of memories). The plan below was written under the working title *Taman Tenang*; the name is the only thing that changed.
>
> Plan v0.1, plus a status note. A slow, walkable, sound-led Three.js experience that reinterprets the zen garden through Malaysian millennial memory (roughly the childhoods of people born 1981–1996: late 80s to mid 2000s Malaysia), with equal, deliberate representation of Malay, Chinese, Indian, Kadazan-Dusun and Iban cultures.
>
> **Status.** The Full tier (§15) is built: all eight stations with their signature interactions, the day arc, weather, the shared-scale sound garden and the finale, on desktop and touch. Every model, texture and sound is procedural (generated in the browser), which replaced the asset pipeline in §12 and the sourcing plan in §9.5 for this version; field recordings, hand-modelled hero objects and community review (§8.4, M8) remain the next steps. Decisions taken are recorded in §17. The README covers running and deploying.

---

## Table of contents

1. [TL;DR](#1-tldr)
2. [Vision](#2-vision)
3. [Design pillars](#3-design-pillars)
4. [The garden: layout and journey](#4-the-garden-layout-and-journey)
5. [Stations in detail](#5-stations-in-detail)
6. [Recurring systems](#6-recurring-systems)
7. [Nostalgia memory bank](#7-nostalgia-memory-bank)
8. [Representation and cultural care](#8-representation-and-cultural-care)
9. [Sound design](#9-sound-design)
10. [Art direction](#10-art-direction)
11. [Controls, UX and accessibility](#11-controls-ux-and-accessibility)
12. [Technical architecture](#12-technical-architecture)
13. [Content specification](#13-content-specification)
14. [Milestones](#14-milestones)
15. [Scope tiers](#15-scope-tiers)
16. [Risks and mitigations](#16-risks-and-mitigations)
17. [Open decisions](#17-open-decisions)
18. [Glossary](#18-glossary)

---

## 1. TL;DR

- **What:** a first-person "stroll" through a dreamlike Malaysian landscape arranged as a ring around a still lake. Eight garden rooms ("stations"), each holding one hero object, one signature interaction, one instrument, and a handful of two-line memories.
- **Arc:** the walk is one day. Dawn on a kampung verandah, noon at a rainforest waterfall, an afternoon downpour in a wakaf, golden hour in Sabah paddy, sunset on an Iban ruai, dusk on a shophouse street lit by kolam lamps and cellophane lanterns, night on the lake among synchronised fireflies, and home to a row of lit pelita.
- **Representation:** every one of the five cultures gets a station built from the same template (place, hero object, interaction, instrument, festival light, memories), plus shared spaces (padang, waterfall, wakaf, lake) where the cultures mix, because the mixing is the memory.
- **Feel:** no run button, no timers, no fail states, no score. Sound leads you before sight does. Touch reveals: peel, unfold, draw, strike, pluck, light, cup.
- **Music thesis:** every culture's instrument (Malay gamelan, Chinese plucked strings, Indian veena/tanpura drone, Kadazan-Dusun gongs, Iban engkerumong) shares one pentatonic scale. Every interaction plays a note. At the end, they play together.
- **Tech:** Three.js (WebGL), Vite + TypeScript, Web Audio, low-poly stylised art, instanced vegetation, lazy-loaded stations, static hosting, PWA. Desktop and mobile (touch, portrait and landscape) from day one.
- **No backend, no database, no accounts.** Progress and settings live in `localStorage`.

---

## 2. Vision

A zen garden is not a theme park. It works through emptiness, slowness, natural material, a single focal point per view, repetition, and impermanence. The Japanese version rakes gravel; the Malaysian version we are building draws rice-flour kolam that sparrows will eat tomorrow, unwraps a warm nasi lemak, listens to rain on a zinc roof, and watches berembang trees breathe light on a river at night.

The player should feel three things, in this order:

1. **Recognition** ("I know this. I had forgotten I knew this.")
2. **Tranquility** (breath slows; the phone is held a little lower)
3. **Belonging** (every Malaysian sees their own home *and* their neighbour's, on the same path, at the same weight)

Reference tones (mood, not assets): the unity-themed festive TV commercials of the late 90s and 2000s, Alto's Odyssey / Monument Valley for pacing and palette discipline, the quiet of Sable and Journey for sound-led wayfinding.

---

## 3. Design pillars

| Pillar | What it means in practice |
|---|---|
| **Slow** | Walking speed 1.1–1.3 m/s. No sprint. Camera eases. Nothing counts down. Nothing can be failed. |
| **Sparse** | One hero object per station. Negative space is content: a wide padang, an open sawah, a still lake. If a prop does not carry a memory or a sound, cut it. |
| **Sensory** | You hear a station before you see it. Every interaction has a tactile analogue (peel, pour, strike, fold) and a sound with a long tail. |
| **Shared** | Five cultures, one path, one scale, one home. Stations are built from the same template so no culture reads as "featured" or "token". Shared spaces sit between cultural spaces. |
| **Specific** | Details are millennial-era Malaysian, not generic Southeast Asia. Brown paper on nasi lemak, cellophane lanterns that catch fire, ice-cold malt drink at Hari Sukan, the roti man's horn at five. Specificity is what triggers nostalgia. |

---

## 4. The garden: layout and journey

### 4.1 Layout

A ring path around a central lake (*tasik*). The lake is visible from every station and anchors the composition; fog hides everything beyond the ring. Stations are garden rooms separated by hedges, rock, forest edge or a change in ground material, so each is framed on approach.

```
                  ┌──────────────  SAWAH · Tuai / Kaamatan  ──────────────┐
                  │              (Kadazan-Dusun · golden hour)             │
        WAKAF · Hujan                                          RUMAH PANJAI · Ruai / Gawai
     (shared · afternoon rain)                                       (Iban · sunset)
                  │                                                        │
    HUTAN & AIR TERJUN · Sejuk               T A S I K              JALAN KENANGAN · Senja
     (shared rainforest · noon)              (the lake)           (Indian + Chinese · dusk)
                  │                     Kelip-kelip · night        ├─ Kolam & Vilakku (Indian)
        PADANG · Angin                    (sampan crossing)        └─ Kopitiam & Tanglung (Chinese)
     (shared · morning)                                                    │
                  └───────────  RUMAH KAMPUNG · Pulang  ───────────────────┘
                              (Malay · dawn; return at night)
```

Walk clockwise. Free roam is allowed, but the path, the sound and the light all nudge the same direction.

### 4.2 Time of day

Time is tied to **progress, not the clock**. Entering a station's trigger volume (or completing its interaction) advances the day smoothly over ~20 seconds to that station's target hour. Wandering back does not rewind time; the garden simply remembers where the sun was. A full loop is one day.

| Order | Station | Culture | Hour | Light |
|---|---|---|---|---|
| 0 | Rumah Kampung · *Pulang* | Malay | dawn (06:45) | lilac-peach, low mist over the lake |
| 1 | Padang · *Angin* | shared | morning (09:30) | clean, high blue, hard shadows |
| 2 | Hutan & Air Terjun · *Sejuk* | shared | noon (12:30) | emerald canopy, god rays |
| 3 | Wakaf · *Hujan* | shared | afternoon (15:30) | slate-teal, rain, distant thunder |
| 4 | Sawah · *Tuai / Kaamatan* | Kadazan-Dusun | golden hour (17:30) | amber over green-gold paddy, Kinabalu silhouette |
| 5 | Rumah Panjai · *Ruai / Gawai* | Iban | sunset (18:30) | vermilion river, long shadows on timber |
| 6 | Jalan Kenangan · *Senja* | Indian + Chinese | dusk (19:15) | indigo sky, warm lamp and lantern light |
| 7 | Tasik · *Kelip-kelip* | shared | night (21:00) | navy, moon, synchronised green pulses |
| 0' | Rumah Kampung (return) | Malay | night (21:30) | pelita flames along the path, verandah bulb |

### 4.3 A walk, in prose (12–20 minutes)

You wash your feet at the tempayan before climbing the stairs. On the verandah a nasi lemak bungkus waits, still warm; you peel it open and steam drifts up while a spotted dove coos somewhere behind the house. You cross the padang; a wau bulan hums when you let out its string. You follow the sound of water into the forest until the waterfall fills everything; you sit on a boulder and the interface disappears. Clouds gather. Rain begins as you reach the wakaf; you sit under the zinc roof and fold a paper boat for the drain. The rain lifts into gold and the path opens onto paddy at the foot of a distant Kinabalu; you strike gongs and the wind answers in the rice. On the ruai of the longhouse the pua kumbu hangs, and the loom is waiting. On the shophouse street two doorways face each other: one with a half-drawn kolam and unlit brass lamps, the other a kopitiam with cellophane lanterns hanging from the five-foot way. You draw, you light, and you carry a lantern down to the jetty. The sampan drifts across the black lake under trees that breathe light; you cup your hands and one firefly stays. On the far shore a row of pelita leads up to the house. You light them one by one. The last one is the house. You're home.

---

## 5. Stations in detail

Each station follows the same template: **Place · Time · Soundscape · Hero object · Signature interaction · Secondary · Instrument · Memory lines (drafts) · Tech notes · Care notes.**

### 5.0 Rumah Kampung · *Pulang* (Malay · dawn, and the night return)

- **Place:** a timber kampung house on stilts with an *anjung* (verandah), zinc roof, *tangga* (stairs) with a *tempayan* (clay water jar) and *gayung* (dipper) at the foot. *Kain pelikat* and batik on the *ampaian* (clothesline). A rubber tree with tapping cup, a rambutan tree, a *bunga raya* hedge. A small roadside *gerai* (stall) out front with a stack of nasi lemak triangles under a cloth and a cardboard "RM1" sign. A green mosquito-coil (*ubat nyamuk*) smoking in a saucer at dusk on the return.
- **Soundscape (dawn):** *tekukur* / *merbuk* dove cooing, far roosters, leaves, a radio somewhere playing a muffled original 90s-pop pastiche, ceiling fan wobble on the verandah. **(night):** crickets, *cicak* clicks, oil-lamp flicker, the lake lapping.
- **Hero object:** the **nasi lemak bungkus** (pyramid wrap: banana leaf inside, brown paper or newspaper outside).
- **Signature interaction: the peel.**
  1. Tap the stack at the gerai; one triangle lifts into a close-up "in your hands" view. The world softens (fog and vignette; DOF on desktop only).
  2. Flick the tucked paper corner / rubber band (snap sound).
  3. Drag each of three paper flaps outward. Drag distance scrubs the unfold; release snaps to the nearest open/closed state. Paper crinkle layered per flap.
  4. Drag the banana leaf open. Steam particles rise; rice, sambal sheen, *ikan bilis*, peanuts, cucumber, half an egg. A soft leaf sound, then a single Malay gamelan note.
  5. Memory card fades in. Swipe down to set it down. Station complete, time advances.
- **Secondary:** wash feet at the tempayan (hold on the gayung: pour, ripples, the threshold ritual that begins the whole walk); *congkak* board on the verandah (tap a house to sow seeds, cowrie clicks; no opponent, just the rhythm); on the night return, **light the pelita** along the path (tap each; the last is the house).
- **Instrument:** Malay gamelan (saron / gambang timbre).
- **Memory lines (drafts):**
  - "Wash your feet before you climb. The water is colder than the morning."
  - "RM1. The paper is still warm. You save the egg for last."
  - "One flame for each stake. The last one is the house. You're home."
- **Tech notes:** wrapper as one mesh with **morph targets** per flap and leaf (deterministic scrubbing with `morphTargetInfluences`); rice as a clustered low-poly blob with a grainy normal; sambal as a decal. Steam: ~60 soft sprites. Tempayan water: small animated-normal plane. Pelita: point lights are budget-capped, so use emissive flame sprites plus one or two real lights near the player.
- **Care notes:** *pelita* are tied to Ramadan's *malam tujuh likur* and Hari Raya; present them as festive light, never as religious practice. Distant maghrib *azan* on the return is a decision (see §17): if included it must be a respectful, distant, muffled texture with a settings toggle and no interaction attached.

### 5.1 Padang · *Angin* (shared · morning)

- **Place:** an open school-field-sized *padang*, a *pondok* (shelter) at the edge, a green van with a cold malt drink dispenser (shape and colour only; no logo), a *getah* skipping rope hooked on a post, a *guli* (marble) circle scratched in the dirt, five stones on the steps.
- **Soundscape:** wind, far-off children (mixed, distant, no intelligible language), a bicycle bell passing, a whistle once.
- **Hero object:** a **wau bulan** (Kelantanese moon kite) leaning against the pondok.
- **Signature interaction: fly the wau.** Pick up; the camera turns into the wind; hold to let out string, kite climbs; the *busur* (bow) on the kite begins to **hum** (*dengung*) louder with altitude and wind; tilt to look up; release to reel in. No goal except height and hum.
- **Secondary (stretch):** *batu seremban* (toss-and-catch timing with five stones), *guli* (flick a marble), *gasing* (spin a top with a drag-and-release).
- **Instrument:** wind hum, tuned to the shared scale's drone.
- **Memory lines (drafts):**
  - "The bow hums when the wind is right. You learn to hear the sky."
  - "Hari Sukan. The van is green. The cup sweats in your hand."
- **Tech notes:** kite as a rigged mesh with a spring-damper on a string spline; the hum is a synthesised drone (oscillator + filter) modulated by altitude and wind noise.
- **Care notes:** none beyond trademarks (§8.5). The padang is deliberately a shared space; games are not assigned to ethnicities.

### 5.2 Hutan & Air Terjun · *Sejuk* (shared rainforest · noon)

- **Place:** a trail under dipterocarp canopy with buttress roots, tree ferns, *periuk kera* (pitcher plants), moss; the trail descends to a two-tier waterfall and a cold pool. On the flattest boulder someone has spread a *tikar*, a floral thermos, a tupperware, a pair of slippers. Nobody is there. They just left.
- **Soundscape:** the *riang-riang* cicada waves, hornbill wingbeats overhead, drips, then the waterfall growing from pink noise to full. Audio is the wayfinding: you hear the falls a full minute before you see them.
- **Hero object:** the **waterfall** itself.
- **Signature interaction: sit.** Duduk spots on boulders: tap to sit, the camera settles low, UI hides, the audio "opens" (detail layer of individual drips, spray, birds; low shelf lifts). Mist beads on the lens. Nothing to do. Clouds gather while you sit; when you stand the light has changed.
- **Secondary:** **skip stones** (pick up, flick; skip count from flick angle and speed; ripples and plinks in the scale); step into the shallows (screen-edge ripple, cold-water sound).
- **Instrument:** water pitched plinks.
- **Memory lines (drafts):**
  - "The tikar is on the flattest rock. Someone's mother is saying don't go past the big stone."
  - "The water is colder than the air has any right to allow."
- **Tech notes:** waterfall = scrolling noise textures with foam at impact, plus ~200 mist sprites; pool = animated normals + fresnel + cheap refraction offset (no render-to-texture on mobile); god rays = a few soft billboards; canopy = instanced trees with vertex-shader sway and LOD.
- **Care notes:** none. Leeches are not modelled.

### 5.3 Wakaf · *Hujan* (shared · afternoon rain)

- **Place:** a *wakaf* / *pondok* by the trail with a zinc roof and a *longkang* (drain) running past it. Rain arrives as you leave the waterfall and is full by the time you reach the shelter.
- **Soundscape:** rain on zinc near-field (with convolver reverb of a tin-roofed room), rain on leaves far-field, water sheeting off the roof edge, distant rolling thunder (randomised, never sudden or loud), the drain gurgling.
- **Hero object:** the **rain on the roof**.
- **Signature interaction: fold a paper boat.** A sheet of exercise-book paper on the bench. Three drag folds with snapping, then place it in the drain; the camera follows it drifting down the longkang until it disappears.
- **Secondary:** sit; catch rainwater in your palm (hold at the roof edge).
- **Instrument:** the roof (rain intensity is the tempo of everything here).
- **Memory lines (drafts):**
  - "Rain on zinc. Nobody says anything. Nobody needs to."
  - "Exercise-book paper, folded twice too many. It sails anyway."
- **Tech notes:** rain = GPU points in a camera-following volume; wetness parameter darkens and sharpens specular on ground materials; drain flow = scrolling flow-map; the boat follows a spline with bobbing. Rain eases over ~60 seconds after the boat leaves, into golden hour.
- **Care notes:** *wakaf* is the east-coast Malay word for a roadside rest hut; use *pondok* in UI if preferred. Shared space by design.

### 5.4 Sawah · *Tuai / Kaamatan* (Kadazan-Dusun · golden hour)

- **Place:** terraced paddy in green-gold, bunds to walk along, a bamboo *wakid* (back-basket) and a *tajau* (jar of *tapai*) under a hut, and on the horizon the silhouette of **Kinabalu** with its head in cloud. A *linopot* (rice wrapped in a tarap leaf) sits on the hut step.
- **Soundscape:** wind through paddy, a flock of *pipit* (sparrows) lifting, frogs, a distant gong ensemble practising for Kaamatan.
- **Hero object:** a **gong set** under the hut: a *sompogogungan*-style ensemble of hanging gongs with a *gandang* drum, plus a small *kulintangan* row.
- **Signature interaction: strike the gongs.** Tap any gong; each is a note of the shared scale, with long decay and slight beating. Strike the big gong and the paddy wind gusts in time. If you idle, a soft "ghost" pattern plays two bars as an invitation; you answer or you don't.
- **Secondary:** hold to blow the **sompoton** (bamboo mouth organ with gourd; sustained drone chord); run your hand through the paddy (bunds are walkable; touching the rice sways it and plays a whisper); unwrap the *linopot* (stretch, §6.1).
- **Instrument:** gongs and sompoton.
- **Memory lines (drafts):**
  - "The gongs carry further than voices. Kinabalu keeps its head in the clouds."
  - "Rice in a tarap leaf, tied at dawn, opened at noon. It tastes like the walk."
- **Tech notes:** paddy = `InstancedMesh` tufts (~20k instances) with vertex-shader wind driven by a global wind uniform that the gongs can push; gongs = physically-sampled hits at three velocities, round-robin, plus convolver.
- **Care notes:** Kaamatan carries a spiritual layer (*Bambarayon* the rice spirit, the *Huminodun* story, the *bobohizan*). Do not depict ritual; the harvest, the gongs and the hospitality are what we represent. Kinabalu (*Aki Nabalu*) is revered as a resting place of ancestors; keep it distant and unclimbable. Use "Kadazan-Dusun" in credits and text unless the community consultants advise otherwise. Verify all Kadazan/Dusun words with native speakers before shipping.

### 5.5 Rumah Panjai · *Ruai / Gawai* (Iban · sunset)

- **Place:** an Iban longhouse (*rumah panjai*) on the bank of a wide river; you climb a notched log to the *tanju* (open deck) and walk the *ruai* (long communal verandah) past *bilik* doors. *Pua kumbu* textiles hang from the beams; a *tuak* jar and a stack of *kek lapis* in a tin on a mat; a *terabai* shield on the wall; a longboat pulled up on the bank. A hornbill (*kenyalang*) crosses the sunset once.
- **Soundscape:** river, timber creak, an *engkerumong* gong-chime being played at the far end of the ruai, someone laughing two bilik down, hornbill call. Optionally a *sape* faintly from across the river, credited as Orang Ulu (see care notes).
- **Hero object:** the **pua kumbu loom**.
- **Signature interaction: weave.** A backstrap loom with the warp set up. Tap or drag to pass the weft; each pass reveals a row of an "inspired-by" pattern, and plays a note. Rows accumulate; the cloth lengthens. This is the garden's closest analogue to raking gravel: repetitive, slow, visible progress, no end state required.
- **Secondary:** tap the **engkerumong** gong-chime; cut a slice of *kek lapis* to reveal the layered pattern (stretch); sit on the ruai and watch the river.
- **Instrument:** engkerumong.
- **Memory lines (drafts):**
  - "The ruai is long enough for everyone. Someone is always awake at the far end."
  - "Every pattern was dreamed before it was woven. You are only borrowing the thread."
- **Tech notes:** cloth = a plane whose UV rows unmask from a pattern texture as rows are woven; the loom is a hero model with shape keys for the shed; river = the same water shader as the lake with a flow map.
- **Care notes:** the *sape* is an Orang Ulu (Kayan/Kenyah) instrument, not Iban; do not present it as Iban. Iban musical culture here is *engkerumong*, *tawak*, *bebendai*, *ketebong*. Pua kumbu motifs are spiritually significant and traditionally dream-derived; use original motifs "in the spirit of" pua kumbu geometry, designed with an Iban consultant, never copies of specific sacred patterns. No skulls in the ruai. Gawai Dayak (1 June) is depicted as gathering, not as *miring* ritual.

### 5.6 Jalan Kenangan · *Senja* (Indian + Chinese · dusk)

One pre-war shophouse street with a covered five-foot way (*kaki lima*) on both sides, Peranakan-pastel facades, a *pasar malam* packing up at the far end (generator hum winding down, one *putu bambu* steam whistle, the roti man's horn passing once). The two cultural rooms face each other across the street; the middle of the street is shared.

#### 5.6a Kolam & Vilakku (Indian)

- **Place:** a doorway with a *thoranam* (mango-leaf garland), a rack of jasmine (*malligai*) strings, small bowls of coloured rice, a half-drawn dot grid on the threshold tiles, and brass *vilakku* oil lamps waiting unlit. A tin of *murukku* and a stack of banana leaves on a stool. Crows on the wires.
- **Soundscape:** crows, a temple bell far away, a tanpura-like drone, anklet bells passing once, oil sizzling from a kitchen behind.
- **Hero object:** the **kolam**.
- **Signature interaction: draw the kolam.** A *pulli* (dot) grid guides you. Drag to draw with a grainy rice-flour brush; choose colours from the bowls; a **symmetry toggle** mirrors your stroke 4- or 8-fold radially (instantly satisfying, and true to kolam geometry). Then tap each vilakku to light it; the kolam glows at dusk. Tomorrow, the sparrows will have eaten it; a memory line says so.
- **Secondary:** unfold a banana leaf rice and fold it back toward you (stretch, §6.1).
- **Instrument:** veena-like pluck for strokes, tanpura drone underneath.
- **Memory lines (drafts):**
  - "Rice flour between finger and thumb. Draw it today; the sparrows will eat it tomorrow."
  - "Light one, then another. The doorway remembers who came."
- **Tech notes:** kolam = a `CanvasTexture` (2048²) on the threshold plane, drawn with a stamped grainy brush; symmetry computed in canvas space; vilakku = emissive sprites plus one shared point light with a warm falloff.
- **Care notes:** the kolam and the lamps are threshold-welcoming and festive (Deepavali, Ponggal), appropriate to interact with. No deities, no temple interiors, no Thaipusam iconography. The BM word *kolam* means pond; label the station "Kolam (கோலம்)" in UI to avoid confusion with the lake.

#### 5.6b Kopitiam & Tanglung (Chinese)

- **Place:** a Hainanese-style kopitiam under the five-foot way: marble-topped tables, bentwood chairs, a wall clock, a ceiling fan, a *xiangqi* board mid-game, a folded newspaper, two half-boiled eggs and kaya toast at one table, steam still on the kopi. From the awning hang **cellophane lanterns** in the millennial shapes: rabbit, goldfish, star, the pleated accordion ones. Red couplets on the doorframe. An ancestral altar glows inside, seen through the doorway only.
- **Soundscape:** mahjong tiles muffled from upstairs, the wall clock, the fan, a plucked string phrase from a radio, a temple bell far away, *cicak*.
- **Hero object:** the **cellophane lantern**.
- **Signature interaction: light a lantern and carry it.** Pick a lantern; hold a match to the wick (hold gesture); it glows; it becomes your **handheld light source for the rest of the night** (the jetty, the lake, the pelita path). The candle sways; hold the lantern low.
- **Secondary:** crack the half-boiled egg and pour soy and pepper (drag, drag, tap); move a xiangqi piece (one legal move suggested; nothing more).
- **Instrument:** guzheng/yangqin-like pluck.
- **Memory lines (drafts):**
  - "Hold it low so the candle won't tip. It tips anyway."
  - "Two half-boiled eggs, a splash of soy, white pepper. The newspaper folded small."
- **Tech notes:** lantern = translucent cellophane material (transmission approximated with alpha + backface tint on mobile), inner flame sprite, one point light parented to the camera at hand offset; the lantern can render into the UI layer during the sampan crossing to avoid clipping.
- **Care notes:** the altar and incense are ambient only (ancestor veneration is not a toy). Lanterns (Mid-Autumn), kopitiam and xiangqi are secular and appropriate to touch. No lion dance or firecracker audio at volume; they break tranquility.

### 5.7 Tasik · *Kelip-kelip* (shared · night)

- **Place:** a jetty at the end of Jalan Kenangan; a *sampan* waits. The lake at night, its far bank lined with *berembang* trees full of synchronised fireflies (the Kuala Selangor memory). The moon on the water. Your lantern is the only other light.
- **Soundscape:** oar creak, water lap, frogs, crickets, an owl, and one by one the five instruments enter, sparse, in the shared scale, until they play together softly as you reach the far bank.
- **Hero object:** the **fireflies**.
- **Signature interaction: cup your hands.** Hold anywhere; nearby fireflies drift toward a point in front of you, land, pulse in your palm; release and they lift away. The trees pulse in near-unison with soft jitter.
- **Secondary:** dip a hand in the water (trail of ripples); look up (constellations spell the credits, slowly).
- **Instrument:** all five, together.
- **Memory lines (drafts):**
  - "The trees breathe light. You cup your hands and one of them agrees to stay."
- **Tech notes:** fireflies = additive instanced points, ~3000, grouped per tree with a shared phase oscillator plus per-instance jitter; sampan on a spline with gentle roll; cheap bloom on desktop, sprite-based glow on mobile.
- **Care notes:** none.

The sampan lands at the kampung house's own small jetty. The pelita path (§5.0) leads home. After the last flame, the screen holds, then eases to dawn. The garden loops.

---

## 6. Recurring systems

### 6.1 The unwrap ritual (core: nasi lemak; stretch: the set)

Wrapped food is a motif every one of the five cultures shares, and peeling is the single most satisfying gesture in the brief. One drag-scrub unwrap system serves all of them:

| Culture | Wrapped thing | Layers |
|---|---|---|
| Malay | nasi lemak bungkus | paper flaps → banana leaf |
| Chinese | *bak chang* (glutinous rice dumpling) | string → bamboo leaves |
| Indian | banana leaf rice | unfold leaf; fold it back toward you when done |
| Kadazan-Dusun | *linopot* | tarap leaf tie → leaf |
| Iban | *pansuh* / *lemang* in bamboo | split the bamboo tube |

MVP ships nasi lemak only; the rest reuse the same code and gesture grammar.

### 6.2 The sound garden (one scale)

All instruments are tuned to a single five-note scale (start with a major pentatonic on a low root; test a slendro-like set). Consequences:

- Anything the player taps is consonant with anything else that is sounding.
- Idle time triggers sparse generative phrases in the current station's timbre.
- The finale layers all five timbres. Harmony is the thesis stated in sound.

### 6.3 Memory cards

Two lines maximum, second person, present tense, sensory and specific, no explaining. Bilingual (EN + BM) with the community language shown for the station's own words. Fade in at the moment of payoff, fade out on the next step. Never modal, never blocking.

### 6.4 Festival lights

Each station has a light you can bring into being: pelita (Malay), tanglung (Chinese), vilakku (Indian), the gong hut's oil lamp at dusk (Kadazan-Dusun), the ruai's *pelita* / resin torch (Iban). Lighting is always the same gesture (tap or hold) and the same note.

### 6.5 Sit mode

Available on every bench, boulder, step and deck. The camera lowers, the UI fades, the ambience detail layer opens, time drifts slowly. This is the zen garden proper; everything else exists to bring you to a seat.

### 6.6 Traces, not people

No human characters. Presence is implied: a steaming cup, slippers on a rock, laundry on the line, laughter two rooms away, a half-played board. This avoids uncanny animation, keeps the budget on the world, and sidesteps costume-as-stereotype. (Decision point, §17.)

---

## 7. Nostalgia memory bank

Sprinkled as props, sounds, one-line texts and Easter eggs. Anything trademarked is evoked by shape, colour and behaviour only.

**Objects:** floral enamel thermos, tiffin carrier (*mangkuk tingkat*), melamine floral plates, *kerusi malas*, rattan chair, *tikar mengkuang*, *kelambu* (mosquito net), green *ubat nyamuk* coil, kerosene *pelita*, cassette radio, oscillating fan with a wobble, the small blue-lined *buku 555* shop-tab notebook, glass sweet jars at the *kedai runcit*, a boxy late-80s national sedan silhouette in the driveway, a green malt-drink van, *kuih raya* in plastic containers, green *duit raya* packets and red *ang pow* packets on the same table.

**Sounds:** *tekukur* and *merbuk* doves, cicadas rising in waves, rain on zinc, thunder far away, the roti man's horn at five, an ice-cream motorbike bell, the *putu bambu* steam whistle, the *ting-ting* candy hammer and chisel, *cicak* at night, frogs after rain, a bicycle bell, mahjong tiles, a wall clock, a *pasar malam* generator, a whistle on a padang.

**Food:** nasi lemak bungkus, *kuih*, *apam balik*, *keropok lekor*, ice-cream potong, *cendol* / *ais kacang*, *roti john*, half-boiled eggs and kaya toast, *bak chang*, *murukku*, banana leaf rice, *linopot*, *hinava*, *tapai*, *pansuh*, *kek lapis*.

**Places and moments:** waterfall picnics (Sungai Congkak, Templer Park, Kanching, Chiling, Lata Iskandar), Hari Sukan, paper boats in the longkang, cellophane lanterns catching fire, Kaamatan at the padang, Gawai on the ruai, open houses at every festival, the fireflies at Kampung Kuantan, a very distant pair of twin towers on the horizon behind Jalan Kenangan (optional wink; they opened in 1998).

**Games:** wau, congkak, batu seremban, guli, gasing, ceper, *lompat getah*, *teng-teng*, *galah panjang*, sepak takraw net on the padang.

---

## 8. Representation and cultural care

### 8.1 The equal-weight template

Every cultural station is built from the same checklist so weight is structural, not editorial:

1. Place (architecture or landscape)
2. Hero object and signature interaction
3. Instrument timbre in the shared scale
4. Festival light
5. Food (the unwrap set)
6. 3–5 memory lines written or reviewed by someone from that community
7. Names in the community's language, BM and English

### 8.2 Sacred vs. festive

The rule: **interact with the festive and the domestic; observe the sacred.** Kolam, lanterns, pelita, gongs, loom, kopitiam: touch. Altars, incense, deities, prayer, *miring*, *bobohizan*, the azan: seen or heard at a distance, never gamified, and toggleable where audible.

### 8.3 Accuracy notes already identified

- *Sape* is Orang Ulu, not Iban. Iban station uses *engkerumong*; if a sape is heard anywhere it is credited as Orang Ulu.
- "Kadazan-Dusun" is the umbrella used in credits unless consultants advise "Kadazan" or "Dusun" specifically. Kinabalu is *Aki Nabalu*; keep it distant.
- Pua kumbu motifs: original, inspired-by, consultant-approved.
- Wau bulan is specifically Kelantanese; the hum is from its *busur*.
- Kolam (Tamil) vs. *kolam* (BM, pond): label with script.
- Iban longhouse is *rumah panjai* in Iban; BM *rumah panjang*. Verify spelling and diacritics for every non-BM word with a native speaker.

### 8.4 Consultation checklist (M0 and M8)

- One reviewer per community reads all station copy, names and memory lines.
- One reviewer per community sees the station in motion (video or build) before launch.
- Musicians or recordings for each instrument are credited by name and community.
- A "how we made this" credits page lists sources, consultants and what was deliberately left out and why.

### 8.5 IP and brands

No real logos, brand names, jingles, TV themes, songs or fonts. Evoke: green van, red-and-white packet, floral thermos, a pop pastiche composed for us. All audio is CC0 or original. All 3D is original or CC0 (Kenney, Quaternius, Poly Haven for generic base props only; every cultural object is modelled for this project).

---

## 9. Sound design

### 9.1 Graph

```
Master (limiter) ─┬─ Ambience bus (zone crossfades, 2–3 layers per zone: bed / detail / events)
                  ├─ Weather bus (rain near/far, thunder, wind)
                  ├─ Music bus (shared-scale instrument samplers, generative phrases)
                  ├─ SFX bus (interaction sounds, positional)
                  └─ UI bus (very few, very soft)
Send: convolver reverb (wakaf tin room, longhouse ruai, forest, open)
```

- Three.js `AudioListener` + `PositionalAudio` for emitters (gongs, waterfall, drains); `Audio` for beds.
- Zone ambience crossfades over 3–6 s as the player crosses zone volumes; the next zone's bed is already faintly audible before you arrive (wayfinding).
- Sit mode opens the detail layer and drops UI sounds.
- Time of day modulates layers (dawn birds fade, dusk insects rise).

### 9.2 Zone list

| Zone | Bed | Detail | Events |
|---|---|---|---|
| Kampung dawn | leaves, far roosters | tekukur, fan wobble, muffled radio | pelikat flapping |
| Padang | wind | distant children, whistle | bicycle bell |
| Hutan | cicadas | drips, hornbill wingbeats | branch fall |
| Air terjun | pink noise near/far | spray, individual drips | stone plinks |
| Wakaf / rain | rain on zinc, rain on leaves | roof-edge sheets, drain | thunder (randomised, far) |
| Sawah | paddy wind | pipit flocks, frogs | distant gong practice |
| Rumah panjai | river, timber | engkerumong far, laughter | hornbill call |
| Jalan Kenangan | crows, fan, clock | mahjong, tanpura, kitchen | putu bambu whistle, roti man horn |
| Tasik night | water lap, crickets | frogs, owl, oar | fireflies (silent), instruments enter |

### 9.3 Music system

- One scale, five timbre sets (gamelan, plucked string, veena + tanpura, gongs, engkerumong), 3 velocity layers, round-robin samples, long tails.
- Every interaction triggers a note chosen by a simple melodic walker (small intervals, occasional leap) so sequences sound intentional.
- Idle phrases: 2–4 notes every 20–40 s, quieter than the ambience.
- Finale: a fixed arrangement where each timbre enters on a cue as the sampan crosses.

### 9.4 Mobile audio rules

- Audio context is created and resumed on the "tap to enter" gesture (iOS requires a user gesture; use `touchend`/`pointerup`).
- Pause on `visibilitychange`; resume on return.
- Formats: AAC (`.m4a`) for Safari, Opus (`.ogg`/`.webm`) elsewhere, chosen by `canPlayType`. Loops trimmed sample-accurate; crossfade loops where trimming fails.
- Stream per zone; total shipped audio ≤ 25 MB; nothing is loaded that is not within one zone of the player.
- Respect the iOS silent switch behaviour; show a "sound on?" affordance if the context is running but the output is suspected muted (volume icon in the corner).

### 9.5 Sourcing

CC0 field recordings (Freesound and similar) plus original recordings. The strongest version of this project has real Malaysian field recordings (a kampung dawn, an actual zinc roof in an actual downpour, a real gong set). Decision point in §17.

---

## 10. Art direction

### 10.1 Style

Low-poly, silhouette-first, vertex-coloured, softly lit; a "Malaysian gouache" feel. Hero objects get one hand-painted texture each (batik, pua kumbu, kolam, Peranakan tiles, banana leaf, cellophane). Everything else is flat colour with gradient ramps. Every object must read at a glance from 10 m in fog.

### 10.2 Palettes

**Time of day:** dawn lilac and peach over mist; morning clean cyan and grass; noon deep emerald with white god rays; rain slate, teal and wet umber; golden hour amber, ochre and green-gold; sunset vermilion to indigo; dusk indigo with lamp amber; night navy with moon silver and firefly green.

**Cultural accents:** Malay indigo/turmeric/rust batik and *hijau pucuk pisang*; Chinese vermilion, lantern amber and Peranakan pastels; Indian saffron, marigold, jasmine white and kolam pastels; Kadazan-Dusun black velvet with gold and paddy green; Iban pua kumbu red, black and cream with river-brown timber.

### 10.3 Post-processing

ACES tone mapping; per-hour colour LUT; subtle vignette; bloom for lanterns, pelita, fireflies (desktop: selective bloom at half resolution; mobile: no bloom, glow sprites instead); DOF only in close-up interactions on desktop.

### 10.4 Modelling rules

- Triangle budgets: hero object ≤ 8k, house/longhouse ≤ 25k, tree LOD0 ≤ 600, tuft ≤ 12.
- Single material per model where possible; shared atlas for props.
- Export glTF from Blender; compress with `gltf-transform` (meshopt + KTX2/UASTC).
- Morph targets for anything scrubbed by drag (wrappers, shed on the loom); bones only where deformation is continuous (kite string, cloth).

---

## 11. Controls, UX and accessibility

### 11.1 Locomotion

Two modes, switchable in settings; **Free roam** is the default (first-person, like a quiet walking game), with **Follow the path** for anyone who would rather be led.

| | Free roam (default) | Follow the path |
|---|---|---|
| Desktop | `WASD` + captured-mouse look (pointer lock; `Esc` releases and opens the menu); scroll to zoom; `Space` auto-walks to the next place along the path until you take a step | hold `W` to walk the path; `Space` to auto-walk |
| Mobile | left-thumb joystick; drag anywhere to look; pinch to zoom; round button (right) walks forward when held, auto-walks when tapped | push the joystick forward, or tap the round button |
| Both | the jetties hand you to the path for the sampan crossing and give free roam back ashore | Catmull-Rom spline with look-around |

Camera height 1.6 m, FOV 62 desktop / 74 mobile portrait, zoom to 2.6×, gentle head-bob (toggle), eased turning, no sprint. Walking speed 2.55 m/s free, 1.9 m/s on the path, 1.35 m/s on the water.

### 11.2 Interaction grammar (one finger, always)

- **Tap:** select, strike, light, sit.
- **Hold:** sustain (blow the sompoton, hold the match, cup hands, pour from the gayung).
- **Drag:** unfold, peel, draw, weave, fold; always with snapping to stable states.
- **Flick:** toss, skip, release string.

Interactables pulse a soft emissive rim when within reach; a small reticle on desktop, a faint ring at the touch point on mobile. Never multi-touch-required.

### 11.3 UI

DOM overlay (not in-canvas): title card ("Tap to enter · headphones recommended"), a corner menu (sound, language, quality, subtitles, locomotion, reduced motion), memory cards bottom-centre, station name on entry (three lines: community language, BM, English). Portrait and landscape both supported; portrait frames tall subjects (waterfall, trees) well. Everything fades after 3 s of inactivity.

### 11.4 Accessibility

Reduced-motion mode (no head-bob, slower easing, no rain flicker), subtitles for every named sound event ("[rain on zinc roof]"), colour-blind-safe highlight (rim + ring, not colour alone), scalable font, no flashing above 3 Hz (fireflies are slow pulses), all interactions one-pointer, keyboard-only path on desktop.

### 11.5 Languages

v1 UI in English and Bahasa Malaysia. Station names and key words always shown in the community language. Later: Chinese, Tamil, Kadazan/Dusun, Iban UI strings via community contributors.

---

## 12. Technical architecture

### 12.1 Stack

- **Three.js** (latest stable at scaffold time, pinned), `WebGLRenderer` for maximum device reach; WebGPU evaluated later behind a flag.
- **Vite** + **TypeScript**, ES modules, strict mode.
- `postprocessing` (pmndrs) for merged, mobile-friendly passes.
- `detect-gpu` for an initial quality tier, plus runtime frame-time adaptation.
- `vite-plugin-pwa` for offline after first load.
- `@gltf-transform/cli` (dev) for meshopt + KTX2.
- `lil-gui` and `stats-gl` (dev only) for an in-app debug panel.
- ESLint + Prettier.
- No backend. No database.

### 12.2 Project structure

```
public/
  assets/
    models/    (glb, meshopt + KTX2)
    textures/  (ktx2, a few png for canvas sources)
    audio/     (m4a + ogg, per zone)
    fonts/
src/
  main.ts
  core/        App, Loop, Renderer (adaptive DPR, presets), Input (pointer/touch/keys → intents),
               Gestures (tap/hold/drag/flick), Locomotion (Stroll spline + FreeRoam mask),
               Interaction (raycast, Interactable interface), TimeOfDay, Weather,
               Audio (buses, zones, emitters, music engine), Save (localStorage), Loader (lazy stations)
  world/       Terrain, Lake/Water, Sky, Fog, Vegetation (instancing + wind), Path, Volumes
  stations/    Station.ts (lifecycle) + one folder per station:
               rumahKampung/ padang/ airTerjun/ wakaf/ sawah/ rumahPanjai/ jalanKenangan/ tasik/
  systems/     Unwrap (morph scrub), Instrument (scale + samplers), MemoryCard, FestivalLight, SitMode
  shaders/     water, waterfall, sky, wind, cellophane, rain, fireflies
  ui/          Title, Hud, Menu, Joystick, Subtitles, i18n
  content/     stations.json, memories/*.json, i18n/{en,ms}.json
```

### 12.3 Key systems

- **Station lifecycle:** `preload → enter → update → exit → complete`. Trigger volumes drive preload (one station ahead) and enter. Completion advances time and saves.
- **TimeOfDay:** a 0–1 day value with keyframed sky gradient, sun direction/colour, hemisphere light, fog colour/density, LUT. Interpolated over ~20 s on station events; never runs on the wall clock.
- **Weather:** state machine (`clear → gathering → rain → easing → clear`) driven by the waterfall/wakaf stations; exposes a wetness uniform to ground materials.
- **Locomotion:** Stroll follows a Catmull-Rom path spline with look-around; Free roam uses a walkable-mask texture lookup plus heightmap sampling (cheap, robust, no navmesh dependency).
- **Interaction:** raycast against a small interactable layer; gesture recogniser emits `tap/hold/drag/flick` with normalised values; interactables implement `onHover/onTap/onHold/onDrag/onFlick`.
- **Unwrap:** generic morph-scrub controller: ordered stages, each bound to a morph target, drag axis and snapping thresholds.
- **Instrument:** shared scale definition, per-station sampler sets, velocity layers, round-robin, melodic walker for idle phrases.
- **Vegetation:** `InstancedMesh` with per-instance phase; wind in the vertex shader via `onBeforeCompile`; LOD by distance; fog hides the far plane.
- **Water:** one shader for lake, pool and river (animated normals, fresnel, flow map, foam mask); waterfall is a separate scrolling-noise shader plus sprites.
- **Save:** `localStorage` keys: `tenang.visited[]`, `tenang.settings`, `tenang.lang`, `tenang.dayValue`. Clearable from the menu.

### 12.4 Performance budgets

| Budget | Target |
|---|---|
| Frame rate | 60 fps desktop; ≥ 30 fps on a mid-range Android from ~2020 and an iPhone 11 |
| Visible triangles | ≤ 120k |
| Draw calls | ≤ 120 |
| Lights | 1 directional + hemisphere, ≤ 3 point lights active |
| Textures | ≤ 2048², KTX2, GPU memory ≤ 250 MB |
| Initial download | ≤ 12 MB (core + first station), then lazy |
| Per-station bundle | ≤ 5 MB models/textures + ≤ 4 MB audio |
| Device pixel ratio | capped at 2 desktop / 1.5 mobile, adaptive down to 0.75 under load |

Quality presets Low/Medium/High set shadows (off / baked blobs / one shadow map), bloom, particle counts, instance counts, DPR cap. Auto-select from `detect-gpu`, then adapt from measured frame time.

### 12.5 Mobile specifics

`touch-action: none` on the canvas; `100dvh` layout; orientation change re-layout; `webglcontextlost`/`restored` handling; memory-conscious textures; reduced update rate when hidden; battery-saver preset; audio unlock on gesture; no hover-dependent affordances.

### 12.6 Loading experience

Title card appears on a still, fogged view of the lake at dawn while core assets load. "Tap to enter" unlocks audio and begins the first ambience. Stations stream in as you approach; a station is never entered before its assets are resident (the path slows very slightly if needed rather than showing a loading bar).

### 12.7 Persistence, data and the DB rule

There is no database in this project. All state is client-side `localStorage`. If a shared feature is ever added (for example a "memory wall" where visitors leave a line), it would require a backend and a database, at which point `DB_SCHEMA.md`, an initialisation script, migration scripts and README updates are created per the project rules. Until then, `DB_SCHEMA.md` is intentionally absent.

### 12.8 Hosting and delivery

Static build to GitHub Pages / Netlify / Vercel; PWA manifest and service worker (offline after the first full loop); gzip/brotli; long-cache hashed assets.

### 12.9 Verification approach

Per the project rules, no throwaway test scripts. Verification is built into the main app:

- Dev-only debug panel: teleport to any station, scrub time of day, force weather, toggle quality presets, show perf HUD, mute buses.
- A device matrix run manually before each milestone: Chrome/Firefox/Safari desktop; iOS Safari (one recent, one older iPhone); Android Chrome (one mid-range, one low-end); portrait and landscape.
- Perf HUD numbers recorded per station per device in the milestone notes.

---

## 13. Content specification

### 13.1 `stations.json` (shape)

```json
{
  "id": "sawah",
  "order": 4,
  "culture": "kadazan-dusun",
  "names": { "native": "Kaamatan", "ms": "Sawah · Tuai", "en": "Paddy · Harvest" },
  "dayValue": 0.73,
  "audioZone": "sawah",
  "instrument": "gongs",
  "trigger": { "center": [42, 0, -18], "radius": 14 },
  "preloadRadius": 40,
  "assets": { "models": ["sawah/hut.glb", "sawah/gongs.glb"], "audio": ["sawah/bed.m4a", "sawah/detail.m4a"] },
  "interactables": ["gongs", "sompoton", "paddy-touch", "linopot"],
  "memories": ["sawah.gongs", "sawah.linopot"]
}
```

### 13.2 Memory text style guide

- Two lines maximum. Second person, present tense.
- One concrete sensory detail per line (temperature, texture, sound, price, colour).
- Era-specific, not generic. "RM1" not "cheap". "Zinc" not "roof".
- No explanation of what the thing is; the object on screen does that.
- Written or reviewed by someone from the culture the station represents.
- Provided in EN and BM; native-language words kept as-is with script where relevant.

### 13.3 i18n

Flat JSON per language (`en.json`, `ms.json`), keys namespaced by station. UI strings, station names, memory lines, subtitles for sound events. Right-to-left is not required for v1 (Jawi is display-only, if used in the title).

---

## 14. Milestones

No calendar estimates; each milestone lists what changes and what "done" means.

| # | Milestone | Scope | Done when |
|---|---|---|---|
| M0 | Concept lock | This plan reviewed; §17 decisions made; asset list and audio list finalised; consultants identified per community; title chosen | Sign-off on the plan; lists committed to the repo |
| M1 | Greybox world | Vite + TS + Three scaffold; ring terrain, lake, path spline; Stroll and Free roam on desktop and mobile; time-of-day scrub; sky, fog; placeholder station volumes; audio unlock + one ambience crossfade; debug panel; deployed preview | Walkable loop at 60 fps desktop / 30 fps mid-range phone; time scrubs; audio crossfades between two zones |
| M2 | Vertical slice: Rumah Kampung | House, tempayan foot-wash, gerai, the full nasi lemak peel, memory cards, gamelan note, completion → time advance, save | The peel feels good with mouse and with a thumb; a stranger understands it without instructions |
| M3 | Hutan, Air Terjun, Wakaf | Instanced canopy with wind, waterfall and pool shaders, mist, sit mode, skip stones, weather state machine, rain and wetness, zinc-roof audio with reverb, paper boat | Sound leads you to the falls; sitting is the best part; rain arrives and leaves without a cut |
| M4 | Sawah and Rumah Panjai | Paddy instancing, Kinabalu silhouette, gong set and sompoton, longhouse, ruai walk, pua kumbu loom, engkerumong, hornbill flyby | Both instruments play in the shared scale; the loom accumulates rows; consultants have seen a video |
| M5 | Jalan Kenangan | Shophouse street, kaki lima, kolam canvas drawing with symmetry, vilakku lighting, kopitiam, cellophane lantern light-and-carry | The lantern lights the rest of the night; the kolam glows at dusk |
| M6 | Padang and Tasik finale | Wau flight and hum, fireflies with synchronised pulse and cup-hands, sampan crossing with five-instrument finale, pelita return, constellation credits, loop to dawn | A full loop plays start to finish in 12–20 minutes |
| M7 | Polish | Quality presets and adaptation, device matrix pass, accessibility pass, EN/BM i18n, PWA, final mix, loading experience, README | Budgets in §12.4 met on every device in the matrix |
| M8 | Cultural review and launch | Consultants review copy, names, motifs and builds; fixes; credits page; deploy | Every community reviewer has signed off on their station |

---

## 15. Scope tiers

- **MVP (five cultures + waterfall + finale):** Rumah Kampung (peel, pelita), Air Terjun (sit, stones), Sawah (gongs), Rumah Panjai (loom, engkerumong), Jalan Kenangan (kolam + lantern), Tasik (fireflies). Padang and Wakaf become pass-through ambience with no interaction.
- **Full:** all eight stations with their signature and secondary interactions as written above.
- **Stretch:** the complete unwrap set (§6.1), paper boat, batu seremban / guli / gasing, kopitiam egg and xiangqi move, kek lapis slice, gyro look, photo mode, more UI languages, a river-drift segment between Sawah and Rumah Panjai, field recordings made in Malaysia, and a shared "memory wall" (which would introduce a backend and DB and trigger the §12.7 obligations).

---

## 16. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Low-end mobile performance | Low-poly vertex colour, instancing, KTX2, lazy stations, adaptive DPR, presets, no bloom on mobile, fog to cull |
| iOS audio autoplay and silent-switch confusion | Single unlock gesture, visibility handling, visible sound-state affordance, AAC fallback |
| Art production is the bulk of the work | Strict per-station asset list, shared atlases, CC0 for generic props, hero objects first, greybox everything else until M6 |
| Cultural missteps | Template parity, sacred/festive rule, accuracy notes, consultation at M0 and M8, credits transparency |
| Scope creep | Tiers in §15; stations complete in order; stretch items never block a milestone |
| Trademark or copyright exposure | §8.5 rule; original music; CC0-only recordings; no logos or fonts |
| WebGL context loss on mobile | Handle `webglcontextlost`, reload station, keep state in the save |
| Large audio payloads | Per-zone streaming, ≤ 25 MB total, loops trimmed, Opus where supported |

---

## 17. Decisions

Taken while building; the option chosen is listed first, with the alternatives that were considered.

1. **Title:** *Taman Kenangan* (chosen: the garden is about memory more than stillness) / *Taman Tenang* / *Tenang*.
2. **Default locomotion:** first-person free roam (`WASD` + captured mouse on desktop, joystick + drag on touch), with "Follow the path" in the menu (chosen after playtesting; the first release led with the path). Free roam hands back to the path at the jetties, since the sampan only knows the one route, and resumes ashore. Cues (ring + hint) reveal themselves as you come near; on desktop a centre reticle does the pointing, and anything carried in the hands answers a press anywhere.
3. **Human presence:** traces only, no characters (chosen): a steaming cup, slippers on a rock, a half-played congkak, a cat asleep on a table.
4. **Distant maghrib azan on the night return:** omitted (chosen, at the owner's request). Religious elements appear only where they are also cultural and are handled as such: vilakku at a doorway, pelita at a gate, a wakaf on the roadside. Nothing sacred is interactive.
5. **Art style:** flat low-poly with vertex colour and procedural canvas textures for batik, pua kumbu, tiles, zinc and planks (chosen). Fully procedural geometry replaced hand-modelled heroes for this version.
6. **First target:** Full tier from the start (chosen): all eight stations, each with its signature and most of its secondary interactions.
7. **Start station:** Rumah Kampung as home (chosen). The day begins a few steps short of the house, looking at it, and ends at its gate.
8. **Sound sourcing:** fully synthesised in the browser with Web Audio (chosen for this version): instruments, birds, insects, rain, water and wind are all procedural, which keeps the bundle small and avoids licensing questions. Field recordings remain a next step.
9. **Memory lines:** drafted in this plan and in `src/content/stations.ts`; to be rewritten with one contributor per community before the garden is called finished.
10. **Hero objects:** procedural for this version; commissioning or in-house modelling remains the largest production cost of a later, textured version.

Two technical decisions made during verification are worth recording: the fog colour is run through the same ACES curve as the rest of the frame (three.js applies fog after tone mapping), so distances fade into the sky at night instead of into a paler wash; and every custom shader applies fog after tone mapping and colour-space conversion, matching the built-in materials.

---

## 18. Glossary

**Malay:** *anjung* verandah · *tangga* stairs · *tempayan* clay water jar · *gayung* dipper · *tikar mengkuang* woven pandanus mat · *kerusi malas* reclining chair · *ampaian* clothesline · *kain pelikat* men's sarong · *pelita* oil lamp · *wau bulan* moon kite · *busur* the kite's humming bow · *congkak* mancala board · *batu seremban* five stones · *gasing* top · *guli* marbles · *wakaf / pondok* roadside rest hut · *longkang* drain · *padang* field · *sawah* paddy · *tasik* lake · *senja* dusk · *hujan petang* afternoon rain · *kelip-kelip* fireflies · *ubat nyamuk* mosquito coil · *gerai* stall · *bungkus* wrapped/takeaway · *tekukur / merbuk* doves · *riang-riang* cicada · *cicak* house gecko.

**Chinese Malaysian:** *kopitiam* coffee shop · *kaya* coconut jam · *tanglung* lantern (BM loanword) · *xiangqi* Chinese chess · *bak chang* glutinous rice dumpling · *ang pow* red packet · Mid-Autumn (*Zhongqiu*) lantern festival.

**Indian Malaysian:** *kolam* (கோலம்) rice-flour threshold drawing · *pulli* the dot grid · *vilakku* oil lamp · *kuthu vilakku* standing lamp · *malligai* jasmine · *thoranam* mango-leaf garland · *murukku* fried snack · Deepavali, Ponggal.

**Kadazan-Dusun:** *Kaamatan* harvest festival · *Bambarayon* rice spirit · *Huminodun* the maiden of the rice legend · *bobohizan* priestess · *Unduk Ngadau* Kaamatan pageant · *sumazau* dance · *sompoton* bamboo mouth organ · *sompogogungan* gong ensemble · *kulintangan* small gong row · *gandang* drum · *tapai* rice wine · *tajau* jar · *wakid* back-basket · *siga* headcloth · *linopot* leaf-wrapped rice · *hinava* raw fish salad · *Aki Nabalu* Kinabalu.

**Iban:** *Gawai* festival · *rumah panjai* longhouse · *ruai* communal verandah · *tanju* open deck · *bilik* family apartment · *pua kumbu* ceremonial woven cloth · *engkerumong* gong-chime · *tawak / bebendai* gongs · *ketebong* drum · *ngajat* dance · *kenyalang* hornbill · *terabai* shield · *tuak* rice wine · *pansuh* bamboo-cooked dish · *kek lapis* layered cake.

*All non-English terms to be verified by native speakers before shipping.*
