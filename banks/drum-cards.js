// Drum Bank — the 808 voice table and rhythm pattern cards behind Week 9
// of the Behringer guide.
//
// The same arrangement as the Song Bank (banks/song-cards.js): plain data
// in the app's globalThis.DC* shape, loaded by the guide page with an
// ordinary <script> tag and read as its DRUM_VOICES and DRUM_CARDS.
// Groove Studio's copy is generated from these — after changing them, run
// `npm run studio:banks` and commit the output. The entries are plain
// JSON-shaped data, so this file is also the format a future in-app card
// editor will import and export.
//
// The voices come first because the cards' rows are keyed by them: a card
// may only use the twelve keys below. Provenance is part of the data —
// outside sources that never recorded accents, pattern numbers or tempos
// do not gain invented ones here. The README's Drum Bank section documents
// every field.
//
// ── Adding a card ───────────────────────────────────────────────────────
// Copy this template into DCDrumCards, give it an id no other card uses,
// and fill in what your source actually says:
//
// {
//   id: 'my-first-card',
//   title: 'My First Card',
//   sourceType: 'practice',   // 'record' (transcribed from a recording),
//                             // 'literature' (a genre template from
//                             // production literature) or 'practice'
//   tag: 'What this pattern teaches, in one line.',
//   source: 'Where the steps came from.',
//   voicing: 'Written on the RD-6 voices, charted here on the 808 rows.',
//   steps: 16,                // pattern sheets come in 16 or 32 steps
//   bpm: 120,
//   bpmConfirmed: true,       // leave this out if the tempo is a guess —
//                             // it then prints as an estimate
//   rows: { bd: [0, 4, 8, 12], sd: [4, 12], ch: [0, 2, 4, 6, 8, 10, 12, 14] },
// },
//
// Cards from outside sources (sourceType 'record' or 'literature') must
// not set an `ac` row, `patternNo`, `variation` or `preScale` unless
// their source states them — the test suite enforces this.

// ── drum bank ──
// A TR-808 pattern sheet has one row per voice, and those rows are what every
// drum-machine chart in the wild is drawn on — so the bank charts each pattern on
// the 808's own row set rather than on the RD-6's four. AC leads, as it does on the
// panel. Two rows are switch pairs on the hardware: RS shares its slot with CL
// (claves) and CP shares its with MA (maracas), so a card names which side of each
// pair it means and the row prints and sounds that one.
globalThis.DCDrumVoices = [
  { key:'ac', label:'AC', name:'Accent' },
  { key:'bd', label:'BD', name:'Bass drum' },
  { key:'sd', label:'SD', name:'Snare drum' },
  { key:'lt', label:'LT', name:'Low tom' },
  { key:'mt', label:'MT', name:'Mid tom' },
  { key:'ht', label:'HT', name:'Hi tom' },
  { key:'rs', label:'RS', name:'Rim shot', alt:'CL', altName:'Claves' },
  { key:'cp', label:'CP', name:'Hand clap', alt:'MA', altName:'Maracas' },
  { key:'cb', label:'CB', name:'Cow bell' },
  { key:'cy', label:'CY', name:'Cymbal' },
  { key:'oh', label:'OH', name:'Open hi-hat' },
  { key:'ch', label:'CH', name:'Closed hi-hat' },
];

// Every row array below was generated from its cited source rather than typed out by
// hand, and nothing a source left unrecorded is filled in: no source here writes an
// accent row, so AC is empty on all but the pattern this course wrote itself, and no
// source names a pattern number, variation or pre-scale, so those boxes print blank.
globalThis.DCDrumCards = [
  // The Week 1 lesson pattern. Its tempo and slot are chosen settings of this course,
  // not a claim about a record, so they are shown plainly.
  { id:'four-on-the-floor', title:'Four on the Floor', artist:'This course', sourceType:'practice',
    steps:16, bpm:120, bpmConfirmed:true, patternNo:'1', variation:'A',
    voicing:'Written on the RD-6 voices, charted here on the 808 rows.',
    tag:'The Week 1 pattern — kick on every beat, snare on 2 and 4, hats on the offbeats, accents on the downbeats.',
    source:'Written for this guide (Week 1).',
    rows:{ ac:[0,4,8,12], bd:[0,4,8,12], sd:[4,12], oh:[15], ch:[2,6,10,14] } },

  // Three transcriptions of 808 records, read out of the tr808r package (MIT) rather
  // than re-typed: its demo songs hold each song as a chain of 16-step patterns on the
  // 808's eleven voices. Each card carries the first two patterns of that chain — one
  // 32-step sheet, which is the longer of the two sheet sizes the 808 was printed for.
  { id:'sexual-healing', title:'Sexual Healing', artist:'Marvin Gaye', sourceType:'record',
    steps:32, bpm:94, bpmConfirmed:true,
    voicing:'Transcribed on the TR-808 itself.',
    tag:'Patterns 1-2 of a 2-pattern chain — the whole loop. Syncopated kick, rimshot on the up-beats, one clap a bar.',
    source:'tr808r (MIT) demo song "Marvin Gaye - Sexual Healing"; tempo as stated there.',
    rows:{ bd:[0,7,8,10,12,15,16,24,31], sd:[10,11,22,23,25,27,29], lt:[28,30], mt:[22], ht:[2,18],
      rs:[0,3,6,16,19,22,26,29], cp:[4,20], oh:[6,18,22,26,29],
      ch:[0,2,3,4,6,8,10,12,14,15,16,18,20,22,24,25,26,28,30,31] } },
  { id:'beat-it-intro', title:'Beat It (intro)', artist:'Michael Jackson', sourceType:'record',
    steps:32, bpm:139, bpmConfirmed:true,
    voicing:'Transcribed on the TR-808 itself.',
    tag:'Patterns 1-2 of a 4-pattern chain; the source chains two more kick variations after these.',
    source:'tr808r (MIT) demo song "Michael Jackson - Beat It Intro"; tempo as stated there.',
    rows:{ bd:[0,8,16,24], sd:[4,12,20,28], cp:[18,22,24,30],
      ch:[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30] } },
  { id:'confusion', title:'Confusion', artist:'New Order', sourceType:'record',
    steps:32, bpm:119, bpmConfirmed:true,
    voicing:'Transcribed on the TR-808 itself.',
    tag:'Patterns 1-2 of a 6-pattern chain; the source chains four sparser variations after these. Cowbell and clap carry the groove.',
    source:'tr808r (MIT) demo song "New Order - Confusion"; tempo as stated there.',
    rows:{ bd:[0,1,6,7,10,16,17,22,23,26], sd:[4,12,20,28,30,31], mt:[0,1,16,17,25],
      ht:[6,7,10,13,22,23,26,27,29], cp:[0,1,3,4,6,7,15,16,17,19,20,22,23,24,26,28],
      cb:[0,1,4,6,7,9,11,13,14,16,17,20,22,23,25,26,27,28],
      ch:[0,2,3,4,6,7,8,10,11,12,14,15,16,18,19,20,22,23,24,26,27,28,30,31] } },

  // Breaks and genre templates from the GiantSteps drum-pattern-datasets collection,
  // whose entries are written in General MIDI drum notes rather than for any one
  // machine; the mapping onto 808 rows is this guide's. None of these entries carries
  // a tempo, so every one of them plays at an openly estimated one.
  { id:'funky-drummer', title:'Funky Drummer', artist:'James Brown', sourceType:'record',
    steps:32, bpm:93,
    voicing:'General MIDI drum map, voiced on the 808 rows.',
    tag:'The break, ghost notes and all. Tempo is an estimate — the source entry carries none.',
    source:'GiantSteps drum-pattern-datasets, entry breakfunkydrummer_EH.',
    rows:{ bd:[0,2,6,10,13,16,18,22,26,29], sd:[4,7,9,11,12,15,20,23,25,27,28,31],
      oh:[7,13,23,29],
      ch:[0,1,2,3,4,5,6,8,9,10,11,12,14,15,16,17,18,19,20,21,22,24,25,26,27,28,30,31] } },
  { id:'impeach-the-president', title:'Impeach the President', artist:'The Honey Drippers', sourceType:'record',
    steps:32, bpm:89,
    voicing:'General MIDI drum map, voiced on the 808 rows.',
    tag:'The other most-sampled break. Tempo is an estimate — the source entry carries none.',
    source:'GiantSteps drum-pattern-datasets, entry breakimpeach_EH.',
    rows:{ bd:[0,7,8,14,16,23,24,30], sd:[4,12,20,28], oh:[10,26],
      ch:[0,2,4,6,7,8,12,14,16,18,20,22,23,24,28,30] } },
  { id:'when-the-levee-breaks', title:'When the Levee Breaks', artist:'Led Zeppelin', sourceType:'record',
    steps:32, bpm:71,
    voicing:'General MIDI drum map, voiced on the 808 rows.',
    tag:'Slow, heavy, two kicks into the bar. Tempo is an estimate — the source entry carries none.',
    source:'GiantSteps drum-pattern-datasets, entry breakwhenthelevee_EH.',
    rows:{ bd:[0,1,7,10,11,16,17,23,26,27], sd:[4,12,20,28],
      ch:[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30] } },
  { id:'electro-standard', title:'Electro (standard)', sourceType:'literature',
    steps:32, bpm:120,
    voicing:'General MIDI drum map, voiced on the 808 rows.',
    tag:'The textbook electro beat — the genre the 808 built. Tempo is an estimate — the source entry carries none.',
    source:'GiantSteps drum-pattern-datasets, entry breakelectro(standard)_DMR.',
    rows:{ bd:[0,6,16,22,26,29], sd:[4,12,20,28],
      ch:[0,2,4,6,7,8,9,10,12,14,16,18,20,22,23,24,25,26,28,30] } },
  { id:'house', title:'House', sourceType:'literature',
    steps:16, bpm:125,
    voicing:'General MIDI drum map, voiced on the 808 rows.',
    tag:'Four on the floor, sixteenths on the closed hat, open hat pushed off the beat. Tempo is an estimate — the source entry carries none.',
    source:'GiantSteps drum-pattern-datasets, entry house_SA.',
    rows:{ bd:[0,4,8,12], sd:[4,12], lt:[2,10], oh:[2,5,10,13],
      ch:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15] } },
  { id:'classic-house', title:'Classic House', sourceType:'literature',
    steps:16, bpm:124,
    voicing:'General MIDI drum map, voiced on the 808 rows.',
    tag:'Clap on 2 and 4 instead of a snare, open hat on every off-beat. Tempo is an estimate — the source entry carries none.',
    source:'GiantSteps drum-pattern-datasets, entry classichouse_CCM.',
    rows:{ bd:[0,4,8,12], lt:[7,10,14], cp:[4,12], oh:[2,6,10,14],
      ch:[0,1,2,5,6,7,8,9,10,13,14,15] } },
  // The source entry's shaker line is General MIDI maracas, which on an 808 is the
  // other half of the clap switch — so it prints and sounds as MA on the CP row.
  { id:'minimal-techno', title:'Minimal Techno', sourceType:'literature',
    steps:32, bpm:128, pair:{ cp:'MA' },
    voicing:'General MIDI drum map, voiced on the 808 rows.',
    tag:'Open hat locked to the kick, toms answering, maracas on every step. Tempo is an estimate — the source entry carries none.',
    source:'GiantSteps drum-pattern-datasets, entry technominimal_CCM.',
    rows:{ bd:[0,4,8,12,16,20,24,28], lt:[3,11,19,27], mt:[6,14,22,30],
      cp:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31],
      cy:[0,3,5,7,10,14,16,19,21,23,26,30], oh:[0,4,8,12,16,20,24,28],
      ch:[1,2,3,5,6,7,9,10,11,13,14,15,17,18,19,21,22,23,25,26,27,29,30,31] } },
];
