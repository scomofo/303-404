from pathlib import Path
import re

path = Path('Hybrid Live Set.dc.html')
s = path.read_text()

old_content = re.search(r'''      <sc-if value="\{\{ isContent \}\}" hint-placeholder-val="\{\{ false \}\}">[\s\S]*?      </sc-if>\n\n      <sc-if value="\{\{ isComplete \}\}"''', s)
if not old_content:
    raise SystemExit('content block marker not found')
new_content = '''      <sc-if value="{{ isContent }}" hint-placeholder-val="{{ false }}">
        <div class="card elev-sm" style="padding:var(--space-6);display:flex;flex-direction:column;gap:var(--space-6);">
          <div><span class="tag tag-neutral">{{ currentStep.weekTag }}</span><h2 style="margin:10px 0 0;">{{ currentStep.title }}</h2></div>
          <div style="display:flex;flex-direction:column;gap:12px;"><sc-for list="{{ currentStep.items }}" as="item" hint-placeholder-count="3"><div style="display:flex;flex-direction:column;gap:4px;"><label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;"><input type="checkbox" checked="{{ item.checked }}" onchange="{{ item.toggle }}" style="margin-top:4px;width:18px;height:18px;accent-color:var(--color-accent);flex:none;" /><span style="{{ item.textStyle }}font-size:14.5px;line-height:1.5;">{{ item.text }}</span></label><sc-if value="{{ item.hasSub }}" hint-placeholder-val="{{ false }}"><ul style="margin:0 0 0 30px;padding-left:18px;font-size:13.5px;opacity:.8;display:flex;flex-direction:column;gap:3px;"><sc-for list="{{ item.subitems }}" as="sub" hint-placeholder-count="3"><li>{{ sub }}</li></sc-for></ul></sc-if></div></sc-for></div>

          <sc-if value="{{ currentStep.showLayerMutes }}" hint-placeholder-val="{{ false }}">
            <div style="display:flex;flex-direction:column;gap:10px;">
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;opacity:.55;">Layer mutes — practice dropping and bringing elements back in</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <sc-for list="{{ layerMutes }}" as="layer" hint-placeholder-count="3">
                  <button type="button" onclick="{{ layer.toggle }}" aria-pressed="{{ layer.pressed }}" style="padding:10px 16px;border-radius:var(--radius-md);border:1px solid var(--color-divider);cursor:pointer;font:inherit;font-size:13px;font-weight:600;background:{{ layer.bg }};color:{{ layer.color }};">{{ layer.label }}</button>
                </sc-for>
              </div>
              <p style="font-size:12.5px;opacity:.7;margin:0;">These mutes are visual practice aids. On real hardware you will mute with channel faders or the TD-3/RD-6 volume controls.</p>
            </div>
          </sc-if>

          <sc-if value="{{ currentStep.showPerfmap }}" hint-placeholder-val="{{ false }}">
            <div style="display:flex;flex-direction:column;gap:14px;">
              <span class="tag tag-accent-2" style="align-self:flex-start;">Hybrid performance map — click any section</span>
              <div style="display:flex;border-radius:var(--radius-md);overflow:hidden;height:48px;" role="group" aria-label="Hybrid performance sections">
                <sc-for list="{{ perfSections }}" as="sec" hint-placeholder-count="5"><button type="button" onclick="{{ sec.select }}" style="{{ sec.barStyle }}" aria-pressed="{{ sec.pressed }}">{{ sec.title }}</button></sc-for>
              </div>
              <div class="card" style="background:var(--color-accent-100);padding:var(--space-4);">
                <div style="font-family:var(--font-heading);font-size:16px;margin-bottom:6px;">{{ selectedSection.title }} · {{ selectedSection.time }}</div>
                <p style="margin:0 0 10px;font-size:13.5px;opacity:.85;">{{ selectedSection.desc }}</p>
                <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;"><div><strong>RD-6:</strong> {{ selectedSection.rd6 }}</div><div><strong>TD-3:</strong> {{ selectedSection.td3 }}</div><div><strong>FLX4:</strong> {{ selectedSection.flx4 }}</div></div>
              </div>
            </div>
          </sc-if>
        </div>
      </sc-if>

      <sc-if value="{{ isComplete }}"'''
s = s[:old_content.start()] + new_content + s[old_content.end():]

s = s.replace("initialState() { return { step:0, dialogOpen:false, checks:{} }; }", "initialState() { return { step:0, dialogOpen:false, checks:{}, muteRd6:false, muteTd3:false, muteFlx4:false, perfmapSel:0 }; }")

perf = '''  PERF_SECTIONS = [
    { title:'Intro', time:'0:00–1:30', dur:90, desc:'Set the mood. Keep energy low so the first hardware entry feels like an event.', rd6:'Kick + closed hats only, low volume', td3:'Filter fully closed, waiting', flx4:'Atmosphere / soft pad or distant vocal' },
    { title:'Hardware In', time:'1:30–4:00', dur:150, desc:'Bring the full groove online. This is the core identity of the set.', rd6:'Full pattern (or Pattern 1 → fill chain)', td3:'Bassline enters, Cutoff slowly opens from 9 → 12 o’clock', flx4:'Optional light percussion or nothing — let the hardware speak' },
    { title:'Breakdown', time:'4:00–5:30', dur:90, desc:'Strip back to create tension before the main drop.', rd6:'Mute or drop to hats only', td3:'Keep the line running, push Resonance, experiment with Soft Attack', flx4:'Pad, vocal phrase, or filtered track' },
    { title:'Drop', time:'5:30–8:30', dur:180, desc:'Maximum impact. Coordinate the TD-3 filter snap with the FLX4 action.', rd6:'Full pattern back in on the downbeat', td3:'Filter snap open + Overdrive MED/HIGH for the first 16–32 bars', flx4:'Main track or complementary groove, Beat FX on the transition' },
    { title:'Outro', time:'8:30–end', dur:120, desc:'Wind down cleanly so the next DJ (or the silence) feels intentional.', rd6:'Strip back to kick + hats, then stop on a downbeat', td3:'Close Cutoff gradually, then mute', flx4:'Fade remaining track or leave a tail of atmosphere' },
  ];'''
s = re.sub(r'''  PERF_SECTIONS = \[[\s\S]*?\n  \];''', perf, s, count=1)

s = s.replace("{ id:'w2-2', kind:'content', weekTag:W(2), title:'2. Phrase Practice', items:", "{ id:'w2-2', kind:'content', weekTag:W(2), title:'2. Phrase Practice', showLayerMutes:true, items:")

old_w4 = re.search(r'''      \{ id:'w4-1', kind:'content', weekTag:W\(4\), title:'1\. Performance Map', widget:'perfmap',[\s\S]*? \},\n      \{ id:'w5-intro' ''', s)
if not old_w4:
    raise SystemExit('w4 performance map step not found')
new_w4 = """      { id:'w4-1', kind:'content', weekTag:W(4), title:'1. Performance Map', widget:'perfmap', showLayerMutes:true, items:[{ text:'Walk through each section of the map below. Click a segment to see the exact role of RD-6, TD-3 and FLX4.' },{ text:'Use the layer-mute buttons to practice dropping and restoring elements while you imagine (or play) the arrangement.' },{ text:'When you are comfortable, run the whole 10–12 minute structure with real hardware + controller.' }] },
      { id:'w5-intro' """
s = s[:old_w4.start()] + new_w4 + s[old_w4.end():]

marker = "  // ── nav groups ──"
insert = '''  toggleMute(key) { this.setState(st => ({ [key]: !st[key] })); }
  buildLayerMutes() {
    return [
      { key:'muteRd6', label:this.state.muteRd6 ? 'RD-6 Muted' : 'RD-6 Live', pressed:this.state.muteRd6 ? 'true' : 'false', bg:this.state.muteRd6 ? 'var(--color-neutral-300)' : 'var(--color-accent)', color:this.state.muteRd6 ? 'var(--color-text)' : 'var(--color-bg)', toggle:()=>this.toggleMute('muteRd6') },
      { key:'muteTd3', label:this.state.muteTd3 ? 'TD-3 Muted' : 'TD-3 Live', pressed:this.state.muteTd3 ? 'true' : 'false', bg:this.state.muteTd3 ? 'var(--color-neutral-300)' : 'var(--color-accent-2-600)', color:this.state.muteTd3 ? 'var(--color-text)' : 'var(--color-bg)', toggle:()=>this.toggleMute('muteTd3') },
      { key:'muteFlx4', label:this.state.muteFlx4 ? 'FLX4 Muted' : 'FLX4 Live', pressed:this.state.muteFlx4 ? 'true' : 'false', bg:this.state.muteFlx4 ? 'var(--color-neutral-300)' : 'var(--color-accent-700)', color:this.state.muteFlx4 ? 'var(--color-text)' : 'var(--color-bg)', toggle:()=>this.toggleMute('muteFlx4') },
    ];
  }
  buildPerfSections() {
    return this.PERF_SECTIONS.map((sec, i) => {
      const sel = this.state.perfmapSel === i;
      return { ...sec, select:()=>this.setState({ perfmapSel:i }), pressed:sel ? 'true' : 'false', barStyle:`flex:${sec.dur} 0 auto;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;padding:4px;cursor:pointer;background:${sel ? 'var(--color-accent)' : 'var(--color-accent-2-200)'};color:${sel ? 'var(--color-bg)' : 'var(--color-text)'};border:none;border-right:1px solid var(--color-bg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;` };
    });
  }

'''
if insert not in s:
    s = s.replace(marker, insert + marker, 1)

render_old = re.search(r'''  renderVals\(\) \{[\s\S]*?\n  \}\n\}''', s)
if not render_old:
    raise SystemExit('renderVals block not found')
render_new = '''  renderVals() {
    const step = this.STEPS[this.state.step];
    const items = this.buildItems(step);
    return {
      weekLabel:step.weekTag, stepNumber:this.state.step+1, totalSteps:this.STEPS.length,
      progressPct:Math.round((this.state.step)/(this.STEPS.length-1)*100),
      isOverview:step.kind==='overview', isWeekIntro:step.kind==='weekintro', isContent:step.kind==='content', isComplete:step.kind==='complete',
      currentStep:{ weekTag:step.weekTag, title:step.title, objective:step.objective, items, showPerfmap:step.widget==='perfmap', showLayerMutes:step.showLayerMutes===true || step.widget==='perfmap' },
      layerMutes:this.buildLayerMutes(),
      perfSections:step.widget==='perfmap' ? this.buildPerfSections() : [],
      selectedSection:step.widget==='perfmap' ? this.PERF_SECTIONS[this.state.perfmapSel] : null,
      navGroups:this.buildNavGroups(), dialogOpen:this.state.dialogOpen,
      openDialog:()=>this.openCourseMap(), closeDialog:()=>this.closeCourseMap(), dialogKeydown:e=>this.onCourseMapKeydown(e), stopProp:e=>e.stopPropagation(),
      goNext:()=>this.goNext(), goBack:()=>this.goBack(), isFirst:this.state.step===0, isLast:this.state.step===this.STEPS.length-1, restart:()=>this.restart(),
    };
  }
}'''
s = s[:render_old.start()] + render_new + s[render_old.end():]

path.write_text(s)

# Extend Hybrid tests for stateful widgets.
tp = Path('test/hybrid.test.mjs')
t = tp.read_text()
t = re.sub(r'''test\('performance map exposes both hardware and controller roles for every section',[\s\S]*?\n\}\);''', '''test('performance map exposes selectable RD-6, TD-3 and FLX4 roles for every section', () => {
  const { inst } = loadComponent(FILE);
  const idx = inst.STEPS.findIndex(s => s.widget === 'perfmap');
  const view = renderStep(inst, idx);
  assert.equal(view.currentStep.showPerfmap, true);
  assert.equal(view.currentStep.showLayerMutes, true);
  assert.equal(view.perfSections.length, 5);
  assert.equal(view.selectedSection.title, 'Intro');
  for (const section of view.perfSections) {
    assert.ok(section.title && section.time && section.desc);
    assert.ok(section.rd6 && section.td3 && section.flx4);
    assert.match(section.pressed, /^(true|false)$/);
  }
  view.perfSections[3].select();
  const selected = renderStep(inst, idx);
  assert.equal(selected.selectedSection.title, 'Drop');
  assert.equal(selected.perfSections[3].pressed, 'true');
});''', t, count=1)

t += '''\n\ntest('layer mutes toggle independently, appear in phrase practice, and reset', () => {
  const { inst } = loadComponent(FILE);
  const mapIdx = inst.STEPS.findIndex(s => s.widget === 'perfmap');
  let view = renderStep(inst, mapIdx);
  assert.deepEqual(view.layerMutes.map(x => x.pressed), ['false','false','false']);
  view.layerMutes[0].toggle();
  view = renderStep(inst, mapIdx);
  assert.equal(view.layerMutes[0].label, 'RD-6 Muted');
  assert.equal(view.layerMutes[0].pressed, 'true');
  assert.equal(view.layerMutes[1].pressed, 'false');
  view.layerMutes[2].toggle();
  assert.equal(inst.state.muteRd6, true);
  assert.equal(inst.state.muteTd3, false);
  assert.equal(inst.state.muteFlx4, true);

  const phraseIdx = inst.STEPS.findIndex(s => s.id === 'w2-2');
  assert.equal(renderStep(inst, phraseIdx).currentStep.showLayerMutes, true);

  inst.restart();
  assert.equal(inst.state.muteRd6, false);
  assert.equal(inst.state.muteTd3, false);
  assert.equal(inst.state.muteFlx4, false);
  assert.equal(inst.state.perfmapSel, 0);
});\n'''
tp.write_text(t)
