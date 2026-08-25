from pathlib import Path
p = Path('tools/integrate_expanded_songbank.py')
s = p.read_text()
s = s.replace("{ id:'practice-5', title:'Sparse Rest Acid', sourceType:'practice', tag:'Practice pattern · rests + sparse accents', bpm:135, bpmConfirmed:true,", "{ id:'practice-5', title:'Sparse Rest Acid', sourceType:'practice', tag:'Practice pattern · rests + sparse accents', bpm:135, bpmConfirmed:true, homeOctave:2,")
s = s.replace("accent:[0,4,7,11], slide:[2,6,10] },", "accent:[0,4,7,11], slide:[2,6,14] },")
s += "\n# Keep provenance-count regression expectations aligned with the intentional bank expansion.\nt = Path('test/songbank.test.mjs')\ntxt = t.read_text()\ntxt = txt.replace(\"assert.deepEqual(counts, { practice: 3, chart: 11, table: 5 });\", \"assert.deepEqual(counts, { practice: 8, chart: 11, table: 8 });\")\nt.write_text(txt)\n"
p.write_text(s)
