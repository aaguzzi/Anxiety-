const { chromium } = require('playwright');
// Screenshots go to the folder given as the first argument, or to the system's temp folder.
const OUT = process.argv[2] || require('os').tmpdir();
const URL = process.env.APP_URL || 'http://localhost:4173/';
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
const SCRIPT = 'TITLE: Evening Unwind\n' + Array.from({ length: 8 }, (_, i) => `This is spoken line number ${['one','two','three','four','five','six','seven','eight'][i]}.\n[pause 2]`).join('\n');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let lastBody = null;
  await page.route('https://api.anthropic.com/v1/messages*', async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    lastBody = JSON.parse(route.request().postData());
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
        content: [{ type: 'text', text: SCRIPT }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }) });
  });
  await page.addInitScript(() => {
    window.__spoken = [];
    window.speechSynthesis.speak = u => { window.__spoken.push({ text: u.text, rate: Math.round(u.rate * 100) / 100 }); setTimeout(() => u.onend && u.onend(new Event('end')), 400); };
    window.speechSynthesis.cancel = () => {};
  });
  const spoken = () => page.evaluate(() => window.__spoken);
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('ac-settings')));
  const caption = t => page.locator('.player-caption').getByText(t);
  const panel = page.locator('.voice-panel');

  await page.goto(URL);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ac-settings', JSON.stringify({ onboarded: true, voiceChoice: 'emma', speechSpeed: 0.65, anthropicKey: 'sk-ant-test' })); });
  await page.reload();
  await page.getByRole('button', { name: 'Meditate', exact: true }).click();

  // ── Voice & sounds opens straight from the Meditate tab
  check('Meditate shows the voice and sounds in use', await page.locator('.voice-card').getByText('Automatic · no background sounds').isVisible());
  await page.screenshot({ path: `${OUT}/v01-meditate.png` });
  await page.locator('.voice-card').click();
  await panel.waitFor();
  check('Voice & sounds opens directly, not inside Settings', await panel.getByText('Voice & sounds').first().isVisible() && await page.getByText('Daily reminder').count() === 0);
  check('a voice this build lacks shows as Automatic', (await panel.locator('.voice-row.selected .voice-name').textContent()).includes('Automatic'));
  check('fine controls are visible without digging', await panel.getByLabel('Softness').isVisible() && await panel.getByLabel('Room').isVisible() && await panel.getByLabel('Speaking speed').isVisible() && await panel.getByLabel('Silences between lines').isVisible());
  await page.screenshot({ path: `${OUT}/v02-panel-top.png` });

  await panel.locator('.voice-pick', { hasText: 'Phone voice' }).click();
  await page.waitForTimeout(700);
  let s = await spoken();
  check('tapping a voice selects it and plays a sample', s.length === 1 && s[0].rate === 0.65 && (await panel.locator('.voice-row.selected .voice-name').textContent()).includes('Phone voice'), JSON.stringify(s));

  await panel.getByLabel('Speaking speed').fill('0.9');
  await panel.getByLabel('Softness').fill('0.6');
  await panel.getByLabel('Room').fill('0');
  await panel.getByLabel('Silences between lines').fill('1.4');
  let st = await stored();
  check('sliders save fine-grained values', st.speechSpeed === 0.9 && st.voiceSoftness === 0.6 && st.voiceSpace === 0 && st.pauseScale === 1.4, JSON.stringify([st.speechSpeed, st.voiceSoftness, st.voiceSpace, st.pauseScale]));
  check('slider shows what the value means', await panel.getByText('90% of natural').isVisible() && await panel.getByText('1.4× as long').isVisible() && await panel.getByText('Medium · 60%').isVisible());
  await page.evaluate(() => { window.__spoken = []; });
  await panel.getByRole('button', { name: 'Play a sample' }).click();
  await page.waitForTimeout(600);
  s = await spoken();
  check('Play a sample uses the new speed', s.length === 1 && s[0].rate === 0.9, JSON.stringify(s));
  await panel.getByRole('button', { name: 'Very slow', exact: true }).click();
  st = await stored();
  check('quick pace sets speed and silences together', st.speechSpeed === 0.75 && st.pauseScale === 2);
  await panel.getByRole('button', { name: 'Calm', exact: true }).click();

  // ── Background sound layers
  await panel.getByRole('switch', { name: 'Rain' }).click();
  await panel.getByRole('switch', { name: 'Singing bowls' }).click();
  st = await stored();
  check('layers switch on independently', st.sounds.rain.on && st.sounds.bowls.on && !st.sounds.ocean, JSON.stringify(st.sounds));
  await panel.locator('#sound-rain').fill('0.8');
  st = await stored();
  check('each layer has its own volume', st.sounds.rain.volume === 0.8 && st.sounds.bowls.volume === 0.5, JSON.stringify(st.sounds));
  await panel.getByRole('switch', { name: 'Rain' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/v03-panel-sounds.png` });
  await panel.getByRole('switch', { name: 'Singing bowls' }).click();
  st = await stored();
  check('a layer switches off and keeps its volume', !st.sounds.bowls.on && st.sounds.bowls.volume === 0.5);
  await panel.locator('.back-btn').click();
  check('Meditate summary names the sounds', await page.locator('.voice-card').getByText('Phone voice · Rain').isVisible());

  // ── Player: clock, seek, start over, sounds, voice panel
  await page.evaluate(() => { window.__spoken = []; });
  await page.getByText('Leaves on a Stream').click();
  await page.locator('.player-caption span:not(.player-status)').first().waitFor({ timeout: 5000 });
  const first = await page.locator('.player-caption').textContent();
  const timeText = async () => (await page.locator('.player-time span').first().textContent());
  await page.waitForTimeout(2600);
  const t1 = await timeText();
  check('clock moves while playing', t1 !== '0:00', t1);
  await page.screenshot({ path: `${OUT}/v04-player.png` });
  const max = Number(await page.locator('.player-seek').getAttribute('max'));
  await page.locator('.player-seek').fill(String(Math.round(max / 2)));
  await page.waitForTimeout(900);
  const mid = await page.locator('.player-caption').textContent();
  const tMid = await timeText();
  const [mm, ss] = tMid.split(':').map(Number);
  check('seek bar jumps into the meditation', mid !== first && Math.abs(mm * 60 + ss - max / 2) < 40, `${tMid} of ${max}s`);
  await page.getByRole('button', { name: 'Start over' }).click();
  await page.waitForTimeout(700);
  check('Start over returns to the first line', (await page.locator('.player-caption').textContent()) === first);

  await page.locator('.player-sounds').getByRole('button', { name: 'Ocean', exact: true }).click();
  st = await stored();
  check('sound layers toggle from the player', st.sounds.ocean.on === true && await page.locator('.player-sounds .chip.selected').count() === 2);

  // move a few lines in, then change the voice speed from the player
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next line' }).click();
  await page.waitForTimeout(500);
  const before = await page.locator('.player-caption').textContent();
  await page.evaluate(() => { window.__spoken = []; });
  await page.locator('.player-voice-btn').click();
  await panel.waitFor();
  check('opening Voice & sounds pauses the meditation', await panel.getByText('Your meditation is paused').isVisible());
  await page.waitForTimeout(900);
  check('nothing is spoken while the panel is open', (await spoken()).length === 0, JSON.stringify(await spoken()));
  await panel.getByLabel('Speaking speed').fill('1');
  await page.evaluate(() => { window.__spoken = []; });
  await panel.locator('.back-btn').click();
  await page.waitForTimeout(900);
  s = await spoken();
  check('back in the player it carries on from the same sentence at the new speed', s.length >= 1 && s[0].rate === 1 && s[0].text.trim() === before.trim(), JSON.stringify(s.slice(0, 2)) + ' vs ' + before);

  // unchanged settings: resumes rather than restarting
  await page.locator('.player-voice-btn').click();
  await panel.waitFor();
  await panel.locator('.back-btn').click();
  await page.waitForTimeout(300);
  check('closing the panel unchanged resumes playback', await page.getByRole('button', { name: 'Pause', exact: true }).isVisible());

  // ── Resume where you left off
  const leftAt = await page.locator('.player-caption').textContent();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const pausedAt = await page.locator('.player-caption').textContent();
  await page.getByRole('button', { name: 'Close meditation' }).click();
  await page.getByText('Leaves on a Stream').click();
  await page.locator('.player-resumed').waitFor({ timeout: 5000 });
  await page.locator('.player-caption span:not(.player-status)').first().waitFor({ timeout: 5000 });
  check('reopening picks up where you left off', (await page.locator('.player-caption').textContent()) === pausedAt, `${pausedAt} / was ${leftAt}`);
  await page.screenshot({ path: `${OUT}/v05-player-resumed.png` });
  await page.getByRole('button', { name: 'Start from the beginning' }).click();
  await page.waitForTimeout(700);
  check('can start from the beginning instead', (await page.locator('.player-caption').textContent()) === first && await page.locator('.player-resumed').count() === 0);
  await page.getByRole('button', { name: 'Close meditation' }).click();

  // ── Make your own: fuller setup
  await page.getByText('Racing thoughts').click();
  await page.getByRole('group', { name: 'Length' }).getByRole('button', { name: '15 min' }).click();
  await page.getByRole('group', { name: 'Practice' }).getByRole('button', { name: 'Body scan' }).click();
  await page.getByRole('group', { name: 'Guidance' }).getByRole('button', { name: 'More silence' }).click();
  await page.getByRole('group', { name: "I'll be" }).getByRole('button', { name: 'Lying down' }).click();
  await page.getByRole('group', { name: 'End by bringing me' }).getByRole('button', { name: 'Toward sleep' }).click();
  await page.locator('#med-notes').fill('mention the sea');
  await page.locator('#med-notes').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/v06-make-your-own.png` });
  await page.getByRole('button', { name: 'Create meditation' }).click();
  await caption('This is spoken line number one.').waitFor({ timeout: 15000 });
  const ask = lastBody.messages[0].content;
  check('the request carries the whole setup', /Length: 15 minutes/.test(ask) && /Racing thoughts/.test(ask) && /body scan/i.test(ask) && /long silences/.test(ask) && /Lying down/.test(ask) && /drift toward sleep/.test(ask) && /mention the sea/.test(ask), ask.replace(/\n/g, ' | '));
  check('the request gives a word and silence budget', /about 760 spoken words/.test(ask) && /about 575 seconds/.test(ask), ask.split('\n')[0]);
  check('the prompt asks for a proper settling-in', /Settling in/.test(lastBody.system) && lastBody.output_config.effort === 'medium');
  await page.getByRole('button', { name: 'Close meditation' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Meditate', exact: true }).click();
  check('setup choices are remembered', await page.getByRole('group', { name: 'Practice' }).getByRole('button', { name: 'Body scan' }).getAttribute('aria-pressed') === 'true' && await page.getByRole('group', { name: 'Length' }).getByRole('button', { name: '15 min' }).getAttribute('aria-pressed') === 'true');

  // ── Settings no longer hides the voice options
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: /settings/i }).first().click();
  check('Settings has no voice list, only a way in', await page.locator('.voice-row').count() === 0 && await page.getByRole('button', { name: 'Open Voice & sounds' }).isVisible());
  await page.getByRole('button', { name: 'Open Voice & sounds' }).click();
  await panel.waitFor();
  await panel.locator('.back-btn').click();
  check('closing it from Settings returns to Settings', await page.getByText('Daily reminder', { exact: true }).isVisible());

  check('no page errors', errors.length === 0, errors.join('; '));
  console.log(results.join('\n'));
  await browser.close();
})().catch(e => { console.log(results.join('\n')); console.error('SCRIPT FAILED:', e.message.split('\n').slice(0, 3).join(' ')); process.exit(1); });
