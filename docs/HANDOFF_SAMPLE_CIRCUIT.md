# Handoff: Sample & Circuit Guide

Verified: August 26, 2026

Module file: SampleCircuit Guide.dc.html

Focused tests: test/slicebank.test.mjs and the Sample & Circuit cases in test/timing.test.mjs

## Shipped scope

The guide is an eight-week, 50-step beginner curriculum for Novation Circuit Tracks / Rhythm, Elektron Model:Samples, Roland SP-404MKII, or the browser lab. It contains eight week introductions, 40 daily lessons, an overview and a completion screen.

Interactive features:

- 15-card Slice Bank;
- deterministic browser-generated audio;
- local WAV, AIFF and MP3 decoding;
- canvas waveform with draggable internal markers;
- sensitivity-based transient slicing;
- eight playable pads;
- eight-track, 16-step pattern grid;
- audio-clock tempo scheduling;
- OfflineAudioContext resampling with buffer-copy fallback;
- stereo PCM WAV export at 16 or 24 bit.

## Runtime ownership

SamplerEngine is authored inside the guide's text/x-dc block. This follows the existing one-file architecture. Do not move it into support.js casually: support.js is generated shared runtime infrastructure and does not own the other guides' audio engines.

The sampler uses raw Web Audio. There is no Tone.js, WaveSurfer, dependency installation or build step.

## Provenance

All 15 default cards use:

    sourceType: original_synthesis
    license: Repository original

The page generates every default sound locally. It embeds, downloads and redistributes no third-party recording. User-imported files remain local to that browser session and are not persisted.

A symbolic rhythm chart and an audio sample are different assets. A properly sourced chart can describe a rhythm such as the Amen pattern without bundling the original recording. An audio card still requires a redistribution-compatible recording licence.

Schema-compatible sourceType values are cc0, mit_licensed, musicradar_free, giantsteps, original_synthesis, field_recording and public_domain. A label is not evidence. Before adding external audio, record the exact asset, creator, source URL, licence and retrieval date.

Never reuse:

- a software repository licence as an unrelated audio-sample licence;
- a pattern-dataset licence as permission for a recording;
- a free-download label as permission to redistribute;
- an unsupported public-domain claim for a named commercial break.

## Card rules

Each card includes id, title, sourceType, originalBpm, bpmConfirmed, bitDepth, sampleRate, duration, slices, autoSliced, algorithm, sensitivity, waveform, generator, seed, provenance and license.

- Slice data is zero-based; visible pad labels are one-based.
- Adjacent slices share one exact boundary.
- Every slice is at least 5 ms.
- One-shots use originalBpm null and bpmConfirmed false.
- Confirmed loop BPM is numeric and between 20 and 300.
- Auto-sliced cards record algorithm transient_detection and sensitivity from 0 to 100.
- Export rates are 44.1 or 48 kHz; bit depth is 16 or 24.

## SamplerEngine responsibilities

| Method | Responsibility |
| --- | --- |
| loadSample | Decode and store a local file |
| createGenerated | Lazily synthesize and cache an original card |
| slice | Detect transient windows and return bounded regions |
| playSlice | Map a pad index to its exact buffer offset |
| resample | Render offline, or clone when offline rendering is unavailable |
| encodeWav | Write a PCM RIFF/WAVE ArrayBuffer |
| exportWav | Return bytes plus explicit format metadata |
| transitionMetrics | Report a scheduled gap and boundary click level |

Default generators fade both buffer edges toward zero. Preserve that property to keep adjacent patterns click-free.

## Tempo and transport

A sixteenth note is calculated as:

    stepSeconds = 60 / bpm / 4

Pattern-chain entries share the same end/start timestamp. Changing tempo stops an active transport before it restarts, so old and new grids cannot overlap. Navigation, Start Over and unmount also stop transport.

## State and persistence

initialState owns step, dialogOpen, checks, selectedCardId, sensitivity, selectedTrack, pattern, tempo, playing and status.

Shipped 2026-09-03: versioned localStorage under `303-404/sample-circuit/v1`
(local mixin on the `DCLogic` component; see `enablePersistence` in
`SampleCircuit Guide.dc.html`). Persisted: step, checks, selectedCardId,
sensitivity, selectedTrack, pattern, tempo. Never persisted: dialogOpen,
playing, status, imported file bytes, sampler nodes, transport timers.
Note: this guide still extends `DCLogic` (not the shared `DCCourseLogic`),
so its adapter is a local copy — migrate to the shared base if the class
is ever unified.

Progress, imported files and marker edits beyond the persisted pattern are
memory-only. Start Over rebuilds original card data and writes the fresh
state back. Imported audio blobs are never persisted; if blob persistence
is added later:

- namespace it under 303-404/sample-circuit/;
- store audio blobs in IndexedDB, not localStorage;
- version metadata and buffer schemas;
- never serialize AudioNodes, timers, contexts or object URLs;
- document quota, deletion and migration behavior.

## Automated coverage

test/slicebank.test.mjs guards:

1. eight weeks and both labs;
2. 15-card original provenance;
3. the 5 ms minimum;
4. tempo provenance;
5. resample shape and RMS loss;
6. WAV rate, depth, channels and PCM header;
7. chain gap and click thresholds;
8. pad-to-offset mapping;
9. transient algorithm metadata.

test/timing.test.mjs guards exact sixteenth grids, card-tempo changes and pattern boundaries. Shared structure tests guard rendering, Course Map, reset completeness, accessible controls and design-system colours.

The Node harness does not render React DOM or a real canvas. It cannot validate browser decoding, downloads, OfflineAudioContext output, touch dragging, speaker output or responsive layout.

## Browser QA

- [ ] Serve the repository with python3 -m http.server 8000.
- [ ] Complete all 50 steps.
- [ ] Open all 15 cards and play every available pad.
- [ ] Auto-slice Pocket Funk Break at several sensitivities.
- [ ] Drag markers with mouse and touch; keep adjacent slices at least 5 ms.
- [ ] Import supported WAV, AIFF and MP3 files.
- [ ] Build a pattern, play it, change BPM and confirm a clean restart.
- [ ] Resample and compare duration, pitch and level.
- [ ] Export 16-bit and 24-bit WAV files and play them outside the guide.
- [ ] Check narrow-screen bank, pads and grid containment.
- [ ] Navigate, reset and close while playing; confirm timers and audio stop.

## Safe changes

- Keep resettable fields in initialState.
- Keep default audio original or attach authoritative redistribution evidence.
- Keep card metadata, slices, labels and buffer aligned.
- Preserve the 5 ms minimum in auto and manual slicing.
- Stop and restart transport on BPM changes.
- Keep exports within the documented rates and depths.
- Use design-system tokens rather than hardcoded colours and spacing.
- Add every new test file to the explicit npm test command.
- Run the complete suite.

---

End of handoff.
