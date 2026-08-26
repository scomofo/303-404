# Hardware Guides

Four single-page interactive courses share one runtime and design system: the **TD-3 & RD-6 Guide** for the Behringer TD-3-MO / RD-6-BK, the **DDJ-FLX4 Guide** for the Pioneer DJ DDJ-FLX4, the **MPK Mini MK4 Guide** for the Akai MPK Mini MK4, and the **Hybrid Live Set Guide** that combines both hardware systems into one performance workflow.

## TD-3 & RD-6 Guide

The Behringer guide takes an absolute beginner from wiring and basic drum sequencing through acid-bass programming, sync, pattern chaining, performance, troubleshooting, a TD-3 Song Bank, and a Drum Bank over **ten weeks**. A progress bar covers **37 steps** and the Course map can jump to any step.

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

The Song Bank contains **27 cards ship by default** across three source types: **original practice patterns**, **written-out step tables**, and patterns **transcribed from real fan-made** TD-3/TB-303 charts. The common pattern-chart layout is a visualization and **does not claim that every pattern originated on a Roland sheet**.

Each `SONG_CARDS` entry can include `sourceType`, `needsAccentSlideReview`, `homeOctave`, `overdrive`, tempo/provenance fields, filter settings, note names, accents and slides. Notes use names such as `C2` and `F#3`, with **`null` for a rest**. Unknown source details remain blank or explicitly estimated rather than being invented. Six legacy chart entries remain marked with `needsAccentSlideReview: true` until their original source rows can be revalidated.

### Drum Bank

Week 9 adds a bank of found drum patterns, each rendered as a **TR-808 rhythm pattern sheet** across AC, BD, SD, LT, MT, HT, RS, CP, CB, CY, OH and CH. Cards are 16 or 32 steps and load into an independent synthesized drum engine at the card's own tempo. **11 pattern sheets ship by default**.

Three record transcriptions come from the MIT-licensed `tr808r` package: "Sexual Healing", the "Beat It" intro, and "Confusion". Seven patterns come from the public **GiantSteps** `drum-pattern-datasets` collection, including Funky Drummer, Impeach the President, When the Levee Breaks, Electro, House, Classic House and Minimal Techno. One card is the course's own Week 1 four-on-the-floor pattern.

The Drum Bank keeps provenance explicit. Outside sources that do not record accents, machine slots or tempos do not gain invented values; unknown tempos are labelled estimates. RS/CL and CP/MA are switch pairs and a card's `pair` field controls both the printed row and the voice that sounds.

Add a card in `DRUM_CARDS` with fields such as `{ id, title, artist?, sourceType, steps, bpm, bpmConfirmed?, patternNo?, variation?, preScale?, pair?, voicing, tag, source, rows }`. `sourceType` is `record`, `literature` or `practice`; `bpmConfirmed` distinguishes a stated tempo from an estimate; `voicing` explains whether the source was written for this machine or mapped onto it; and `pair` selects CL or MA where applicable.

## DDJ-FLX4 Guide

The DDJ-FLX4 guide covers seven weeks of hands-on controller lessons: setup, transport, tempo, mixer fundamentals, beatmatching, Sync, hot cues, loops, Beat FX and a mapped first mix. It then hands off to a self-paced **6-week Practice Plan**.

### Practice Plan

The Practice Plan turns knowing the controls into being able to play: each week has a goal, practice tasks, a watchlist and one milestone, with links back to the relevant hands-on lesson. The six-week progression covers setup/software, beatmatching, EQ and transitions, phrasing/hot cues/loops, FX and set flow, then a recorded 20–30 minute set.

Video and creator links are deliberately YouTube **search** links rather than guessed video IDs. The source curriculum names titles and channels but does not supply authoritative video IDs, so the guide searches for those titles instead of pretending a guessed URL is exact.

Progress ticks for tasks, watch items and milestones share the in-memory checks map but are namespaced so they cannot overwrite one another. Start Over clears the whole course and Practice Plan.

## Hybrid Live Set Guide

`Hybrid Live Set.dc.html` is a five-week follow-on course for learners who have completed both hardware guides. It combines the TD-3-MO / RD-6-BK and DDJ-FLX4 into one staged performance workflow.

| Week | Covers |
| --- | --- |
| 1 | Shared signal flow, gain staging and clocking choices |
| 2 | Layer roles and 8-bar phrase practice |
| 3 | Coordinated transitions, drops, hot cues and loops |
| 4 | A 10–12 minute full hybrid arrangement |
| 5 | Stage-readiness checklist and recovery drills |

Week 4 includes a dual performance timeline that shows the **TD-3/RD-6 role and DDJ-FLX4 role side by side** across Intro, Hardware Groove, Breakdown, Drop and Outro. The timeline is horizontally scrollable and keyboard-focusable on narrow screens. Checklist state is kept in memory and Start Over restores the guide to its initial state.

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
| `test/structure.test.mjs` | Step rendering, unique ids/nav labels, Course Map behavior, restart state, accessibility and design-system rules across all four guides |
| `test/songbank.test.mjs` | Song-card notes, rests, tempo provenance, schema, chart/engine agreement, source types and audio behavior |
| `test/drumbank.test.mjs` | Drum-card row sets and lengths, provenance, source omissions, switch pairs, accent behavior, per-card tempo/length, navigation cleanup and sheet/engine agreement |
| `test/mpk.test.mjs` | Scale snapping and its nearest-tone claim, scale-only chord stacks and interval-derived numerals, arp orderings, Mutate staying inside the held chord, knob assignment and default fallback, style-preset and arrangement integrity, and every widget a step names rendering (and only those) |
| `test/timing.test.mjs` | Lookahead scheduling, exact grids, stop cleanup, shuffle and swing, filter envelopes, Note Repeat rolls and arrangement layers, a Drum Bank card's own tempo grid, and DDJ phase behavior |
| `test/curriculum.test.mjs` | Six complete Practice Plan weeks, valid lesson cross-links, search-only video links, namespaced progress, milestone tallying, creators and README consistency |
| `test/hybrid.test.mjs` | Five-week hybrid structure, dual performance timeline, independent checklists, reset behavior and Course Map grouping |

The test harness loads each guide's inline component logic against a stub runtime and stub Web Audio API. Timing tests wait for the data they need instead of depending on a fixed wall-clock window, and every engine started by a test is disposed during cleanup.

## Layout

```text
Behringer Setup Guide.dc.html   TD-3/RD-6 course and audio engines
DDJ-FLX4 Guide.dc.html          DDJ-FLX4 course and Practice Plan
MPK Mini MK4 Guide.dc.html      MPK Mini MK4 production course and its synth engines
Hybrid Live Set.dc.html         Combined hardware/controller performance course
support.js                      shared generated runtime
_ds/                            shared Organic design system
uploads/                        retained hardware reference images
test/                           harness plus seven .test.mjs files
package.json                    test script and Node engine requirement
```

The four guides keep independent component state but share the runtime and design system. Prefer the design-system tokens in `_ds/.../styles.css` over hard-coded visual values.
