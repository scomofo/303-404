import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readGuide } from './harness.mjs';

// A small DOM double executes the shared UI against the actual HTML shells.
// These tests cover events and persistence, not browser layout or audio playback.
class Element {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase(); this.doc = doc; this.children = [];
    this.dataset = {}; this.attributes = {}; this.listeners = new Map();
    this.textContent = ''; this.hidden = false; this.disabled = false; this.value = '';
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
    if (name === 'class') this.className = value;
    if (name === 'id') this.id = value;
    if (name === 'href') this.href = value;
    if (name === 'type') this.type = value;
    if (name === 'hidden' || name === 'disabled') this[name] = true;
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
  matches(selector) {
    if (selector[0] === '.') return (this.className || '').split(' ').includes(selector.slice(1));
    if (selector[0] === '#') return this.id === selector.slice(1);
    if (selector[0] === '[') return Object.hasOwn(this.attributes, selector.slice(1, -1));
    return this.tagName.toLowerCase() === selector;
  }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(name, fn) { this.listeners.set(name, [...(this.listeners.get(name) || []), fn]); }
  fire(name) { for (const fn of this.listeners.get(name) || []) fn({ target: this, preventDefault() {} }); }
  focus() { this.doc.activeElement = this; }
}
function dom(html) {
  const doc = {};
  doc.root = new Element('document', doc);
  doc.createElement = tag => new Element(tag, doc);
  doc.querySelector = selector => doc.root.querySelector(selector);
  doc.querySelectorAll = selector => doc.root.querySelectorAll(selector);
  doc.getElementById = id => doc.querySelector('#' + id);
  const stack = [doc.root];
  for (const match of html.matchAll(/<\/?([a-z][\w-]*)([^>]*)>/gi)) {
    const [token, tag, attributes] = match;
    if (token.startsWith('</')) { if (stack.at(-1).tagName.toLowerCase() === tag.toLowerCase()) stack.pop(); continue; }
    const node = doc.createElement(tag);
    for (const [, name, value] of attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) node.setAttribute(name, value ?? '');
    stack.at(-1).append(node);
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag.toLowerCase())) stack.push(node);
  }
  return doc;
}
const memory = () => {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
function load(file, storage, search = '') {
  const document = dom(readGuide(file)), events = new Map();
  const location = new URL(`https://example.test/music/${file}${search}`);
  const window = { localStorage: storage, location,
    addEventListener: (type, fn) => events.set(type, [...(events.get(type) || []), fn]),
    history: { replaceState: (_, __, url) => { window.location = new URL(url); } },
  };
  const scope = { document, window, URL, URLSearchParams };
  for (const script of ['practice-sessions.js', 'practice-path.js']) runInNewContext(readGuide(script), scope);
  return { document, window, P: scope.DCPracticeSessions, events };
}

test('home → studio goals → next session → returning home preserves progress and notes', () => {
  const storage = memory();
  storage.data.set('303-404/studio/project/existing', 'my existing music');
  const home = load('index.html', storage);
  assert.equal(home.document.getElementById('practice-path-list').children.length, 7);
  assert.equal(home.document.getElementById('practice-session-link').href, './groove-studio.html?mission=pocket');
  const studio = load('groove-studio.html', storage, '?mission=pocket');
  const doc = studio.document, body = doc.getElementById('guided-session-body');
  assert.equal(doc.querySelector('[data-practice-studio]').hidden, false);
  const submit = body.querySelector('.session-primary');
  assert.equal(submit.disabled, true);
  for (const input of body.querySelectorAll('input')) { input.checked = true; input.fire('change'); }
  const feeling = body.querySelector('select'); feeling.value = 'revisit'; feeling.fire('change');
  const note = body.querySelector('textarea'); note.value = '<b>Less bass before the return.</b>'; note.fire('input');
  assert.equal(submit.disabled, false);
  body.querySelector('form').fire('submit');
  assert.match(body.querySelector('.session-feedback').textContent, /Session complete/);
  assert.equal(body.querySelector('.session-next').hidden, false);
  body.querySelector('.session-next').fire('click');
  assert.equal(studio.window.location.search, '?mission=bass-space');
  assert.match(doc.getElementById('guided-session-heading').textContent, /Give the bass room/);
  assert.equal(doc.activeElement, doc.getElementById('guided-session-heading'));
  assert.equal(storage.getItem('303-404/studio/project/existing'), 'my existing music');

  const returned = load('index.html', storage);
  assert.equal(returned.document.getElementById('path-count').textContent, '1 of 7 sessions completed');
  assert.equal(returned.document.getElementById('practice-session-link').href, './groove-studio.html?mission=bass-space');
  const first = returned.document.getElementById('practice-path-list').children[0].querySelector('button');
  first.fire('click');
  assert.equal(first.getAttribute('aria-pressed'), 'true');
  assert.equal(returned.document.getElementById('practice-session-note').textContent, 'Your note: <b>Less bass before the return.</b>');
  assert.equal(returned.document.getElementById('practice-session-note').children.length, 0);
  assert.equal(returned.document.getElementById('practice-session-link').textContent, 'Practise this again');
  assert.equal(returned.document.getElementById('path-complete').hidden, true);
  returned.document.getElementById('practice-session-link').fire('click');
  for (const refresh of returned.events.get('pageshow')) refresh({ persisted: true });
  assert.equal(returned.document.getElementById('practice-session-link').href, './groove-studio.html?mission=bass-space');
  const restored = load('groove-studio.html', storage, '?mission=pocket').document.getElementById('guided-session-body');
  assert.ok(restored.querySelectorAll('input').every(input => input.checked));
  assert.equal(restored.querySelector('select').value, 'revisit');
  assert.equal(restored.querySelector('textarea').value, note.value);
});

test('free play and invalid mission links keep the studio available without a brief', () => {
  for (const search of ['', '?mission=unknown', '?mission=__proto__']) {
    const storage = memory(), app = load('groove-studio.html', storage, search);
    assert.equal(app.document.querySelector('[data-practice-studio]').hidden, true);
    assert.equal(storage.data.size, 0);
  }
});

test('a failed completion stays visibly unsaved and does not unlock Next or inflate home progress', () => {
  const storage = memory(), app = load('groove-studio.html', storage, '?mission=pocket');
  const body = app.document.getElementById('guided-session-body');
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  for (const input of body.querySelectorAll('input')) { input.checked = true; input.fire('change'); }
  const feeling = body.querySelector('select'); feeling.value = 'ready'; feeling.fire('change');
  body.querySelector('form').fire('submit');
  assert.equal(body.querySelector('.session-error').hidden, false);
  assert.match(body.querySelector('.session-error').textContent, /not saved/);
  assert.equal(body.querySelector('.session-next').hidden, true);
  assert.equal(load('index.html', storage).document.getElementById('path-count').textContent, '0 of 7 sessions completed');
});
