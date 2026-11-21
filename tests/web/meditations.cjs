const { chromium } = require('playwright');
// Screenshots go to the folder given as the first argument, or to the system's temp folder.
const OUT = process.argv[2] || require('os').tmpdir();
const URL = process.env.APP_URL || 'http://localhost:4173/';
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);

const SCRIPT = 'Here is your script:\n**TITLE: Settling After Work**\nLine one here.\n[pause 3 seconds]\nLine two here.\n[pause 3]\nLine three here.\n[pause 2]\nLine four here.';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let posts = 0;
  let mode = 'ok';
  await page.route('https://api.anthropic.com/v1/messages*', async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    posts++;
    if (mode === 'auth') {
      return route.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
    }
    await new Promise(r => setTimeout(r, 1500));
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
        content: [{ type: 'text', text: SCRIPT }], stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 } }) });
  });
  // Record what is spoken; each line "takes" 400ms. With __ttsFails set, the phone's voice fails.
  await page.addInitScript(() => {
    window.__spoken = [];
    window.speechSynthesis.speak = u => {
      if (window.__ttsFails) { setTimeout(() => u.onerror && u.onerror(Object.assign(new Event('error'), { error: 'synthesis-failed' })), 50); return; }
      window.__spoken.push(u.text);
      setTimeout(() => u.onend && u.onend(new Event('end')), 400);
    };
    window.speechSynthesis.cancel = () => {};
  });
  const spoken = () => page.evaluate(() => window.__spoken);
  const caption = t => page.locator('.player-caption').getByText(t);

  await page.goto(URL);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ac-settings', JSON.stringify({ onboarded: true })); });
  await page.reload();
  await page.getByRole('button', { name: 'Meditate', exact: true }).click();

  // built-in meditation without a key
  check('ready-made meditations listed', await page.locator('.saved-med').count() === 11);
  await page.screenshot({ path: `${OUT}/n01-meditate-nokey.png` });
  await page.getByText('Arriving Here').click();
  await caption('Wherever you are, let yourself arrive.').waitFor({ timeout: 5000 });
  check('ready-made meditation plays with no key', true);
  await page.getByRole('button', { name: 'Close meditation' }).click();

  // add key via Settings, lands on the key field
  await page.getByRole('button', { name: 'Add API key' }).click();
  await page.waitForTimeout(400);
  check('settings opens at the key field', await page.locator('#api-key').isVisible() && await page.locator('#api-key').evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
  await page.locator('#api-key').fill('sk-ant-test');
  await page.locator('.exercise-overlay .back-btn').click();

  mode = 'auth';
  await page.getByText('Stress about work').click();
  await page.getByRole('button', { name: 'Create meditation' }).click();
  await page.getByRole('alert').waitFor({ timeout: 15000 });
  check('bad key shows a clear error', (await page.getByRole('alert').textContent()).includes('API key was not accepted'));

  // leave the tab while it writes: no second request, nothing pops up elsewhere, saved on return
  mode = 'ok';
  posts = 0;
  await page.getByRole('button', { name: 'Create meditation' }).click();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Meditate', exact: true }).click();
  check('still shows busy after leaving and returning', await page.getByText('Writing your meditation…').isVisible());
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.waitForTimeout(2500);
  check('player does not pop up on another tab', await page.locator('.player-title').count() === 0);
  check('only one request sent', posts === 1, `posts=${posts}`);
  await page.getByRole('button', { name: 'Meditate', exact: true }).click();
  check('meditation saved with parsed title', await page.getByText('Settling After Work').isVisible());

  // play it: preamble and title are not spoken
  await page.evaluate(() => { window.__spoken = []; });
  await page.getByText('Settling After Work').click();
  await caption('Line one here.').waitFor({ timeout: 5000 });
  await page.waitForTimeout(900);            // now in the 3s gap after line one
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/n02-player-paused.png` });
  await page.getByRole('button', { name: 'Resume' }).click();
  await caption('Line two here.').waitFor({ timeout: 6000 });
  let s = await spoken();
  check('title and preamble are not read aloud', !s.some(t => /TITLE|Here is your script|pause/i.test(t)), JSON.stringify(s));
  check('pause in a silence does not repeat the line', s.filter(t => t === 'Line one here.').length === 1, JSON.stringify(s));

  // skip while paused stays paused
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Next line' }).click();
  await page.waitForTimeout(800);
  check('skip while paused stays paused on the new line', await page.getByText('Paused').isVisible() && await caption('Line three here.').isVisible());
  await page.getByRole('button', { name: 'Previous line' }).click();
  await page.getByRole('button', { name: 'Previous line' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await caption('Line one here.').waitFor({ timeout: 3000 });

  // double-tap next moves two lines
  await page.getByRole('button', { name: 'Next line' }).dblclick();
  await caption('Line three here.').waitFor({ timeout: 3000 });
  check('double-tap Next moves two lines', true);
  await page.getByRole('button', { name: 'Next line' }).click();
  await page.getByRole('button', { name: 'Next line' }).click();
  await page.getByText('Welcome back.').waitFor({ timeout: 3000 });
  check('Next on the last line finishes', true);
  const meditationsDone = async () => Object.values(JSON.parse(await page.evaluate(() => localStorage.getItem('ac-history')) || '{}')).flat().filter(id => id === 'meditation').length;
  for (let i = 0; i < 20 && await meditationsDone() === 0; i++) await page.waitForTimeout(100); // saved just after the screen shows
  check('reaching the end counts as practice, before Finish is tapped', await meditationsDone() === 1, await page.evaluate(() => localStorage.getItem('ac-history')));
  check('the finish screen keeps the close button', await page.getByRole('button', { name: 'Close meditation' }).isVisible());
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  check('Finish closes the player, and the practice is counted once', await page.locator('.player-overlay').count() === 0 && await meditationsDone() === 1);

  // delete
  await page.getByRole('button', { name: /Delete Settling/ }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  check('delete removes it (ready-made ones stay)', await page.locator('.saved-med').count() === 11);

  // the phone's voice fails: the error screen offers another voice, and tries again after it
  await page.evaluate(() => { window.__ttsFails = true; });
  await page.getByText('Arriving Here').click();
  await page.getByText("The voice couldn't start").waitFor({ timeout: 5000 });
  check('the voice-error screen keeps the close button', await page.getByRole('button', { name: 'Close meditation' }).isVisible());
  await page.getByRole('button', { name: 'Choose another voice' }).click();
  await page.locator('.voice-panel').waitFor({ timeout: 3000 });
  check('Choose another voice opens Voice & sounds', true);
  await page.evaluate(() => { window.__ttsFails = false; window.__spoken = []; });
  await page.locator('.voice-panel .back-btn').click();
  await caption('Welcome.').waitFor({ timeout: 5000 });
  check('back from Voice & sounds it tries the voice again, from the line that failed', (await spoken())[0] === 'Welcome.', JSON.stringify(await spoken()));
  await page.getByRole('button', { name: 'Close meditation' }).click();
  await page.evaluate(() => { window.__ttsFails = true; });
  await page.getByText('Arriving Here').click();
  await page.getByText("The voice couldn't start").waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  check('Close on the voice-error screen leaves the player', await page.locator('.player-overlay').count() === 0);
  await page.evaluate(() => { window.__ttsFails = false; });

  // regressions: tab scroll reset, breathing completion screen
  await page.getByRole('button', { name: 'Toolbox', exact: true }).click();
  await page.locator('.screen').evaluate(el => el.scrollTo(0, 900));
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  check('tab switch resets scroll', await page.locator('.screen').evaluate(el => el.scrollTop) === 0);

  check('no page errors', errors.length === 0, errors.join('; '));
  console.log(results.join('\n'));
  await browser.close();
})().catch(e => { console.log(results.join('\n')); console.error('SCRIPT FAILED:', e.message.split('\n')[0]); process.exit(1); });
