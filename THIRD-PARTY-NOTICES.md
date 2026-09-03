# Third-party notices

This repository's original course code, templates, engines, and tests are
MIT-licensed (see `LICENSE`). The following third-party sources informed
bank data or are loaded at runtime. They are **not** re-licensed by this
project.

## Drum Bank pattern sources (symbolic charts only — no audio redistributed)

* `coolbutuseless/tr808r` — MIT License, Copyright (c) 2022
  mikefc@coolbutuseless.com. Used for three transcribed TR-808 rhythm
  pattern sheets ("Sexual Healing", the "Beat It" intro, "Confusion").
  Only the symbolic step grid was transcribed; no package audio or code
  is vendored. See `test/drumbank.test.mjs` provenance guards.

* `GiantSteps/drum-pattern-datasets` — no LICENSE file ships upstream
  (2-line README only, accessed September 2026). Seven patterns
  (including Funky Drummer, Impeach the President, When the Levee Breaks,
  Electro, House, Classic House, Minimal Techno) are used as transcribed
  symbolic charts with explicit `sourceType`, `voicing`, and citation on
  each `DRUM_CARDS` entry. Unknown tempos stay estimates
  (`bpmConfirmed` absent/false). Do not treat this dataset license as
  permission for any audio recording.

Rule (enforced by README + tests): a software or pattern-dataset license
must never be reused as an audio-sample license. Any future audio card
needs its own redistribution-compatible recording license.

## Runtime CDN dependencies (loaded, not vendored)

* React 18.3.1 + ReactDOM 18.3.1 (`unpkg.com`, MIT-licensed by Meta).
* Babel Standalone 7.29.0 (`unpkg.com`, MIT-licensed by Babel).
* Design-system fonts via `_ds/.../styles.css`.

No React/Babel code is copied into this repo. `support.js` is generated
from `dc-runtime` plus the hand-maintained `__DC_COURSE_SHARED_*` block.
