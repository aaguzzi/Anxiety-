// Evidence for a layout review. Drives the built app through every screen and state at several
// phone sizes and text sizes, and saves a screenshot of each screenful together with automatic
// measurements of what may be wrong on it (manifest.json in the same folder).
//
//   node tests/layout/capture.cjs [output folder]
//
// APP_URL defaults to http://localhost:4173/ (a running `vite preview`). Optional filters while
// working on it: ONLY=<regexp on scene names>, VARIANTS=a,e.
//
// The app runs against the stand-in phone of tests/phone (fake-phone.js and Capacitor's own
// native bridge), so the Android-only parts are on screen: natural voices, background sounds,
// reminders, the update banner. The plain web build is captured as well where it looks different.
//
// Text size: Android WebView multiplies every font size (and every fixed line height) by the
// system font scale. That is imitated here by reading each element's own computed font size and
// line height and writing them back multiplied, again after every re-render (a MutationObserver
// added before the app loads).
//
// Keyboard: variant f focuses a text field at 360x640, then makes the viewport 340 high, the way
// the web view shrinks when the keyboard opens, and scrolls the field into view as Chrome does.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const URL = process.env.APP_URL || 'http://localhost:4173/';
const OUT = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'anxiety-layout'));
const ROOT = path.join(__dirname, '..', '..');
const FAKE_PHONE = fs.readFileSync(path.join(ROOT, 'tests/phone/fake-phone.js'), 'utf8');
const BRIDGE = fs.readFileSync(path.join(ROOT, 'node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js'), 'utf8');
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const MAX_SCREENS = 30;

const VARIANTS = [
  { id: 'a', w: 360, h: 640, text: 1, label: '360x640, text 100% (most common small Android)' },
  { id: 'b', w: 320, h: 640, text: 1, label: '320x640, text 100% (narrow: large display size)' },
  { id: 'c', w: 412, h: 915, text: 1, label: '412x915, text 100% (large phone)' },
  { id: 'd', w: 360, h: 640, text: 1.3, label: '360x640, text 130%' },
  { id: 'e', w: 360, h: 640, text: 2, label: '360x640, text 200%' },
  { id: 'f', w: 360, h: 640, text: 1, kb: 340, label: '360x640, a text field focused, then the viewport 340 high (keyboard open)' },
].filter(v => !process.env.VARIANTS || process.env.VARIANTS.split(',').includes(v.id));

// A time zone in which it is now the given hour, so Home shows the same time of day on every run.
function zoneAt(hour) {
  let off = (hour - new Date().getUTCHours() + 24) % 24;
  if (off > 14) off -= 24;
  return off === 0 ? 'Etc/GMT' : off > 0 ? `Etc/GMT-${off}` : `Etc/GMT+${-off}`;
}
const NIGHT = zoneAt(23); // the app is often opened at night
const MORNING = zoneAt(8);

// ─── Data seeded into the app ───────────────────────────────────────────────────────────────
const PHONE = {
  onboarded: true, voiceChoice: 'ruth', speechSpeed: 0.75, pauseScale: 1, voiceQuality: 'best', voiceSoftness: 0.3, voiceSpace: 0,
  sounds: { rain: { on: true, volume: 0.5 } }, voiceBench: { rtf: 0.1, cores: 8, ramMb: 8000 },
};
const KEY = 'sk-ant-api03-layout-test';
const CONTACT = { contactName: 'Alexandra Montgomery-Fitzgerald', contactPhone: '+1 (416) 555-0199 ext. 2041' };
const LONG_TITLE = 'A Gentle Practice for the Night Before a Very Difficult Conversation with My Manager About My Workload';
const WORD_TITLE = 'Unwinding-after-an-extraordinarily-overwhelming-Wednesday';
const LONG_PROMPT = 'I keep replaying the conversation I need to have with my manager tomorrow morning about how much work I have been given since my colleague left. ' +
  'Every time I try to fall asleep my chest gets tight and I start rehearsing what I will say, then imagining every way it could go wrong, ' +
  'and then I feel angry at myself for not being able to just switch off. I would like something slow that helps me put this down for the night ' +
  'and reminds me that I can handle it tomorrow, without telling me to think positively or to count my breaths, because counting makes it worse.';
const segments = n => Array.from({ length: n }, (_, i) => ({
  text: ['Let yourself settle into whatever is holding you up right now.', 'Notice the breath moving in, and moving out, without changing it.',
    'If your mind runs ahead to tomorrow, that is what minds do; gently come back.', 'There is nothing you need to solve in this moment.'][i % 4],
  pause: 3 + (i % 3),
}));
const MEDITATIONS = [
  { id: '1790000000001', title: LONG_TITLE, prompt: LONG_PROMPT, minutes: 15, createdAt: '2026-11-19T21:40:00.000Z', segments: segments(24) },
  { id: '1790000000002', title: WORD_TITLE, prompt: 'Feeling overwhelmed', minutes: 5, createdAt: '2026-11-18T19:05:00.000Z', segments: segments(12) },
  { id: '1790000000003', title: 'Settling After Work', prompt: 'Stress about work', minutes: 5, createdAt: '2026-11-17T18:30:00.000Z', segments: segments(12) },
  { id: '1790000000004', title: 'Before Sleep', prompt: 'Winding down before sleep', minutes: 10, createdAt: '2026-11-12T22:10:00.000Z', segments: segments(16) },
];
const SCRIPT = 'TITLE: Evening Unwind\n' + ['one', 'two', 'three', 'four'].map(w => `This is spoken line number ${w}.\n[pause 2]`).join('\n');

// Runs in the page before the app: seeds storage once per tab, and the stand-ins' settings.
function seedInit(o) {
  try {
    if (!sessionStorage.getItem('__seeded')) {
      localStorage.clear();
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      for (const [k, v] of Object.entries(o.storage || {})) put(k, v);
      if (o.demo) {
        const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const ago = (days, h, m) => { const d = new Date(); d.setDate(d.getDate() - days); d.setHours(h, m, 0, 0); return d; };
        const history = {};
        const done = [['4-7-8', 'soften-allow', 'physiological-sigh', 'meditation', 'sos'], ['box-breathing', 'meditation'], ['5-4-3-2-1'],
          [], ['leaves-on-stream', 'thought-labeling', 'meditation'], ['values-compass'], ['meditation', 'body-scan']];
        done.forEach((ids, i) => { if (ids.length) history[key(ago(i, 12, 0))] = ids; });
        put('ac-history', history);
        const c = (days, h, m, level, feeling, focus, note) => ({ id: String(ago(days, h, m).getTime()), at: ago(days, h, m).toISOString(), level, feeling, focus, ...(note ? { note } : {}) });
        put('ac-checkins', [
          c(6, 8, 15, 4, 'Worried about what might happen', ['defusion', 'acceptance']),
          c(5, 22, 40, 8, 'Overwhelmed or panicky', ['breathing', 'grounding'], 'Could not sleep. Heart racing after reading work emails in bed.'),
          c(3, 13, 5, 6, 'Caught in anxious thoughts', ['defusion', 'mindfulness'],
            'Big meeting this afternoon and I did not sleep well. My chest felt tight on the bus and I kept checking my phone for messages from my manager; by lunchtime I could not concentrate on anything and I skipped eating.'),
          c(2, 19, 30, 3, 'Disconnected or numb', ['grounding', 'mindfulness']),
          c(1, 7, 50, 9, 'Tense or uncomfortable in my body', ['breathing', 'grounding'], 'notes-from-therapist:https://example.org/worksheets/anxiety/acceptance-and-commitment/week-three-defusion.pdf'),
          c(0, 9, 10, 7, 'Stuck or avoiding something', ['values', 'action'], 'Avoiding the phone call to the clinic again.'),
          c(0, 21, 55, 10, 'Overwhelmed or panicky', ['breathing', 'grounding']),
        ]);
      }
      if (o.positions) {
        const p = {};
        for (const [id, index] of Object.entries(o.positions)) p[id] = { index, at: Date.now() };
        put('ac-med-positions', p);
      }
      sessionStorage.setItem('__seeded', '1');
    }
  } catch (e) { /* storage unavailable */ }
  window.__seedReplies = o.replies || {};
  if (o.ttsFails) {
    window.speechSynthesis.speak = u => setTimeout(() => u.onerror && u.onerror(Object.assign(new Event('error'), { error: 'synthesis-failed' })), 50);
    window.speechSynthesis.cancel = () => {};
  }
}

// Runs in the page: lets the script fast-forward or freeze the exercises' one-second clocks, and
// hold the player's seek bar in the middle of a drag.
function timersInit() {
  const SI = window.setInterval.bind(window);
  const ST = window.setTimeout.bind(window);
  const tick = window.__tick = { scale: 1, frozen: false };
  window.__holdScrub = false;
  window.setInterval = function (fn, ms, ...args) {
    if (ms !== 1000 || typeof fn !== 'function') return SI(fn, ms, ...args);
    let acc = 0;
    return SI(() => {
      if (tick.frozen) return;
      acc += 50 * tick.scale;
      if (acc >= 1000) { acc -= 1000; fn(...args); }
    }, 50);
  };
  window.setTimeout = function (fn, ms, ...args) {
    if (window.__holdScrub && ms === 300) return ST(() => {}, 0); // the seek bar's "settled" timer
    return ST(fn, ms, ...args);
  };
}

// Runs in the page: Android WebView text zoom. Every element gets its own computed font size (and
// line height, unless "normal") multiplied, written inline; redone whenever elements are added,
// change class, or have their inline font size changed by the app.
function textZoomInit(k) {
  if (!k || k === 1) return;
  window.__textScale = k;
  const ORIG = new WeakMap();
  const OURS = new WeakMap();
  const SKIP = new Set(['HEAD', 'SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'BR']);
  let observer = null;
  let passes = 0;
  const setp = (s, p, v, prio = '') => (v ? s.setProperty(p, v, prio) : s.removeProperty(p));
  function pass() {
    if (!document.body) return;
    passes++;
    const els = [...document.querySelectorAll('html, body, body *')].filter(el => !SKIP.has(el.tagName) && !(el instanceof SVGElement));
    // Elements with `transition: all` would animate the change and report a size mid-way: switch
    // their transitions off for the pass.
    const still = [];
    for (const el of els) {
      const cs = getComputedStyle(el);
      if (/\b(all|font|font-size|line-height)\b/.test(cs.transitionProperty) && cs.transitionDuration.split(',').some(d => parseFloat(d) > 0)) {
        still.push([el, el.style.getPropertyValue('transition'), el.style.getPropertyPriority('transition')]);
        el.style.setProperty('transition', 'none', 'important');
      }
    }
    for (const el of els) {
      const s = el.style;
      const ours = OURS.get(el);
      if (!ours) { ORIG.set(el, { fs: s.getPropertyValue('font-size'), lh: s.getPropertyValue('line-height') }); continue; }
      const orig = ORIG.get(el);
      const fs = s.getPropertyValue('font-size');
      const lh = s.getPropertyValue('line-height');
      if (fs !== ours.fs) orig.fs = fs; // the app set its own value since
      if (lh !== ours.lh) orig.lh = lh;
      setp(s, 'font-size', orig.fs);
      setp(s, 'line-height', orig.lh);
    }
    const natural = els.map(el => { const cs = getComputedStyle(el); return [parseFloat(cs.fontSize), cs.lineHeight]; });
    els.forEach((el, i) => {
      const [fs, lh] = natural[i];
      const s = el.style;
      if (fs > 0) s.setProperty('font-size', `${+(fs * k).toFixed(3)}px`);
      if (/px$/.test(lh)) s.setProperty('line-height', `${+(parseFloat(lh) * k).toFixed(3)}px`);
      OURS.set(el, { fs: s.getPropertyValue('font-size'), lh: s.getPropertyValue('line-height') });
    });
    if (still.length) {
      void document.documentElement.offsetWidth; // apply the new sizes while transitions are off
      for (const [el, v, prio] of still) setp(el.style, 'transition', v, prio);
    }
    if (observer) observer.takeRecords();
  }
  observer = new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'childList') {
        for (const n of r.addedNodes) if (n.nodeType === 1 && !(n instanceof SVGElement)) return pass();
      } else if (r.target.nodeType === 1 && !(r.target instanceof SVGElement)) {
        if (r.attributeName === 'class') return pass();
        const o = OURS.get(r.target);
        const s = r.target.style;
        if (!o || s.getPropertyValue('font-size') !== o.fs || s.getPropertyValue('line-height') !== o.lh) return pass();
      }
    }
  });
  observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
  document.addEventListener('DOMContentLoaded', pass);
  window.addEventListener('load', pass);
  window.__tzPass = pass;
  window.__tzPasses = () => passes;
}

// Runs in the page after fake-phone.js: lets a scene hold a call to the phone (to catch a state
// that is normally gone in a moment) or answer it differently.
function bridgeControlInit() {
  const fake = window.androidBridge;
  const ctl = window.__bridgeCtl = {
    hold: new Set(), held: [], replies: Object.assign({}, window.__seedReplies || {}),
    release(name) {
      const keep = [];
      for (const json of this.held) {
        const c = JSON.parse(json);
        if (!name || `${c.pluginId}.${c.methodName}` === name) fake.postMessage(json); else keep.push(json);
      }
      this.held = keep;
    },
  };
  window.androidBridge = {
    postMessage(json) {
      const c = JSON.parse(json);
      const name = `${c.pluginId}.${c.methodName}`;
      if (Object.prototype.hasOwnProperty.call(ctl.replies, name)) {
        const r = ctl.replies[name];
        window.__phone.calls.push({ name, options: c.options });
        setTimeout(() => window.Capacitor.fromNative({ callbackId: c.callbackId, pluginId: c.pluginId, methodName: c.methodName, success: !r.error, data: r.data || {}, error: r.error }), 0);
        return;
      }
      if (ctl.hold.has(name)) { ctl.held.push(json); return; }
      return fake.postMessage(json);
    },
  };
}

// Runs in the page: the measurements.
function layoutLibInit() {
  const L = window.__lay = {};
  const ids = new WeakMap();
  let nextId = 1;
  const idOf = el => { let i = ids.get(el); if (!i) { i = nextId++; ids.set(el, i); } return i; };
  const firstSeen = new Map();
  let styles = new Map();
  const st = el => { let s = styles.get(el); if (!s) { s = getComputedStyle(el); styles.set(el, s); } return s; };
  const INTERACTIVE = 'button, a[href], input:not([type=hidden]), textarea, select, [role=button], [role=switch], [role=slider], [role=link], [role=checkbox], [role=tab], [role=menuitem], [tabindex]:not([tabindex="-1"])';
  const FIELD = /^(INPUT|TEXTAREA|SELECT)$/;
  const clean = t => (t || '').replace(/\s+/g, ' ').trim();
  const cut = (t, n = 48) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
  const directText = el => clean([...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join(' '));
  const hasWords = t => /[\p{L}\p{N}]/u.test(t);

  function reactProps(el) {
    const k = Object.keys(el).find(x => x.startsWith('__reactProps$'));
    return k ? el[k] : null;
  }
  const clickable = el => { const p = reactProps(el); return !!(p && (p.onClick || p.onPointerDown || p.onMouseDown || p.onTouchStart)); };

  function accName(el) {
    const by = el.getAttribute('aria-labelledby');
    if (by) { const t = clean(by.split(/\s+/).map(id => (document.getElementById(id) || {}).textContent || '').join(' ')); if (t) return { name: t, from: 'labelledby' }; }
    const al = clean(el.getAttribute('aria-label'));
    if (al) return { name: al, from: 'aria-label' };
    if (el.labels && el.labels.length) { const t = clean([...el.labels].map(l => l.textContent).join(' ')); if (t) return { name: t, from: 'label' }; }
    const field = FIELD.test(el.tagName) && !/^(button|submit|reset)$/.test(el.type);
    if (!field) {
      const t = clean(el.textContent) || clean([...el.querySelectorAll('img[alt]')].map(i => i.alt).join(' '));
      if (t) return { name: t, from: 'content' };
    }
    const title = clean(el.getAttribute('title'));
    if (title) return { name: title, from: 'title' };
    if (field && el.placeholder) return { name: el.placeholder, from: 'placeholder' };
    if (el.tagName === 'INPUT' && /^(button|submit|reset)$/.test(el.type) && el.value) return { name: el.value, from: 'value' };
    return { name: '', from: 'none' };
  }
  const sig = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].filter(c => c.length < 30).slice(0, 2).map(c => '.' + c).join('') + (el.type && FIELD.test(el.tagName) ? `[${el.type}]` : '');
  function describe(el) {
    if (!el || el.nodeType !== 1) return String(el);
    const n = cut(accName(el).name || clean(el.textContent), 44);
    return sig(el) + (n ? ` "${n}"` : '');
  }
  L.describe = describe;

  function visibleStyle(el) {
    if (!el.isConnected || !el.getClientRects().length) return false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const s = st(e);
      if (s.display === 'none' || parseFloat(s.opacity) < 0.05) return false;
    }
    return st(el).visibility === 'visible';
  }
  function opacityOf(el) {
    let o = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= parseFloat(st(e).opacity);
    return o;
  }
  // The part of the viewport an element can show through: the viewport cut by every ancestor
  // that clips its overflow (for positioned elements, only from their containing block up).
  function clipRect(el) {
    const r = { l: 0, t: 0, r: innerWidth, b: innerHeight };
    let skipping = /^(absolute)$/.test(st(el).position);
    if (st(el).position === 'fixed') return r;
    for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) {
      const s = st(e);
      if (skipping) {
        if (s.position === 'static') continue;
        skipping = false;
      }
      const b = e.getBoundingClientRect();
      if (s.overflowX !== 'visible') { r.l = Math.max(r.l, b.left + e.clientLeft); r.r = Math.min(r.r, b.left + e.clientLeft + e.clientWidth); }
      if (s.overflowY !== 'visible') { r.t = Math.max(r.t, b.top + e.clientTop); r.b = Math.min(r.b, b.top + e.clientTop + e.clientHeight); }
      if (s.position === 'fixed') break;
      if (s.position === 'absolute') skipping = true;
    }
    return r;
  }
  const inter = (a, c) => {
    const l = Math.max(a.left, c.l), t = Math.max(a.top, c.t), r = Math.min(a.right, c.r), b = Math.min(a.bottom, c.b);
    return r - l >= 1 && b - t >= 1 ? { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t } : null;
  };
  function horizontallyScrolled(el) {
    for (let e = el.parentElement; e; e = e.parentElement) {
      const s = st(e);
      if (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1) return true;
    }
    return false;
  }
  function scrollCtx(el) {
    for (let e = el.parentElement; e; e = e.parentElement) {
      const s = st(e);
      if ((/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1) || (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1)) return e;
      if (s.position === 'fixed') return null;
    }
    return null;
  }

  // The topmost layer the user is looking at, and anything floating above it (the SOS button).
  function activeLayer() {
    const overlays = [...document.querySelectorAll('.exercise-overlay')].filter(e => e.getClientRects().length);
    let root = document.querySelector('.app') || document.body;
    let z = 0;
    if (overlays.length) {
      overlays.sort((a, b) => (parseInt(st(a).zIndex, 10) || 0) - (parseInt(st(b).zIndex, 10) || 0));
      root = overlays[overlays.length - 1];
      z = parseInt(st(root).zIndex, 10) || 0;
    }
    const extra = [...document.querySelectorAll('.sos-fab')].filter(e => !root.contains(e) && (parseInt(st(e).zIndex, 10) || 0) > z);
    return { root, extra };
  }
  function interactives(layer) {
    const scope = [layer.root, ...layer.extra];
    const set = new Set();
    for (const s of scope) {
      if (s.matches(INTERACTIVE)) set.add(s);
      for (const el of s.querySelectorAll(INTERACTIVE)) set.add(el);
    }
    for (const s of scope) {
      for (const el of [s, ...s.querySelectorAll('*')]) {
        if (!set.has(el) && !(el instanceof SVGElement) && clickable(el)) set.add(el);
      }
    }
    return [...set];
  }
  // A checkbox inside its label is tapped through the label.
  const targetBox = el => {
    if (el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type)) { const l = el.closest('label'); if (l) return l; }
    return el;
  };

  // ── colours
  function color(s) {
    const m = /rgba?\(([^)]+)\)/.exec(s || '');
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratioOf = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  function backdrops(el) {
    const layers = [];
    let image = false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const s = st(e);
      if (s.backgroundImage && s.backgroundImage !== 'none') {
        const cols = (s.backgroundImage.match(/rgba?\([^)]*\)/g) || []).map(color).filter(Boolean);
        if (cols.length) layers.push({ grads: cols }); else image = true;
      }
      const bg = color(s.backgroundColor);
      if (bg && bg[3] > 0) { layers.push({ color: bg }); if (bg[3] >= 0.999) break; }
    }
    let bases = [[255, 255, 255, 1]];
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (l.color) bases = bases.map(b => over(l.color, b));
      else bases = bases.flatMap(b => l.grads.map(g => over(g, b))).slice(0, 16);
    }
    return { bases, image, gradient: layers.some(l => l.grads) };
  }
  function contrastOf(el, fgString) {
    const fg = color(fgString);
    if (!fg) return null;
    const { bases, image, gradient } = backdrops(el);
    const alpha = fg[3] * opacityOf(el);
    let worst = null;
    for (const b of bases) {
      const f = over([fg[0], fg[1], fg[2], alpha], b);
      const r = ratioOf(f, b);
      if (!worst || r < worst.r) worst = { r, f, b };
    }
    return { ratio: Math.round(worst.r * 100) / 100, fg: hex(worst.f), bg: hex(worst.b), image, gradient };
  }

  L.resetSeen = () => firstSeen.clear();

  // Problems visible on the current screenful.
  L.measure = (shot, opts = {}) => {
    styles = new Map();
    const out = {};
    const vw = innerWidth;
    const layer = activeLayer();
    const view = { l: 0, t: 0, r: innerWidth, b: innerHeight };
    const ox = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    if (ox > 0) out.pageOverflowX = ox;
    const scope = [];
    for (const s of [layer.root, ...layer.extra]) { scope.push(s); for (const el of s.querySelectorAll('*')) if (!(el instanceof SVGElement)) scope.push(el); }
    const add = (k, item) => (out[k] = out[k] || []).push(item);
    const agg = {};
    const group = (k, gkey, el, extra) => {
      const g = agg[k] = agg[k] || new Map();
      let e = g.get(gkey);
      if (!e) { e = { key: gkey, el: sig(el), n: 0, names: [], ...extra }; g.set(gkey, e); }
      e.n++;
      const nm = cut(accName(el).name || clean(el.textContent), 32);
      if (nm && e.names.length < 3 && !e.names.includes(nm)) e.names.push(nm);
      return e;
    };

    for (const el of scope) {
      const s = st(el);
      if (s.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) continue;
      if (!visibleStyle(el)) continue;
      const clip = clipRect(el);
      const vis = inter(r, clip);
      if (!vis) continue;
      const own = directText(el);
      const isField = FIELD.test(el.tagName);

      // a screen that scrolls up and down but has also become wider than the phone
      if (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1 && el.scrollHeight > el.clientHeight + 1) {
        add('sidewaysScroll', { key: describe(el), el: describe(el), wider: el.scrollWidth - el.clientWidth, ...(el.scrollLeft ? { pannedBy: Math.round(el.scrollLeft) } : {}) });
      }

      // clipped and truncated text
      const hidesX = /^(hidden|clip)$/.test(s.overflowX), hidesY = /^(hidden|clip)$/.test(s.overflowY);
      if ((hidesX || hidesY) && !isField && hasWords(clean(el.textContent))) {
        const byX = hidesX ? el.scrollWidth - el.clientWidth : 0;
        const byY = hidesY ? el.scrollHeight - el.clientHeight : 0;
        if (byX > 1 || byY > 1) {
          const dir = byX > 1 && byY > 1 ? 'x+y' : byX > 1 ? 'x' : 'y';
          const item = { key: describe(el) + dir, el: describe(el), dir, by: Math.max(byX, byY) };
          if (s.textOverflow === 'ellipsis' && byX > 1) add('truncated', { key: item.key, el: describe(el), text: cut(clean(el.textContent), 140) });
          else add('clipped', item);
        }
      }
      // text spilling out of its own box
      if (own && hasWords(own) && !isField && !/^(inline|contents)$/.test(s.display) && s.overflowX === 'visible' && s.overflowY === 'visible' && el.clientWidth > 0) {
        const byX = el.scrollWidth - el.clientWidth, byY = el.scrollHeight - el.clientHeight;
        const minY = Math.max(2, parseFloat(s.fontSize) * 0.2); // glyphs of a big digit overhang a tight line box a little
        if (byX > 2 || byY > minY) add('spills', { key: describe(el), el: describe(el), dir: byX > 2 && byY > minY ? 'x+y' : byX > 2 ? 'x' : 'y', by: Math.round(Math.max(byX > 2 ? byX : 0, byY > minY ? byY : 0)) });
      }
      // cut off at the side (not inside something that scrolls sideways)
      if ((own && hasWords(own)) || el.matches(INTERACTIVE)) {
        const right = r.right - Math.min(clip.r, vw), left = Math.max(clip.l, 0) - r.left;
        if ((right > 1 || left > 1) && !horizontallyScrolled(el) && !el.getAnimations().some(a => a.playState === 'running')) add('cutOff', { key: describe(el), el: describe(el), side: right > 1 ? 'right' : 'left', by: Math.round(Math.max(right, left)) });
      }
      // contrast
      const texts = [];
      if (own && hasWords(own)) texts.push([s.color, false]);
      if (isField && el.tagName !== 'SELECT' && !/^(range|checkbox|radio|color|file)$/.test(el.type)) {
        if (el.value) texts.push([s.color, false]);
        else if (el.placeholder) texts.push([getComputedStyle(el, '::placeholder').color, true]);
      }
      const animating = () => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) if (e.getAnimations().some(a => a.playState === 'running' && !('transitionProperty' in a))) return true; return false; };
      for (const [fgs, ph] of texts) {
        const c = contrastOf(el, fgs);
        if (c && c.ratio < 4.5) {
          const px = Math.round(parseFloat(s.fontSize) * 10) / 10;
          const bold = parseInt(s.fontWeight, 10) >= 700;
          const e = group('contrast', `${sig(el)}|${c.fg}|${c.bg}|${px}${ph ? '|ph' : ''}`, el, {
            ratio: c.ratio, fg: c.fg, bg: c.bg, px, ...(bold ? { bold } : {}),
            ...(px >= 24 || (bold && px >= 18.66) ? { large: true } : {}),
            ...(ph ? { placeholder: true } : {}), ...(el.disabled || el.closest('[disabled]') ? { disabled: true } : {}),
            ...(c.gradient ? { overGradient: true } : {}), ...(c.image ? { overImage: true } : {}),
            ...(animating() ? { animating: true } : {}),
          });
          e.ratio = Math.min(e.ratio, c.ratio);
        }
      }
    }

    // interactive elements on this screenful
    const items = interactives(layer).filter(el => visibleStyle(el)).map(el => {
      const box = targetBox(el);
      const r = box.getBoundingClientRect();
      return { el, box, r, vis: inter(r, clipRect(box)) };
    }).filter(x => x.vis && inter(x.vis, view));
    for (const x of items) {
      if (!firstSeen.has(idOf(x.el))) firstSeen.set(idOf(x.el), shot);
      const w = Math.round(x.r.width), h = Math.round(x.r.height);
      if (w < 48 || h < 48) {
        const e = group('small', `${sig(x.el)}|${w}x${h}`, x.el, { size: `${w}x${h}` });
        if (x.box !== x.el) e.via = 'label';
        if (x.el.disabled) e.disabled = true;
      }
      const n = accName(x.el);
      if (n.from === 'none') add('noName', { key: describe(x.el), el: describe(x.el) });
      else if (n.from === 'placeholder') add('placeholderOnly', { key: describe(x.el), el: sig(x.el), placeholder: cut(n.name, 60) });
      if (!x.el.matches(INTERACTIVE)) add('clickableNoRole', { key: describe(x.el), el: describe(x.el) });
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        if (a.box.contains(b.box) || b.box.contains(a.box) || a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (st(a.el).pointerEvents === 'none' || st(b.el).pointerEvents === 'none') continue;
        const ca = scrollCtx(a.box), cb = scrollCtx(b.box);
        if (ca !== cb && (ca || cb)) continue; // depends on scroll position; see "covered"
        const o = inter(a.vis, { l: b.vis.left, t: b.vis.top, r: b.vis.right, b: b.vis.bottom });
        if (o && o.width >= 2 && o.height >= 2) add('overlap', { key: describe(a.el) + '|' + describe(b.el), a: describe(a.el), b: describe(b.el), area: `${Math.round(o.width)}x${Math.round(o.height)}` });
      }
    }
    for (const [k, g] of Object.entries(agg)) out[k] = [...g.values()].map(e => (e.names.length ? e : (delete e.names, e)));

    if (opts.focus) {
      const a = document.activeElement;
      if (a && a !== document.body) {
        const r = a.getBoundingClientRect();
        const vis = inter(r, clipRect(a));
        const covered = new Set();
        if (vis) {
          for (const [x, y] of [[(r.left + r.right) / 2, (r.top + r.bottom) / 2], [r.left + 4, r.top + 4], [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4]]) {
            if (x < vis.left || x > vis.right || y < vis.top || y > vis.bottom) continue;
            const hit = coverAt(a, a, x, y);
            if (hit) covered.add(describe(owner(hit, a)));
          }
        }
        const frac = vis ? Math.round((vis.width * vis.height) / (r.width * r.height) * 100) : 0;
        out.focusedField = { el: describe(a), top: Math.round(r.top), bottom: Math.round(r.bottom), viewportHeight: innerHeight, visiblePercent: frac, ...(covered.size ? { coveredBy: [...covered] } : {}) };
      } else out.focusedField = { el: null, note: 'nothing focused' };
    }
    return out;
  };

  // What is on top of the element at this point, if anything. Points where the element itself is
  // not hit at all (outside a rounded shape) do not count.
  function coverAt(el, box, x, y) {
    const stack = document.elementsFromPoint(x, y);
    const mine = h => h === el || h === box || box.contains(h) || el.contains(h) || (el.labels && [...el.labels].some(l => l.contains(h)));
    const at = stack.findIndex(mine);
    if (at <= 0) return null;
    return stack.slice(0, at).find(h => !h.contains(box)) || null;
  }

  // A readable name for what is on top: the control it belongs to, a floating layer (navigation
  // bar, SOS button), or else the element itself (or its nearest ancestor with a class).
  function owner(hit, covered) {
    const i = hit.closest(INTERACTIVE);
    if (i && !i.contains(covered)) return i;
    for (let e = hit; e && e.nodeType === 1 && !e.contains(covered); e = e.parentElement) {
      const p = getComputedStyle(e).position;
      if (p === 'fixed' || p === 'absolute' || p === 'sticky') return e;
    }
    for (let e = hit; e && e.nodeType === 1 && !e.contains(covered); e = e.parentElement) if (e.classList.length || e.id) return e;
    return hit;
  }

  // Scroll each interactive element into view and see whether something else is on top of it.
  L.coverage = () => {
    styles = new Map();
    const layer = activeLayer();
    const els = interactives(layer).filter(el => visibleStyle(el));
    const saved = [];
    for (const e of document.querySelectorAll('*')) if (e.scrollTop || e.scrollLeft) saved.push([e, e.scrollTop, e.scrollLeft]);
    const doc = document.scrollingElement;
    const docPos = [doc.scrollTop, doc.scrollLeft];
    const out = [];
    for (const el of els) {
      const box = targetBox(el);
      // The least scrolling that would show it all. If that moves a container the user cannot
      // scroll (overflow: hidden), the control is cut off there: undo that part.
      const hidden = [];
      for (let e = box.parentElement; e; e = e.parentElement) {
        const s = st(e);
        const hx = /^(hidden|clip)$/.test(s.overflowX), hy = /^(hidden|clip)$/.test(s.overflowY);
        if (hx || hy) hidden.push([e, e.scrollLeft, e.scrollTop, hx, hy]);
      }
      box.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const hiddenScroll = hidden.filter(([e, l, t, hx, hy]) => (hx && e.scrollLeft !== l) || (hy && e.scrollTop !== t)).map(([e]) => sig(e));
      for (const [e, l, t, hx, hy] of hidden) { if (hx) e.scrollLeft = l; if (hy) e.scrollTop = t; }
      // Then the best place the user can scroll it to: the middle of each scrollable container.
      for (let e = box.parentElement; e; e = e.parentElement) {
        const s = st(e);
        const r = box.getBoundingClientRect(), er = e.getBoundingClientRect();
        if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1) e.scrollTop += (r.top + r.height / 2) - (er.top + e.clientTop + e.clientHeight / 2);
        if (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1) e.scrollLeft += (r.left + r.width / 2) - (er.left + e.clientLeft + e.clientWidth / 2);
      }
      if (doc.scrollHeight > innerHeight + 1 || doc.scrollWidth > innerWidth + 1) {
        const r = box.getBoundingClientRect();
        window.scrollBy((r.left + r.width / 2) - innerWidth / 2, (r.top + r.height / 2) - innerHeight / 2);
      }
      styles = new Map();
      const r = box.getBoundingClientRect();
      const clip = clipRect(box);
      const vis = inter(r, clip);
      const item = { id: idOf(el), el: describe(el), size: `${Math.round(r.width)}x${Math.round(r.height)}` };
      const hint = hiddenScroll.length ? ` (cut off by ${hiddenScroll.join(', ')}, which the user cannot scroll)` : '';
      if (!vis) item.unreachable = 'never on screen' + hint;
      else {
        const shown = (vis.width * vis.height) / (r.width * r.height);
        if (shown < 0.95 && (hint || (r.height <= clip.b - clip.t && r.width <= clip.r - clip.l))) item.partlyHidden = `${Math.round(100 - shown * 100)}% never on screen${hint}`;
        const ix = Math.min(4, r.width / 4), iy = Math.min(4, r.height / 4);
        const pts = { C: [(r.left + r.right) / 2, (r.top + r.bottom) / 2], TL: [r.left + ix, r.top + iy], TR: [r.right - ix, r.top + iy], BL: [r.left + ix, r.bottom - iy], BR: [r.right - ix, r.bottom - iy] };
        const by = {};
        for (const [name, [x, y]] of Object.entries(pts)) {
          if (x < vis.left || x > vis.right || y < vis.top || y > vis.bottom) continue;
          const hit = coverAt(el, box, x, y);
          if (!hit) continue;
          const o = describe(owner(hit, box));
          (by[o] = by[o] || []).push(name);
        }
        const covers = Object.entries(by);
        if (covers.length) {
          item.coveredBy = covers.map(([o, p]) => `${o} [${p.join(' ')}]`);
          if (covers.some(([, p]) => p.includes('C'))) item.centre = true;
        }
      }
      if (item.unreachable || item.partlyHidden || item.coveredBy) out.push(item);
    }
    for (const e of document.querySelectorAll('*')) if (e.scrollTop || e.scrollLeft) { e.scrollTop = 0; e.scrollLeft = 0; }
    for (const [e, t, l] of saved) { e.scrollTop = t; e.scrollLeft = l; }
    doc.scrollTop = docPos[0]; doc.scrollLeft = docPos[1];
    return out.map(x => ({ ...x, shot: firstSeen.has(x.id) ? firstSeen.get(x.id) : null }));
  };

  // The container the screen scrolls in, and where to stop for each screenful.
  function mainScroller() {
    styles = new Map();
    const { root } = activeLayer();
    let best = null, area = 0;
    for (const e of [root, ...root.querySelectorAll('*')]) {
      if (e instanceof SVGElement) continue;
      const s = st(e);
      if (!/(auto|scroll)/.test(s.overflowY) || e.scrollHeight <= e.clientHeight + 4) continue;
      const r = e.getBoundingClientRect();
      const a = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) * Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
      if (a > area) { area = a; best = e; }
    }
    const doc = document.scrollingElement;
    if (!best && doc.scrollHeight > innerHeight + 4) best = doc;
    return best;
  }
  L.landed = () => { const s = mainScroller(); return s ? Math.round(s.scrollTop) : 0; };
  L.plan = (o = {}) => {
    const s = mainScroller();
    L.scroller = s;
    if (!s) return [null];
    const isDoc = s === document.scrollingElement;
    const ch = isDoc ? innerHeight : s.clientHeight;
    const max = s.scrollHeight - ch;
    let obstruct = 0;
    const nav = document.querySelector('.nav');
    if (nav && !isDoc && nav.getClientRects().length) {
      const sr = s.getBoundingClientRect(), nr = nav.getBoundingClientRect();
      if (nr.top < sr.bottom && nr.bottom > sr.top && !document.querySelector('.exercise-overlay')) obstruct = sr.bottom - nr.top;
    }
    const step = Math.max(120, ch - obstruct - 32);
    let start = 0;
    if (o.from) {
      const el = document.querySelector(o.from);
      if (el) start = Math.max(0, Math.min(max, el.getBoundingClientRect().top - (isDoc ? 0 : s.getBoundingClientRect().top) + s.scrollTop - 12));
    }
    const pos = [Math.round(start)];
    for (let y = start + step; y < max - 40 && pos.length < (o.max || 30) - 1; y += step) pos.push(Math.round(y));
    if (max - pos[pos.length - 1] > 8) pos.push(Math.round(max));
    return pos;
  };
  L.scrollTo = y => { if (L.scroller) L.scroller.scrollTop = y; };
  L.top = () => { const s = mainScroller(); if (s) s.scrollTop = 0; };
  // Lets entrances (slide-up, staggered fade-ins) finish, but not the slow transitions of the
  // breathing circle or the leaves drifting across, which are captured mid-way on purpose.
  L.settle = async () => {
    const anims = document.getAnimations().filter(a => {
      const t = a.effect && a.effect.getComputedTiming();
      if (a.playState !== 'running' || !t || !isFinite(t.endTime)) return false;
      const left = t.endTime - (t.localTime || 0);
      return 'transitionProperty' in a ? left <= 600 : left <= 2500;
    });
    await Promise.race([Promise.all(anims.map(a => a.finished.catch(() => {}))), new Promise(r => setTimeout(r, 2600))]);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  };
}

// ─── Capture machinery ──────────────────────────────────────────────────────────────────────
const manifest = { generated: new Date().toISOString(), app: URL, out: OUT, timeZone: { night: NIGHT, morning: MORNING }, variants: {}, notes: [], notReached: [], pageErrors: [], shots: [] };

function compact(m, seen) {
  const out = {};
  for (const [k, v] of Object.entries(m)) {
    if (Array.isArray(v)) {
      const keep = v.filter(x => { const key = `${k}|${x.key || JSON.stringify(x)}`; if (seen.has(key)) return false; seen.add(key); return true; })
        .map(({ key, ...rest }) => rest);
      if (keep.length) out[k] = keep;
    } else if (v !== undefined && v !== null && v !== 0) out[k] = v;
  }
  return out;
}

async function openScene(browser, v, sc) {
  const context = await browser.newContext({
    viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    timezoneId: sc.tz || NIGHT, locale: 'en-US', colorScheme: 'light', reducedMotion: 'no-preference',
  });
  const c = {
    v, sc, context, entries: [], blocked: [], errors: [], api: { mode: 'ok', release: null },
  };
  await context.route('https://api.anthropic.com/**', async route => {
    try {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
      if (route.request().method() !== 'POST') return await route.fulfill({ status: 204, headers: cors });
      if (c.api.mode === 'hold') await new Promise(r => { c.api.release = r; });
      if (c.api.mode === 'error') {
        return await route.fulfill({ status: 400, contentType: 'application/json', headers: cors,
          body: JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }) });
      }
      await route.fulfill({ status: 200, contentType: 'application/json', headers: cors,
        body: JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: SCRIPT }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }) });
    } catch { /* the scene closed meanwhile */ }
  });
  const page = c.page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => c.errors.push(e.message.split('\n')[0]));
  const seed = sc.seed || {};
  const replies = { ...(seed.replies || {}) };
  if (seed.update) {
    replies['CapacitorHttp.get'] = { data: { status: 200, headers: {}, data: { versionCode: 99, versionName: '1.16', url: 'https://example.invalid/anxiety-companion.apk' } } };
  }
  await page.addInitScript(seedInit, { storage: seed.storage || { 'ac-settings': PHONE }, demo: !!seed.demo, positions: seed.positions || null, replies, ttsFails: !!seed.ttsFails });
  await page.addInitScript(timersInit);
  await page.addInitScript(textZoomInit, v.text);
  if ((sc.mode || 'phone') === 'phone') {
    await page.addInitScript(FAKE_PHONE);
    await page.addInitScript(bridgeControlInit);
    await page.addInitScript(BRIDGE);
  }
  await page.addInitScript(layoutLibInit);
  return c;
}

function sceneApi(c) {
  const { page, v } = c;
  const overlay = () => page.locator('.exercise-overlay').last();
  const api = {
    page,
    server: c.api,
    wait: ms => page.waitForTimeout(ms),
    async load() {
      await page.goto(URL);
      await page.waitForSelector('.app, .completion-screen');
      await page.waitForTimeout(350);
    },
    ov: overlay,
    btn: (name, scope) => (scope || page).getByRole('button', { name, exact: true }),
    text: (t, timeout = 8000) => page.getByText(t).first().waitFor({ timeout }),
    async until(fn, arg, ms = 8000) {
      const end = Date.now() + ms;
      while (Date.now() < end) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(50); }
      throw new Error('timed out waiting for ' + String(fn).slice(0, 80));
    },
    // A tap. If something else is in the way, it is recorded and the element is clicked directly.
    async tap(loc, what) {
      try {
        await loc.click({ timeout: 4000 });
      } catch (e) {
        const msg = String(e.message).replace(/\u001b\[[0-9;]*m/g, '');
        if (/strict mode violation|resolved to 0 elements/.test(msg)) throw e;
        const lines = msg.split('\n').map(l => l.trim().replace(/^- /, ''));
        const why = lines.filter(l => /intercepts pointer events|outside of the viewport|not visible|not stable|not enabled|detached/.test(l)).pop() || lines[0];
        c.blocked.push({ target: what || String(loc).slice(0, 80), why: why.slice(0, 200) });
        await loc.evaluate(el => el.click());
      }
    },
    async tab(name) { await api.tap(page.locator('.nav-tab', { hasText: name }), `tab ${name}`); await page.waitForTimeout(250); },
    async openExercise(title) {
      await api.tab('Toolbox');
      await api.tap(page.locator('.toolbox-list .exercise-card').filter({ has: page.locator('.exercise-card-title', { hasText: title }) }).first(), title);
      await overlay().locator('.exercise-title', { hasText: title }).waitFor();
    },
    ticks: o => page.evaluate(x => Object.assign(window.__tick, x), o),
    hold: name => page.evaluate(n => window.__bridgeCtl.hold.add(n), name),
    release: name => page.evaluate(n => { window.__bridgeCtl.hold.delete(n); window.__bridgeCtl.release(n); }, name),
    phone: (fn, arg) => page.evaluate(fn, arg),

    // Screenshots of every screenful of the screen as it is now (variants a–e).
    async shot(scene, o = {}) {
      if (v.id === 'f') return;
      await page.evaluate(() => window.__lay.settle());
      const landed = await page.evaluate(() => window.__lay.landed());
      await page.evaluate(() => window.__lay.resetSeen());
      let positions;
      if (o.focus) {
        await (typeof o.focus === 'string' ? page.locator(o.focus).first() : o.focus).evaluate(el => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(80);
        positions = [null];
      } else if (o.sweep === false) positions = [null];
      else positions = await page.evaluate(x => window.__lay.plan(x), { from: o.from || null, max: MAX_SCREENS });
      const seen = new Set();
      const first = c.entries.length;
      for (let i = 0; i < positions.length; i++) {
        if (positions[i] !== null) { await page.evaluate(y => window.__lay.scrollTo(y), positions[i]); await page.waitForTimeout(70); }
        const file = `${scene}--${v.id}${i ? '-' + i : ''}.png`;
        await page.screenshot({ path: path.join(OUT, file) });
        const m = await page.evaluate(i => window.__lay.measure(i), i);
        const problems = compact(m, seen);
        if (i === 0 && landed > 0 && !o.focus && !o.from && o.sweep !== false) problems.openedScrolledDown = landed;
        if (i === 0 && c.blocked.length) { problems.tapBlocked = c.blocked.splice(0); }
        c.entries.push({ scene, variant: v.id, path: file, ...(positions.length > 1 ? { screen: `${i + 1}/${positions.length}` } : {}), problems });
      }
      const cov = await page.evaluate(() => window.__lay.coverage());
      for (const x of cov) {
        const e = c.entries[first + (x.shot === null ? 0 : Math.min(x.shot, positions.length - 1))];
        const { id, shot, ...item } = x;
        const k = item.unreachable ? 'unreachable' : item.coveredBy ? 'covered' : 'partlyHidden';
        (e.problems[k] = e.problems[k] || []).push(item);
      }
      await page.evaluate(() => window.__lay.top());
    },
    // Variant f only: the field focused and the keyboard open.
    async field(scene, loc, name) {
      if (v.id !== 'f') return;
      await loc.scrollIntoViewIfNeeded();
      await loc.focus();
      await page.setViewportSize({ width: v.w, height: v.kb });
      await page.waitForTimeout(250);
      await page.evaluate(() => { const a = document.activeElement; if (a && a.scrollIntoViewIfNeeded) a.scrollIntoViewIfNeeded(true); });
      await page.evaluate(() => window.__lay.settle());
      const file = `${scene}--f-${name}.png`;
      await page.screenshot({ path: path.join(OUT, file) });
      const m = await page.evaluate(() => window.__lay.measure(0, { focus: true }));
      const problems = compact(m, new Set());
      if (c.blocked.length) problems.tapBlocked = c.blocked.splice(0);
      c.entries.push({ scene, variant: 'f', path: file, field: name, problems });
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await page.setViewportSize({ width: v.w, height: v.h });
      await page.waitForTimeout(150);
    },
  };
  return api;
}

// ─── Scenes ─────────────────────────────────────────────────────────────────────────────────
// Each scene starts from a fresh app (its own browser context) and may capture several states.
const scenes = [];
const scene = (name, o, run) => scenes.push({ name, ...o, run });
const withKey = (extra = {}) => ({ 'ac-settings': { ...PHONE, anthropicKey: KEY, ...extra } });

scene('welcome', { seed: { storage: { 'ac-settings': { onboarded: false } } } }, async s => {
  await s.load();
  await s.shot('welcome');
});

scene('home', {}, async s => {
  await s.load();
  await s.shot('home-fresh');
});
scene('home-web', { mode: 'web', seed: { storage: { 'ac-settings': { onboarded: true } } } }, async s => {
  await s.load();
  await s.shot('home-fresh-web');
});
scene('home-history', { seed: { demo: true, update: true } }, async s => {
  await s.load();
  await s.page.locator('.update-card').waitFor({ timeout: 4000 });
  await s.shot('home-history');
});
scene('home-morning', { tz: MORNING, seed: { update: true } }, async s => {
  await s.load();
  await s.shot('home-morning');
});

scene('checkin', { fields: true }, async s => {
  await s.load();
  await s.tab('Check-In');
  await s.page.locator('.intensity-slider').fill('10');
  await s.shot('checkin-intensity');
  await s.tap(s.btn('Continue'));
  await s.text('Right now, I feel');
  await s.shot('checkin-q1');
  await s.tap(s.page.locator('.option-btn', { hasText: 'Overwhelmed or panicky' }));
  await s.text("What's showing up most?");
  await s.wait(150);
  await s.shot('checkin-q2');
  await s.tap(s.page.locator('.option-btn', { hasText: 'Harsh self-judgment or criticism' }));
  await s.text('What I need most right now');
  await s.wait(150);
  await s.shot('checkin-q3');
  await s.tap(s.page.locator('.option-btn', { hasText: 'To reconnect with what matters' }));
  await s.text("Here's what might help");
  await s.shot('checkin-results');
  await s.field('checkin-results', s.page.locator('.results-wrap textarea'), 'note');
});

scene('meditate-nokey', {}, async s => {
  await s.load();
  await s.tab('Meditate');
  await s.shot('meditate-nokey');
});
scene('meditate-key', { fields: true, seed: { storage: withKey() } }, async s => {
  await s.load();
  await s.tab('Meditate');
  await s.page.locator('#med-prompt').fill("I can't switch off after work, my chest feels tight, and I keep going over everything I said in today's meeting");
  for (const [g, b] of [['Practice', 'Stepping back from thoughts'], ['Guidance', 'More silence'], ["I'll be", 'Lying down'], ['End by bringing me', 'Ready for something hard']]) {
    await s.tap(s.page.getByRole('group', { name: g }).getByRole('button', { name: b, exact: true }), b);
  }
  await s.page.locator('#med-notes').fill('no counting breaths; mention the sea and the sound of rain on a window');
  await s.shot('meditate-key', { from: '.home-section:has(#med-prompt)' });
  await s.field('meditate-key', s.page.locator('#med-prompt'), 'prompt');
  await s.field('meditate-key', s.page.locator('#med-notes'), 'notes');
});
scene('meditate-writing', { seed: { storage: withKey() } }, async s => {
  await s.load();
  await s.tab('Meditate');
  await s.page.locator('#med-prompt').fill('Stress about work');
  s.server.mode = 'hold';
  await s.tap(s.btn('Create meditation'));
  await s.text('Writing your meditation…');
  await s.shot('meditate-writing', { focus: '.home-section:has(#med-prompt) .btn-primary' });
  if (s.server.release) s.server.release();
});
scene('meditate-error', { seed: { storage: withKey() } }, async s => {
  await s.load();
  await s.tab('Meditate');
  await s.page.locator('#med-prompt').fill('Stress about work');
  s.server.mode = 'error';
  await s.tap(s.btn('Create meditation'));
  await s.page.getByRole('alert').waitFor({ timeout: 15000 });
  await s.shot('meditate-error', { focus: '[role=alert]' });
});
scene('meditate-saved', { seed: { storage: { 'ac-settings': PHONE, 'ac-meditations': MEDITATIONS } } }, async s => {
  await s.load();
  await s.tab('Meditate');
  await s.shot('meditate-saved', { from: '.home-section:has(.saved-med-remove)' });
  await s.tap(s.page.locator('.saved-med-remove').first(), 'Delete (first saved meditation)');
  await s.page.locator('.saved-med-confirm').waitFor();
  await s.shot('meditate-delete-confirm', { focus: '.saved-med-confirm' });
  await s.tap(s.btn('Keep'));
  await s.phone(() => { window.__phone.config.lineMs = 1e8; });
  await s.tap(s.page.locator('.saved-med-main', { hasText: 'A Gentle Practice' }), 'long-titled meditation');
  await s.until(() => window.__phone.session && window.__phone.session.status === 'playing');
  await s.wait(300);
  await s.shot('player-long-title');
});

// The player, with the phone playing the meditation (natural voice).
scene('player', {}, async s => {
  await s.load();
  await s.tab('Meditate');
  await s.phone(() => { window.__phone.config.lineMs = 1e8; });
  await s.hold('NeuralVoice.startSession');
  await s.tap(s.page.locator('.saved-med-main', { hasText: 'Before a Hard Moment' }), 'Before a Hard Moment');
  await s.text('Preparing the voice');
  await s.shot('player-preparing');
  await s.release('NeuralVoice.startSession');
  await s.until(() => window.__phone.session && window.__phone.session.status === 'playing');
  // the longest sentence of this meditation on screen
  await s.phone(() => {
    const lines = window.__phone.last('NeuralVoice.startSession').options.lines;
    let at = 0;
    lines.forEach((l, i) => { if (l.text.length > lines[at].text.length) at = i; });
    window.__phone.session.seek(at);
  });
  await s.wait(500);
  await s.shot('player-playing');
  await s.tap(s.btn('Pause'));
  await s.page.locator('.player-voice', { hasText: 'Paused' }).waitFor();
  await s.shot('player-paused');
  await s.tap(s.btn('Resume'));
  await s.until(() => window.__phone.session && window.__phone.session.status === 'playing');
  await s.page.evaluate(() => { window.__holdScrub = true; });
  const seek = s.page.locator('.player-seek');
  const max = Number(await seek.getAttribute('max'));
  await seek.fill(String(Math.round(max * 0.6)));
  await s.shot('player-scrubbing', { focus: '.player-seek' });
  await s.page.evaluate(() => { window.__holdScrub = false; });
  await seek.fill(String(Math.round(max * 0.6) + 1));
  await s.wait(500);
  await s.phone(() => window.__phone.session.seek(999));
  await s.text('Welcome back.');
  await s.shot('player-done');
});
scene('player-resumed', { seed: { positions: { 'starter-leaves': 6 } } }, async s => {
  await s.load();
  await s.tab('Meditate');
  await s.phone(() => { window.__phone.config.lineMs = 1e8; });
  await s.tap(s.page.locator('.saved-med-main', { hasText: 'Leaves on a Stream' }), 'Leaves on a Stream');
  await s.page.locator('.player-resumed').waitFor();
  await s.until(() => window.__phone.session && window.__phone.session.status === 'playing');
  await s.wait(300);
  await s.shot('player-resumed');
});
scene('player-error', { mode: 'web', seed: { storage: { 'ac-settings': { onboarded: true } }, ttsFails: true } }, async s => {
  await s.load();
  await s.tab('Meditate');
  await s.tap(s.page.locator('.saved-med-main', { hasText: 'Panic, Right Now' }), 'Panic, Right Now');
  await s.text("The voice couldn't start", 15000);
  await s.shot('player-error');
});

// Voice & sounds
scene('voice', { seed: { storage: { 'ac-settings': { ...PHONE, sounds: { rain: { on: true, volume: 0.5 }, bowls: { on: true, volume: 0.8 } } } } } }, async s => {
  await s.load();
  await s.tab('Meditate');
  await s.tap(s.page.locator('.voice-card'), 'Voice & sounds card');
  await s.page.locator('.voice-panel').waitFor();
  await s.page.locator('.voice-panel .voice-pick').first().waitFor();
  await s.shot('voice');
  await s.hold('NeuralVoice.play');
  await s.tap(s.page.locator('.voice-panel .voice-pick').filter({ has: s.page.locator('.voice-name', { hasText: /^(✓ )?Clara$/ }) }), 'Clara');
  await s.page.getByRole('button', { name: 'Stop the Clara sample' }).waitFor();
  await s.page.locator('.voice-panel [role=status]').waitFor();
  await s.shot('voice-sample', { focus: '.voice-panel .voice-row.selected' });
  await s.shot('voice-sample-note', { focus: '.voice-panel [role=status]' });
  await s.shot('voice-sample-stop', { focus: '.voice-panel .btn-outline' });
});
scene('voice-from-player', {}, async s => {
  await s.load();
  await s.tab('Meditate');
  await s.phone(() => { window.__phone.config.lineMs = 1e8; });
  await s.tap(s.page.locator('.saved-med-main', { hasText: 'Panic, Right Now' }), 'Panic, Right Now');
  await s.until(() => window.__phone.session && window.__phone.session.status === 'playing');
  await s.tap(s.page.locator('.player-voice-btn'), 'Voice & sounds (player)');
  await s.page.locator('.voice-panel').waitFor();
  await s.shot('voice-from-player', { sweep: false });
});
scene('voice-web', { mode: 'web', seed: { storage: { 'ac-settings': { onboarded: true } } } }, async s => {
  await s.load();
  await s.tab('Meditate');
  await s.tap(s.page.locator('.voice-card'), 'Voice & sounds card');
  await s.page.locator('.voice-panel').waitFor();
  await s.wait(300);
  await s.shot('voice-web');
});

scene('toolbox', {}, async s => {
  await s.load();
  await s.tab('Toolbox');
  await s.shot('toolbox');
  await s.tap(s.page.locator('.filter-chip', { hasText: 'Mindful' }), 'filter Mindful');
  await s.wait(200);
  await s.shot('toolbox-filter', { sweep: false });
});

// Every exercise in src/data/exercises.ts, through its states.
const EXERCISES = [
  ['box-breathing', 'Box Breathing', false, async s => {
    await s.shot('ex-box-breathing');
    await s.tap(s.btn('Begin', s.ov()));
    await s.wait(2600);
    await s.ticks({ frozen: true });
    await s.shot('ex-box-breathing-running');
    await s.ticks({ frozen: false, scale: 20 });
    await s.text('Nicely done.', 20000);
    await s.ticks({ scale: 1 });
    await s.shot('ex-box-breathing-done');
  }],
  ['physiological-sigh', 'Physiological Sigh', false, async s => {
    await s.shot('ex-physiological-sigh');
    await s.tap(s.btn('Begin', s.ov()));
    await s.wait(1300);
    await s.ticks({ frozen: true });
    await s.shot('ex-physiological-sigh-running');
  }],
  ['4-7-8', '4-7-8 Breathing', false, async s => {
    await s.shot('ex-4-7-8');
    await s.tap(s.btn('Begin', s.ov()));
    await s.ticks({ scale: 10 });
    await s.ov().locator('.breathing-phase-label', { hasText: 'Breathe out slowly' }).waitFor();
    await s.ticks({ frozen: true, scale: 1 });
    await s.wait(1500);
    await s.shot('ex-4-7-8-running');
  }],
  ['5-4-3-2-1', '5-4-3-2-1 Grounding', true, async s => {
    await s.shot('ex-5-4-3-2-1');
    await s.field('ex-5-4-3-2-1', s.ov().locator('.sense-input').first(), 'first-item');
    const inputs = s.ov().locator('.sense-input');
    await inputs.nth(0).fill('The lamp on the bedside table, still switched on');
    await inputs.nth(5).fill('My feet pressing into the cold kitchen floor tiles');
    for (const i of [1, 2, 6]) await s.tap(s.ov().locator('.sense-check').nth(i), `sense check ${i}`);
    await s.shot('ex-5-4-3-2-1-progress', { sweep: false, focus: s.ov().locator('.sense-block').first() });
    await s.field('ex-5-4-3-2-1-progress', inputs.nth(14), 'last-item');
    await s.tap(s.ov().getByRole('button', { name: /^(Finish|Complete grounding)$/ }), 'Finish');
    await s.text("You're here.");
    await s.shot('ex-5-4-3-2-1-done');
  }],
  ['body-scan', 'Brief Body Scan', false, async s => {
    await s.shot('ex-body-scan');
    await s.tap(s.btn('Begin body scan', s.ov()));
    for (let i = 0; i < 2; i++) await s.tap(s.btn('Continue', s.ov()));
    await s.text('Chest & shoulders');
    await s.shot('ex-body-scan-region');
    for (let i = 0; i < 4; i++) await s.tap(s.btn('Continue', s.ov()));
    await s.tap(s.btn('Complete scan', s.ov()));
    await s.text('Well done.');
    await s.shot('ex-body-scan-done');
  }],
  ['leaves-on-stream', 'Leaves on a Stream', true, async s => {
    await s.shot('ex-leaves-on-stream');
    const input = s.ov().locator('.thought-input');
    await s.field('ex-leaves-on-stream', input, 'thought');
    for (const t of ['I will mess this up', 'Everyone noticed how nervous I was in the meeting this morning', 'What if']) {
      await input.fill(t);
      await s.tap(s.ov().getByRole('button', { name: 'Add leaf' }), 'Add leaf');
      await s.wait(500);
    }
    await s.wait(1200);
    await s.shot('ex-leaves-on-stream-leaves');
    await s.tap(s.btn('Complete practice', s.ov()));
    await s.text('Well practiced.');
    await s.shot('ex-leaves-on-stream-done');
  }],
  ['thought-labeling', 'Thought Labeling', true, async s => {
    await s.shot('ex-thought-labeling');
    const input = s.ov().locator('.label-input');
    await s.field('ex-thought-labeling', input, 'thought');
    await input.fill('I am going to say something stupid in the meeting and everyone will realise I do not belong there');
    await s.tap(s.btn('Notice it', s.ov()));
    await s.text('Step 1');
    await s.shot('ex-thought-labeling-noticed');
    await s.tap(s.ov().getByRole('button', { name: /^Finish/ }), 'Finish (1 noticed)');
    await s.text('Nicely done.');
    await s.shot('ex-thought-labeling-done');
  }],
  ['name-the-story', 'Name the Story', true, async s => {
    await s.shot('ex-name-the-story');
    const input = s.ov().locator('.label-input');
    await s.field('ex-name-the-story', input, 'story');
    await input.fill("The I'm not good enough and everyone will find out");
    await s.shot('ex-name-the-story-phrase');
    await s.tap(s.btn('I practiced the phrase', s.ov()));
    await s.shot('ex-name-the-story-practiced');
  }],
  ['dare-response', 'Make Room', true, async s => {
    await s.shot('ex-make-room');
    await s.field('ex-make-room', s.ov().locator('.step-reflection'), 'reflection');
    await s.ov().locator('.step-reflection').fill('My mind keeps saying I will panic on the train and not be able to get off.');
    await s.tap(s.ov().getByRole('button', { name: /^Next: Allow/ }), 'Next: Allow');
    await s.tap(s.ov().getByRole('button', { name: /^Next: Turn toward/ }), 'Next: Turn toward');
    await s.shot('ex-make-room-turn-toward');
    await s.tap(s.ov().getByRole('button', { name: /^Next: Engage/ }), 'Next: Engage');
    await s.tap(s.btn('Complete', s.ov()));
    await s.text('You faced it.');
    await s.shot('ex-make-room-done');
  }],
  ['soften-allow', 'Soften and Allow', true, async s => {
    const input = s.ov().locator('.label-input');
    await s.shot('ex-soften-allow');
    await s.field('ex-soften-allow', input, 'where');
    await input.fill('A tight band right across my chest and up into my throat');
    await s.tap(s.btn('I found it', s.ov()));
    await s.text('Describe it');
    await s.shot('ex-soften-allow-describe');
    await s.field('ex-soften-allow-describe', input, 'describe');
    await input.fill('Heavy, grey, about the size of a fist, pulsing');
    await s.tap(s.btn('Continue', s.ov()));
    await s.text('Breathe space around it');
    await s.shot('ex-soften-allow-soften');
    await s.tap(s.btn("I've taken 3 breaths", s.ov()));
    await s.text('Allow it to be here');
    await s.shot('ex-soften-allow-allow');
    await s.tap(s.btn('Complete practice', s.ov()));
    await s.text('Opening, not closing.');
    await s.shot('ex-soften-allow-done');
  }],
  ['values-compass', 'Values Compass', true, async s => {
    for (const d of ['Relationships', 'Personal Growth', 'Meaning & Spirit']) await s.tap(s.ov().locator('.domain-card', { hasText: d }), d);
    await s.shot('ex-values-compass');
    await s.tap(s.ov().getByRole('button', { name: /^Continue with/ }), 'Continue with 3 areas');
    await s.text('Set an intention');
    await s.shot('ex-values-compass-intend');
    const inputs = s.ov().locator('.intention-input');
    await s.field('ex-values-compass-intend', inputs.first(), 'intention');
    await inputs.nth(0).fill('I want to listen properly to the people I love, even when I am tired');
    await inputs.nth(1).fill('Keep learning, slowly, without comparing myself to anyone');
    await inputs.nth(2).fill('Notice small good things');
    await s.tap(s.btn('Set my compass', s.ov()));
    await s.text('Compass set.');
    await s.shot('ex-values-compass-done');
  }],
  ['observer-self', 'The Observer Self', false, async s => {
    await s.shot('ex-observer-self');
    for (let i = 0; i < 3; i++) await s.tap(s.btn('Continue', s.ov()));
    await s.wait(400);
    await s.shot('ex-observer-self-slide4');
    for (let i = 0; i < 3; i++) await s.tap(s.btn('Continue', s.ov()));
    await s.tap(s.btn('Complete', s.ov()));
    await s.text('The sky remains.');
    await s.shot('ex-observer-self-done');
  }],
  ['present-moment', 'Coming Back to Now', true, async s => {
    await s.shot('ex-present-moment');
    const t = s.ov().locator('.anchor-textarea');
    await s.field('ex-present-moment', t.first(), 'doing');
    await t.nth(0).fill('Lying in bed with the light off, phone in my hand');
    await t.nth(1).fill('Heart beating fast, the fridge humming, cold feet');
    await t.nth(2).fill('Be gentle with myself and put the phone down');
    await s.tap(s.btn('Anchor complete', s.ov()));
    await s.text("You're here.");
    await s.shot('ex-present-moment-done');
  }],
  ['one-small-step', 'One Small Step', true, async s => {
    await s.shot('ex-one-small-step');
    const t = s.ov().locator('.form-textarea');
    await s.field('ex-one-small-step', t.first(), 'blocking');
    await t.nth(0).fill('Calling the clinic to book the appointment I keep putting off');
    await t.nth(1).fill('Because I value looking after my health so I can be there for my family');
    await t.nth(2).fill('Write down what I want to say, then call before 10am');
    await s.ov().locator('.form-input').fill('Tomorrow at 9:30, at the kitchen table, before checking email');
    await s.field('ex-one-small-step', s.ov().locator('.form-input'), 'when');
    await s.tap(s.btn('I commit to this step', s.ov()));
    await s.text('A step forward.');
    await s.shot('ex-one-small-step-done');
  }],
];
for (const [id, title, fields, run] of EXERCISES) {
  scene(`ex-${id}`, { fields }, async s => {
    await s.load();
    await s.openExercise(title);
    await run(s);
  });
}

// SOS
scene('sos', {}, async s => {
  await s.load();
  await s.tap(s.page.locator('.sos-fab'), 'SOS button');
  await s.text('This feeling will pass.');
  await s.wait(1400);
  await s.ticks({ frozen: true });
  await s.shot('sos-breathe');
  await s.ticks({ frozen: false });
  await s.tap(s.btn('Skip breathing', s.ov()));
  for (const n of [5, 4, 3, 2, 1]) {
    await s.page.locator('.sos-step-num', { hasText: String(n) }).waitFor();
    await s.shot(`sos-ground-${n}`);
    if (n > 1) await s.tap(s.btn('Next', s.ov()));
  }
  await s.tap(s.btn('Skip grounding', s.ov()));
  await s.text('Make room for it');
  await s.shot('sos-accept');
  await s.tap(s.btn('Continue', s.ov()));
  await s.text('How are you now?');
  await s.shot('sos-after');
  await s.tap(s.ov().locator('.option-btn', { hasText: 'A little calmer' }));
  await s.text('You rode the wave.');
  await s.shot('sos-calmer');
});
scene('sos-support', {}, async s => {
  await s.load();
  await s.tap(s.page.locator('.sos-fab'), 'SOS button');
  await s.tap(s.btn('Get help', s.ov()));
  await s.text("You don't have to do this alone");
  await s.shot('sos-support');
});
scene('sos-support-contact', { seed: { storage: { 'ac-settings': { ...PHONE, ...CONTACT } } } }, async s => {
  await s.load();
  await s.tap(s.page.locator('.sos-fab'), 'SOS button');
  await s.tap(s.btn('Get help', s.ov()));
  await s.text("You don't have to do this alone");
  await s.shot('sos-support-contact', { sweep: false });
});

// Settings
const openSettings = async s => {
  await s.tap(s.page.getByRole('button', { name: 'Settings', exact: true }), 'Settings (gear)');
  await s.page.locator('.exercise-title', { hasText: 'Settings' }).waitFor();
  await s.wait(300);
};
scene('settings', { fields: true, seed: { update: true, storage: withKey({ ...CONTACT, reminderEnabled: true, reminderTime: '21:30' }) } }, async s => {
  await s.load();
  await openSettings(s);
  await s.shot('settings');
  await s.field('settings', s.page.locator('#api-key'), 'api-key');
  await s.field('settings', s.page.getByPlaceholder('Name', { exact: true }), 'contact-name');
  await s.field('settings', s.page.getByPlaceholder('Phone number'), 'contact-phone');
  await s.tap(s.btn('Delete all my data'));
  await s.page.locator('.delete-confirm').waitFor();
  await s.shot('settings-delete-confirm', { focus: '.delete-confirm' });
});
scene('settings-from-key', {}, async s => {
  await s.load();
  await s.tab('Meditate');
  await s.tap(s.btn('Add API key'));
  await s.page.locator('#api-key').waitFor();
  await s.wait(400);
  await s.shot('settings-from-key', { sweep: false });
});
scene('settings-denied', { seed: { replies: { 'LocalNotifications.checkPermissions': { data: { display: 'denied' } }, 'LocalNotifications.requestPermissions': { data: { display: 'denied' } } } } }, async s => {
  await s.load();
  await openSettings(s);
  await s.tap(s.page.getByRole('switch', { name: 'Daily reminder' }), 'reminder switch');
  await s.text('Notifications are blocked');
  await s.shot('settings-reminder-denied', { sweep: false });
});
scene('settings-web', { mode: 'web', seed: { storage: { 'ac-settings': { onboarded: true } } } }, async s => {
  await s.load();
  await openSettings(s);
  await s.shot('settings-web', { sweep: false });
});

scene('history', { seed: { demo: true } }, async s => {
  await s.load();
  await s.tap(s.btn('View check-in history'));
  await s.text('Check-in history');
  await s.wait(300);
  await s.shot('history');
});

// Saved settings the app cannot render (sounds: null) make it fall back to the error screen.
scene('error-boundary', { mode: 'web', seed: { storage: { 'ac-settings': { onboarded: true, sounds: null } } } }, async s => {
  await s.load();
  await s.text('Something went wrong');
  await s.shot('error-boundary');
});

// ─── Run ────────────────────────────────────────────────────────────────────────────────────
async function runVariant(browser, v) {
  const shots = [];
  for (const sc of scenes) {
    if (ONLY && !ONLY.test(sc.name)) continue;
    if (v.id === 'f' && !sc.fields) continue;
    let c;
    try {
      c = await openScene(browser, v, sc);
      await sc.run(sceneApi(c));
      if (c.blocked.length && c.entries.length) {
        const last = c.entries[c.entries.length - 1];
        last.problems.tapBlocked = [...(last.problems.tapBlocked || []), ...c.blocked];
      }
    } catch (e) {
      manifest.notReached.push({ scene: sc.name, variant: v.id, error: String(e.message).split('\n')[0].slice(0, 300) });
    } finally {
      if (c) {
        shots.push(...c.entries);
        for (const err of c.errors) manifest.pageErrors.push({ scene: sc.name, variant: v.id, error: err.slice(0, 200) });
        if (!manifest.variants[v.id].textCheck && v.text !== 1) {
          manifest.variants[v.id].textCheck = await c.page.evaluate(() => {
            const fs = sel => { const e = document.querySelector(sel); return e ? getComputedStyle(e).fontSize : null; };
            return { body: fs('body'), navTab: fs('.nav-tab'), passes: window.__tzPasses ? window.__tzPasses() : 0 };
          }).catch(() => null);
        }
        await c.context.close().catch(() => {});
      }
    }
    process.stdout.write(`${v.id}:${sc.name} `);
  }
  return shots;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/\.(png|json)$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  for (const v of VARIANTS) manifest.variants[v.id] = { label: v.label, viewport: `${v.w}x${v.h}`, textScale: v.text, ...(v.kb ? { keyboardViewport: `${v.w}x${v.kb}` } : {}) };
  manifest.notes.push(
    `Home shows the time of day; it was night (local time 23:00-05:00) in every scene except home-morning (time zones ${NIGHT} / ${MORNING}).`,
    'Variants d and e multiply every element\'s computed font size and fixed line height, the way Android WebView text zoom does; nothing else (padding, widths, icons) changes.',
    'Variant f: the field was focused at 360x640, the viewport then made 340 high and the field scrolled into view if needed (as Chrome does on Android when the keyboard opens).',
    'Problems are listed on the screenful where they first appear in a scene (a later screenful repeats only new ones). "small", "contrast": n = count on that screenful, names = examples. ' +
      '"covered"/"unreachable"/"partlyHidden" come from scrolling each control to the centre of its scroll container and hit-testing its centre (C) and corners.',
    'Screens run against tests/phone/fake-phone.js (the Android build) unless the scene name ends in -web; player-error and error-boundary use the web build too.',
    'Emulated as a touch phone (isMobile, hasTouch: hover none, pointer coarse, overlay scrollbars), deviceScaleFactor 1, locale en-US.',
    'Variant f assumes the web view is resized when the keyboard opens (adjustResize, or Capacitor\'s edge-to-edge margins following the keyboard inset); if the keyboard overlaps the web view instead, more is hidden.',
    '"openedScrolledDown": the screen (a new step or result) appeared already scrolled by that many px, after the previous step\'s button was scrolled into view and tapped.',
    '"tapBlocked": a tap on that control did not reach it within 4 s (another element intercepted it, or it could not be scrolled into view); the script then clicked it directly.',
    '"sidewaysScroll": a screen that scrolls vertically has become wider than the phone and pans sideways; pannedBy = how far it was panned in that screenshot (after a control off to the side was tapped). Controls inside it are not listed under cutOff.',
  );
  const browser = await chromium.launch();
  const t0 = Date.now();
  const results = await Promise.all(VARIANTS.map(v => runVariant(browser, v)));
  await browser.close();
  // Scenes in the order they were captured, each with its variants side by side.
  const order = new Map();
  for (const list of results) for (const e of list) if (!order.has(e.scene)) order.set(e.scene, order.size);
  manifest.shots = results.flat().sort((x, y) => order.get(x.scene) - order.get(y.scene) || (x.variant < y.variant ? -1 : x.variant > y.variant ? 1 : 0));
  manifest.counts = { screenshots: manifest.shots.length, scenes: new Set(manifest.shots.map(s => s.scene)).size, seconds: Math.round((Date.now() - t0) / 1000) };
  const tally = {};
  for (const s of manifest.shots) for (const k of Object.keys(s.problems)) { tally[k] = tally[k] || {}; tally[k][s.variant] = (tally[k][s.variant] || 0) + 1; }
  manifest.problemCounts = { about: 'number of screenshots showing each kind of problem, per variant', ...tally };
  // One screenshot per line: compact, and easy to grep.
  const { shots, ...head } = manifest;
  const text = JSON.stringify(head, null, 1).replace(/\n}$/, ',\n "shots": [\n' + shots.map(x => '  ' + JSON.stringify(x)).join(',\n') + '\n ]\n}\n');
  JSON.parse(text);
  fs.writeFileSync(path.join(OUT, 'manifest.json'), text);
  console.log(`\n${manifest.shots.length} screenshots of ${manifest.counts.scenes} scenes in ${manifest.counts.seconds}s -> ${OUT}`);
  if (manifest.notReached.length) console.log('NOT REACHED:\n' + manifest.notReached.map(n => `  ${n.variant} ${n.scene}: ${n.error}`).join('\n'));
  if (manifest.pageErrors.length) console.log(`page errors: ${manifest.pageErrors.length}`);
  process.exit(manifest.notReached.length ? 1 : 0);
})().catch(e => { console.error('CAPTURE CRASHED', e); process.exit(2); });
