// Event-focused DOM double; this does not emulate browser layout or audio.
class Element {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase(); this.doc = doc; this.children = []; this.dataset = {}; this.attributes = {};
    this.listeners = new Map(); this.textContent = ''; this.hidden = false; this.disabled = false; this._value = undefined;
  }
  get value() { return this._value ?? (this.tagName === 'SELECT' ? this.children[0]?.value || '' : this.textContent); }
  set value(value) { this._value = String(value); }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (['id', 'type', 'href', 'value'].includes(name)) this[name] = value;
    if (name === 'class') this.className = value;
    if (['hidden', 'disabled'].includes(name)) this[name] = true;
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
  matches(selector) {
    if (selector[0] === '#') return this.id === selector.slice(1);
    if (selector[0] === '.') return (this.className || '').split(' ').includes(selector.slice(1));
    const attr = /^\[([\w-]+)(?:="([^"]+)")?\]$/.exec(selector);
    if (attr) {
      const value = attr[1].startsWith('data-') ? this.dataset[attr[1].slice(5)] : this.attributes[attr[1]];
      return value !== undefined && (attr[2] === undefined || String(value) === attr[2]);
    }
    return this.tagName.toLowerCase() === selector;
  }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) || []), fn]); }
  async fire(type, extra = {}) { for (const fn of this.listeners.get(type) || []) await fn({ target: this, preventDefault() {}, ...extra }); }
  focus() { this.doc.activeElement = this; this.fire('focus'); }
  pause() { this.paused = true; }
}
function dom(html) {
  const document = { hidden: false, listeners: new Map(), addEventListener: Element.prototype.addEventListener, fire: Element.prototype.fire };
  const root = new Element('document', document), stack = [root];
  document.createElement = tag => new Element(tag, document);
  document.getElementById = id => root.querySelector('#' + id);
  for (const [, closing, tag, attributes] of html.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>/gi)) {
    if (closing) { if (stack.at(-1).tagName.toLowerCase() === tag.toLowerCase()) stack.pop(); continue; }
    const node = document.createElement(tag);
    for (const [, name, value] of attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) node.setAttribute(name, value ?? '');
    stack.at(-1).append(node);
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag.toLowerCase())) stack.push(node);
  }
  return document;
}

export { Element, dom };
