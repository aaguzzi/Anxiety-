const { chromium } = require('playwright');
// The Toolbox exercises: the breathing exercises open ready to start, with 'Begin' on the first
// screen; no exercise slides sideways at large text or on a narrow phone; a closing screen opens
// at its top and counts the practice as soon as it appears (so the round button counts it too);
// steps can be stepped back through without losing what was typed; a button that waits for an
// answer says what it needs; and every main button is the same navy.
// Screenshots go to the folder given as the first argument, or to the system's temp folder.
const OUT = process.argv[2] || require('os').tmpdir();
const URL = process.env.APP_URL || 'http://localhost:4173/';
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
const NAVY = 'rgb(42, 50, 64)';

async function open(browser, w, h, errors) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear();
      localStorage.setItem('ac-settings', JSON.stringify({ onboarded: true }));
      sessionStorage.setItem('seeded', '1');
    }
    // The exercises' one-second clocks, run faster when asked.
    const SI = window.setInterval.bind(window);
    window.__speed = 1;
    window.setInterval = (fn, ms, ...args) => {
      if (ms !== 1000) return SI(fn, ms, ...args);
      let acc = 0;
      return SI(() => { acc += 50 * window.__speed; if (acc >= 1000) { acc -= 1000; fn(...args); } }, 50);
    };
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
  });
  await page.goto(URL);
  await page.locator('.nav').waitFor();
  return page;
}

const zoom = async (page, k) => { if (k !== 1) { await page.evaluate(k => window.__zoom(k), k); await page.waitForTimeout(100); } };
const ov = page => page.locator('.exercise-modal');
const btn = (page, name) => ov(page).getByRole('button', { name, exact: true });

async function openExercise(page, title, k = 1) {
  await page.locator('.nav-tab', { hasText: 'Toolbox' }).click();
  await page.locator('.toolbox-list .exercise-card', { has: page.locator('.exercise-card-title', { hasText: title }) }).first().click();
  await ov(page).locator('.exercise-title', { hasText: title }).waitFor();
  await page.waitForTimeout(350); // the overlay slides in
  await zoom(page, k);
}

// Where an element is against the visible part of the exercise's scroll area.
const place = (page, sel) => page.evaluate(sel => {
  const sc = document.querySelector('.exercise-modal .exercise-scroll');
  const el = document.querySelector(sel);
  if (!sc || !el) return null;
  const s = sc.getBoundingClientRect(), r = el.getBoundingClientRect();
  return { top: Math.round(r.top - s.top), bottom: Math.round(r.bottom - s.top), height: Math.round(s.height), scrollTop: Math.round(sc.scrollTop) };
}, sel);

// A tap the way a person makes it: scroll only until the whole button is on screen, then tap.
async function tapAfterScrolling(page, loc) {
  await loc.evaluate(el => {
    const sc = el.closest('.exercise-scroll');
    const s = sc.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.bottom > s.bottom) sc.scrollTop += r.bottom - s.bottom + 4;
    else if (r.top < s.top) sc.scrollTop -= s.top - r.top + 4;
  });
  await page.waitForTimeout(60);
  await loc.tap();
}

const practised = (page, id) => page.evaluate(id => Object.values(JSON.parse(localStorage.getItem('ac-history') || '{}')).flat().filter(x => x === id).length, id);

// Main buttons with a colour of their own, on the screen as it is now.
const offColour = page => page.evaluate(navy => [...document.querySelectorAll('.exercise-modal .btn-primary')]
  .filter(b => b.style.backgroundColor || b.style.opacity || getComputedStyle(b).backgroundColor !== navy)
  .map(b => `${b.textContent.trim()}: ${getComputedStyle(b).backgroundColor}`), NAVY);

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const colours = [];
  const noteColours = async (page, where) => { for (const c of await offColour(page)) colours.push(`${where}: ${c}`); };

  // ── The breathing exercises open ready to start, with Begin on the first screen
  for (const [w, h, k] of [[360, 640, 1], [320, 640, 1], [360, 740, 1.3]]) {
    const page = await open(browser, w, h, errors);
    const late = [];
    for (const title of ['Physiological Sigh', 'Box Breathing', '4-7-8 Breathing']) {
      await openExercise(page, title, k);
      const begin = await place(page, '.exercise-modal .breathing-start-btn');
      const hold = await place(page, '.exercise-modal .hold-toggle');
      if (!begin || begin.bottom > begin.height) late.push(`${title}: Begin at ${JSON.stringify(begin)}`);
      if (hold && (hold.bottom > begin.top || hold.bottom > hold.height)) late.push(`${title}: 'Skip the breath-holds' not above Begin on screen`);
      const label = await ov(page).locator('.breathing-phase-label').textContent();
      if (label !== 'Ready') late.push(`${title}: says '${label}' before Begin`);
      if (w === 360 && k === 1) await noteColours(page, title);
      if (w === 360 && k === 1 && title === 'Physiological Sigh') await page.screenshot({ path: `${OUT}/e01-sigh-ready-360.png` });
      await ov(page).locator('.back-btn').click();
      await page.waitForTimeout(150);
    }
    check(`${w}x${h}, ${k * 100}% text: each breathing exercise says 'Ready', with Begin (and the breath-hold choice) on the first screen`, late.length === 0, late.join('; '));
    await page.close();
  }

  // ── The Toolbox Sigh: a still circle until Begin, Pause starts the sigh again, and it ends on
  //    a closing screen that has already counted it
  {
    const page = await open(browser, 360, 640, errors);
    await openExercise(page, 'Physiological Sigh');
    const size = () => ov(page).locator('.breathing-circle').evaluate(e => e.getBoundingClientRect().width);
    const idle = await size();
    await btn(page, 'Begin').tap();
    await page.waitForTimeout(3300);
    const inhaled = await size();
    check('the Sigh\'s circle grows on the first inhale (it starts small)', inhaled > idle + 30, `${idle} -> ${inhaled}`);
    await btn(page, 'Pause').tap();
    const paused = await ov(page).locator('.breathing-phase-label').textContent();
    await btn(page, 'Resume').tap();
    const resumed = await ov(page).locator('.breathing-phase-label').textContent();
    check('the Sigh can be paused, and resumes from its first inhale', paused === 'Paused' && resumed === 'First inhale', `${paused} / ${resumed}`);
    await page.evaluate(() => { window.__speed = 40; });
    await page.getByText('Nicely done.').waitFor({ timeout: 10000 });
    await page.evaluate(() => { window.__speed = 1; });
    check('the Sigh ends on a closing screen and is counted before Finish', await practised(page, 'physiological-sigh') === 1);
    await btn(page, 'Finish').tap();
    check('Finish closes it without counting it twice', await ov(page).count() === 0 && await practised(page, 'physiological-sigh') === 1);
    await page.close();
  }

  // ── No sideways panning, and Leaves on a Stream's + stays on screen
  for (const [w, k] of [[320, 1], [320, 2], [360, 2]]) {
    const page = await open(browser, w, 640, errors);
    const wide = [];
    for (const [title, field] of [['5-4-3-2-1 Grounding', '.sense-input'], ['Leaves on a Stream', '.thought-input']]) {
      await openExercise(page, title, k);
      await ov(page).locator(field).first().tap();
      await ov(page).locator(field).first().fill('The lamp on the bedside table');
      await page.waitForTimeout(100);
      const m = await page.evaluate(() => {
        const sc = document.querySelector('.exercise-modal .exercise-scroll');
        const add = document.querySelector('.thought-add-btn');
        const r = add && add.getBoundingClientRect();
        return { wider: sc.scrollWidth - sc.clientWidth, panned: sc.scrollLeft, add: r && { left: Math.round(r.left), right: Math.round(r.right) } };
      });
      if (m.wider > 0 || m.panned > 0 || (m.add && (m.add.left < 0 || m.add.right > w))) wide.push(`${title}: ${JSON.stringify(m)}`);
      if (w === 360 && title === 'Leaves on a Stream') await page.screenshot({ path: `${OUT}/e02-leaves-360-200.png` });
      await ov(page).locator('.back-btn').click();
      await page.waitForTimeout(150);
    }
    check(`${w} wide, ${k * 100}% text: 5-4-3-2-1 and Leaves on a Stream fit the width (the + on screen)`, wide.length === 0, wide.join('; '));
    await page.close();
  }

  // ── Closing screens open at their top and count the practice; the round button keeps it.
  //    (A short screen stands in for large text without the simulated zoom, which is applied after
  //    each screen has already been laid out.)
  for (const [w, h, k] of [[360, 640, 1], [320, 640, 1], [360, 420, 1], [360, 640, 2]]) {
    const page = await open(browser, w, h, errors);
    const hidden = [];
    const landed = async name => {
      await page.locator('.exercise-modal .completion-screen').waitFor();
      await page.waitForTimeout(100);
      const p = await place(page, '.exercise-modal .completion-title');
      const icon = await place(page, '.exercise-modal .completion-icon');
      if (!p || p.top < 0 || icon.top < 0) hidden.push(`${name}: ${JSON.stringify({ icon, title: p })}`);
    };

    await openExercise(page, 'One Small Step', k);
    const t = ov(page).locator('.form-textarea');
    await t.nth(0).fill('Calling the clinic to book the appointment I keep putting off');
    await t.nth(1).fill('Because I value looking after my health so I can be there for my family');
    await ov(page).locator('.form-input').fill('Tomorrow at 9:30, at the kitchen table, before checking email');
    await zoom(page, k);
    const commit = ov(page).getByRole('button', { name: 'I commit to this step' });
    const need = ov(page).locator('.btn-need');
    const waiting = await commit.isDisabled() && /one small step/.test(await need.textContent());
    if (w === 360 && h === 640 && k === 1) {
      const describedBy = await commit.getAttribute('aria-describedby');
      check('One Small Step says what it is waiting for (the step) while its button is disabled', waiting && !!describedBy && await need.getAttribute('id') === describedBy);
      check('the waiting button looks disabled the shared way (navy, faded)', await commit.evaluate(b => getComputedStyle(b).opacity) === '0.4' && (await offColour(page)).length === 0);
    }
    await t.nth(2).fill('Write down what I want to say, then call before 10am');
    await zoom(page, k);
    if (w === 360 && h === 640 && k === 1) check('...and stops saying it once the step is written', await commit.isEnabled() && await need.count() === 0);
    await tapAfterScrolling(page, commit);
    await landed('One Small Step');
    if (w === 360 && h === 640 && k === 1) await page.screenshot({ path: `${OUT}/e03-one-small-step-done-360.png` });
    await ov(page).locator('.back-btn').click();
    await page.waitForTimeout(150);
    if (w === 360 && h === 640 && k === 1) check('leaving a closing screen by the round button keeps the practice', await practised(page, 'one-small-step') === 1);

    await openExercise(page, '5-4-3-2-1 Grounding', k);
    if (w === 360 && h === 640 && k === 1) check("5-4-3-2-1 has one 'Finish' (the form's button says I'm done noticing)", await btn(page, "I'm done noticing").count() === 1 && await btn(page, 'Finish').count() === 0);
    await tapAfterScrolling(page, btn(page, "I'm done noticing"));
    await landed('5-4-3-2-1');
    const before = await practised(page, '5-4-3-2-1');
    await btn(page, 'Finish').tap();
    if (w === 360 && h === 640 && k === 1) check('Finish closes a closing screen without counting it twice', before === 1 && await practised(page, '5-4-3-2-1') === 1, `${before}`);

    await openExercise(page, 'Coming Back to Now', k);
    const a = ov(page).locator('.anchor-textarea');
    await a.nth(0).fill('Lying in bed with the light off, phone in my hand');
    await a.nth(1).fill('Heart beating fast, the fridge humming, cold feet');
    await a.nth(2).fill('Be gentle with myself and put the phone down');
    await zoom(page, k);
    await tapAfterScrolling(page, btn(page, 'Anchor complete'));
    await landed('Coming Back to Now');
    await ov(page).locator('.back-btn').click();
    await page.waitForTimeout(150);

    await openExercise(page, 'Brief Body Scan', k);
    await tapAfterScrolling(page, btn(page, 'Begin body scan'));
    for (let i = 0; i < 6; i++) {
      await zoom(page, k);
      await tapAfterScrolling(page, btn(page, 'Continue'));
      const step = await place(page, '.exercise-modal .exercise-scroll > :last-child');
      if (step.top < 0) hidden.push(`Body Scan region ${i + 2} opened ${-step.top}px below its start`);
    }
    await zoom(page, k);
    await tapAfterScrolling(page, btn(page, 'Complete scan'));
    await landed('Body Scan');
    await ov(page).locator('.back-btn').click();
    await page.waitForTimeout(150);

    check(`${w}x${h}, ${k * 100}% text: closing screens and new steps open at their top (icon and heading on screen)`, hidden.length === 0, hidden.join('; '));
    await page.close();
  }

  // ── Stepping back within an exercise keeps what was written; the round button leaves
  {
    const page = await open(browser, 360, 640, errors);
    const kept = [];
    await openExercise(page, 'Make Room');
    check('Make Room has no Back on its first step', await btn(page, 'Back').count() === 0);
    await ov(page).locator('.step-reflection').fill('My mind keeps saying I will panic on the train.');
    await noteColours(page, 'Make Room N');
    await tapAfterScrolling(page, ov(page).getByRole('button', { name: /^Next: Allow/ }));
    await ov(page).locator('.step-reflection').fill('Tight chest');
    await noteColours(page, 'Make Room A');
    await tapAfterScrolling(page, btn(page, 'Back'));
    if (await ov(page).locator('.step-reflection').inputValue() !== 'My mind keeps saying I will panic on the train.') kept.push('Make Room step N');
    await tapAfterScrolling(page, ov(page).getByRole('button', { name: /^Next: Allow/ }));
    if (await ov(page).locator('.step-reflection').inputValue() !== 'Tight chest') kept.push('Make Room step A');
    await ov(page).locator('.back-btn').click();
    await page.waitForTimeout(150);

    await openExercise(page, 'Soften and Allow');
    const input = ov(page).locator('.label-input');
    check('Soften and Allow says what "I found it" is waiting for', await btn(page, 'I found it').isDisabled() && await ov(page).locator('.btn-need').count() === 1);
    await input.fill('A tight band across my chest');
    await tapAfterScrolling(page, btn(page, 'I found it'));
    await page.getByText('Describe it', { exact: true }).waitFor();
    await tapAfterScrolling(page, btn(page, 'Back'));
    if (await input.inputValue() !== 'A tight band across my chest') kept.push('Soften and Allow: where');
    await tapAfterScrolling(page, btn(page, 'I found it'));
    await input.fill('Heavy, grey');
    await tapAfterScrolling(page, btn(page, 'Continue'));
    await noteColours(page, 'Soften and Allow, soften');
    await tapAfterScrolling(page, btn(page, 'Back'));
    if (await input.inputValue() !== 'Heavy, grey') kept.push('Soften and Allow: describe');
    await ov(page).locator('.back-btn').click();
    await page.waitForTimeout(150);

    await openExercise(page, 'Values Compass');
    check('Values Compass says what it is waiting for before an area is chosen', await btn(page, 'Continue').isDisabled() && /area/.test(await ov(page).locator('.btn-need').textContent()));
    for (const d of ['Relationships', 'Health']) await ov(page).locator('.domain-card', { hasText: d }).click();
    await tapAfterScrolling(page, ov(page).getByRole('button', { name: /^Continue with 2 areas/ }));
    await ov(page).locator('.intention-input').first().fill('Listen properly');
    await tapAfterScrolling(page, btn(page, 'Back'));
    const chosen = await ov(page).locator('.domain-card.selected').count();
    await tapAfterScrolling(page, ov(page).getByRole('button', { name: /^Continue with 2 areas/ }));
    if (chosen !== 2 || await ov(page).locator('.intention-input').first().inputValue() !== 'Listen properly') kept.push('Values Compass');
    await ov(page).locator('.back-btn').click();
    await page.waitForTimeout(150);

    await openExercise(page, 'Brief Body Scan');
    await btn(page, 'Begin body scan').tap();
    await tapAfterScrolling(page, btn(page, 'Continue'));
    await noteColours(page, 'Body Scan');
    await tapAfterScrolling(page, btn(page, 'Back'));
    if (!/1 of 7/.test(await ov(page).textContent())) kept.push('Body Scan');
    await page.screenshot({ path: `${OUT}/e04-body-scan-back-360.png` });
    await ov(page).locator('.back-btn').click();
    await page.waitForTimeout(150);

    check('Back (under the main button) steps back within Make Room, Soften and Allow, Values Compass and Body Scan, keeping what was written', kept.length === 0, kept.join('; '));
    check('the round button leaves an exercise in the middle, and counts nothing', await ov(page).count() === 0 && await practised(page, 'dare-response') === 0 && await practised(page, 'body-scan') === 0);

    await openExercise(page, 'Leaves on a Stream');
    await ov(page).locator('.thought-input').fill('What if');
    await btn(page, 'Add leaf').tap();
    await noteColours(page, 'Leaves on a Stream');
    const add = await ov(page).locator('.thought-add-btn').evaluate(b => getComputedStyle(b).backgroundColor);
    if (add !== NAVY) colours.push(`Add leaf: ${add}`);
    await ov(page).locator('.back-btn').click();
    await page.waitForTimeout(150);
    for (const title of ['The Observer Self', 'Thought Labeling', 'One Small Step']) {
      await openExercise(page, title);
      await noteColours(page, title);
      await ov(page).locator('.back-btn').click();
      await page.waitForTimeout(150);
    }
    check('every main button in the exercises is the same navy, with no colour or fading of its own', colours.length === 0, colours.join('; '));
    await page.close();
  }

  check('no page errors', errors.length === 0, errors.join('; '));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log('FAILED', e.message.split('\n')[0]); process.exit(1); });
