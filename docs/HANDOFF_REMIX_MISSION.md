# Guided remix: change the hats, hear the feel

## Purpose

The Arcade previously moved from exact-match beat challenges to open-ended
remix buttons. This optional mission connects a deliberate edit to a listening
decision and a saved piece of music. It guides one action at a time:
hear A, change the hats, hear B, reflect, keep the version.

Open Beat Arcade, turn on some pads (or rebuild a reference), choose **Remix
this beat**, then **Guide my remix**. No challenge completion is required.

## Behavior

- Original A stays intact. The experiment accepts any different hi-hat pattern
  while keeping the other musical scene data unchanged.
- The suggestion removes an original hat when there are at least two, or adds
  a missing offbeat hat to a sparse original. **Go to hi-hats** focuses that pad.
- A full sequence of playback events for one bar, with all instruments, advances
  each listening step. Queued scenes, button clicks, partial bars and solos do
  not earn comparison credit. This tracks playback, not a person's hearing.
- Musical edits during the guide stop playback and invalidate the remix listen,
  reflection and completion. Undo and Reset follow the same rule. A listening
  speed change requires both sides to be compared again at the new speed.
- Every offered reflection is valid. There is no taste score, new star award,
  course completion credit, timer or deadline.
- **Keep mission version** uses the existing isolated Studio project save. The
  mission completes only after saving succeeds. A failed write preserves the
  comparison and reflection for retry, with an error next to the mission.
- Saved projects contain A and B at their musical tempo and full mix. Listening
  speed and solos do not alter saved music. The final Drop Lab action uses the
  existing `build=1` route to derive performance scenes from remix B.
- **Free remix** exits the guide without modifying music. Returning to a beat
  within this visit preserves its active mission. Starting the guide again
  resets its comparison. Mission progress/reflections are not stored across
  reloads; kept Studio projects are.

## Implementation

| File | Change |
| --- | --- |
| `arcade/mission.js` | Pure musical comparison and mission state |
| `arcade/app.js` | Mission controls, current-version playback tracking, save/retry integration |
| `beat-arcade.html`, `arcade/arcade.css` | Optional mission card, five-step indicator, adaptive pad suggestion |
| `index.html` | Home entry copy introduces guided remixing |
| `test/mission.test.mjs` | 12 independent mission contract tests |
| `test/arcade.test.mjs` | 6 additional UI event integration tests |
| `package.json`, `README.md` | Test inclusion and user-facing documentation |

No runtime dependency, project schema or stored progress format changed.

## Validation of this archive

- Based on uploaded snapshot `0596b15addc0eea3ef722a72fba3551f4597ff31`.
- The validation below was performed on the local source before PR creation.
  No deployment or browser acceptance is claimed.
- `npm test` on Node v24.19.0: **300 passed, 0 failed, 1 skipped** (301 total).
- The skipped test is the existing optional Playwright boot check. It is not
  installed as a project dependency and does not currently include Arcade or
  Drop Lab.
- New tests exercise production scripts with DOM/audio doubles. They cover the
  full mission event flow, save failures/retries, exact A/B project handoff,
  edit/undo/reset invalidation, round changes, unchanged scores/originals,
  solo/queued playback and listening-speed changes.
- JavaScript syntax checks passed; edited HTML has no duplicate IDs.
- The available browser rejected access to the local preview with
  `net::ERR_BLOCKED_BY_CLIENT`. No browser layout, actual listening or physical
  touch-device acceptance is claimed for this change. Earlier Chrome QA in
  other documents does not validate this new mission.

## Short browser acceptance check (not yet performed)

Serve the extracted project on one origin using `python -m http.server 8000`.
Open `http://localhost:8000/beat-arcade.html` in a target browser with audio on.

1. Add a kick and at least two hats. Enter Remix, then **Guide my remix**.
   The first action should be **Hear original A**. Let one bar play; the guide
   should advance to the hi-hat change. Verify a short/paused listen does not
   advance it.
2. Use **Go to hi-hats**, toggle the focused pad with Space, then **Hear remix B**.
   The original must stay intact; the guide should request a reflection after
   one bar. Listen to both versions and confirm that the hats are the difference.
3. Pick any reflection, then **Keep mission version**. Completion should appear
   after the project saves. Open the remix in Studio and confirm A and B retain
   their respective patterns. Change listening speed to 75% during a fresh
   attempt; comparison should restart while the saved musical tempo stays unchanged.
4. After completion, edit another hat or use Undo. The guide should request a
   fresh listen and reflection. Choose **Free remix**; the musical edits must
   remain. Switch beats and return; the remix must remain for the visit.
5. Repeat with keyboard only and at 390 px and 320 px widths. Verify visible
   focus, legible steps, usable reflection selection and no page overflow.
   Try the completed mission's Drop Lab action and confirm the performance set
   derives from the chosen remix.

Capture browser/version, viewport or device, pass/fail and notes for each check.
Failure should identify the exact action and visible/audio result, not merely
whether the page loaded.

## Existing review item

The separately identified guided-practice completion-retry bug in
`practice-path.js` remains outside this gameplay improvement. The new mission
uses the existing remix project saver and has its own failure/retry coverage.
