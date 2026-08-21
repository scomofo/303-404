# Hardware Guides

Two single-page, interactive setup courses that share one runtime and design system: [**TD-3 & RD-6 Guide**](#td-3--rd-6-guide) for the Behringer TD-3-MO / RD-6-BK, and [**DDJ-FLX4 Guide**](#ddj-flx4-guide) for the Pioneer DJ DDJ-FLX4 controller.

## TD-3 & RD-6 Guide

A single-page, interactive setup and performance course for the **Behringer TD-3-MO** acid synthesizer and **Behringer RD-6-BK** drum machine. It walks an absolute beginner from unboxing to playing a five-minute live set, then on through pattern chaining, sound-design extras, stage-ready troubleshooting, and a loadable bank of TD-3 patterns, over eight weeks — with clickable hardware widgets and Web Audio previews of the patterns you're programming.

Everything lives in one file — [Behringer Setup Guide.dc.html](Behringer%20Setup%20Guide.dc.html) — with a runtime script, a design-system bundle, and two photos alongside it.

### Running it

Open `Behringer Setup Guide.dc.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000/Behringer%20Setup%20Guide.dc.html.

**An internet connection is required.** The page pulls React 18, ReactDOM, and Babel Standalone from unpkg at runtime, and the Caprasimo/Figtree fonts from Google Fonts. There is no build step and nothing to install.

Audio starts only after you press a Play button, since browsers require a user gesture before a `AudioContext` will produce sound.

### The course

| | Week | Covers |
| --- | --- | --- |
| 1 | Unboxing, Connections & Basic Drum Sequencing | Power and audio wiring, clearing RD-6 memory, programming a 4-on-the-floor pattern |
| 2 | TD-3-MO Subtractive Synthesis & Pitch Entry | VCO/VCF settings, then a 16-step acid bassline in PITCH MODE and TIME MODE |
| 3 | Hardware Syncing & Modded-Out Features | 3.5mm sync from RD-6 Sync Out to TD-3 Sync In, sub-oscillator, filter FM depth, accent sweep |
| 4 | 5-Minute Live Arrangement & Performance | A 120 BPM performance map, pattern queuing, filter snap drops |
| 5 | RD-6 Pattern Banks, Chaining & Live Routing | Banks A/B, programming a fill pattern, PATTERN CHAIN (song) mode, shuffle, individual voice outputs |
| 6 | TD-3 Sound Design Extras & External Clock | Overdrive, Soft Attack, pattern Groups A–D, TRACK WRITE, syncing to MIDI/USB clock |
| 7 | Care, Troubleshooting & Backing Up Your Sounds | Common fixes for no-sound/no-sync issues, backing up patterns, physical maintenance |
| 8 | Song Bank — Load Ready-Made Patterns | A bank of loadable 16-step TD-3 patterns (notes, accents, slides, tempo) to study and play instantly |

A progress bar tracks your position across the 31 steps, and the **Course map** button in the header jumps to any step.

### Interactive pieces

- **Signal-path diagrams** — tap each cable run (audio out, and the sync cable in Week 3) to mark it connected.
- **Knob dials** — every instruction that names a knob position renders it as a dial pointing at the right o'clock value.
- **RD-6 step sequencer** — a 16-step grid across BD, SD/CP, CH, OH and Accent, pre-loaded with the pattern from the lesson. Toggle any cell and hit **Play Pattern** to hear it: synthesized kick, plus filtered noise bursts for snare and hats, with accented steps hitting louder. Week 5 gives you a second, independently editable grid for the Bank A fill pattern.
- **TD-3 pattern editors** — the pitch row (C2…F2 across 16 steps), the timing row where you toggle ACC and SLIDE per step, and a playback view. **Play Bassline** runs a sawtooth oscillator through a resonant lowpass with a per-step filter envelope; accents open the cutoff further, and a slide on the previous step ramps the pitch instead of retriggering the envelope.
- **Performance map** — a proportional timeline of the seven sections of the five-minute set; click a section for its direction.
- **Chain playback** (Week 5) — **Play Chain** loops the Week 1 pattern for 16 steps, then automatically switches to the Week 5 fill pattern for 16 steps, and repeats — simulating the RD-6's PATTERN CHAIN mode, with the active pattern highlighted live.
- **Shuffle control** (Week 5) — Straight/Light/Medium/Heavy options actually delay every odd-numbered 16th note during playback, so you can hear the swing amount change.
- **Overdrive & Soft Attack** (Week 6) — OFF/LOW/MED/HIGH drives a real `WaveShaper` distortion curve on the TD-3 voice, and the Soft Attack checkbox lengthens the VCA's attack time; hit **Play Bassline** to compare settings.
- **Song Bank** (Week 8) — a stack of loadable step patterns, each drawn as a full pattern chart (see **Pattern chart** below). Hit a card's **Load into engine** to hand it to its own independent TD-3 engine (its own oscillator/filter/gain chain, not the Week 2/6 one), then Play to hear it. 19 cards ship by default:
  - 3 original practice patterns ("Rolling Eighths", "Octave Jump", "Offbeat Squelch") for drilling technique.
  - 5 written-out step tables supplied directly rather than photographed: "Sandstorm" (Darude), "Industrial Driving Pulse", "Polyrhythmic Acid Slicer", "Euphoric Roller" and "German Hard Trance Slammer". These pin their own `homeOctave`, and the last two include rests.
  - 11 transcribed from real fan-made TD-3/TB-303 pattern charts: "On the Run", "Everybody Needs a 303" (Fatboy Slim), "Higher State of Consciousness" and "Are You There" (Josh Wink), "I'm a Disco Dancer" parts 1–2 (Christopher Just), "Claustrophobic Sting" (The Prodigy, an 8-step pattern), "Forget It" parts 1–2 (Cut & Paste), "Da Funk" (Daft Punk), and "Breathe Deeper" (Tame Impala).
  - Any detail a source card left blank, unmarked, or illegible (accents, slides, exact octave placement) loads empty or as an explicitly flagged guess rather than an invented value — each card's `tag` notes what to double-check, and the pattern-length field means shorter patterns (e.g. the Prodigy's 8 steps) just loop at that length instead of padding to 16.
  - **Tempo is the recording's, not the chart's.** None of the pattern charts print a BPM, so each card carries the tempo of the actual track. Where a track runs at a range ("Are You There", 127–132) or differs by release ("Everybody Needs a 303", 138 on the original and 126 on the remixes), the card shows that rather than a single invented number, and `bpm` holds the value used for playback. A card added without a known tempo still renders as `~X BPM (estimated)`.
  - Frequencies are computed for any note name via equal-temperament math (`noteToFreq`, A4 = 440Hz) rather than a fixed lookup table, so cards can use any note/octave (the transcriptions above needed several the original Week 2/6 curriculum never used, like C#, F#, G#, and octaves 1 and 3).
  - Cards can optionally tune the filter/envelope instead of using the shared default (900Hz cutoff, 1800Hz on accents, Q 8, 0.18s decay) — "Breathe Deeper" sets `filter: { cutoff, resonance, decay, accent }` (each 0-1) to approximate its source card's Cutoff/Resonance/Decay/Accent knob percentages, mapped to roughly 200–2800Hz cutoff, Q 1–24, and a 0.08–0.43s decay tail. Envelope-mod depth isn't separately modeled.

  - **Pattern chart** — every card in the bank *is* one of the printed 16-step sheets these patterns were transcribed from, redrawn: the sheet's Roland TB-303 masthead (the mark is an SVG *mask* rather than a coloured image, so it inks itself from `--color-text` and stays on the design system's palette), an Author / Title header with the pattern-group (I–IV) x bank (A/B) grid beside it, then the numbered step columns with the four downbeats tinted, a NOTE row carrying pitch class only, a DOWN / UP row marking the octave as a shift away from the pattern's home octave (the octave most of its steps sit in, since a sheet records a shift from where a pattern lives rather than an absolute pitch), an ACCENT / SLIDE row writing a step that is both as `A/S`, and the sheet's note/tie/rest row — where a filled dot is a step that sounds and a dash is a rest. This engine has no ties, so the legend's hollow circle never appears on a card. Below the grid, the EFX / Notes block carries everything the printed sheet has no box for (tempo, pattern number, overdrive, home octave), and the bottom bar rings the card's waveform and draws the five panel knobs: CUT OFF FREQ, RESONANCE, ENV MOD, DECAY, ACCENT. Anything no source stated — author, pattern group, bank, knob positions — is left blank or dashed, and an unknown knob draws no pointer rather than a default one. ENV MOD is blank on every card because this engine models filter decay but not modulation depth; OVERDRIVE is a TD-3-MO addition the sheet has no knob for, so it rides in the notes block instead.

  Add your own by editing the `SONG_CARDS` array near the top of the `Component` class — each entry is `{ id, title, artist (optional), group / pattern / bank (optional — only for cards whose source chart prints them), tag, bpm, bpmConfirmed: true (optional — omit and the card is labelled an estimate), bpmDisplay: 'text' (optional — overrides the shown tempo for ranges or per-release differences), waveform: 'sawtooth'|'square' (optional, defaults to sawtooth), notes: [note names like C2, C#2, F#3, ...], accent: [step indices], slide: [step indices], filter: {cutoff, resonance, decay, accent} (optional, each 0-1) }`.

Checklists, cable states, and your edits to all patterns are held in memory for the session — reloading, or the **Start Over** button, resets them.

## DDJ-FLX4 Guide

A single-page, interactive setup and mixing course for the **Pioneer DJ DDJ-FLX4** controller. It walks an absolute beginner from unboxing and software setup through gain staging, EQ, faders and the crossfader, beatmatching by ear and with SYNC, hot cues, loops, Beat FX, and a mapped three-minute mix, over seven weeks.

### Running it

Open `DDJ-FLX4 Guide.dc.html` the same way as the Behringer guide — directly in a browser, or via `python -m http.server 8000` then http://localhost:8000/DDJ-FLX4%20Guide.dc.html. Same requirements: an internet connection (for React/Babel/fonts from their CDNs) and a click on a Start/Play button before any audio plays.

### The course

| | Week | Covers |
| --- | --- | --- |
| 1 | Unboxing, Connections & Software Setup | Bus power, Master Out wiring, installing Serato DJ Lite or rekordbox |
| 2 | Decks — Loading, Transport & Tempo | Load/Play/Cue, jog wheel scratch vs. bend, the tempo fader |
| 3 | Mixer Fundamentals | Trim/gain staging, 3-band EQ and the EQ swap, channel faders, the crossfader |
| 4 | Beatmatching & Sync | Manual tempo + phase correction (nudge), then the one-touch SYNC button |
| 5 | Hot Cues & Loops | Setting and jumping to hot cues, Auto Loop lengths |
| 6 | Beat FX & Your First Mix | A tempo-synced echo effect, then a mapped 3-minute performance |
| 7 | Care, Troubleshooting & Software Tips | No-sound/no-detect fixes, firmware, switching between Serato and rekordbox |

### Interactive pieces

All of it — mixer, beatmatching, hot cues, loops, Beat FX — runs on **two synthesized reference loops** (procedural kick + hi-hat via Web Audio oscillators/noise, exactly like the TD-3/RD-6 guide's approach), not real music, so you can practice DJ mixing mechanics without needing licensed audio.

- **Practice decks** — a shared Start/Stop engine appears on every mixing-related step from Week 2 on. Deck A holds a fixed 124 BPM reference loop; Deck B starts detuned (+4%) so there's something to fix.
- **Gain & EQ** (Week 3) — Trim and 3-band EQ per deck as segmented presets (Low/Unity/Hot, Cut/Flat/Boost), wired to real `BiquadFilterNode` shelving/peaking filters and gain nodes — changes apply live, even mid-playback.
- **Faders & crossfader** (Week 3) — stepped channel faders and a crossfader with a simple linear taper (center = both audible, hard left/right isolates a deck), all driving real per-deck gain nodes.
- **Beatmatching & Sync** (Week 4) — live BPM readouts for both decks, Nudge −/+ buttons that bump Deck B's phase a step at a time, and a SYNC button that snaps Deck B's tempo to 0% and its phase to match Deck A instantly.
- **Hot cues** (Week 5) — 4 pads for Deck A; an unlit pad sets a cue at the current playhead step, a lit one jumps back to it.
- **Loops** (Week 5) — Auto Loop length presets (Off/8/4/2 steps) that actually shorten Deck A's loop point.
- **Beat FX** (Week 6) — an ON/OFF toggle and Low/Med/High level presets driving a real synced `DelayNode` echo (with feedback) on the master send.
- **Performance map** (Week 6) — the same proportional-timeline pattern as the Behringer guide's Week 4, mapped to a 6-section, 3-minute mix.

## Tests

```bash
npm test
```

No install step — the suite uses only `node:test` and `node:assert`, so it needs nothing but Node 20+. It runs in about four seconds and is wired to GitHub Actions on every push and pull request.

The tests load each guide's `<script type="text/x-dc">` block and run its `Component` class against a stub runtime and a stub Web Audio API (`test/harness.mjs`), so the logic is exercised without a browser. Three areas are covered:

| File | Guards |
| --- | --- |
| `test/structure.test.mjs` | Every step renders; ids and nav labels are unique; the course map reaches every step; `restart()` restores the whole of `initialState()`; each page declares a title and a language; no hardcoded hex colors; every control has an accessible name |
| `test/songbank.test.mjs` | Every card's notes resolve to a real frequency; accent/slide indices stay in range; tempos are plausible and applied on load; an unconfirmed tempo is visibly marked an estimate; each card's chart has one column per step, shows pitch class without the octave, derives D/U from the home octave, and dashes anything no source stated |
| `test/timing.test.mjs` | Notes are scheduled ahead of the audio clock and land on an exact grid; Stop silences hits already queued; shuffle stretches the wait *into* off-beat 16ths without changing the bar length; a DDJ phase jump moves the column without disturbing the tempo grid |

The stub clock advances with real time, so the schedulers run for real and only the audio nodes are faked. Reverting an engine to fire notes at `ctx.currentTime` fails the grid assertions immediately.

Two rules keep the timing tests honest on a busy machine. They wait for the data they need rather than for a fixed number of milliseconds — how many steps fit in 700ms is a property of the runner, not of the code — and every test that starts an engine registers `t.after(dispose)`, because a failed assertion would otherwise leave the sequencer's `setTimeout` chain rescheduling forever and hang the run instead of failing it.

Each of these guards a bug this repo has actually shipped, and each was checked by reintroducing that bug and confirming the suite goes red — worth repeating for any test added here, since an assertion that cannot fail is worse than none.

## Layout

```
Behringer Setup Guide.dc.html   the TD-3/RD-6 app — markup plus its component logic
DDJ-FLX4 Guide.dc.html          the DDJ-FLX4 app — markup plus its component logic
support.js                      generated dc-runtime (loads React/Babel, renders <x-dc>) — shared by both
_ds/organic-…/                  the Organic design system: styles.css, manifest, its own readme — shared by both
uploads/                        td3.jpg, rd-6.jpg — reference photos of the Behringer units
test/                           the test suite — harness.mjs plus three .test.mjs files
package.json                    test script only; the guides themselves still have no build step
.thumbnail                      WebP cover image
```

Each guide's markup is templated: `{{ … }}` bindings, `<sc-if>` and `<sc-for>` are resolved by the dc-runtime in `support.js` against that file's own `Component` class in its inline `<script type="text/x-dc">` block at the bottom of the HTML. Edit that class to change behavior; edit the markup above it to change layout. The two files are independent — neither imports the other's `Component` class or state.

All color, type, spacing, radius and shadow values come from CSS variables defined in the design system's `styles.css` — see [its readme](_ds/organic-a1ee2274-b5d1-4b02-b801-60a22fb5cbe6/readme.md) before changing any styling, and prefer the tokens over hard-coded values.

`support.js` is generated and carries a do-not-edit header.
