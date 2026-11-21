const { chromium } = require('playwright');
const fs = require('fs');
// The tab screens and what they show of the person's own words:
// - typing on a tab: the bottom bar and the round SOS button step aside while the keyboard is up,
//   and the field and its button are in view; they come back when the keyboard is put away;
// - the person's own words (a link, an e-mail address) stay inside their cards at 320 wide;
// - meditations say in full when to use them, the person's own requests show three lines and
//   'Show more', and Delete/Keep get their own line; the person's own meditations come straight
//   after 'For right now' (the three newest, 'Show all'); the Voice & sounds card lines up;
// - Home: the featured practice before the update notice, whose link is only 'Update'; a week with
//   no check-ins says so and offers one;
// - Check-in history: by month, with a summary, 60 at a time;
// - words readable (4.5:1), targets big enough, every control a button, every field named.
// Screenshots go to the folder given as the first argument, or to the system's temp folder.
const OUT = process.argv[2] || require('os').tmpdir();
const URL = process.env.APP_URL || 'http://localhost:4173/';
const ROOT = __dirname + '/../..';
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);

const day = 86400000;
const checkin = (msAgo, level, extra = {}) => {
  const at = new Date(Date.now() - msAgo);
  return { id: String(at.getTime()), at: at.toISOString(), level, feeling: 'Caught in anxious thoughts', focus: ['defusion', 'grounding'], ...extra };
};
const URL_NOTE = 'notes-from-therapist:https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefgh/edit?usp=sharing';
const EMAIL = 'appointments@greenfieldmedicalpractice.co.uk';
const meditation = (i, extra = {}) => ({
  id: `17900000000${String(i).padStart(2, '0')}`, title: `My meditation ${i}`, prompt: 'Stress about work', minutes: 5,
  createdAt: new Date(Date.UTC(2026, 10, i)).toISOString(), segments: [{ text: 'Let yourself settle.', pause: 3 }], ...extra,
});
const LONG_PROMPT = 'I keep replaying the conversation I need to have with my manager tomorrow morning about how much work I have been given since my colleague left. ' +
  'Every time I try to fall asleep my chest gets tight and I start rehearsing what I will say, then imagining every way it could go wrong.';

async function open(browser, { w = 360, h = 640, storage = {}, phone = false, update = false } = {}, errors) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(storage => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear();
      localStorage.setItem('ac-settings', JSON.stringify({ onboarded: true }));
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, JSON.stringify(v));
      sessionStorage.setItem('seeded', '1');
    }
    // Android's text size: every font size and fixed line height multiplied, once.
    const orig = new WeakMap();
    window.__zoom = k => {
      const els = [...document.querySelectorAll('body, body *')].filter(e => !(e instanceof SVGElement));
      for (const e of els) {
        if (!orig.has(e)) orig.set(e, [e.style.fontSize, e.style.lineHeight]);
        const [fs, lh] = orig.get(e);
        e.style.fontSize = fs;
        e.style.lineHeight = lh;
      }
      const natural = els.map(e => { const s = getComputedStyle(e); return [parseFloat(s.fontSize), s.lineHeight]; });
      els.forEach((e, i) => {
        const [fs, lh] = natural[i];
        e.style.fontSize = `${fs * k}px`;
        if (/px$/.test(lh)) e.style.lineHeight = `${parseFloat(lh) * k}px`;
      });
    };
  }, storage);
  if (phone) {
    await page.addInitScript(fs.readFileSync(ROOT + '/tests/phone/fake-phone.js', 'utf8'));
    if (update) {
      // The update check's reply: a newer version.
      await page.addInitScript(() => {
        const fake = window.androidBridge;
        window.androidBridge = {
          postMessage(json) {
            const c = JSON.parse(json);
            if (`${c.pluginId}.${c.methodName}` !== 'CapacitorHttp.get') return fake.postMessage(json);
            const data = { status: 200, headers: {}, data: { versionCode: 99, versionName: '1.16', url: 'https://example.invalid/anxiety-companion.apk' } };
            setTimeout(() => window.Capacitor.fromNative({ callbackId: c.callbackId, pluginId: c.pluginId, methodName: c.methodName, success: true, data }), 0);
          },
        };
      });
    }
    await page.addInitScript(fs.readFileSync(ROOT + '/node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js', 'utf8'));
  }
  await page.goto(URL);
  await page.locator('.nav').waitFor();
  return page;
}

const tab = (page, name) => page.getByRole('button', { name, exact: true }).click();
const zoom = async (page, k) => { await page.evaluate(k => window.__zoom(k), k); await page.waitForTimeout(100); };
const shown = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; }, sel);

// Where an element is, against the screen.
const rect = (page, sel) => page.evaluate(sel => {
  const e = typeof sel === 'string' ? document.querySelector(sel) : null;
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height), vh: innerHeight, vw: innerWidth };
}, sel);

// The keyboard opening: the web view gets shorter. Then the app's own scroll has a frame to run.
async function keyboard(page, up) {
  await page.setViewportSize({ width: 360, height: up ? 340 : 640 });
  await page.waitForTimeout(250);
}

// Contrast of each element's own words against the solid colours behind it (WCAG ratio).
const lowContrast = page => page.evaluate(() => {
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const over = (a, b) => [0, 1, 2].map(i => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el instanceof SVGElement || el.closest('svg')) continue;
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    if (!/[A-Za-z0-9]/.test(own)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.bottom < 0 || r.top > innerHeight) continue;
    if (el.closest('[disabled], .sos-step-num, .sos-fab')) continue; // disabled controls are exempt; the SOS colours are their own pass's
    let fg = parse(getComputedStyle(el).color), bg = [255, 255, 255, 1], layers = [], image = false, alpha = 1;
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      alpha *= parseFloat(s.opacity);
      if (s.backgroundImage !== 'none') { image = true; break; }
      const b = parse(s.backgroundColor);
      if (b && b[3] > 0) { layers.push(b); if (b[3] >= 0.999) break; }
    }
    if (image) continue;
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    fg = over([fg[0], fg[1], fg[2], fg[3] * alpha], bg);
    const x = lum(fg), y = lum(bg);
    const ratio = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    const px = parseFloat(getComputedStyle(el).fontSize), bold = parseInt(getComputedStyle(el).fontWeight, 10) >= 700;
    const need = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5;
    if (ratio < need) out.push(`${el.className || el.tagName} "${own.slice(0, 24)}" ${ratio.toFixed(2)}`);
  }
  return [...new Set(out)];
});

// Fields and clickable things on the screen as it is now.
const fieldsWithoutName = page => page.evaluate(() => [...document.querySelectorAll('input, textarea')]
  .filter(e => e.type !== 'hidden' && e.getClientRects().length)
  .filter(e => !(e.labels && e.labels.length) && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby'))
  .map(e => e.placeholder || e.className));

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // ── Typing on a tab: the bar and the SOS button step aside while the keyboard is up
  {
    const page = await open(browser, {}, errors);
    await tab(page, 'Check-In');
    await page.getByRole('button', { name: 'Continue' }).click();
    for (const t of ['Caught in anxious thoughts', 'Racing or looping thoughts', 'To get distance from my thoughts']) {
      await page.getByText(t).click();
      await page.waitForTimeout(350);
    }
    await page.getByText("Here's what might help").waitFor();
    const note = page.locator('.results-wrap textarea');
    // Tapped while in the middle of the screen, the natural place to tap.
    await note.evaluate(el => { const sc = el.closest('.screen'); sc.scrollTop += el.getBoundingClientRect().top - 250; });
    await note.tap();
    await page.waitForTimeout(100);
    check('focusing the note hides the bar and the SOS button', !(await shown(page, '.nav')) && !(await shown(page, '.sos-fab')));
    await keyboard(page, true);
    await note.fill('Big meeting this afternoon');
    const n = await rect(page, '.results-wrap textarea'), save = await rect(page, '.results-wrap .btn-secondary');
    check('with the keyboard up, the note and Save note are in view', n.top >= 0 && n.bottom <= n.vh && save.top >= 0 && save.bottom <= save.vh, { note: n, save });
    await page.screenshot({ path: `${OUT}/t01-checkin-note-keyboard.png` });
    await keyboard(page, false);
    check('putting the keyboard away (the field still focused) brings them back', await shown(page, '.nav') && await shown(page, '.sos-fab'));
    await keyboard(page, true);
    check('the keyboard up again hides them again', !(await shown(page, '.nav')) && !(await shown(page, '.sos-fab')));
    await page.locator('.results-title').click();
    await keyboard(page, false);
    check('leaving the field brings them back', await shown(page, '.nav') && await shown(page, '.sos-fab'));
    // The level slider is an input that opens no keyboard.
    await page.getByRole('button', { name: 'Take the check-in again' }).click();
    await page.locator('.intensity-slider').focus();
    check('the level slider leaves the bar and SOS in place', await shown(page, '.nav') && await shown(page, '.sos-fab'));
    await page.close();
  }
  {
    const page = await open(browser, { storage: { 'ac-settings': { onboarded: true, anthropicKey: 'sk-ant-test' } } }, errors);
    await tab(page, 'Meditate');
    for (const [sel, what] of [['#med-prompt', 'prompt'], ['#med-notes', 'notes']]) {
      const f = page.locator(sel);
      await f.evaluate(el => { const sc = el.closest('.screen'); sc.scrollTop += el.getBoundingClientRect().top - 280; });
      await f.tap();
      await keyboard(page, true);
      await f.fill(what === 'prompt' ? 'Stress about work' : 'mention the sea');
      const r = await rect(page, sel);
      const end = what === 'notes' ? await rect(page, '.home-section:has(#med-prompt) .btn-primary') : r;
      check(`Meditate ${what}: in view above the keyboard, bar and SOS out of the way`,
        r.top >= 0 && r.bottom <= r.vh && end.bottom <= end.vh && !(await shown(page, '.nav')) && !(await shown(page, '.sos-fab')), { field: r, button: end });
      if (what === 'notes') await page.screenshot({ path: `${OUT}/t02-meditate-notes-keyboard.png` });
      await page.locator('.toolbox-title').click();
      await keyboard(page, false);
    }
    check('back on the bar after typing', await shown(page, '.nav') && await shown(page, '.sos-fab'));
    const chips = await page.evaluate(() => [...document.querySelectorAll('.chip')].map(e => Math.round(e.getBoundingClientRect().height)));
    check('Meditate chips are 44px tall or more', chips.length > 10 && Math.min(...chips) >= 44, Math.min(...chips));
    await page.close();
  }

  // ── The person's own words stay inside their cards, 320 wide
  {
    const checkins = [checkin(2 * 3600e3, 6, { note: URL_NOTE }), checkin(day, 4, { note: `Email ${EMAIL} about Tuesday` })];
    const page = await open(browser, { w: 320, storage: { 'ac-checkins': checkins } }, errors);
    await page.getByRole('button', { name: 'View check-in history' }).click();
    await page.locator('.history-note').first().waitFor();
    const spill = await page.evaluate(() => [...document.querySelectorAll('.history-item')].map(c => c.scrollWidth - c.clientWidth).filter(x => x > 0));
    check('a link and an address in check-in notes stay inside their cards', spill.length === 0, spill);
    await page.screenshot({ path: `${OUT}/t03-history-link-320.png` });
    await page.close();
  }
  {
    const page = await open(browser, { w: 320 }, errors);
    await tab(page, 'Toolbox');
    await page.locator('.exercise-card', { hasText: 'One Small Step' }).click();
    await page.locator('#oss-step').fill(`Email ${EMAIL} and ask for a Tuesday slot`);
    await page.locator('#oss-when').fill(`Today, then forward it to ${EMAIL}`);
    await page.getByRole('button', { name: 'I commit to this step' }).click();
    await page.getByText('A step forward.').waitFor();
    const sc = await page.evaluate(() => { const s = document.querySelector('.exercise-modal .exercise-scroll'); return { sw: s.scrollWidth, cw: s.clientWidth }; });
    check('One Small Step: an e-mail address in the step wraps inside its card, nothing pans sideways', sc.sw <= sc.cw, sc);
    await page.screenshot({ path: `${OUT}/t04-one-small-step-email-320.png` });
    await page.getByRole('button', { name: 'Close exercise' }).click();
    await page.locator('.exercise-card', { hasText: 'Values Compass' }).click();
    await page.locator('.domain-card', { hasText: 'Health' }).click();
    await page.getByRole('button', { name: /^Continue with/ }).click();
    await page.getByLabel(/Health/).fill(`Book the check-up: ${EMAIL}`);
    await page.getByRole('button', { name: 'Set my compass' }).click();
    await page.getByText('Compass set.').waitFor();
    const msg = await page.evaluate(() => {
      const m = document.querySelector('.completion-msg'), col = m.parentElement.getBoundingClientRect(), r = m.getBoundingClientRect();
      const s = document.querySelector('.exercise-modal .exercise-scroll');
      return { left: Math.round(r.left), right: Math.round(r.right), colLeft: Math.round(col.left), colRight: Math.round(col.right), sw: s.scrollWidth, cw: s.clientWidth };
    });
    check('Values Compass: an address in an intention stays inside its column', msg.left >= msg.colLeft && msg.right <= msg.colRight && msg.sw <= msg.cw, msg);
    await page.close();
  }

  // ── Meditate: descriptions in full, the person's own near the top, the voice card lined up
  {
    const saved = Array.from({ length: 12 }, (_, i) => meditation(i + 1));
    saved[11] = meditation(12, { title: 'Before a Difficult Conversation', prompt: LONG_PROMPT });
    const page = await open(browser, { storage: { 'ac-meditations': saved } }, errors);
    await tab(page, 'Meditate');
    const vc = await page.evaluate(() => { const r = document.querySelector('.voice-card').getBoundingClientRect(), s = getComputedStyle(document.querySelector('.voice-card')); return { left: r.left, right: r.right, vw: innerWidth, border: s.borderTopWidth }; });
    check('the Voice & sounds card lines up with the cards below, with no button border', vc.left === 24 && vc.right === vc.vw - 24 && vc.border === '0px', vc);
    const order = await page.evaluate(() => [...document.querySelectorAll('.home-section-title')].map(t => t.textContent));
    check("the person's own meditations come straight after 'For right now'", order[0] === 'For right now' && order[1] === 'Your meditations', order);
    const yours = page.locator('.home-section', { hasText: 'Your meditations' });
    check('the three newest show, then Show all', await yours.locator('.saved-med').count() === 3 && await yours.locator('.saved-med').first().getByText('Before a Difficult Conversation').isVisible());
    const at = await page.evaluate(() => { const t = [...document.querySelectorAll('.home-section-title')].find(t => t.textContent === 'Your meditations'); return Math.round(t.getBoundingClientRect().top + document.querySelector('.screen').scrollTop); });
    check("'Your meditations' is within about a screen and a half of the top (it was 4.7 screens down)", at < 960, at);
    await yours.getByRole('button', { name: 'Show all 12' }).click();
    check('Show all shows every one', await yours.locator('.saved-med').count() === 12);
    await yours.getByRole('button', { name: 'Show fewer' }).click();

    const first = yours.locator('.saved-med').first();
    const lines = () => first.locator('.saved-med-prompt').evaluate(e => ({ lines: Math.round(e.clientHeight / parseFloat(getComputedStyle(e).lineHeight)), hidden: e.scrollHeight - e.clientHeight }));
    const l1 = await lines();
    check('a long request shows three lines, and Show more', l1.lines === 3 && l1.hidden > 0 && await first.getByRole('button', { name: 'Show more' }).isVisible(), l1);
    await first.getByRole('button', { name: 'Show more' }).click();
    const l2 = await lines();
    check('Show more shows all of it', l2.hidden <= 1 && l2.lines > 3 && await first.getByRole('button', { name: 'Show less' }).isVisible(), l2);
    await first.getByRole('button', { name: 'Show less' }).click();

    const cut = async () => page.evaluate(() => [...document.querySelectorAll('.saved-med')].filter(c => !c.querySelector('.saved-med-remove') && !c.querySelector('.saved-med-confirm'))
      .map(c => c.querySelector('.saved-med-text .settings-row-sub')).filter(e => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1 || getComputedStyle(e).textOverflow === 'ellipsis').map(e => e.textContent));
    check('every ready-made meditation says in full when to use it (360, 100%)', (await cut()).length === 0, await cut());
    await zoom(page, 2);
    check('… and at 200% text', (await cut()).length === 0, await cut());
    await zoom(page, 1.3);
    await first.getByRole('button', { name: /^Delete/ }).click();
    const c = await page.evaluate(() => {
      const row = document.querySelector('.saved-med:has(.saved-med-confirm)');
      const t = row.querySelector('.exercise-card-title').getBoundingClientRect(), d = row.querySelector('.saved-med-confirm').getBoundingClientRect();
      return { titleBottom: Math.round(t.bottom), titleRight: Math.round(t.right), confirmTop: Math.round(d.top) };
    });
    check('Delete and Keep get their own line, under the title (130%)', c.confirmTop >= c.titleBottom, c);
    await page.screenshot({ path: `${OUT}/t05-meditate-delete-confirm-130.png` });
    await page.close();
  }

  // ── Home: the practice first, then the update notice; a week with no check-ins
  {
    const page = await open(browser, { phone: true, update: true }, errors);
    await page.locator('.update-card').waitFor({ timeout: 4000 });
    const ord = await page.evaluate(() => {
      const f = document.querySelector('.featured-card'), u = document.querySelector('.update-card');
      return { featuredFirst: !!(f.compareDocumentPosition(u) & Node.DOCUMENT_POSITION_FOLLOWING), cardTag: u.tagName, links: [...u.querySelectorAll('a')].map(a => a.textContent.trim()) };
    });
    check('Home: the featured practice comes before the update notice', ord.featuredFirst, ord);
    check('only Update opens the download, not the whole card', ord.cardTag !== 'A' && ord.links.length === 1 && ord.links[0] === 'Update', ord);
    const start = await rect(page, '.featured-action');
    check('the featured practice is on the first screen (360x640)', start.bottom <= start.vh - 67, start);
    await page.screenshot({ path: `${OUT}/t06-home-update.png` });
    await page.close();
  }
  {
    const page = await open(browser, { storage: { 'ac-checkins': [checkin(12 * day, 6), checkin(13 * day, 7)] } }, errors);
    const card = page.locator('.week-card');
    check('a week with no check-ins says so, without an empty chart', await card.locator('.week-chart').count() === 0 && await card.getByText('No check-ins in the last 7 days').isVisible());
    check('… and offers a check-in, and the history', await card.getByRole('button', { name: 'Do a check-in' }).isVisible() && await card.getByRole('button', { name: 'View check-in history' }).isVisible());
    await card.getByRole('button', { name: 'Do a check-in' }).click();
    check('Do a check-in opens the check-in', await page.locator('.intensity-slider').isVisible());
    await page.close();
  }

  // ── Check-in history: by month, with a summary, 60 at a time
  {
    const many = Array.from({ length: 150 }, (_, i) => checkin(i * day / 2 + 3600e3, (i % 10) + 1, i % 3 ? {} : { note: 'A short note.' }));
    const page = await open(browser, { storage: { 'ac-checkins': many } }, errors);
    const t0 = Date.now();
    await page.getByRole('button', { name: 'View check-in history' }).click();
    await page.locator('.history-item').first().waitFor();
    const opened = Date.now() - t0;
    const h = () => page.evaluate(() => ({
      cards: document.querySelectorAll('.history-item').length,
      months: [...document.querySelectorAll('.history-month')].map(m => [m.querySelector('.history-month-title').textContent, m.querySelector('.history-month-summary').textContent, m.querySelectorAll('.history-item').length]),
    }));
    const h1 = await h();
    // Each month's summary counts all of its check-ins.
    const counts = await page.evaluate(() => {
      const all = JSON.parse(localStorage.getItem('ac-checkins'));
      const m = {};
      for (const c of all) { const d = new Date(c.at); const k = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); m[k] = (m[k] || 0) + 1; }
      return m;
    });
    const summariesRight = h1.months.every(([name, summary]) => summary.startsWith(`${counts[name]} check-in`) && /average anxiety [0-9.]+\/10/.test(summary));
    check('60 check-ins at first, under month headings with a year', h1.cards === 60 && h1.months.length >= 2 && h1.months.every(([name]) => /\d{4}/.test(name)), h1.months);
    check("each month's summary counts all of its check-ins and gives the average", summariesRight, { months: h1.months, counts });
    await page.getByRole('button', { name: 'Show older check-ins (90 more)' }).click();
    check('Show older adds 60 more', (await h()).cards === 120);
    check('history opens quickly', opened < 3000, `${opened} ms`);
    await page.screenshot({ path: `${OUT}/t07-history-months.png` });
    await page.close();
  }

  // ── Words readable, targets big enough, controls buttons, fields named
  {
    const checkins = [checkin(3600e3, 6, { note: 'A note' }), checkin(day, 3)];
    const history = { [new Date().toISOString().slice(0, 10)]: ['box-breathing'] };
    const page = await open(browser, { storage: { 'ac-checkins': checkins, 'ac-history': history, 'ac-meditations': [meditation(1)] } }, errors);
    const low = [];
    const note = async where => { for (const x of await lowContrast(page)) low.push(`${where}: ${x}`); };
    await note('Home');
    await page.evaluate(() => document.querySelector('.screen').scrollTo(0, 99999));
    await note('Home, end');
    await tab(page, 'Toolbox');
    await note('Toolbox');
    await tab(page, 'Meditate');
    await note('Meditate');
    await tab(page, 'Check-In');
    await note('Check-In');
    await tab(page, 'Home');
    await page.getByRole('button', { name: 'View check-in history' }).click();
    await page.locator('.history-item').first().waitFor();
    await page.waitForTimeout(400); // the overlay fades in
    await note('History');
    await page.getByRole('button', { name: 'Go back' }).click();
    for (const ex of ['Make Room', '5-4-3-2-1 Grounding', 'Thought Labeling', 'Values Compass', 'One Small Step', 'Leaves on a Stream']) {
      await tab(page, 'Toolbox');
      await page.locator('.exercise-card', { hasText: ex }).first().click();
      await page.waitForTimeout(350);
      await note(ex);
      check(`${ex}: every field has a name of its own, not only its placeholder`, (await fieldsWithoutName(page)).length === 0, await fieldsWithoutName(page));
      await page.getByRole('button', { name: 'Close exercise' }).click();
    }
    check('words are readable everywhere checked (4.5:1, 3:1 for large)', low.length === 0, low.slice(0, 12));

    await tab(page, 'Toolbox');
    const tags = await page.evaluate(() => ['.exercise-card', '.filter-chip'].map(s => [s, [...document.querySelectorAll(s)].every(e => e.tagName === 'BUTTON'), Math.min(...[...document.querySelectorAll(s)].map(e => e.getBoundingClientRect().height))]));
    check('exercise cards are buttons, and filter chips 44px tall or more', tags.every(([, b, h]) => b && h >= 44), tags);
    await tab(page, 'Home');
    const home = await page.evaluate(() => ({ featured: document.querySelector('.featured-card').tagName, quick: [...document.querySelectorAll('.quick-exercises .exercise-card')].every(e => e.tagName === 'BUTTON') }));
    check('the featured practice and the quick practices are buttons', home.featured === 'BUTTON' && home.quick, home);
    await page.getByRole('button', { name: 'View check-in history' }).click();
    const back = await rect(page, '.exercise-overlay .back-btn');
    check('the back button has a 48px target', back.w >= 48 && back.h >= 48, back);
    await page.getByRole('button', { name: 'Go back' }).click();
    await tab(page, 'Toolbox');
    await page.locator('.exercise-card', { hasText: '5-4-3-2-1 Grounding' }).click();
    const tick = await rect(page, '.sense-check');
    check('the 5-4-3-2-1 ticks have a 48px target', tick.w >= 48 && tick.h >= 48, tick);
    await page.getByRole('button', { name: 'Close exercise' }).click();
    await page.locator('.exercise-card', { hasText: 'Values Compass' }).click();
    check('the Values Compass areas are buttons that say whether they are chosen', await page.getByRole('button', { name: 'Health', pressed: false }).count() === 1);
    await page.getByRole('button', { name: 'Close exercise' }).click();
    await page.close();
  }

  // ── Headings at the same level look the same
  {
    const page = await open(browser, { storage: { 'ac-checkins': [checkin(3600e3, 6)] } }, errors);
    const style = sel => page.evaluate(sel => { const s = getComputedStyle(document.querySelector(sel)); return [s.fontSize, s.fontWeight, s.fontFamily, s.textTransform, s.color].join(' | '); }, sel);
    const homeSection = await style('.home-section-title');
    await tab(page, 'Check-In');
    await page.getByRole('button', { name: 'Continue' }).click();
    for (const t of ['Caught in anxious thoughts', 'Racing or looping thoughts', 'To get distance from my thoughts']) {
      await page.getByText(t).click();
      await page.waitForTimeout(350);
    }
    await page.getByText('Recommended for you').waitFor();
    check("Check-in results' section headings look like Home's", await style('.results-wrap .home-section-title') === homeSection, await style('.results-wrap .home-section-title'));
    const badges = await page.evaluate(() => [...document.querySelectorAll('.results-wrap .badge-cat')].map(b => getComputedStyle(b).color));
    await tab(page, 'Home');
    await page.getByRole('button', { name: 'View check-in history' }).click();
    const histBadges = await page.evaluate(() => [...document.querySelectorAll('.history-item .badge')].map(b => b.className));
    check('History shows the categories as category pills, as elsewhere', histBadges.length > 0 && histBadges.every(c => c.includes('badge-cat')) && badges.length > 0, histBadges);
    await page.close();
  }

  check('no page errors', errors.length === 0, errors.join('; '));
  console.log(results.join('\n'));
  await browser.close();
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log('FAILED', e.message.split('\n')[0]); process.exit(1); });
