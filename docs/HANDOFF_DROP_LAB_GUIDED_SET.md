# Drop Lab guided performance: Make the return land

## Purpose
A short, optional performance challenge gives learners a concrete way to try
the existing four-scene Intro → Groove → Breakdown → Return arrangement.
There is no score. The learner can leave for free play at any point and can
record a take separately.

## Progress contract
- The guide displays the names from the currently loaded project in scene order
  A, B, C, D.
- A step advances only after the transport reports one uninterrupted 16-step
  bar for the expected scene, beginning at tick 0.
- Partial bars, missing ticks, a stop, or a different scene clear the current
  partial bar. Previously completed scenes remain complete.
- Changing projects exits and resets the guide so progress cannot carry between
  different music.
- Progress is temporary for this visit. It does not write a score or project,
  and it does not claim to judge the learner's hearing, timing quality, or taste.
  Recording and downloading a take remain separate actions.

## Implementation
| File | Role |
| --- | --- |
| `drop/mission.js` | Pure four-scene and full-bar progress state |
| `drop/app.js` | Transport event tracking, project reset, launch controls and status |
| `drop-lab.html`, `drop/drop.css` | Accessible challenge controls and responsive progress cards |
| `test/drop.test.mjs` | Partial/wrong-scene rejection, full arc, renamed scenes and reset coverage |
| `README.md` | Learner-facing feature summary |

No project schema, storage key, recording format, runtime dependency, or scoring
system changes.

## Automated validation
The Drop Lab test harness uses a transport double and dispatches the same
scene/tick visual events consumed by production code. It can verify sequence
and interruption rules, but it does not establish that a person heard a scene,
that the browser rendered the card well, or that a physical keyboard/touch input
works.

## Browser acceptance (pending)
Serve the repository on one origin with `python -m http.server 8000`, then open
`http://localhost:8000/drop-lab.html` in a current desktop browser with audio on.

1. Choose **Start guided set** and press **Launch Intro**. Confirm the status
   stays on step 1 through a partial bar, then advances after a full bar.
2. Stop halfway through the next scene and restart it. Confirm the new bar must
   finish from its beginning. Launch a different scene out of order and confirm
   it earns no credit.
3. Complete the four scenes in order, both using **Launch** and the existing
   scene pads/1–4 keys. Confirm the challenge reports the complete arc, then
   record, play back and download a take.
4. Load a saved project with renamed scenes. Confirm the guide uses those names;
   choose **Use starter** during an active challenge and confirm it resets.
5. Check keyboard focus and layout at desktop, 390 px and 320 px widths. Confirm
   all progress labels and buttons remain visible, with no horizontal overflow.

Capture browser/version, viewport, pass/fail and the visible/audio result for
each action. A checklist alone is not evidence that the procedure was performed.
