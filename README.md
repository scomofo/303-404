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
- **Song Bank** (Week 8) — a gallery of loadable 16-step patterns (notes, accents, slides, waveform, tempo). Tap a card to load it into its own independent TD-3 engine (its own oscillator/filter/gain chain, not the Week 2/6 one) and hit Play to hear it. Three cards ("Rolling Eighths", "Octave Jump", "Offbeat Squelch") are original practice patterns for drilling technique. "On the Run" is transcribed from a fan-made TD-3 tutorial card — notes and octave-up (`UP`) steps as printed, square waveform as circled on the card; its Accent/Slide row and tempo weren't marked on the source, so those load as empty/a 130 BPM starting guess rather than invented values. Add your own by editing the `SONG_CARDS` array near the top of the `Component` class — each entry is `{ id, title, tag, bpm, waveform: 'sawtooth'|'square' (optional, defaults to sawtooth), notes: [16 note names, e.g. C2/D2/D#2/E2/F2/G2/A2/A#2/C3/D3/E3], accent: [step indices], slide: [step indices] }`.

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
