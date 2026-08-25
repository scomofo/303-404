from pathlib import Path

path = Path('Behringer Setup Guide.dc.html')
s = path.read_text()
s = s.replace('Duration: 9 Weeks (2 Hours / Week)', 'Duration: 10 Weeks (2 Hours / Week)')

cards = '''
    // ── additional practice patterns ──
    { id:'practice-4', title:'Long Slide Cascade', sourceType:'practice', tag:'Practice pattern · continuous glide focus', bpm:128, bpmConfirmed:true,
      notes:['C2','D#2','G2','C3','D#3','G2','C2','D#2','G2','C3','A#2','G2','F2','D#2','C2','G1'],
      accent:[0,4,8,12], slide:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14] },

    { id:'practice-5', title:'Sparse Rest Acid', sourceType:'practice', tag:'Practice pattern · rests + sparse accents', bpm:135, bpmConfirmed:true,
      notes:['C2',null,'C2',null,'D#2',null,'C2','G2',null,'C2',null,'A#2',null,'C2','D2',null],
      accent:[0,4,7,11], slide:[2,6,10] },

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
'''
marker = "  ];\n\n\n  // ── drum bank ──"
if "id:'practice-8'" not in s:
    assert marker in s, 'SONG_CARDS insertion marker not found'
    s = s.replace(marker, cards + "  ];\n\n\n  // ── drum bank ──", 1)

week10 = '''      { id:'w10-intro', kind:'weekintro', weekTag:W(10), navLabel:'Week Overview',
        title:'Week 10: Advanced Tone Shaping & Live Modulation',
        objective:"Move beyond static settings. Learn how Filter FM, Overdrive, Accent density, Soft Attack and real-time knob moves interact, and practice morphing a bassline live." },
      { id:'w10-1', kind:'content', weekTag:W(10), title:'1. Interaction Recipes',
        items:[
          { text:"Filter FM + Overdrive: Start with FM Depth at 12 o'clock and Overdrive at MED. The metallic edge of FM becomes aggressive when overdriven — use this for lead sections." },
          { text:"Accent density vs Decay: High accent density + short Decay = tight, percussive acid. Low accent density + long Decay = evolving, liquid lines." },
          { text:"Soft Attack + Slide: Soft Attack rounds the initial pluck; combined with slides it creates a more vocal, less aggressive character." },
        ],
        knobs:[ { label:'Filter FM Depth', hour:12 }, { label:'Overdrive', hour:2 } ],
        switches:[ { label:'Soft Attack', value:'ON' } ] },
      { id:'w10-2', kind:'content', weekTag:W(10), title:'2. Live Morph Practice', widget:'td3fx',
        items:[
          { text:"Load any Song Bank card (or the Week 2 bassline) and hit Play Bassline." },
          { text:"While it plays, slowly open Cutoff from 9 o'clock toward 1 o'clock over 8 bars, then snap it closed on a downbeat." },
          { text:"Raise Resonance only on accented steps (use the Accent knob or your ears)." },
          { text:"Toggle Soft Attack mid-phrase and notice how the attack changes the perceived tempo feel." },
        ] },
      { id:'w10-3', kind:'content', weekTag:W(10), title:'3. Recipe Cards — A/B Comparison',
        items:[
          { text:"Classic Squelch: Cutoff 10 o'clock, Resonance 2–3, Env Mod 2, Decay 11, Accent 2–3, Overdrive OFF, Soft Attack OFF." },
          { text:"Distorted Lead: Cutoff 12–1, Resonance 1–2, Env Mod 1, Decay 10, Accent 3, Overdrive MED–HIGH, Soft Attack OFF." },
          { text:"Liquid Sub: Cutoff 8–9, Resonance 3+, Env Mod 1–2, Decay 1–2 o'clock, Accent 1–2, Overdrive LOW, Soft Attack ON, Sub-Osc LOW." },
        ] },

'''
complete = "      { id:'complete', kind:'complete', weekTag:'Complete', navLabel:'Complete', title:\"You're ready to play.\" },"
if "id:'w10-intro'" not in s:
    assert complete in s, 'complete step marker not found'
    s = s.replace(complete, week10 + complete, 1)
path.write_text(s)

r = Path('README.md')
readme = r.read_text()
readme = readme.replace('over **nine weeks**. A progress bar covers **33 steps**', 'over **ten weeks**. A progress bar covers **37 steps**')
readme = readme.replace('| 9 | Drum Bank — rhythm pattern sheets |', '| 9 | Drum Bank — rhythm pattern sheets |\n| 10 | Advanced tone shaping and live modulation |')
readme = readme.replace('contains **19 cards ship by default**', 'contains **27 cards ship by default**')
r.write_text(readme)
