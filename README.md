# Hardware Music Guides

Five single-page interactive courses share one runtime and design system: the **TD-3 & RD-6 Guide**, **DDJ-FLX4 Guide**, **MPK Mini MK4 Guide**, **Hybrid Live Set Guide**, and the eight-week **Sample & Circuit Guide** for grooveboxes and samplers.

## TD-3 & RD-6 Guide

The Behringer guide takes an absolute beginner from wiring and basic drum sequencing through acid-bass programming, sync, pattern chaining, performance, troubleshooting, a TD-3 Song Bank, and a Drum Bank over **ten weeks**. A progress bar covers **39 steps** and the Course map can jump to any step.

| Week | Covers |
| --- | --- |
| 1 | Connections and basic drum sequencing |
| 2 | TD-3-MO synthesis and pitch entry |
| 3 | Hardware syncing and MO features |
| 4 | Five-minute live arrangement |
| 5 | RD-6 banks, chaining and routing |
| 6 | TD-3 sound design and external clock |
| 7 | Care, troubleshooting and backups |
| 8 | Song Bank — load ready-made TD-3 patterns |
| 9 | Drum Bank — rhythm pattern sheets |
| 10 | Advanced tone shaping and live modulation |

### Song Bank

The Song Bank contains **31 cards by default** across three source types: **original practice patterns**, **written-out step tables**, and patterns **transcribed from real fan-made** TD-3/TB-303 charts. The common pattern-chart layout is a visualization and **does not claim that every pattern originated on a Roland sheet**.

Each `SONG_CARDS` entry can include `sourceType`, `needsAccentSlideReview`, `homeOctave`, `overdrive`, tempo/provenance fields, filter settings, note names, accents and slides. Notes use names such as `C2` and `F#3`, with **`null` for a rest**. Unknown source details remain blank or explicitly estimated rather than being invented. Six legacy chart entries remain marked with `needsAccentSlideReview: true` until their original source rows can be revalidated.

### Drum Bank

Week 9 adds a bank of found drum patterns, each rendered as a **TR-808 rhythm pattern sheet** across AC, BD, SD, LT, MT, HT, RS, CP, CB, CY, OH and CH. Cards are 16 or 32 steps and load into an independent synthesized drum engine at the card's own tempo. **11 pattern sheets ship by default**.

Three record transcriptions come from the MIT-licensed `tr808r` package: "Sexual Healing", the "Beat It" intro, and "Confusion". Seven patterns come from the public **GiantSteps** `drum-pattern-datasets` collection, including Funky Drummer, Impeach the President, When the Levee Breaks, Electro, House, Classic House and Minimal Techno. One card is the course's own Week 1 four-on-the-floor pattern.

The Drum Bank keeps provenance explicit. Outside sources that do not record accents, machine slots or tempos do not gain invented values; unknown tempos are labelled estimates. RS/CL and CP/MA are switch pairs and a card's `pair` field controls both the printed row and the voice that sounds.

Add a card in `DRUM_CARDS` with fields such as `{ id, title, artist?, sourceType, steps, bpm, bpmConfirmed?, patternNo?, variation?, preScale?, pair?, voicing, tag, source, rows }`. `sourceType` is `record`, `literature` or `practice`; `bpmConfirmed` distinguishes a stated tempo from an estimate; `voicing` explains whether the source was written for this machine or mapped onto it; and `pair` selects CL or MA where applicable.

## DDJ-FLX4 Guide

The **DJ-404 performance curriculum** in `DDJ-FLX4 Guide.dc.html` is one eight-week intensive rather than separate beginner and practice plans. Each week contains five applied sessions and ends with a recorded milestone.

| Week | Covers |
| --- | --- |
| 1 | Wiring, software, cueing, controller anatomy and library preparation |
| 2 | Jog nudging, tempo ranges, pitch riding and manual beatmatching |
| 3 | Channel faders, EQ, filters, gain staging and eight-bar transitions |
| 4 | Hot cues, loops, phrase counting and loop rolls |
| 5 | Echo, reverb, filters and controlled FX-led transitions |
| 6 | Camelot guidance, harmonic listening and a five-track key journey |
| 7 | A planned 28–32 minute energy arc and critical playback notes |
| 8 | Re-recording, safe export, artwork, tracklist and self-assessment |

The existing cable, jog, tempo, mixer, beatmatch, cue, loop, FX and performance-map widgets remain part of the course. New labs add a phase-meter canvas, harmonic-compatibility guidance and a short practice recorder. The browser recorder creates original-synth stereo WAV drills at **44.1 kHz / 16-bit**, with a three-minute memory cap. The final 30-minute set should be recorded in rekordbox or Serato.

### Transition Bank

The Transition Bank contains **12 technique cards**, not sample audio. Each card records `id`, `title`, `type`, optional `bpmRange`, `difficulty`, `sourceAttribution`, four instructional `steps`, and a `videoSearch`. Cards can be filtered by type and difficulty. Video references remain YouTube **search** links rather than guessed upload IDs.

The practice engine uses two original synthesized reference grooves with millisecond beat-grid offsets. EQ kill reaches -60 dB in the simulation; echo feedback decays below -60 dB within four beats; hot-cue analysis can snap to a local zero crossing; and Camelot mismatches warn without blocking playback. The FLX4 has no physical FX paddles, so lessons refer to Beat FX, Smart CFX, Smart Fader and software mappings actually available to the selected setup.

## Hybrid Live Set Guide

`Hybrid Live Set.dc.html` is a six-week follow-on course for learners who have completed both hardware guides. It combines the TD-3-MO / RD-6-BK and DDJ-FLX4 into one staged performance workflow.

| Week | Covers |
| --- | --- |
| 1 | Shared signal flow, gain staging and clocking choices |
| 2 | Layer roles and 8-bar phrase practice |
| 3 | Coordinated transitions, drops, hot cues and loops |
| 4 | A 10–12 minute full hybrid arrangement |
| 5 | Stage-readiness checklist and recovery drills |
| 6 | Genre variants — the same rig in house, techno and breaks |

Week 4 includes a dual-pane performance timeline that shows the **TD-3/RD-6 role and DDJ-FLX4 role side by side** across Intro, Hardware Groove, Breakdown, Drop and Outro. The timeline is horizontally scrollable and keyboard-focusable on narrow screens; Left/Right Arrow, Home and End select sections without requiring a pointer. Checklist state is kept in memory and Start Over restores the guide to its initial state.

## MPK Mini MK4 Guide

`MPK Mini MK4 Guide.dc.html` is a six-week production course for the **Akai MPK Mini MK4** (Akai also calls it the MPK Mini IV). It is the only guide here covering a keyboard and pad controller rather than DJ or hardware-synth gear, and the MK4 makes no sound of its own — it sends MIDI and software makes the noise — so the course says plainly that part of learning the unit is learning MPC Beats or a DAW.

| Week | Covers |
| --- | --- |
| — | Lessons and resources, each tagged with the week it belongs to |
| 1 | USB-C setup, registration, the bundled software and a twelve-control panel map |
| 2 | Pad banks, velocity, Note Repeat and a velocity-storing 16-step grid |
| 3 | Scale Mode and Chord Mode across seven scales and twelve roots, plus a four-bar progression |
| 4 | Arpeggiator (mode, rate, range, Pattern, Freeze, Mutate), eight assignable knobs and DAW mapping |
| 5 | A 20-bar arrangement layering the drum grid, progression and arp by section |
| 6 | Four style presets, practice rhythm and choosing what to study next |

Everything is synthesized in the browser — five parameterised drum voices and one subtractive synth voice shared by the keys, chords and arpeggiator — so the mechanics can be practised before any software is installed. Grid cells store a **velocity** rather than a boolean and are shaded by it, because "every hit at full" is the habit Week 2 exists to break.

Three guarantees the guide states in its own copy are enforced by tests rather than left to trust: **no key can produce an out-of-scale note**, and none snaps further than the nearest scale tone; a chord stacks **only scale tones**, with its Roman numeral read off the intervals the stack produced rather than assumed from the degree; and **Mutate never leaves the held chord**, abandoning an octave jump at the edge of the playable range rather than clamping onto a note outside the chord. The eight knobs edit a live filter, waveshaper and tempo-synced delay while the loop plays, and an unassigned knob target falls back to its own default rather than to zero, so reassigning a knob never silently mutes the instrument.

Lessons are listed by **title rather than link**, for the same reason the DDJ Practice Plan uses searches: the source names videos and channels but no authoritative IDs. The pad-practice entry names both Melodics and padlab.

## Sample & Circuit Guide

`SampleCircuit Guide.dc.html` is an eight-week, beginner-friendly curriculum for Novation Circuit Tracks / Rhythm, Elektron Model:Samples, Roland SP-404MKII, or the built-in browser sampler. Its sequence is power and routing, live versus step recording, slicing, motion recording, pattern chaining, resampling, performance controls, and a final stereo export.

| Week | Covers |
| --- | --- |
| 1 | Power, routing, gain staging, sample organisation and a first pattern |
| 2 | Step sequencing, real-time recording, quantisation, swing and ghost notes |
| 3 | Transient detection, draggable slice markers, pad mapping and chopping |
| 4 | Motion recording, parameter locks, sends and LFO movement |
| 5 | Pattern variants, chains, mute states and a 16-bar form |
| 6 | Internal resampling, reverse transitions, layering and micro-chopping |
| 7 | Master dynamics, isolator EQ, sidechain motion and live muting |
| 8 | A 32-bar capstone, stereo WAV export and critical listening |

### Slice Bank and browser sampler

The Slice Bank contains **15 cards**. Every bundled sound is deterministically generated in the browser and uses `sourceType: original_synthesis`; the repository does not embed or download commercial recordings. This keeps the default experience immediately playable while making its provenance exact. The page can also decode a user-selected WAV, AIFF or MP3 locally, but imported audio remains the user's responsibility and is not persisted after refresh.

Each card keeps `id`, `title`, `sourceType`, `originalBpm`, `bpmConfirmed`, `bitDepth`, `sampleRate`, `duration`, `slices`, `autoSliced`, `algorithm`, `sensitivity`, `waveform`, `provenance` and `license`. One-shots use `originalBpm: null` and do not claim a tempo. Auto-sliced loops record `algorithm: transient_detection` and a 0–100 sensitivity value. Slice indices are zero-based in data and map directly to one-based pad labels.

The raw Web Audio `SamplerEngine` is authored inside the guide, not in generated `support.js`. It provides `loadSample()`, transient-based `slice()`, `playSlice()`, OfflineAudioContext-backed `resample()`, and stereo PCM `exportWav()`. The internal WAV writer supports 44.1/48 kHz at 16 or 24 bit. The 16-step Pattern Lab schedules against the audio clock; a tempo change stops and restarts transport before using the new grid.

A symbolic rhythm chart and an audio sample are not the same asset. A properly sourced chart may describe a rhythm such as the Amen pattern without bundling the original recording. Any future audio card must still document a redistribution-compatible recording license; a software or pattern-dataset license must not be reused as an audio-sample license.

## Running the guides

Open any `.dc.html` file directly in a browser or serve the repository, for example:

```bash
python -m http.server 8000
```

The guides load React 18, ReactDOM, Babel Standalone and fonts at runtime. Audio starts only after a user gesture, as required by browsers.

## Tests

Run:

```bash
npm test
```

There is no install step. The suite uses Node's built-in `node:test` and `node:assert` and runs on Node 20+; GitHub Actions runs it on Node 20 and 22 for pushes to `main` and pull requests.

| File | Guards |
| --- | --- |
| `test/structure.test.mjs` | Step rendering, unique ids/nav labels, Course Map behavior, restart state, accessibility and design-system rules across all five guides |
| `test/songbank.test.mjs` | Song-card notes, rests, tempo provenance, schema, chart/engine agreement, source types and audio behavior |
| `test/drumbank.test.mjs` | Drum-card row sets and lengths, provenance, source omissions, switch pairs, accent behavior, per-card tempo/length, navigation cleanup and sheet/engine agreement |
| `test/mpk.test.mjs` | Scale snapping and its nearest-tone claim, scale-only chord stacks and interval-derived numerals, arp orderings, Mutate staying inside the held chord, knob assignment and default fallback, style-preset and arrangement integrity, and every widget a step names rendering (and only those) |
| `test/slicebank.test.mjs` | Eight-week curriculum, 15-card schema and provenance, minimum slice length, tempo rules, resampling RMS, WAV format, chain continuity, pad mapping and transient metadata |
| `test/transitionbank.test.mjs` | Twelve-card transition schema and filters, phase lock, EQ kill depth, echo decay, recording WAV format and peak, hot-cue zero crossing, Camelot warnings and beat-grid offsets |
| `test/timing.test.mjs` | Lookahead scheduling, exact grids, stop cleanup, shuffle and swing, filter envelopes, Note Repeat rolls and arrangement layers, Drum/Slice Bank tempo grids, pattern-chain boundaries and DDJ phase behavior |
| `test/curriculum.test.mjs` | Eight five-day DJ-404 weeks, independent recorded milestones, search-only learning resources, widget coverage and README consistency |
| `test/hybrid.test.mjs` | Five-week hybrid structure, dual-pane scrollable timeline and keyboard controls, independent checklists, reset behavior and Course Map grouping |

The test harness loads each guide's inline component logic against a stub runtime and stub Web Audio API. Timing tests wait for the data they need instead of depending on a fixed wall-clock window, and every engine started by a test is disposed during cleanup.

## Layout

```text
Behringer Setup Guide.dc.html   TD-3/RD-6 course and audio engines
DDJ-FLX4 Guide.dc.html          DDJ-FLX4 course and Practice Plan
MPK Mini MK4 Guide.dc.html      MPK Mini MK4 production course and its synth engines
Hybrid Live Set.dc.html         Combined hardware/controller performance course
SampleCircuit Guide.dc.html     Groovebox/sampler course, Slice Bank and sampler engine
support.js                      shared generated runtime
_ds/                            shared Organic design system
uploads/                        retained hardware reference images
test/                           harness plus nine .test.mjs files
package.json                    test script and Node engine requirement
```

The five guides keep independent component state but share the runtime and design system. Prefer the design-system tokens in `_ds/.../styles.css` over hard-coded visual values. Maintainer notes live in `docs/HANDOFF_MODULES_1_4.md`, `docs/HANDOFF_SAMPLE_CIRCUIT.md`, and `docs/HANDOFF_DJ_404.md`.
