# Groove Studio browser QA — 2026-09-05

## Defect fixed

Real Chrome playback initially failed with `Illegal invocation`. The transport
stored native window timer functions and called them with the transport as the
receiver. Default timer/cancellation wrappers now invoke the APIs on their
owning global object. A regression test checks both receivers.

## Verified in Chrome

- Practice-home navigation opens the studio with all instrument controls.
- Space toggles a drum step; Undo restores it and visible keyboard focus remains.
- Scene playback starts and its playhead advances. Selecting Return queues and
  launches scene D. Live mutes respond without stopping the transport.
- The full 32-bar arrangement plays through and stops automatically after its release tails.
- The live recorder captures output and produces a downloadable WebM/Opus take.
  The downloaded take decoded to stereo 48 kHz PCM: 8.16 seconds, mean level
  -25.7 dBFS and maximum -9.8 dBFS. This was real browser output, not a stub buffer.
- Arrangement export produces a downloaded stereo 16-bit PCM WAV at 44.1 kHz.
  The 32-bar test project rendered 60 seconds of music plus 1.1 seconds of tails.
  Measured peak: 0.39667; RMS: 0.04519. No clipped samples; the final-second peak
  was 0.000244. The test project included a muted bass lane in scene D.
- Project JSON downloads and a typed project name survives a reload.
- The desktop workspace and 390 px / 320 px iframe layouts were visually reviewed.
  Their content widths were 375 / 305 px after scrollbars, with matching scroll
  widths (no horizontal overflow). Drum targets were 73.5×48 / 56×48 px.

## Repeating the preview

`npm ci` installs the pinned development-only Vite dependency. `npm run dev`
serves the existing static pages with auto-refresh. The responsive fixture is
`test/manual-viewport.html`. Production does not depend on Vite or a build step.

## Limits

This is Chrome browser interaction, responsive-layout and decoded audio-data
validation. It is not a claim of human listening, physical touch-device testing,
Safari/Firefox codec coverage or exhaustive accessibility certification. The
optional Playwright boot test remains skipped unless Playwright is installed.
The browser automation download-event waiter timed out for the take, but the
file was actually downloaded and independently decoded successfully.
