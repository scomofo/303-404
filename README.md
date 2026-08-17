# TD-3 & RD-6 Guide

A single-page, interactive setup and performance course for the **Behringer TD-3-MO** acid synthesizer and **Behringer RD-6-BK** drum machine. It walks an absolute beginner from unboxing to playing a five-minute live set over four weeks, with clickable hardware widgets and Web Audio previews of the patterns you're programming.

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

A progress bar tracks your position across the 16 steps, and the **Course map** button in the header jumps to any step.

### Interactive pieces

- **Signal-path diagrams** — tap each cable run (audio out, and the sync cable in Week 3) to mark it connected.
- **Knob dials** — every instruction that names a knob position renders it as a dial pointing at the right o'clock value.
- **RD-6 step sequencer** — a 16-step grid across BD, SD/CP, CH, OH and Accent, pre-loaded with the pattern from the lesson. Toggle any cell and hit **Play Pattern** to hear it: synthesized kick, plus filtered noise bursts for snare and hats, with accented steps hitting louder.
- **TD-3 pattern editors** — the pitch row (C2…F2 across 16 steps), the timing row where you toggle ACC and SLIDE per step, and a playback view. **Play Bassline** runs a sawtooth oscillator through a resonant lowpass with a per-step filter envelope; accents open the cutoff further, and a slide on the previous step ramps the pitch instead of retriggering the envelope.
- **Performance map** — a proportional timeline of the seven sections of the five-minute set; click a section for its direction.

Checklists, cable states, and your edits to both patterns are held in memory for the session — reloading, or the **Start Over** button, resets them.

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
