# Groove Studio

The studio adds a creative destination to the six-course app. Open it from the
home or course header; the Behringer bank cards also pass a specific pattern in
`?bass=<id>` or `?drums=<id>`. These links create a new project, preserving saved
ones. No imported audio or hardware connection is required.

## Ownership and data

- `studio/project.js`: `DCStudioProject`, version 1, four ordered scenes A–D.
  Each scene owns separate drum, bass, source and mix objects. The arrangement
  references scenes by ID, with 1–8 sections and at most 32 bars.
- Drum steps are 16 or 32; bass lengths are 2–32. All hit, accent and slide
  positions are zero-based. Notes are names such as `F#2`, with `null` for rests.
  A slide belongs to the note that leads into the next note.
- `validateProject` reconstructs known fields and rejects invalid music,
  oversized forms and unknown versions. Backups contain data, never audio
  nodes, recording chunks, URLs or a browser context. Imports receive a new ID.
- `ProjectStore` uses `303-404/studio/project/<id>`. Reads do not require a
  successful write. Saves compare the raw value last read/written to detect
  other-tab changes or deletion; a conflict offers Save a copy. Damaged entries
  are retained. JSON backups are the durable, portable user-controlled copy.
- Course state and progress keep their existing keys and format. Loading a
  bank card does not transfer a learner's edited course-engine state.

## Banks and attribution

`scripts/build-studio-banks.mjs` extracts all 31 `SONG_CARDS`, 11 `DRUM_CARDS`
and voice definitions using the existing guide harness. Run `npm run studio:banks`
after changing the source banks. The drift test checks the full output.

Project attribution retains the source title, type, source note and unresolved
accent/slide review flag; user edits mark the pattern as edited. The page calls
the audio a synthesized approximation. Dataset licenses describe pattern data,
not a license to redistribute commercial recordings.

## Audio and lifecycle

`studio/audio.js` provides one `Engine.scheduleStep` implementation for both
live transport and `OfflineAudioContext` WAV export. All lanes use a sixteenth
clock (`15 / BPM` seconds) but wrap at their own pattern lengths. Sections reset
both lanes. Live scene launches occur at a bar boundary. Transport scheduling
looks ahead by 100 ms, wakes every 25 ms and emits visual events at audio time.
It stops after a timing interruption instead of scheduling a burst of late notes.

The synth has continuous saw/square oscillators with scheduled waveform gains,
pitch glides and a resonant filter/envelope. Drum voices use oscillators and a
deterministic noise buffer. Closed hats choke open tails once. A soft output
stage bounds the sum; Stop cancels future sources and disconnects the graph.

Arrangement WAV export snapshots the project, renders 44.1 kHz stereo audio
plus a 1.1-second tail, then writes 16-bit PCM from that rendered buffer. It does
not synthesize an unrelated reference beat. Live gestures are separate: a take
connects the current engine output to a media-stream destination while retaining
speaker output. Recording uses the browser's supported codec and correct file
extension, has a three-minute cap, and stops tracks/disconnects capture on finish.

The app pauses playback when hidden and saves edits on page exit. Changing
tempo, arrangement, project, undo or redo stops transport. Pattern and scene
sound edits affect steps not already in the lookahead queue. Master changes
ramp over 15 ms. The latest live take has a playback/download URL until replaced
or the page is discarded; project backups do not include it.

## Validation and remaining checks

`test/studio.test.mjs` covers musical data, independent copies, corruption and
quota, cross-tab conflicts/deletion, exact timing and scene launch boundaries,
rest/slide behavior, switch pairs, hat choking, source cleanup, PCM samples,
offline/live event parity and recording-stream identity/error cleanup.

These are dependency-free Node tests with an audio graph stub. They do not
measure browser DSP, sound quality or codec support. Browser/listening QA has
not been performed. The optional Playwright boot list includes the studio and
is skipped when Playwright is absent. Before release, audition scene transitions
and exports, listen back to a take, and check keyboard/mobile use in target
browsers. Serve the repository on one origin so project/course storage is shared.
