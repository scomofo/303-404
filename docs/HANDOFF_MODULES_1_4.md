# Handoff: Modules #1 and #4 — 303-404 Curriculum

**Verified:** August 26, 2026  
**Repository:** `scomofo/303-404`  
**Reference:** The branch containing this document, based on `main` at `1c2c8d609f1cfb91756baf7aac64210b299a4531`  
**Scope:** `Behringer Setup Guide.dc.html` and `Hybrid Live Set.dc.html`

This handoff describes the code that is present on the branch containing it. It separates current behavior from intended or proposed work. If `main` has moved, re-check the counts, tests, and known gaps before relying on this document.

## 1. Current Module Summary

| Module | File | Current scope | Primary interactive features |
| --- | --- | --- | --- |
| #1 — TD-3/RD-6 Guide | `Behringer Setup Guide.dc.html` | 10 weeks, 39 steps, 31 Song Bank cards, 11 Drum Bank sheets | Course Map, checklists, RD-6/TD-3 editors and audio, Song Bank, Drum Bank, performance exercises |
| #4 — Hybrid Live Set | `Hybrid Live Set.dc.html` | 6 weeks, 20 total steps including overview and completion | Course Map, independent checklists, visual layer mutes, selectable dual-pane performance timeline |

### Module #1: Behringer TD-3-MO / RD-6-BK Guide

The Behringer guide takes an absolute beginner from connections and basic sequencing through synthesis, clocking, performance, troubleshooting, pattern banks, and advanced tone shaping.

The Course Map can jump directly to any step. Checklist state records what the learner has ticked; it does not enforce prerequisites, unlock dependencies, or automatically skip steps.

### Module #4: Hybrid Live Set Guide

The Hybrid guide is a follow-on course for learners who already know the TD-3/RD-6 and DDJ-FLX4 material. It combines those systems conceptually into a six-week performance workflow. It does not import progress or engines from the other guides and keeps its own independent in-memory state.

Its performance map currently contains these sections:

1. Intro
2. Hardware Groove
3. Breakdown
4. Drop
5. Outro

The five sections render in a horizontally scrollable, keyboard-focusable timeline. Every section has a Hardware pane for RD-6/TD-3 and a Controller pane for DDJ-FLX4. Left/Right Arrow changes the selected section; Home and End jump to the first and last section. The selected section also appears in a detailed summary card.

## 2. Architecture and Runtime Ownership

Each guide is a standalone `.dc.html` file containing:

- declarative template markup;
- one inline `<script type="text/x-dc">` block;
- a module-specific `Component` class;
- module-specific state, data, view-model builders, and behavior.

Shared dependencies:

- `support.js` — generated DC runtime. It loads and hosts the component/template system and supplies state integration. It does **not** contain the TD-3, RD-6, Drum Bank, or Hybrid audio engines. Do not hand-edit it unless the generated runtime itself is intentionally being replaced.
- `_ds/` — Organic design-system assets and CSS variables. Use its color, spacing, radius, typography, and shadow tokens instead of hardcoded visual values.
- React 18 and ReactDOM — loaded from a CDN by `support.js`.
- Babel Standalone — also loaded by the runtime when required.

There is no application build step. The guides can be opened directly, but a local static server is the more reliable development path. Internet access is required for the CDN dependencies and fonts unless they are vendored locally.

### Where the audio code lives

The Behringer audio engines and sequencers live in the inline `Component` class in `Behringer Setup Guide.dc.html`. The Hybrid guide has no real audio engine. Its layer-mute controls are explicitly visual practice aids.

Refactoring `support.js` can still affect every guide's rendering and state lifecycle, but it is not an audio-engine refactor. Changes to Behringer scheduling or synthesis belong in the Behringer guide unless the repository deliberately introduces a new shared engine layer.

## 3. State Management and Persistence

### Current behavior: memory only

Both modules keep state in memory. Neither file uses `localStorage` or IndexedDB.

A hard reload resets:

- the current step;
- checklist progress;
- loaded Song or Drum Bank selection;
- current play state and playhead;
- editor changes;
- Hybrid layer-mute state;
- the selected Hybrid performance section.

The Song Bank does not currently have a favorites feature.

### `initialState()` is the reset contract

Every resettable field must be defined in `initialState()`. `restart()` restores that state, and `test/structure.test.mjs` guards against fields being left dirty after Start Over.

When adding state:

1. Add it to `initialState()`.
2. Confirm Start Over restores it.
3. Add a focused test when the field controls nontrivial behavior.

### Future persistence

If persistent learner progress is added, namespace stored records by module, for example:

```text
303-404/behringer/progress
303-404/hybrid/progress
```

The Hybrid checklist currently uses local step ids such as `w1-1` and `w5-1`. Those ids cannot collide today because each guide has its own component state. They would need a module-level namespace if multiple guides begin sharing one persistent store.

Do not persist transient audio objects, timers, oscillators, or Web Audio nodes. Persist serializable learner state only, and version the stored schema so future migrations are possible.

## 4. Module #1 — Data and Behavior Rules

### Song Bank: `SONG_CARDS`

Current card count: **27**.

The actual `sourceType` values are:

| Value | Meaning | Current count |
| --- | --- | ---: |
| `practice` | Original practice material | 8 |
| `chart` | Chart transcription | 11 |
| `table` | Written step-table source | 8 |

Do not rename these values casually; tests and rendering copy depend on them.

Notes use readable scientific pitch notation such as `C2` and `F#3`. A JavaScript `null` represents a rest. Keep note names and rests in this data form unless the entire schema, renderer, playback engine, documentation, and tests are migrated together.

#### Pending accent/slide source review

Exactly six chart entries currently carry `needsAccentSlideReview: true`:

- `fatboy-slim-everybody-needs-a-303`
- `josh-wink-higher-state`
- `josh-wink-are-you-there`
- `christopher-just-disco-dancer-1`
- `christopher-just-disco-dancer-2`
- `prodigy-claustrophobic-sting`

These flags are transparent provenance warnings. Do not remove, hide, or set them to false without revalidating the original accent and slide rows and updating the corresponding tests.

### Drum Bank: `DRUM_CARDS`

Current card count: **11**.

The bank renders all cards on the TR-808 row set:

```text
AC, BD, SD, LT, MT, HT, RS/CL, CP/MA, CB, CY, OH, CH
```

Cards must use 16 or 32 steps. The printed sheet and playback engine both derive from the same `rows` data.

#### Provenance rules

The Drum Bank uses these `sourceType` values:

- `record`
- `literature`
- `practice`

For external sources:

- Do not add an accent row unless the source records accents.
- Do not invent pattern number, variation, or pre-scale fields.
- The engine still needs a numeric `bpm`. When the source does not state one, use an openly documented estimate and leave `bpmConfirmed` absent or false so the sheet prints `~N BPM (estimated)`.
- Keep the citation and voicing explanation on the card.

The source datasets currently represented are the MIT-licensed `tr808r` package, the GiantSteps `drum-pattern-datasets` collection, and one practice pattern written for the course.

#### RS/CL and CP/MA switch pairs

`RS`/`CL` and `CP`/`MA` are switch pairs. A card's `pair` field controls both:

- the label printed on the pattern sheet; and
- the synthesized voice selected for playback.

Never change one side without the other. `test/drumbank.test.mjs` explicitly guards this agreement.

#### Card loading and tempo behavior

Loading a Drum Bank card currently:

1. stops any running Drum Bank sequence;
2. copies the card's rows into component state;
3. stores its step count, BPM, switch-pair settings, and selected id;
4. waits for the learner to press **Play Pattern**.

Loading does **not** automatically resume or retrigger playback.

When Play is pressed, the scheduler captures the loaded length and computes a sixteenth-note duration as:

```js
15 / bpm
```

For example, 71 BPM produces an approximately 211.3 ms step and 128 BPM produces an approximately 117.2 ms step. The sequence wraps at the loaded card's 16- or 32-step length.

Navigation, Start Over, and component unmount stop the Drum Bank along with the other engines. Preserve that cleanup whenever navigation or scheduling is changed.

#### Cymbal buffer regression history

PR #14 originally used a 0.3-second noise buffer for a one-second cymbal envelope. The merged fix increased the buffer to 1.1 seconds. The code is currently correct, but there is no focused regression assertion comparing buffer duration with the longest noise voice. Keep this relationship in mind if voice durations or buffer allocation change.

## 5. Module #4 — Current Integration Model

### Independent course state

The Hybrid guide owns these state fields:

```text
step, dialogOpen, checks, muteRd6, muteTd3, muteFlx4, perfmapSel
```

It does not read Module #1 or DDJ-FLX4 completion state. Its checklist arrays are keyed by Hybrid step id and Start Over clears them.

### Performance timeline

`PERF_SECTIONS` is a five-entry data array. Each section includes:

- `title`
- `time`
- `dur`
- `desc`
- `rd6`
- `td3`
- `flx4`

Selecting a section updates `perfmapSel`; the detail card then shows the three device roles for that section. The scroll region has `tabIndex="0"`, an accessible name, internal horizontal overflow, and keyboard selection. Selection calls `scrollIntoView()` when the browser exposes it.

### Layer mutes

The RD-6, TD-3, and FLX4 mute buttons are visual practice controls. They do not mute real audio, connect to another module, or operate hardware. Their state is independent, appears during phrase practice and the performance map, and resets through `initialState()`.

### Timeline accessibility boundary

`test/hybrid.test.mjs` guards the dual-pane view-model, focusable scroll-region markup, horizontal-overflow declaration, and Left/Right/Home/End selection logic. The Node harness still cannot calculate layout or prove that a particular browser paints and scrolls the region correctly. Keep a narrow-viewport browser pass in release QA.

## 6. Test Boundaries

### Full suite

Run from the repository root:

```bash
npm test
```

There is no dependency-install step. `package.json` requires Node 20 or newer, and CI runs Node 20 and 22. This is the repository's supported-version policy; do not describe Node 20 as the version that first introduced `node:test`.

### Focused Module #1 validation

```bash
node --test \
  test/structure.test.mjs \
  test/songbank.test.mjs \
  test/drumbank.test.mjs \
  test/timing.test.mjs
```

Coverage includes:

- general step rendering, Course Map behavior, accessibility checks, reset state, and design-token rules;
- Song Bank schema, provenance, charts, engine agreement, note handling, and audio behavior;
- Drum Bank schema, source omissions, sheet/engine agreement, switch pairs, accents, load state, and navigation cleanup;
- lookahead scheduling, exact grids, queued-note cleanup, shuffle, envelopes, and card-level Drum Bank tempo.

### Focused Module #4 validation

```bash
node --test \
  test/structure.test.mjs \
  test/hybrid.test.mjs
```

`test/hybrid.test.mjs` currently verifies:

- five week-intro steps plus overview and completion;
- five performance-section data records and selection state;
- dual Hardware/Controller pane data and accessible section labels;
- focusable timeline markup and horizontal overflow;
- Left/Right Arrow, Home and End selection behavior;
- RD-6, TD-3, and FLX4 descriptions for every section;
- independent checklist state and reset behavior;
- Course Map grouping;
- independent visual layer mutes and reset behavior.

It does **not** execute React DOM, calculate responsive layout, or prove physical scrolling in a real browser.

`test/timing.test.mjs` contains Behringer, DDJ-FLX4, and MPK timing coverage. It does not currently exercise Module #4 because the Hybrid guide has no audio scheduler.

### What the harness does and does not run

`test/harness.mjs`:

- reads the inline `Component` logic from each `.dc.html` file;
- evaluates it against a synchronous stub logic base;
- supplies a stub Web Audio API;
- lets tests inspect state, view-model values, and scheduled audio data.

It does **not** execute:

- `support.js` itself;
- React or ReactDOM;
- the final template DOM;
- real browser focus or keyboard defaults;
- CSS layout, clipping, or horizontal scrolling;
- actual speakers, hardware, MIDI, or browser audio-policy behavior.

A new markup-only button does not automatically require a harness stub and may not affect the Node tests at all. Code that directly uses an unstubbed browser global may require a targeted stub. DOM, responsive-layout, and accessibility claims still need a browser/manual check or a DOM-capable automated test.

## 7. Serving and Browser Verification

Use a local static server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/Behringer%20Setup%20Guide.dc.html
http://localhost:8000/Hybrid%20Live%20Set.dc.html
```

### Module #1 browser pass

- Click through Week 1 to Week 10.
- Use Course Map to visit every week and return focus after closing it.
- Load and play representative Song Bank cards.
- Check both 16- and 32-step Drum Bank sheets on desktop and a narrow viewport.
- Verify horizontal sheet scrolling remains inside the card.
- Confirm Play, Stop, navigation, and Start Over leave no audio running.
- Refresh once and confirm the currently documented memory-only reset behavior.

### Module #4 browser pass

- Click every performance section and confirm the detail card changes correctly.
- Toggle each layer mute independently in phrase practice and the performance map.
- Tick Week 1 and Week 5 items, then confirm Start Over clears both.
- Exercise Course Map focus trapping and return focus.
- On a narrow viewport, verify internal horizontal scrolling, page-width containment, Tab focus, and Left/Right/Home/End behavior.

## 8. Known Issues and Active Tasks

| Issue | Module | Priority | Current status |
| --- | --- | --- | --- |
| No persisted learner progress | #1 and #4 | High if shipping as a retained course | Reload resets all state; no storage adapter exists |
| Six legacy Song Bank charts need accent/slide source revalidation | #1 | Medium | `needsAccentSlideReview: true` remains on the six named cards |
| No real-browser regression coverage for responsive layout, focus, scrolling, or CDN/runtime boot | #1 and #4 | Medium | Node tests inspect logic and limited markup only |
| Cymbal buffer fix lacks a direct duration regression test | #1 | Low | Current 1.1-second buffer safely covers the one-second cymbal |
| CDN dependencies limit offline use | #1 and #4 | Low unless offline use is required | React/ReactDOM/Babel and fonts are loaded at runtime |

YouTube search links belong to the DDJ-FLX4 Practice Plan and are outside this two-module handoff. MPK synth and Mutate behavior are also outside scope and should not appear as Module #4 issues.

## 9. Safe-Change Rules

Before merging changes to these modules:

- Keep every resettable field in `initialState()`.
- Stop sequencers during navigation, restart, and unmount.
- Preserve source omissions instead of inventing Song or Drum Bank facts.
- Keep printed Drum Bank pair labels and audible pair voices synchronized.
- Preserve per-card Drum Bank BPM and pattern length.
- Use `_ds/` tokens rather than hardcoded colors or spacing.
- Treat `support.js` as generated shared infrastructure.
- Update README counts and claims whenever course data or UI behavior changes.
- Add every new `*.test.mjs` file to the explicit `npm test` command in `package.json`.
- Run the full suite even after a focused test pass; the five guides share structural rules and runtime assumptions.
- Perform browser QA for DOM/CSS/accessibility claims that the Node harness cannot observe.

## 10. New-Maintainer Checklist

- [ ] Check out the intended branch and record its commit SHA.
- [ ] Use Node 20 or 22 and run `npm test` before editing.
- [ ] Read `initialState()`, `buildSteps()`, and `renderVals()` in both modules.
- [ ] Review `SONG_CARDS`, `DRUM_CARDS`, and their focused tests before changing bank data.
- [ ] Review `PERF_SECTIONS` and `test/hybrid.test.mjs` before changing the Hybrid performance map.
- [ ] Open both guides through a static server and complete the browser passes above.
- [ ] Verify the Hybrid timeline at desktop and narrow viewports after any layout or design-system change.
- [ ] Keep persistence work separate from audio/runtime objects and namespace any stored schema.
- [ ] Update this handoff when counts, test boundaries, or known gaps change.

## 11. Sources of Truth

Use these in order:

1. Current module code and data in the two `.dc.html` files.
2. Focused assertions in `test/songbank.test.mjs`, `test/drumbank.test.mjs`, `test/timing.test.mjs`, `test/hybrid.test.mjs`, and shared assertions in `test/structure.test.mjs`.
3. `package.json` for the test command and supported Node version.
4. `README.md` for user-facing intent, checked against implementation.

Tests are executable specifications for the behavior they assert, but they are not complete browser specifications. Do not treat an untested README statement as shipped behavior.

## Appendix A — Corrections Made During This Audit

| Supplied-draft statement | Audited correction |
| --- | --- |
| `support.js` owns the audio engines | Audio engines live in module component code; `support.js` is the generated runtime |
| Song Bank source types are `original` / `written` / `transcribed` | Actual values are `practice` / `chart` / `table` |
| The Hybrid guide ships a dual-pane, scrollable, keyboard-focusable timeline | The draft was initially ahead of the implementation; this branch now ships the timeline and keyboard selection, while real layout still requires browser QA |
| Hybrid tests enforce horizontal keyboard scrolling | They now guard markup and selection logic, but the Node harness still cannot prove physical browser scrolling |
| Drum-card loading retriggers playback at the new BPM | Loading stops playback and stores the new BPM; the learner presses Play to start a new scheduler |
| Hybrid checklist keys are globally namespaced | They are local step ids inside an independent component; module namespacing becomes necessary if persistence is shared |
| Adding a DOM control necessarily requires harness-stub changes | The harness does not render the DOM; only logic that uses missing browser globals may need stubs |
| Node 20 is required because it introduced `node:test` | Node 20+ is the repository support policy and CI matrix |
| YouTube-link and MPK/Mutate issues belong in this handoff | They are outside Modules #1 and #4 and were removed from the active-task list |

---

End of handoff.
