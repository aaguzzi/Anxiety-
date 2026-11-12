// Runs the real web app against a stand-in for the phone (fake-phone.js), so the code paths that
// only exist in the Android app (the phone playing the meditation itself) are exercised.
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.APP_URL || 'http://localhost:4173/';
const BRIDGE = __dirname + '/../../node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js';
const results = [];
const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); };
const SETTINGS = { onboarded: true, voiceChoice: 'ruth', speechSpeed: 0.75, pauseScale: 1, voiceQuality: 'best', voiceSoftness: 0.3, voiceSpace: 0,
  sounds: { rain: { on: true, volume: 0.5 } }, anthropicKey: 'sk-ant-test', voiceBench: { rtf: 0.1, cores: 8, ramMb: 8000 } };
const S0 = 'You are having a wave of panic, and you opened this.';
const S2 = 'Put both feet flat on the floor, and press them down.';
const SCRIPT = 'TITLE: Evening Unwind\n' + ['one', 'two', 'three', 'four'].map(w => `This is spoken line number ${w}.\n[pause 2]`).join('\n');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://api.anthropic.com/v1/messages*', async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    await new Promise(r => setTimeout(r, 900));
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: SCRIPT }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }) });
  });
  await page.addInitScript(fs.readFileSync(__dirname + '/fake-phone.js', 'utf8'));
  await page.addInitScript(fs.readFileSync(BRIDGE, 'utf8'));

  const phone = fn => page.evaluate(fn);
  const wait = ms => page.waitForTimeout(ms);
  const caption = t => page.locator('.player-caption').getByText(t);
  const player = page.locator('.player-overlay');
  const until = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await page.evaluate(fn)) return true; await wait(40); } return false; };
  async function fresh(extra = {}, config = {}) {
    await page.goto(URL);
    await page.evaluate(([s, x]) => { localStorage.clear(); localStorage.setItem('ac-settings', JSON.stringify(s)); for (const k in x) localStorage.setItem(k, JSON.stringify(x[k])); }, [SETTINGS, extra]);
    await page.reload();
    await page.evaluate(c => Object.assign(window.__phone.config, c), config);
    await page.getByRole('button', { name: 'Meditate', exact: true }).click();
  }
  const open = () => page.getByText('Panic, Right Now').click();

  // ── A. An ordinary start, then pause and resume
  await fresh(); await open();
  await caption(S0).waitFor({ timeout: 5000 });
  let a = await phone(() => ({ platform: window.Capacitor.getPlatform(), starts: __phone.count('NeuralVoice.startSession'), o: __phone.last('NeuralVoice.startSession').options, preview: __phone.preview, awake: __phone.keepAwake, sounds: __phone.sounds, status: __phone.session && __phone.session.status }));
  check('the app believes it is running on a phone', a.platform === 'android', a.platform);
  check('one session started, from the first sentence, with a name', a.starts === 1 && a.o.startIndex === 0 && typeof a.o.tag === 'string' && a.o.tag.length > 5, { starts: a.starts, startIndex: a.o.startIndex, tag: a.o.tag });
  check('speech files are named by line, voice, speed, quality and wording', /^starter-panic-0-ruth-75-s16-e2-t[0-9a-z]+$/.test(a.o.lines[0].id) && a.o.lines[0].id !== a.o.lines[1].id.replace('-1-', '-0-'), a.o.lines[0].id);
  check('once the phone is playing, the preview is off and the screen may sleep', a.preview === false && a.awake === false, { preview: a.preview, awake: a.awake });
  check('the phone was told which sounds are on', a.sounds.rain === 0.5, a.sounds);
  check('player names the voice', (await page.locator('.player-voice').textContent()).includes('Ruth'));
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  check('Pause reaches the phone', await until(() => __phone.session.status === 'paused') && await page.locator('.player-voice').getByText('Paused').isVisible());
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  check('Resume reaches the phone', await until(() => __phone.session.status === 'playing'));
  // The clock must start again with a sentence that is replayed from its start.
  await caption(S2).waitFor({ timeout: 6000 });
  const before = await page.locator('.player-time span').first().textContent();
  for (let i = 0; i < 6; i++) { await wait(330); await page.getByRole('button', { name: 'Pause', exact: true }).click(); await until(() => __phone.session.status === 'paused'); await page.getByRole('button', { name: 'Resume', exact: true }).click(); await until(() => __phone.session.status === 'playing'); }
  const after = await page.locator('.player-time span').first().textContent();
  const secs = t => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };
  check('replaying a sentence six times does not run the clock on', await caption(S2).isVisible() && secs(after) - secs(before) <= 1, `${before} -> ${after}`);

  // ── B. The natural voice fails while Voice & sounds is open
  await fresh(); await open();
  await caption(S2).waitFor({ timeout: 6000 });
  await page.locator('.player-voice-btn').click();
  await page.locator('.voice-panel').waitFor();
  check('opening Voice & sounds pauses the phone and previews the sounds', await until(() => __phone.session && __phone.session.status === 'paused' && __phone.preview === true));
  await phone(() => __phone.sessionError());
  await wait(700);
  let b = await phone(() => ({ spoken: __phone.spoken.slice(), played: __phone.played.slice() }));
  check('nothing starts speaking under the open panel', b.spoken.length === 0 && b.played.length === 0, b);
  await page.locator('.voice-panel .back-btn').click();
  check('back in the player it carries on from the same sentence with the phone voice', await until(() => __phone.spoken.length > 0) && (await phone(() => __phone.spoken[0])) === S2, await phone(() => __phone.spoken[0]));
  check('and now keeps the screen on and the sounds playing itself', await until(() => __phone.keepAwake === true && __phone.preview === true));
  check('player says which voice took over', await page.locator('.player-voice').getByText('Phone voice').isVisible());

  // ── C. The natural voice fails while playing, app on screen
  await fresh(); await open();
  await caption(S2).waitFor({ timeout: 6000 });
  await phone(() => __phone.sessionError());
  check('the phone voice carries on from the same sentence', await until(() => __phone.spoken.length > 0) && (await phone(() => __phone.spoken[0])) === S2, await phone(() => __phone.spoken[0]));
  check('with the screen kept on and the sounds kept playing', await until(() => __phone.keepAwake === true && __phone.preview === true), await phone(() => ({ awake: __phone.keepAwake, preview: __phone.preview })));
  check('and stops listening to the session that failed', await until(() => (__phone.listeners['NeuralVoice:sessionState'] || []).length === 0), await phone(() => (__phone.listeners['NeuralVoice:sessionState'] || []).length));

  // ── D. The natural voice fails while the app is off screen
  await fresh(); await open();
  await caption(S2).waitFor({ timeout: 6000 });
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }));
  await phone(() => __phone.sessionError());
  await wait(700);
  check('off screen: it waits, paused, without speaking', (await phone(() => __phone.spoken.length)) === 0 && await page.locator('.player-voice').getByText('Paused').isVisible());
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }));
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  check('Resume then carries on from that sentence', await until(() => __phone.spoken.length > 0) && (await phone(() => __phone.spoken[0])) === S2, await phone(() => __phone.spoken[0]));

  // ── E. Voice & sounds opened while the phone is still being asked to start (permission prompt up)
  await fresh({}, { permission: 'prompt', permissionDelay: 700 }); await open();
  await wait(150);
  // Nothing has asked other apps to be quiet yet, so the sounds must not have started either.
  check('no sounds before the phone has been asked to play', (await phone(() => __phone.preview)) === false && (await phone(() => __phone.count('NeuralVoice.startSession'))) === 0);
  await page.locator('.player-voice-btn').click();
  await page.locator('.voice-panel').waitFor();
  await wait(1300);
  let e = await phone(() => ({ live: !!__phone.session, started: __phone.sessionsStarted, stop: (__phone.last('NeuralVoice.stopSession') || {}).options, tag: __phone.last('NeuralVoice.startSession').options.tag, pauses: __phone.count('NeuralVoice.pauseSession') }));
  check('nothing is left playing under the panel', e.live === false && e.started === 1, e);
  check('the abandoned session was stopped by name', e.stop && e.stop.tag === e.tag, e);
  await page.locator('.voice-panel .back-btn').click();
  check('closing the panel starts the meditation properly', await until(() => __phone.sessionsStarted === 2 && __phone.session && __phone.session.status === 'playing'), await phone(() => ({ started: __phone.sessionsStarted, status: __phone.session && __phone.session.status })));
  await wait(600);
  check('and it stays alive', await phone(() => !!__phone.session && !__phone.session.ended));

  // ── F. "Start from the beginning" pressed in the same window: the late stop must not end the new session
  await fresh({ 'ac-med-positions': { 'starter-panic': { index: 6, at: Date.now() } } }, { permission: 'prompt', permissionDelay: 700 }); await open();
  check('offers to start from the beginning', await page.getByText('Picking up where you left off').isVisible());
  await wait(150);
  await page.getByRole('button', { name: 'Start from the beginning' }).click();
  await wait(1800);
  let f = await phone(() => ({ live: !!__phone.session && !__phone.session.ended, tag: __phone.session && __phone.session.tag, index: __phone.session && __phone.session.index, starts: __phone.calls.filter(c => c.name === 'NeuralVoice.startSession').map(c => ({ tag: c.options.tag, from: c.options.startIndex })), stops: __phone.calls.filter(c => c.name === 'NeuralVoice.stopSession').map(c => c.options.tag) }));
  const lastStart = f.starts[f.starts.length - 1];
  check('exactly one session survives, the one from the beginning', f.live && lastStart.from === 0 && f.tag === lastStart.tag && f.index <= 3, f);
  check('the first sentence is on screen', await caption(S0).isVisible() || await page.locator('.player-caption').getByText('That was a good thing to do.').isVisible() || await caption(S2).isVisible());

  // ── G. Started during a phone call: the phone holds it paused
  await fresh({}, { startPaused: true }); await open();
  check('player shows Paused, not an endless "Preparing"', await page.locator('.player-voice').getByText('Paused').isVisible({ timeout: 3000 }).catch(() => false) || (await wait(800), await page.locator('.player-voice').getByText('Paused').isVisible()));

  // ── H. The phone refuses to start playback: fall back to timing the lines from the screen
  await fresh({}, { startFails: true }); await open();
  check('falls back to playing the natural voice line by line', await until(() => __phone.played.length > 0, 6000), await phone(() => __phone.played[0]));
  let h = await phone(() => ({ awake: __phone.keepAwake, preview: __phone.preview, listeners: (__phone.listeners['NeuralVoice:sessionState'] || []).length, id: __phone.played[0], prepared: __phone.calls.filter(c => c.name === 'NeuralVoice.prepare')[0].options.id }));
  check('keeps the screen on and plays the sounds itself', h.awake === true && h.preview === true, h);
  check('no listener left behind from the failed start', h.listeners === 0, h.listeners);
  check('the file that is played is the file that was prepared', h.id === h.prepared, h);
  // A sample played from Voice & sounds over this meditation must not cancel the lines queued for it.
  const callsBefore = await phone(() => __phone.calls.length);
  await page.locator('.player-voice-btn').click();
  await page.locator('.voice-panel').waitFor();
  await page.locator('.voice-panel .voice-pick[aria-pressed="true"]').click();
  await wait(120);
  await page.locator('.voice-panel .back-btn').click();
  await wait(400);
  const stops = await page.evaluate(n => __phone.calls.slice(n).filter(c => c.name === 'NeuralVoice.stop').map(c => c.options), callsBefore);
  check('a sample over an in-app meditation leaves its queued lines alone', stops.length > 0 && stops.every(o => o && o.cancelQueued === false), stops);

  // ── I. A meditation finishes being written while the app is off screen
  await fresh();
  await page.getByText('Stress about work').click();
  await page.getByRole('button', { name: 'Create meditation' }).click();
  await wait(200);
  await phone(() => __phone.setActive(false));
  await wait(1700);
  let i1 = await phone(() => ({ saved: JSON.parse(localStorage.getItem('ac-meditations') || '[]').length, starts: __phone.count('NeuralVoice.startSession') }));
  check('written and saved, but not started while off screen', i1.saved === 1 && i1.starts === 0 && await player.count() === 0, i1);
  await phone(() => __phone.setActive(true));
  check('it opens and starts when the app is back', await until(() => __phone.count('NeuralVoice.startSession') === 1) && await player.count() === 1);
  await page.getByRole('button', { name: 'Close meditation' }).click();
  await phone(() => __phone.setActive(false)); await phone(() => __phone.setActive(true)); await wait(300);
  check('and does not open again later', await player.count() === 0);

  // ── J. A voice sample hands the speaker back when it ends
  await fresh();
  await page.locator('.voice-card').click();
  await page.locator('.voice-panel').waitFor();
  await page.locator('.voice-panel').getByRole('button', { name: /^Clara/ }).click();
  await until(() => __phone.played.length > 0);
  await wait(700);
  let j = await phone(() => ({ id: __phone.played[0], calls: __phone.calls.map(c => c.name + (c.name === 'NeuralVoice.stop' ? ':' + JSON.stringify(c.options) : '')) }));
  const playAt = j.calls.lastIndexOf('NeuralVoice.play');
  check('sample file is named by voice and wording', /^sample-clara-75-s16-e2-t[0-9a-z]+$/.test(j.id), j.id);
  check('after the sample ends the speaker is handed back, without cancelling anything queued', j.calls.slice(playAt + 1).includes('NeuralVoice.stop:{"cancelQueued":false}'), j.calls.slice(playAt));
  await page.locator('.voice-panel .back-btn').click();

  // ── K. Finishing, playing again, and Stop from the notification
  await fresh(); await open();
  await caption(S0).waitFor({ timeout: 5000 });
  await phone(() => __phone.session.seek(999));
  check('finishing shows the completion screen', await page.getByText('Welcome back.').isVisible({ timeout: 3000 }).catch(() => false) || (await wait(500), await page.getByText('Welcome back.').isVisible()));
  await page.getByRole('button', { name: 'Play again' }).click();
  check('Play again starts a new session from the top', await until(() => __phone.sessionsStarted === 2 && __phone.session && __phone.session.status === 'playing' && __phone.last('NeuralVoice.startSession').options.startIndex === 0));
  await phone(() => __phone.sessionStoppedFromNotification());
  check('Stop from the notification closes the player', await until(() => !document.querySelector('.player-overlay')));

  check('no page errors', errors.length === 0, errors.slice(0, 3));
  console.log(results.join('\n'));
  await browser.close();
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log(results.join('\n')); console.error('TEST CRASHED', e); process.exit(2); });
