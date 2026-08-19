# TD-3 & RD-6 Guide

A single-page, interactive setup and performance course for the **Behringer TD-3-MO** acid synthesizer and **Behringer RD-6-BK** drum machine. It walks an absolute beginner from unboxing to playing a five-minute live set, then on through pattern chaining, sound-design extras, stage-ready troubleshooting, and a loadable bank of TD-3 patterns, over eight weeks — with clickable hardware widgets and Web Audio previews of the patterns you're programming.

Everything lives in one file — [Behringer Setup Guide.dc.html](Behringer%20Setup%20Guide.dc.html) — with a runtime script, a design-system bundle, and two photos alongside it.

## Running it

Open `Behringer Setup Guide.dc.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000/Behringer%20Setup%20Guide.dc.html.

**An internet connection is required.** The page pulls React 18, ReactDOM, and Babel Standalone from unpkg at runtime, and the Caprasimo/Figtree fonts from Google Fonts. There is no build step and nothing to install.

Audio starts only after you press a Play button, since browsers require a user gesture before a `AudioContext` will produce sound.

## The course

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
- **Song Bank** (Week 8) — a gallery of loadable step patterns (notes, accents, slides, waveform, tempo). Tap a card to load it into its own independent TD-3 engine (its own oscillator/filter/gain chain, not the Week 2/6 one) and hit Play to hear it. 14 cards ship by default:
  - 3 original practice patterns ("Rolling Eighths", "Octave Jump", "Offbeat Squelch") for drilling technique.
  - 11 transcribed from real fan-made TD-3/TB-303 pattern charts: "On the Run", "Everybody Needs a 303" (Fatboy Slim), "Higher State of Consciousness" and "Are You There" (Josh Wink), "I'm a Disco Dancer" parts 1–2 (Christopher Just), "Claustrophobic Sting" (The Prodigy, an 8-step pattern), "Forget It" parts 1–2 (Cut & Paste), "Da Funk" (Daft Punk), and "Breathe Deeper" (Tame Impala).
  - Any detail a source card left blank, unmarked, or illegible (accents, slides, tempo, exact octave placement) loads empty or as an explicitly flagged guess rather than an invented value — each card's `tag` notes what to double-check, and the pattern-length field means shorter patterns (e.g. the Prodigy's 8 steps) just loop at that length instead of padding to 16.
  - Frequencies are computed for any note name via equal-temperament math (`noteToFreq`, A4 = 440Hz) rather than a fixed lookup table, so cards can use any note/octave (the transcriptions above needed several the original Week 2/6 curriculum never used, like C#, F#, G#, and octaves 1 and 3).
  - Cards can optionally tune the filter/envelope instead of using the shared default (900Hz cutoff, 1800Hz on accents, Q 8, 0.18s decay) — "Breathe Deeper" sets `filter: { cutoff, resonance, decay, accent }` (each 0-1) to approximate its source card's Cutoff/Resonance/Decay/Accent knob percentages, mapped to roughly 200–2800Hz cutoff, Q 1–24, and a 0.08–0.43s decay tail. Envelope-mod depth isn't separately modeled.

  Add your own by editing the `SONG_CARDS` array near the top of the `Component` class — each entry is `{ id, title, tag, bpm, waveform: 'sawtooth'|'square' (optional, defaults to sawtooth), notes: [note names like C2, C#2, F#3, ...], accent: [step indices], slide: [step indices], filter: {cutoff, resonance, decay, accent} (optional, each 0-1) }`.

Checklists, cable states, and your edits to all patterns are held in memory for the session — reloading, or the **Start Over** button, resets them.

## Layout

```
Behringer Setup Guide.dc.html   the app — markup plus its component logic
support.js                      generated dc-runtime (loads React/Babel, renders <x-dc>)
_ds/organic-…/                  the Organic design system: styles.css, manifest, its own readme
uploads/                        td3.jpg, rd-6.jpg — reference photos of the two units
.thumbnail                      WebP cover image
```

The markup is templated: `{{ … }}` bindings, `<sc-if>` and `<sc-for>` are resolved by the dc-runtime in `support.js` against the `Component` class in the inline `<script type="text/x-dc">` block at the bottom of the HTML. Edit that class to change behavior; edit the markup above it to change layout.

All color, type, spacing, radius and shadow values come from CSS variables defined in the design system's `styles.css` — see [its readme](_ds/organic-a1ee2274-b5d1-4b02-b801-60a22fb5cbe6/readme.md) before changing any styling, and prefer the tokens over hard-coded values.

`support.js` is generated and carries a do-not-edit header.
