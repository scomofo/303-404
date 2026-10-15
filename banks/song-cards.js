// Song Bank — the TD-3 pattern cards behind Week 8 of the Behringer guide.
//
// This file is plain data, in the same globalThis.DC* shape as the app's
// other standalone files: the guide page loads it with an ordinary <script>
// tag and reads the cards as its SONG_CARDS. Groove Studio's copy is
// generated from these cards — after changing them, run
// `npm run studio:banks` and commit the output. The entries are plain
// JSON-shaped data, so this file is also the format a future in-app card
// editor will import and export.
//
// Provenance is part of the data. Every card names its source type, and
// whatever a source left blank or unstated stays blank or is labelled an
// estimate — never fill in a value the source did not give. The README's
// Song Bank section documents every field.
//
// ── Adding a card ───────────────────────────────────────────────────────
// Copy this template into the array, give it an id no other card uses, and
// fill in what your source actually says:
//
// {
//   id: 'my-first-card',
//   title: 'My First Card',
//   sourceType: 'practice',   // 'practice' (written for practice), 'chart'
//                             // (a fan-made pattern chart) or 'table' (a
//                             // written step table)
//   tag: 'Practice pattern',  // the short label printed beside the title
//   bpm: 120,
//   bpmConfirmed: true,       // leave this out if the tempo is a guess —
//                             // it is then printed as an estimate
//   notes: ['C2', 'C2', null, 'D#2'],  // one entry per step; null is a rest
//   accent: [0],              // step indices that play with an accent
//   slide: [],                // step indices that slide into the next note
// },

globalThis.DCSongCards = [
  // The three practice patterns aren't transcriptions of anything — their tempo is a
  // chosen setting, not a guess about a record, so it is shown plainly.
  { id:'practice-1', title:'Rolling Eighths', sourceType:'practice', tag:'Practice pattern', bpm:130, bpmConfirmed:true,
    notes:['C2','C2','C2','C2','C2','C2','D#2','C2','C2','C2','C2','C2','C2','C2','A#2','C2'],
    accent:[0,6,14], slide:[1,7,13] },
  { id:'practice-2', title:'Octave Jump', sourceType:'practice', tag:'Practice pattern', bpm:125, bpmConfirmed:true,
    notes:['C2','C3','C2','C2','C2','C3','C2','C2','C2','C3','C2','C2','C2','C3','C2','G2'],
    accent:[1,5,9,13], slide:[] },
  { id:'practice-3', title:'Offbeat Squelch', sourceType:'practice', tag:'Practice pattern', bpm:140, bpmConfirmed:true,
    notes:['C2','G2','C2','D2','C2','G2','C2','D#2','C2','G2','C2','D2','C2','G2','C2','F2'],
    accent:[3,7,11,15], slide:[0,4,8,12] },
  // Transcribed from a fan-made TD-3 tutorial card (Pattern I, Bank A). The card's "UP" row
  // marks an octave-up shift on those steps; its Accent/Slide row was left unmarked, so that
  // is loaded empty. The card printed no tempo — the BPM below is the recording's, not the
  // chart's, which is why it differs sharply from the genre-typical guess it replaced.
  { id:'on-the-run', title:'On the Run', artist:'Pink Floyd', sourceType:'chart', group:'I', pattern:1, bank:'A', tag:'Pattern I · Bank A · Square wave', bpm:165, bpmConfirmed:true, bpmDisplay:'~165 BPM', waveform:'square',
    notes:['E2','G2','A2','G2','D3','C3','D3','E3','E2','G2','A2','G2','D3','C3','D3','E3'],
    accent:[], slide:[] },

  // Six of the following cards retain accent/slide arrays imported from scanned
  // "ML-303 Pattern Chart" worksheets by merging the labelled row
  // with the worksheet's ●/○/— row. That lower row is now understood as note/tie/rest,
  // so those six arrays remain explicitly flagged for revalidation against the
  // original images; the scans are not stored here and must not be guessed from. The
  // Cut & Paste entries have their own corrective source notes below and are excluded
  // from this audit set. No BPM is printed on these cards; the tempos are the recordings'.
  { id:'fatboy-slim-everybody-needs-a-303', title:'Everybody Needs a 303', artist:'Fatboy Slim', sourceType:'chart', needsAccentSlideReview:true, tag:'Fatboy Slim · Fan chart transcription', bpm:138, bpmConfirmed:true, bpmDisplay:'138 BPM (original release)', waveform:'square',
    notes:['D2','D2','C#2','D2','G2','D2','D3','D2','C#3','D2','F3','D2','A2','C#3','D3','C#3'],
    accent:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], slide:[0] },
  { id:'josh-wink-higher-state', title:'Higher State of Consciousness', artist:'Josh Wink', sourceType:'chart', needsAccentSlideReview:true, tag:'Josh Wink · Fan chart transcription', bpm:126, bpmConfirmed:true,
    notes:['G2','G1','G2','G2','G2','G2','B2','G2','B2','G2','G2','B2','G2','G2','G2','B2'],
    accent:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], slide:[0,2,3,9,12,13] },
  { id:'josh-wink-are-you-there', title:'Are You There', artist:'Josh Wink', sourceType:'chart', needsAccentSlideReview:true, tag:'Josh Wink · Fan chart transcription · 10-step pattern', bpm:130, bpmConfirmed:true, bpmDisplay:'127–132 BPM',
    notes:['D#3','D3','C#3','D3','E3','E2','E2','D#3','C#2','D#3'],
    accent:[0,1,2,3,4,5,6,7,8,9], slide:[4,5,7,8] },
  { id:'christopher-just-disco-dancer-1', title:"I'm a Disco Dancer (Part 1/2)", artist:'Christopher Just', sourceType:'chart', needsAccentSlideReview:true, tag:'Christopher Just · Fan chart transcription', bpm:131, bpmConfirmed:true, bpmDisplay:'130–132 BPM',
    notes:['C2','C#3','C2','C2','E3','E2','E2','D#2','D#3','C#3','D#2','D#2','D#2','D#2','E2','C2'],
    accent:[], slide:[1,2,4,5,8,9] },
  { id:'christopher-just-disco-dancer-2', title:"I'm a Disco Dancer (Part 2/2)", artist:'Christopher Just', sourceType:'chart', needsAccentSlideReview:true, tag:'Christopher Just · Fan chart transcription', bpm:131, bpmConfirmed:true, bpmDisplay:'130–132 BPM',
    notes:['C#2','C#2','C2','C1','C#3','C2','F#3','C1','F#2','C2','C#2','C#2','C2','C2','C#2','C#2'],
    accent:[], slide:[] },
  { id:'prodigy-claustrophobic-sting', title:'Claustrophobic Sting', artist:'The Prodigy', sourceType:'chart', needsAccentSlideReview:true, tag:'The Prodigy · Fan chart transcription · 8-step pattern', bpm:150, bpmConfirmed:true,
    notes:['F2','F#2','F#2','F#2','F#3','C#2','F#3','F3'],
    accent:[1,2,3,4,5,6,7], slide:[0,1,4] },
  // Part 1/2 confirmed against a clearer digital card: BPM 120, and its combined
  // Accent/Slide row uses "S" (slide) only — no accents on this pattern.
  { id:'cut-paste-forget-it-1', title:'Forget It (Part 1/2)', artist:'Cut & Paste', sourceType:'chart', group:'I', pattern:1, bank:'A', tag:'Cut & Paste · Fan chart transcription', bpm:120, bpmConfirmed:true, waveform:'square',
    notes:['A#1','A#1','A#2','A#2','F1','F1','F2','F2','G#2','G#2','F2','G#2','G#2','F2','A#2','A#2'],
    accent:[], slide:[0,2,4,7,10,13] },
  // Part 2/2's own card image wasn't available — its SLIDE row wasn't confidently legible
  // in the original scan (column alignment unclear), so slide is left empty rather than
  // guessed. NOTE and DOWN (octave) are clear. BPM carried over from Part 1's 120, which the
  // recording confirms.
  { id:'cut-paste-forget-it-2', title:'Forget It (Part 2/2)', artist:'Cut & Paste', sourceType:'chart', tag:'Cut & Paste · Fan chart transcription · slide not legible in scan', bpm:120, bpmConfirmed:true,
    notes:['A#1','A#1','A#2','A#2','A#1','A#1','D2','D2','D#2','D#2','E2','E2','F2','F2','F2','F2'],
    accent:[], slide:[] },

  // Full step-by-step transcription (note + down/up + accent/slide per step) supplied
  // directly, replacing the earlier partial read of a small card photo. BPM is the
  // recording's; waveform keeps the square-wave read from that photo.
  { id:'daft-punk-da-funk', title:'Da Funk', artist:'Daft Punk', sourceType:'chart', tag:'Daft Punk · Fan chart transcription', bpm:111, bpmConfirmed:true, waveform:'square',
    notes:['G1','A#3','G2','F3','D#2','C#1','C#1','C#2','D#3','D#1','F3','G3','G#1','G1','C1','G2'],
    accent:[4,5,6,7,11], slide:[2,4,6,8,10,11,13,14,15] },

  // ── supplied step tables ──
  // The five cards below came as written-out step tables rather than chart photos, and
  // all mark their octaves relative to the TD-3's base rather than to the pattern's own
  // centre — hence the explicit homeOctave on each. Notes are entered as played on the
  // one-octave keyboard, so within a block B sits above E. Knob directions given as clock
  // positions map onto the 7-to-5 o'clock sweep (9 o'clock = 0.2, 11 = 0.4, 1 = 0.6,
  // 2 = 0.7, 3 = 0.8). Settings named but not modelled by this engine — filter tracking,
  // the sub-oscillator, the Muffler switch, slide time, envelope-mod depth — are left out
  // rather than approximated, and noted on each card's tag. None of the five came with a
  // source-confirmed tempo, so every BPM stays a flagged estimate.

  { id:'darude-sandstorm', title:'Sandstorm', artist:'Darude', sourceType:'table', tag:'Darude · Supplied step table · E minor trance lead · filter tracking and sub-osc not modelled',
    bpm:136, waveform:'sawtooth', homeOctave:2, overdrive:0.7,
    notes:['B3','B3','B3','B3','B3','B3','E3','F#3','G3','G3','G3','G3','G3','G3','D3','E3'],
    accent:[0,4,8,12], slide:[],
    filter:{ decay:0.15 } },

  { id:'techno-industrial-pulse', title:'Industrial Driving Pulse', artist:'Peak-time techno', sourceType:'table', tag:'Supplied step table · F# minor roller · sub-osc not modelled',
    bpm:132, waveform:'sawtooth', homeOctave:2, overdrive:0.7,
    notes:['F#2','F#2','F#3','F#3','F#2','G2','F#2','F#1','F#2','F#2','A2','F#3','F#2','F#2','G2','F#1'],
    accent:[0,5,8,13], slide:[2,3,10,14],
    filter:{ cutoff:0.2, resonance:0.6 } },

  // Rests are null entries: the step keeps its slot in the bar and sounds nothing.
  { id:'techno-acid-slicer', title:'Polyrhythmic Acid Slicer', artist:'Peak-time techno', sourceType:'table', tag:'Supplied step table · D minor, 4 rests · Muffler switch not modelled',
    bpm:130, waveform:'square', homeOctave:2,
    notes:['D2','D3',null,'D2','F2','D2',null,'C1','D2',null,'D3','G#2','F2','D2',null,'C2'],
    accent:[0,4,8,10,13], slide:[1,7,11],
    filter:{ decay:0.15, accent:1 } },

  // Steps 11-13 are two octave presses up, which the chart shows as U2.
  { id:'trance-euphoric-roller', title:'Euphoric Roller', artist:'90s hard trance', sourceType:'table', tag:'Supplied step table · A minor · filter tracking not modelled',
    bpm:145, waveform:'sawtooth', homeOctave:2, overdrive:0.4,
    notes:['A2','A2','C3','B3','E3','A2','G2','A2','A3','A3','C4','B4','E4','G3','F#3','E3'],
    accent:[0,4,8,12], slide:[2,6,10,13] },

  // A flat and B flat are written as their enharmonic sharps, which is what noteToFreq parses.
  { id:'trance-german-slammer', title:'German Hard Trance Slammer', artist:'90s hard trance', sourceType:'table', tag:'Supplied step table · F minor, 1 rest · slide time and env-mod depth not modelled',
    bpm:148, waveform:'sawtooth', homeOctave:2,
    notes:['F2','F3','G3','F2','G#3','G3','F2',null,'F2','F3','A#3','G#3','G3','F2','C3','G2'],
    accent:[0,4,8,12], slide:[1,5,9,11,14],
    filter:{ resonance:0.8, decay:0.15 } },

  // Full step-by-step transcription (pitch, octave transpose, accent, slide per step) plus
  // tuned filter settings supplied directly, replacing the earlier notes-only read of a
  // small card photo. filter is {cutoff, resonance, decay, accent}, each 0-1, approximating
  // the described knob percentages; envelope-mod depth isn't separately modeled by this
  // simplified engine. BPM is the recording's — markedly slower than the genre-typical guess
  // it replaced, so this card now plays at roughly three-quarters of its former speed.
  { id:'tame-impala-breathe-deeper', title:'Breathe Deeper', artist:'Tame Impala', sourceType:'chart', tag:'Tame Impala · Fan chart transcription · tuned filter', bpm:105, bpmConfirmed:true, waveform:'sawtooth',
    notes:['A2','E2','F#2','E1','D2','A2','G2','A2','A2','E2','F#2','E1','D2','A2','G2','A2'],
    accent:[4,12], slide:[1,3,5,7,9,11,13,15],
    filter:{ cutoff:0.45, resonance:0.85, decay:0.5, accent:0.7 } },

  // ── additional practice patterns ──
  { id:'practice-4', title:'Long Slide Cascade', sourceType:'practice', tag:'Practice pattern · continuous glide focus', bpm:128, bpmConfirmed:true,
    notes:['C2','D#2','G2','C3','D#3','G2','C2','D#2','G2','C3','A#2','G2','F2','D#2','C2','G1'],
    accent:[0,4,8,12], slide:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14] },

  { id:'practice-5', title:'Sparse Rest Acid', sourceType:'practice', tag:'Practice pattern · rests + sparse accents', bpm:135, bpmConfirmed:true, homeOctave:2,
    notes:['C2',null,'C2',null,'D#2',null,'C2','G2',null,'C2',null,'A#2',null,'C2','D2',null],
    accent:[0,4,7,11], slide:[2,6,14] },

  { id:'practice-6', title:'Dense Accent Roller', sourceType:'practice', tag:'Practice pattern · high accent density', bpm:130, bpmConfirmed:true, waveform:'sawtooth',
    notes:['C2','C2','C3','C2','D#2','C2','C2','G2','C2','C2','A#2','C2','C2','D2','D#2','F2'],
    accent:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], slide:[3,7,11,15] },

  { id:'practice-7', title:'Octave Cascade', sourceType:'practice', tag:'Practice pattern · rapid octave shifts', bpm:140, bpmConfirmed:true,
    notes:['C1','C2','C3','C2','D#1','D#2','D#3','D#2','G1','G2','G3','G2','A#1','A#2','A#3','A#2'],
    accent:[0,3,6,9,12,15], slide:[1,4,7,10,13] },

  { id:'practice-8', title:'Offbeat Slide Machine', sourceType:'practice', tag:'Practice pattern · slides only on offbeats', bpm:132, bpmConfirmed:true,
    notes:['C2','G2','C2','D#2','C2','G2','C2','F2','C2','G2','C2','D#2','C2','G2','C2','A#2'],
    accent:[0,4,8,12], slide:[1,3,5,7,9,11,13,15] },

  // ── additional supplied tables ──
  { id:'techno-rolling-sub', title:'Rolling Sub Pulse', artist:'Peak-time techno', sourceType:'table',
    tag:'Supplied step table · C minor roller · sub-osc and filter tracking not modelled',
    bpm:132, waveform:'sawtooth', homeOctave:1, overdrive:0.5,
    notes:['C1','C1','C2','C1','D#1','C1','C2','G1','C1','C1','A#1','C2','C1','C1','D#1','C1'],
    accent:[0,4,8,12], slide:[2,6,10,14],
    filter:{ cutoff:0.15, resonance:0.7, decay:0.25 } },

  { id:'trance-euphoric-lead', title:'Euphoric Lead Lift', artist:'90s hard trance', sourceType:'table',
    tag:'Supplied step table · A minor · filter tracking not modelled',
    bpm:142, waveform:'sawtooth', homeOctave:2, overdrive:0.35,
    notes:['A2','A2','C3','B3','E3','A2','G2','A2','A3','A3','C4','B3','E3','G3','F#3','E3'],
    accent:[0,4,8,12], slide:[2,6,10,14],
    filter:{ cutoff:0.55, resonance:0.65, decay:0.2 } },

  { id:'acid-liquid-line', title:'Liquid Line', artist:'Classic acid', sourceType:'table',
    tag:'Supplied step table · G minor · long decay, soft character',
    bpm:125, waveform:'sawtooth', homeOctave:2, overdrive:0.2,
    notes:['G2','A#2','D3','G2','F2','D3','A#2','G2','G2','A#2','D3','C3','A#2','G2','F2','D2'],
    accent:[0,3,6,10,13], slide:[1,4,7,8,11,14],
    filter:{ cutoff:0.35, resonance:0.8, decay:0.55, accent:0.6 } },

  { id:'practice-9', title:'Syncopated Skip', sourceType:'practice', tag:'Practice pattern · syncopated rests', bpm:138, bpmConfirmed:true, homeOctave:2,
    notes:['C2','C2',null,'D#2','C2',null,'G2','C2','C2',null,'A#2','C2',null,'D2','C2',null],
    accent:[0,3,6,10,13], slide:[] },

  // Every consecutive interval is exactly three semitones — the pattern climbs the
  // diminished ladder (C, D#, F#, A, C, D#) two steps up, one step back.
  { id:'practice-10', title:'Minor Third Zigzag', sourceType:'practice', tag:'Practice pattern · minor third zigzag up the diminished ladder', bpm:133, bpmConfirmed:true,
    notes:['C2','D#2','C2','D#2','F#2','D#2','F#2','A2','F#2','A2','C3','A2','C3','D#3','C3','A2'],
    accent:[0,4,8,12], slide:[1,3,5,7,9,11,13,15] },

  { id:'trance-rolling-arp', title:'Rolling Arp Sequence', artist:'Uplifting trance', sourceType:'table',
    tag:'Supplied step table · C major rolling arpeggio · filter tracking not modelled',
    bpm:138, waveform:'sawtooth', homeOctave:2, overdrive:0.3,
    notes:['C2','E2','G2','C3','C2','E2','G2','C3','C2','E2','G2','B2','C2','E2','G2','A2'],
    accent:[0,4,8,12], slide:[],
    filter:{ cutoff:0.5, resonance:0.5, decay:0.3 } },

  { id:'techno-hypnotic-loop', title:'Hypnotic Minimal Loop', artist:'Minimal techno', sourceType:'table',
    tag:'Supplied step table · A minor sparse loop · sub-osc not modelled',
    bpm:128, waveform:'square', homeOctave:2,
    notes:['A2','A2','A2','A2','A2','A2','C3','A2','A2','A2','A2','A2','A2','A2','G2','A2'],
    accent:[0,6,12], slide:[],
    filter:{ decay:0.6, resonance:0.3 } },
];
