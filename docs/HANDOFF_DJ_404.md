# Handoff: DJ-404 / DDJ-FLX4 Performance Guide

Verified: August 26, 2026

Module file: DDJ-FLX4 Guide.dc.html

Focused tests: test/curriculum.test.mjs, test/transitionbank.test.mjs, DDJ cases in test/timing.test.mjs, and shared test/structure.test.mjs

## Shipped curriculum

The former seven-week hands-on course plus separate six-week Practice Plan has been merged into one eight-week intensive. It contains eight week introductions, 40 daily sessions, eight independently tracked milestones, an overview and completion screen.

The weekly sequence is:

1. wiring, software, cueing and library preparation;
2. tempo, nudging, pitch riding and manual beatmatching;
3. faders, EQ, filters and gain staging;
4. hot cues, loops and phrasing;
5. echo, reverb and FX transitions;
6. Camelot guidance and harmonic listening;
7. planning and recording a 28–32 minute energy arc;
8. re-recording, export, artwork, tracklist and self-assessment.

Existing practice widgets were retained where they were stronger than rebuilding them: cables, jog wheels, tempo, mixer EQ, faders, Sync, hot cues, loops, Beat FX and the performance map.

## New features

- 12-card Transition Bank with type and difficulty filters;
- two original synthesized reference tracks with millisecond beat-grid offsets;
- canvas phase meter for Deck A and Deck B;
- simulated -60 dB EQ kills;
- echo feedback that decays below -60 dB within four beats;
- Camelot compatibility status that warns without blocking playback;
- zero-crossing helper for click-safe cue placement;
- short browser practice recorder that exports stereo 44.1 kHz / 16-bit PCM WAV;
- three-minute browser recording cap to bound memory use.

The final 30-minute course set is recorded in rekordbox or Serato. The browser recorder is a drill tool, not a replacement for a full DJ-software recorder.

## Runtime ownership

The DDJ practice engine remains in the guide's text/x-dc Component. support.js is generated shared runtime infrastructure and should not receive a hand-written DJEngine class.

The guide uses raw Web Audio and the repository's existing lookahead scheduler. There is no new library or build dependency.

Important lifecycle rules:

- Start Decks creates independent Deck A and Deck B sequences.
- Sync sets Deck B to the reference tempo and phase.
- Nudge changes phase without changing the tempo grid.
- Stop, navigation, Start Over and unmount flush future scheduled sources.
- EQ, fader, crossfader and effect changes update the existing audio graph.

## Transition Bank schema

Each card includes:

    id
    title
    type
    bpmRange
    difficulty
    sourceAttribution
    steps
    videoSearch

bpmRange is null when a technique is not tied to a narrow tempo range. Otherwise it is a two-number inclusive guidance range. It is educational metadata and must not block the card on other tracks.

sourceAttribution describes the technique category or manufacturer control workflow without claiming ownership of a standard DJ method. YouTube links are search URLs, not guessed video IDs.

The FLX4 has no physical FX paddles. Do not add paddle instructions unless the curriculum explicitly describes an external or software mapping. Use Beat FX, Smart CFX, Smart Fader and available rekordbox/Serato mappings.

## Browser lab models

### Phase

phaseDriftMs calculates raw timing separation over a duration. Sync normalizes Deck B tempo and seeks its step column to Deck A before the test evaluates drift.

### EQ

The Cut choice maps to -60 dB for low, mid and high simulated bands. Flat and boost continue to use the existing filter-gain ranges.

### Echo

Feedback is 0.15. Four repeats are below -60 dB. Raising this value requires updating both the educational claim and the focused decay test.

### Harmonic guidance

camelotCompatibility marks:

- exact keys;
- same-number A/B relative moves;
- same-letter adjacent-number moves.

Everything else displays an intentional-mismatch warning. It never disables Start Decks, Play, Cue or transitions.

### Recording

buildPracticeWav creates a deterministic original-synth stereo PCM file at 44.1 kHz / 16-bit. Duration is bounded from 0.1 to 180 seconds. Peak level is clamped below -0.5 dB.

A 30-minute stereo 16-bit PCM buffer would consume substantial memory. Do not remove the cap without moving to a streaming writer or another bounded design.

## Persistence

No localStorage adapter was added. The browser lab has fixed generated reference tracks rather than imported, analysed track metadata, so persisting BPM/key records would create state without a real ingestion workflow.

If user-track analysis is added later:

- namespace records under 303-404/ddj-flx4/;
- store serializable metadata only;
- version the schema;
- do not persist AudioNodes, contexts, object URLs or timers;
- make user deletion and re-analysis explicit.

## Automated coverage

test/curriculum.test.mjs guards:

- one eight-week course;
- five daily sessions per week;
- one milestone per week;
- removal of the duplicate Practice Plan path;
- search-only video resources;
- reuse of every major existing widget;
- README consistency.

test/transitionbank.test.mjs guards:

1. 12 complete, attributed and filterable cards;
2. phase drift below 5 ms after lock;
3. -60 dB EQ kills;
4. echo decay below -60 dB within four beats;
5. 44.1 kHz / 16-bit stereo WAV format, duration and peak;
6. zero-crossing cue snapping;
7. non-blocking Camelot warnings;
8. millisecond beat-grid offsets.

test/timing.test.mjs continues to guard independent deck grids, phase nudging, lookahead and stop cleanup.

The Node harness does not execute React DOM or a real canvas. It cannot prove canvas appearance, real audio-device routing, actual rekordbox/Serato behavior, browser downloads, or responsive layout.

## Browser QA

- [ ] Serve with python3 -m http.server 8000.
- [ ] Complete all 50 steps and use Course Map to revisit every week.
- [ ] Start and stop the synthetic decks from every audio widget.
- [ ] Confirm the phase canvas paints two labelled, moving indicators.
- [ ] Match BPM manually, nudge phase and then compare Sync.
- [ ] Verify each EQ Cut audibly removes its band.
- [ ] Use hot cues, loops and echo while the decks play.
- [ ] Filter Transition Bank cards by type and difficulty.
- [ ] Select 5A and 3A; confirm the warning appears and playback stays available.
- [ ] Record and download a short practice WAV; play it outside the guide.
- [ ] Check narrow-screen Transition Bank cards, filters and canvas.
- [ ] Navigate, reset and close while audio is scheduled; confirm nothing continues.

## Safe changes

- Keep resettable fields in initialState.
- Preserve audio-clock lookahead and queued-source cleanup.
- Keep Sync and Nudge behavior distinct.
- Keep harmonic warnings educational and non-blocking.
- Do not imply the FLX4 has hardware controls it lacks.
- Keep browser recording bounded or replace it with a streaming implementation.
- Use design-system tokens rather than hardcoded colours and spacing.
- Add new tests to the explicit npm test command.
- Run the complete suite.

---

End of handoff.
