const { chromium } = require('playwright');
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
// SOS and the ways to it: the trusted contact dials the number that was meant (parseDial, checked
// directly), every SOS step fits the screen at 200% text on a 320/360-wide phone (no sideways
// panning, the breathing circle and 988 on the first screen, 'Get help' a full-size target apart
// from 'Skip'), the round SOS button clears the tab bar at any text size, the SOS pill is on Settings,
// Check-in history and Voice & sounds, and opening SOS from them closes them cleanly.
// Screenshots go to the folder given as the first argument, or to the system's temp folder.
const OUT = process.argv[2] || require('os').tmpdir();
const URL = process.env.APP_URL || 'http://localhost:4173/';
const ROOT = path.join(__dirname, '..', '..');
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);

// ── parseDial, straight from src/lib/phone.ts
function loadPhone() {
  const { code } = esbuild.transformSync(fs.readFileSync(path.join(ROOT, 'src/lib/phone.ts'), 'utf8'), { loader: 'ts', format: 'cjs' });
  const m = { exports: {} };
  new Function('module', 'exports', code)(m, m.exports);
  return m.exports;
}
const phone = loadPhone();
const DIALS = [
  ['+1 (416) 555-0199 ext. 2041', '+14165550199', '2041'],
  ['416-555-0199 x123', '4165550199', '123'],
  ['416 555 0199 x2041', '4165550199', '2041'],
  ['416-555-0199,2041', '4165550199', '2041'], // the dialer's own pause
  ['416-555-0199;2041', '4165550199', '2041'], // and wait
  ['416-555-0199 #2041', '4165550199', '2041'],
  ['514 555 0199 poste 12', '5145550199', '12'],
  ['+44 (0)20 7946 0958', '+442079460958', ''], // the trunk 0 is not dialled after +44
  ['+44 (0)7700 900123', '+447700900123', ''],
  ['+39 06 6982 1234', '+390669821234', ''], // a plain 0 is part of the number
  ['0412 345 678, 02 9876 5432', '0412345678', ''], // two numbers: the first
  ['0412 345 678 (mobile), 02 9876', '0412345678', ''],
  ['416-555-0199 or 905-555-0123', '4165550199', ''],
  ['416-555-0199 / 905-555-0123', '4165550199', ''],
  ['030/1234567', '0301234567', ''],
  ['(416) 555-0199', '4165550199', ''],
  ['+1 416 555 0199', '+14165550199', ''],
  ['Mum', '', ''],
];
const wrong = DIALS.filter(([raw, number, ext]) => { const d = phone.parseDial(raw); return d.number !== number || d.ext !== ext; })
  .map(([raw]) => `${raw} -> ${JSON.stringify(phone.parseDial(raw))}`);
check(`parseDial reads ${DIALS.length} ways of writing a number`, wrong.length === 0, wrong.join('; '));
check('the link pauses before the extension', phone.telHref('+1 (416) 555-0199 ext. 2041') === 'tel:+14165550199,2041', phone.telHref('+1 (416) 555-0199 ext. 2041'));
check('a field with no digits is not offered as a call', !phone.canDial('Mum') && phone.canDial('911'));
check('Settings shows the number grouped, with the extension', phone.showDial('+1 (416) 555-0199 ext. 2041') === '+1 416 555 0199, then extension 2041', phone.showDial('+1 (416) 555-0199 ext. 2041'));

// ── the app
const CONTACT = { contactName: 'Sam', contactPhone: '+1 (416) 555-0199 ext. 2041' };

async function open(browser, w, h, errors) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(contact => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear();
      localStorage.setItem('ac-settings', JSON.stringify({ onboarded: true, ...contact }));
      sessionStorage.setItem('seeded', '1');
    }
    window.speechSynthesis.speak = () => {};
    window.speechSynthesis.cancel = () => {};
    // Android's text size: every font size and fixed line height multiplied, once. Call again after
    // the screen changes: it starts from each element's own size each time.
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
  }, CONTACT);
  await page.goto(URL);
  await page.locator('.nav').waitFor();
  return page;
}

const zoom = async (page, k) => { if (k !== 1) { await page.evaluate(k => window.__zoom(k), k); await page.waitForTimeout(150); } };

// What a person sees of the SOS step on its first screen.
const sosStep = page => page.evaluate(() => {
  const q = s => document.querySelector(s);
  const box = s => { const e = q(s); return e ? e.getBoundingClientRect() : null; };
  const scroll = q('.sos-overlay .exercise-scroll');
  const footer = box('.sos-footer');
  const help = box('.sos-help-btn');
  const ring = box('.sos-overlay .breathing-ring-wrap');
  const label = box('.sos-overlay .breathing-phase-label');
  const visibleTop = footer ? footer.top : innerHeight;
  const call = q('.sos-footer-btn');
  return {
    pans: scroll.scrollWidth - scroll.clientWidth,
    pageWider: document.documentElement.scrollWidth - innerWidth,
    footerOnScreen: !!footer && footer.top >= 0 && footer.bottom <= innerHeight + 0.5,
    callFits: !!call && call.scrollWidth <= call.clientWidth + 1 && call.getBoundingClientRect().left >= 0 && call.getBoundingClientRect().right <= innerWidth,
    callText: call ? call.textContent : '',
    help: help && { w: Math.round(help.width), h: Math.round(help.height), inside: help.left >= 0 && help.right <= innerWidth },
    skipInTopBar: !!q('.exercise-top-bar .sos-skip'),
    circleOnFirstScreen: ring ? ring.top >= 0 && ring.top + ring.height * 0.75 <= visibleTop : null,
    labelOnFirstScreen: label ? label.bottom <= visibleTop : null,
  };
});

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // ── Every SOS step at 200%, on a 360- and a 320-wide phone
  for (const w of [360, 320]) {
    const page = await open(browser, w, 640, errors);
    await zoom(page, 2);
    await page.locator('.sos-fab').click();
    await page.getByText('This feeling will pass.').waitFor();
    await page.waitForTimeout(400); // the overlay slides in
    await zoom(page, 2);
    let m = await sosStep(page);
    await page.screenshot({ path: `${OUT}/s01-sos-breathe-${w}-200.png` });
    check(`${w} wide, 200%: the breathing step does not pan sideways`, m.pans <= 0 && m.pageWider <= 0, JSON.stringify(m));
    check(`${w} wide, 200%: the breathing circle and its instruction are on the first screen`, m.circleOnFirstScreen && m.labelOnFirstScreen, JSON.stringify(m));
    check(`${w} wide, 200%: 'Call 988' is on screen and its whole label fits its button`, m.footerOnScreen && m.callFits && /Call 988/.test(m.callText), JSON.stringify(m));
    check(`${w} wide, 200%: 'Get help' is at least 48x48, on screen, with 'Skip' away from it`, m.help && m.help.w >= 48 && m.help.h >= 48 && m.help.inside && !m.skipInTopBar, JSON.stringify(m.help));
    await page.getByRole('button', { name: 'Skip breathing' }).click();
    const panned = [];
    for (const n of [5, 4, 3, 2, 1]) {
      await page.locator('.sos-step-num', { hasText: String(n) }).waitFor();
      await zoom(page, 2);
      m = await sosStep(page);
      if (m.pans > 0 || m.pageWider > 0 || !m.footerOnScreen || !m.callFits) panned.push(`${n}: ${JSON.stringify(m)}`);
      if (n === 5) await page.screenshot({ path: `${OUT}/s02-sos-ground-${w}-200.png` });
      const atTop = await page.evaluate(() => document.querySelector('.sos-overlay .exercise-scroll').scrollTop);
      if (atTop > 0) panned.push(`${n} opened scrolled down by ${atTop}`);
      if (n > 1) await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Skip grounding' }).click();
    await page.getByText('Make room for it').waitFor();
    await zoom(page, 2);
    m = await sosStep(page);
    if (m.pans > 0 || !m.footerOnScreen) panned.push(`accept: ${JSON.stringify(m)}`);
    check(`${w} wide, 200%: grounding and 'Make room' fit the screen, with 988 in reach`, panned.length === 0, panned.join('; '));
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.locator('.option-btn', { hasText: 'A little calmer' }).click();
    await page.getByText('You rode the wave.').waitFor();
    await page.waitForTimeout(300);
    if (w === 360) {
      const counted = await page.evaluate(() => (localStorage.getItem('ac-history') || '').includes('"sos"'));
      check('reaching "You rode the wave" counts it, before Done', counted);
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      const once = await page.evaluate(() => (localStorage.getItem('ac-history') || '').split('"sos"').length - 1);
      check('Done closes SOS without counting it twice', once === 1 && await page.locator('.sos-overlay').count() === 0, String(once));
    }
    await page.close();
  }

  // ── The round SOS button and the tab bar, at 100% and 200%
  for (const [w, k] of [[360, 1], [360, 2], [320, 2]]) {
    const page = await open(browser, w, 640, errors);
    await zoom(page, k);
    const m = await page.evaluate(() => {
      const fab = document.querySelector('.sos-fab');
      const f = fab.getBoundingClientRect();
      const nav = document.querySelector('.nav').getBoundingClientRect();
      // Each tab label's own ink, from its text node.
      const labels = [...document.querySelectorAll('.nav-tab')].map(t => {
        const r = document.createRange();
        r.selectNodeContents([...t.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()));
        const rects = [...r.getClientRects()];
        return { left: Math.min(...rects.map(x => x.left)), right: Math.max(...rects.map(x => x.right)), lines: rects.length };
      });
      const gaps = labels.slice(1).map((l, i) => Math.round(l.left - labels[i].right));
      return { above: Math.round(nav.top - f.bottom), w: Math.round(f.width), h: Math.round(f.height), fits: fab.scrollWidth <= fab.clientWidth, gaps, lines: labels.map(l => l.lines), navH: Math.round(nav.height) };
    });
    if (k === 2 && w === 360) await page.screenshot({ path: `${OUT}/s03-home-${w}-200.png` });
    check(`${w} wide, ${k * 100}%: the SOS circle sits clear above the tab bar and 'SOS' fits inside it`, m.above >= 12 && m.fits && m.w >= 58 && m.h >= 58, JSON.stringify(m));
    // At 320 wide and 200% the four labels need nearly the whole width (in this machine's font; Android's
    // Roboto is narrower): they must not run into each other. Where there is room, they keep a gap.
    check(`${w} wide, ${k * 100}%: the tab labels ${w === 320 ? 'do not overlap' : 'keep apart'}`, m.gaps.every(g => g >= (w === 320 ? 0 : 6)), JSON.stringify(m));
    if (w === 360) check(`360 wide, ${k * 100}%: each tab label stays on one line`, m.lines.every(n => n === 1), JSON.stringify(m.lines));
    await page.close();
  }

  // ── The SOS pill on the overlays, and what opening SOS from them does
  {
    const page = await open(browser, 360, 640, errors);
    const pill = async () => page.evaluate(() => {
      const b = document.querySelector('.sos-fab');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      return { pill: b.classList.contains('sos-pill'), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), onTop: hit === b };
    });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.locator('.exercise-title', { hasText: 'Settings' }).waitFor();
    let p = await pill();
    check('Settings has the SOS pill, 48px tall, on top', p && p.pill && p.h >= 48 && p.w >= 48 && p.onTop, JSON.stringify(p));
    const dial = page.locator('#contact-dial');
    await dial.scrollIntoViewIfNeeded();
    check("Settings shows what SOS will dial under the contact's number", (await dial.textContent()).trim() === 'Will dial: +1 416 555 0199, then extension 2041', await dial.textContent());
    await page.screenshot({ path: `${OUT}/s04-settings-contact.png` });
    await page.getByRole('button', { name: 'Open Voice & sounds' }).click();
    await page.locator('.exercise-title', { hasText: 'Voice & sounds' }).waitFor();
    p = await pill();
    check('Voice & sounds has the SOS pill, on top', p && p.pill && p.onTop, JSON.stringify(p));
    await page.locator('.sos-fab').click();
    await page.getByText('This feeling will pass.').waitFor();
    check('SOS from Voice & sounds closes it (and Settings behind it)', await page.locator('.exercise-overlay').count() === 1);
    await page.getByRole('button', { name: 'Get help' }).click();
    const contact = page.locator('.support-btn', { hasText: 'Call Sam' });
    check('the trusted contact is dialled with a pause before the extension', await contact.getAttribute('href') === 'tel:+14165550199,2041', await contact.getAttribute('href'));
    await page.screenshot({ path: `${OUT}/s05-sos-support.png` });
    await page.getByRole('button', { name: 'Close SOS' }).click();
    p = await pill();
    check('closing SOS lands on the tab, with the round SOS button back', p && !p.pill && await page.locator('.exercise-overlay').count() === 0, JSON.stringify(p));
    await page.getByRole('button', { name: 'Meditate', exact: true }).click();
    await page.locator('.voice-card').click();
    await page.locator('.exercise-title', { hasText: 'Voice & sounds' }).waitFor();
    await page.getByRole('button', { name: 'Go back' }).click();
    check('Voice & sounds opened from Meditate afterwards goes back to Meditate, not Settings',
      await page.locator('.exercise-overlay').count() === 0 && await page.locator('.nav-tab.active', { hasText: 'Meditate' }).count() === 1);
    // 'Add API key' opens Settings at the key field; SOS from there, then Settings from Home: at its top.
    await page.getByRole('button', { name: 'Add API key' }).click();
    await page.locator('.exercise-title', { hasText: 'Settings' }).waitFor();
    await page.waitForTimeout(200);
    const atKey = await page.evaluate(() => document.querySelector('.exercise-overlay .exercise-scroll').scrollTop);
    await page.locator('.sos-fab').click();
    await page.getByText('This feeling will pass.').waitFor();
    await page.getByRole('button', { name: 'Close SOS' }).click();
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.locator('.exercise-title', { hasText: 'Settings' }).waitFor();
    await page.waitForTimeout(200);
    const top = await page.evaluate(() => document.querySelector('.exercise-overlay .exercise-scroll').scrollTop);
    check('after SOS from Settings-at-the-key-field, Settings from Home opens at its top', atKey > 0 && top === 0, `${atKey} then ${top}`);
    await page.getByRole('button', { name: 'Go back' }).click();
    await page.evaluate(() => {
      localStorage.setItem('ac-checkins', JSON.stringify([{ id: '1', at: new Date().toISOString(), level: 9, focus: ['grounding'] }]));
    });
    await page.reload();
    await page.getByRole('button', { name: 'View check-in history' }).click();
    await page.locator('.exercise-title', { hasText: 'Check-in history' }).waitFor();
    p = await pill();
    check('Check-in history has the SOS pill, on top', p && p.pill && p.onTop, JSON.stringify(p));
    await page.close();
  }

  check('no page errors', errors.length === 0, errors.join('; '));
  console.log(results.join('\n'));
  await browser.close();
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log('FAILED', e.message.split('\n')[0]); process.exit(1); });
