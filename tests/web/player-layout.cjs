const { chromium } = require('playwright');
// The meditation player's layout on small screens and with the phone's text size at 200%: the words
// never cover a control, the controls stay on screen, every background sound is in view, the SOS
// button keeps clear of 'Voice & sounds', and the finish and voice-error screens scroll.
// Screenshots go to the folder given as the first argument, or to the system's temp folder.
const OUT = process.argv[2] || require('os').tmpdir();
const URL = process.env.APP_URL || 'http://localhost:4173/';
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);

// 25 words, the longest line the meditation prompt allows.
const LONG = 'When the rehearsing starts again, notice it kindly, let the words go quiet, and come back to the weight of your body resting here tonight.';
const MED = {
  id: '1790000000001', title: 'A Gentle Practice for the Night Before a Difficult Conversation', prompt: 'x', minutes: 2,
  createdAt: '2026-11-19T21:40:00.000Z',
  segments: [{ text: LONG, pause: 3 }, { text: 'Let yourself settle.', pause: 3 }, { text: LONG.replace('tonight', 'now'), pause: 3 }],
};

// Android's text size: every font size and fixed line height multiplied, once, on what is on screen.
const zoom = (page, k) => page.evaluate(k => {
  const els = [...document.querySelectorAll('body, body *')].filter(e => !(e instanceof SVGElement));
  const natural = els.map(e => { const s = getComputedStyle(e); return [parseFloat(s.fontSize), s.lineHeight]; });
  els.forEach((e, i) => {
    const [fs, lh] = natural[i];
    e.style.fontSize = `${fs * k}px`;
    if (/px$/.test(lh)) e.style.lineHeight = `${parseFloat(lh) * k}px`;
  });
}, k);

// What the player looks like now.
const inspect = page => page.evaluate(() => {
  const q = s => document.querySelector(s);
  const box = el => el.getBoundingClientRect();
  const reached = el => {
    const r = box(el);
    const h = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    return !!h && (h === el || el.contains(h));
  };
  const controls = { seek: '.player-seek', startOver: '.player-restart', previous: '[aria-label="Previous line"]', pause: '.player-btn-main', next: '[aria-label="Next line"]' };
  const missed = Object.entries(controls).filter(([, s]) => { const el = q(s); const r = box(el); return r.top < 0 || r.bottom > innerHeight || !reached(el); }).map(([n]) => n);
  const words = q('.player-caption span');
  const body = box(q('.player-body'));
  return {
    missed,
    seekHeight: Math.round(box(q('.player-seek')).height),
    wordsBottom: Math.round(words.getBoundingClientRect().top + words.offsetHeight), wordsTop: Math.round(box(words).top),
    seekTop: Math.round(box(q('.player-seek')).top), transportTop: Math.round(box(q('.player-transport')).top), bodyTop: Math.round(body.top),
    voiceToSOS: Math.round(box(q('.sos-fab')).left - box(q('.player-voice-btn')).right),
    chipsOutside: [...document.querySelectorAll('.player-sounds .chip')].filter(c => { const r = box(c); return r.left < 0 || r.right > innerWidth; }).map(c => c.textContent),
    chips: document.querySelectorAll('.player-sounds .chip').length,
    wider: document.documentElement.scrollWidth > innerWidth,
  };
});

async function open(browser, w, h, o = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  page.on('pageerror', e => o.errors.push(e.message));
  await page.addInitScript(({ med, fails }) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear();
      localStorage.setItem('ac-settings', JSON.stringify({ onboarded: true, sounds: { white: { on: true, volume: 0.5 } } }));
      localStorage.setItem('ac-meditations', JSON.stringify([med]));
      sessionStorage.setItem('seeded', '1');
    }
    // Each line is spoken until the test moves on; or the phone's voice fails.
    window.speechSynthesis.speak = u => {
      if (fails) setTimeout(() => u.onerror && u.onerror(Object.assign(new Event('error'), { error: 'synthesis-failed' })), 50);
    };
    window.speechSynthesis.cancel = () => {};
  }, { med: MED, fails: !!o.fails });
  await page.goto(URL);
  await page.getByRole('button', { name: 'Meditate', exact: true }).click();
  await page.locator('.saved-med-main', { hasText: 'A Gentle Practice' }).click();
  return page;
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // ── 320 wide (a large display size), normal text, the longest line
  let page = await open(browser, 320, 640, { errors });
  await page.locator('.player-caption span:not(.player-status)').waitFor({ timeout: 5000 });
  await page.waitForTimeout(900);
  let m = await inspect(page);
  await page.screenshot({ path: `${OUT}/p01-player-320.png` });
  check('320 wide: every control is on screen and takes its own taps', m.missed.length === 0, JSON.stringify(m.missed));
  check('320 wide: the line ends above the seek bar', m.wordsBottom <= m.seekTop, `${m.wordsBottom} vs ${m.seekTop}`);
  check('the seek bar keeps a 44px touch area', m.seekHeight >= 44, String(m.seekHeight));
  check('every background sound is in view, the one playing included', m.chips === 9 && m.chipsOutside.length === 0 && !m.wider, JSON.stringify(m.chipsOutside));
  await page.close();

  // ── 360x640 with text at 200%
  page = await open(browser, 360, 640, { errors });
  await page.locator('.player-caption span:not(.player-status)').waitFor({ timeout: 5000 });
  await page.waitForTimeout(900);
  await zoom(page, 2);
  await page.waitForTimeout(100);
  m = await inspect(page);
  check('200%: Pause and the other controls stay on screen and take their own taps', m.missed.length === 0, JSON.stringify(m.missed));
  check('200%: the SOS button keeps clear of Voice & sounds', m.voiceToSOS >= 8, String(m.voiceToSOS));
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  check('200%: a tap on Pause pauses', await page.getByRole('button', { name: 'Resume', exact: true }).isVisible());
  await page.getByRole('button', { name: 'Next line' }).click();
  await page.getByRole('button', { name: 'Next line' }).click();
  await page.waitForTimeout(900);
  m = await inspect(page);
  await page.screenshot({ path: `${OUT}/p02-player-200.png` });
  check('200%: a new line is scrolled into view above the controls', m.wordsTop >= m.bodyTop - 1 && m.wordsTop < m.transportTop - 60, JSON.stringify(m));
  check('200%: still nothing covered', m.missed.length === 0, JSON.stringify(m.missed));
  await page.getByRole('button', { name: 'Next line' }).click();
  await page.getByText('Welcome back.').waitFor({ timeout: 3000 });
  await zoom(page, 2);
  const finish = page.getByRole('button', { name: 'Finish', exact: true });
  await finish.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/p03-finish-200.png` });
  check('200%: the finish screen scrolls to Finish and Play again', await finish.isVisible() && await finish.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.bottom <= innerHeight && document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2) === el;
  }));
  check('200%: the finish screen has its close button', await page.getByRole('button', { name: 'Close meditation' }).isVisible());
  await page.close();

  // ── the voice fails, 360x640 with text at 200%
  page = await open(browser, 360, 640, { errors, fails: true });
  await page.getByText("The voice couldn't start").waitFor({ timeout: 5000 });
  await zoom(page, 2);
  const choose = page.getByRole('button', { name: 'Choose another voice' });
  await choose.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/p04-voice-error-200.png` });
  check('200%: the voice-error screen scrolls to Choose another voice', await choose.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.bottom <= innerHeight && r.right <= innerWidth && document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2) === el;
  }));
  check('200%: the voice-error screen has its close button', await page.getByRole('button', { name: 'Close meditation' }).isVisible());
  await page.close();

  check('no page errors', errors.length === 0, errors.join('; '));
  console.log(results.join('\n'));
  await browser.close();
})().catch(e => { console.log(results.join('\n')); console.error('SCRIPT FAILED:', e.message.split('\n')[0]); process.exit(1); });
