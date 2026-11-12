// Stands in for the Android side of the app inside a browser test: the Capacitor bridge posts calls
// here, and this answers them the way the phone would. The meditation session below follows the
// behaviour of MeditationSession.java (states, events, tags), on a much faster clock.
(() => {
  const methods = names => names.map(name => ({ name, rtype: 'promise' })).concat([{ name: 'addListener' }, { name: 'removeListener' }, { name: 'removeAllListeners', rtype: 'promise' }]);
  window.prompt = () => '';
  window.Capacitor = {
    DEBUG: false, isLoggingEnabled: false, Plugins: {},
    PluginHeaders: [
      { name: 'NeuralVoice', methods: methods(['info', 'benchmark', 'prepare', 'play', 'stop', 'startSession', 'pauseSession', 'resumeSession', 'skipSession', 'seekSession', 'stopSession', 'sessionState', 'setSounds', 'previewSounds', 'clearCache', 'keepAwake']) },
      { name: 'App', methods: methods(['getState', 'exitApp', 'getInfo', 'getLaunchUrl', 'minimizeApp']) },
      { name: 'LocalNotifications', methods: methods(['checkPermissions', 'requestPermissions', 'schedule', 'cancel', 'getPending', 'createChannel']) },
      { name: 'TextToSpeech', methods: methods(['speak', 'stop', 'isLanguageSupported', 'getSupportedLanguages', 'getSupportedVoices']) },
      { name: 'CapacitorHttp', methods: methods(['request', 'get']) },
    ],
  };
  const phone = window.__phone = {
    calls: [],            // every call the app made: "Plugin.method" plus options
    listeners: {},        // "Plugin:event" -> callback ids
    config: { permission: 'granted', permissionDelay: 0, startFails: false, startPaused: false, lineMs: 500, prepareMs: 150, gapScale: 0.1, startDelay: 0 },
    session: null, lastStatus: 'none', lastIndex: 0, sessionsStarted: 0,
    preview: false, sounds: {}, keepAwake: false, active: true, spoken: [], played: [],
    count(name) { return this.calls.filter(c => c.name === name).length; },
    last(name) { const all = this.calls.filter(c => c.name === name); return all[all.length - 1]; },
    emit(plugin, event, data) {
      for (const id of this.listeners[plugin + ':' + event] || []) {
        window.Capacitor.fromNative({ callbackId: id, pluginId: plugin, methodName: 'addListener', success: true, data: JSON.parse(JSON.stringify(data)), save: true });
      }
    },
    setActive(on) { this.active = on; this.emit('App', 'appStateChange', { isActive: on }); },
    // What the phone itself does to a session, without the app asking.
    sessionError() { const s = this.session; if (s) s.end('error'); },
    sessionStoppedFromNotification() { const s = this.session; if (s) s.end('stopped'); },
  };

  function Session(o) {
    const n = o.lines.length;
    const s = { tag: o.tag, title: o.title, lines: o.lines, status: 'preparing', index: Math.max(0, Math.min(o.startIndex || 0, n - 1)), ended: false, token: 0, inGap: false, gapLeft: 0, gapEndsAt: 0, timer: null };
    const emit = (status, lineStart) => { s.status = status; phone.emit('NeuralVoice', 'sessionState', { status, index: s.index, lineStart: !!lineStart }); };
    const later = (ms, fn) => { const t = s.token; s.timer = setTimeout(() => { if (!s.ended && t === s.token) fn(); }, ms); };
    s.startLine = line => {
      if (line >= n) return s.end('done');
      s.index = line; s.inGap = false;
      emit('playing', true);
      later(phone.config.lineMs, () => {
        const gap = Math.max(20, s.lines[line].pauseMs * phone.config.gapScale);
        s.inGap = true; s.gapEndsAt = Date.now() + gap;
        later(gap, () => s.startLine(line + 1));
      });
    };
    s.begin = () => {
      if (phone.config.startPaused) { s.resumeIndex = s.index; s.resumeDelay = 0; emit('paused'); return; }
      emit('preparing');
      later(phone.config.prepareMs, () => s.startLine(s.index));
    };
    s.pause = () => {
      if (s.ended || s.status === 'paused') return;
      s.token++; clearTimeout(s.timer);
      if (s.inGap) { s.resumeIndex = s.index + 1; s.resumeDelay = Math.max(0, s.gapEndsAt - Date.now()); }
      else { s.resumeIndex = s.index; s.resumeDelay = 0; }
      emit('paused');
    };
    s.resume = () => {
      if (s.ended || s.status !== 'paused') return;
      s.token++;
      if (s.resumeDelay > 0 && s.resumeIndex > 0) {
        s.index = s.resumeIndex - 1; s.inGap = true; s.gapEndsAt = Date.now() + s.resumeDelay;
        emit('playing', false);
        later(s.resumeDelay, () => s.startLine(s.resumeIndex));
      } else s.startLine(s.resumeIndex);
    };
    s.seek = line => {
      if (s.ended) return;
      const target = Math.max(0, line);
      s.token++; clearTimeout(s.timer);
      if (target >= n) return s.end('done');
      if (s.status === 'paused') { s.resumeIndex = target; s.resumeDelay = 0; s.index = target; emit('paused'); }
      else s.startLine(target);
    };
    s.skip = by => { if (s.ended) return; s.seek((s.status === 'paused' ? (s.resumeDelay > 0 ? s.resumeIndex - 1 : s.resumeIndex) : s.index) + by); };
    s.end = status => {
      if (s.ended) return;
      s.ended = true; s.token++; clearTimeout(s.timer);
      if (phone.session === s) phone.session = null;
      phone.lastStatus = status; phone.lastIndex = s.index;
      emit(status);
    };
    return s;
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const handlers = {
    NeuralVoice: {
      info: () => ({ piper: true, kokoro: false, supertonic: true, sounds: true, cores: 8, ramMb: 8000 }),
      benchmark: () => ({ rtf: 0.1, cores: 8, ramMb: 8000 }),
      prepare: async () => { await wait(30); return { cached: false }; },
      play: async o => { phone.played.push(o.id); phone.playing = o.id; await wait(300); const stopped = phone.playing !== o.id; if (!stopped) phone.playing = null; return { stopped }; },
      stop: () => { phone.playing = null; },
      startSession: async o => {
        if (phone.config.startDelay) await wait(phone.config.startDelay);
        if (phone.config.startFails) { if (phone.session) phone.session.end('stopped'); throw new Error('Could not start playback'); }
        if (phone.session) phone.session.end('stopped');
        phone.sessionsStarted++;
        phone.lastStatus = 'none';
        phone.session = Session(o);
        phone.session.begin();
      },
      pauseSession: () => { if (phone.session) phone.session.pause(); },
      resumeSession: () => { if (phone.session) phone.session.resume(); },
      skipSession: o => { if (phone.session) phone.session.skip(o.by == null ? 1 : o.by); },
      seekSession: o => { if (phone.session) phone.session.seek(o.index || 0); },
      stopSession: o => { const s = phone.session; if (s && (!o || !o.tag || o.tag === s.tag)) s.end('stopped'); },
      sessionState: () => (phone.session ? { status: phone.session.status, index: phone.session.index } : { status: phone.lastStatus, index: phone.lastIndex }),
      setSounds: o => { phone.sounds = o.levels || {}; },
      previewSounds: o => { phone.preview = !!o.on; },
      clearCache: () => {},
      keepAwake: o => { phone.keepAwake = !!o.on; },
    },
    App: { getState: () => ({ isActive: phone.active }), exitApp: () => {}, getInfo: () => ({ version: '1.14', build: '15' }), getLaunchUrl: () => ({}), minimizeApp: () => {} },
    LocalNotifications: {
      checkPermissions: () => ({ display: phone.config.permission }),
      requestPermissions: async () => { await wait(phone.config.permissionDelay); phone.config.permission = 'granted'; return { display: 'granted' }; },
      schedule: () => ({ notifications: [] }), cancel: () => {}, getPending: () => ({ notifications: [] }), createChannel: () => {},
    },
    TextToSpeech: {
      speak: async o => { phone.spoken.push(o.text); const mine = phone.ttsToken = (phone.ttsToken || 0) + 1; await wait(300); if (mine !== phone.ttsToken) return; },
      stop: () => { phone.ttsToken = (phone.ttsToken || 0) + 1; },
      isLanguageSupported: () => ({ supported: true }), getSupportedLanguages: () => ({ languages: ['en-US'] }), getSupportedVoices: () => ({ voices: [] }),
    },
    CapacitorHttp: { request: () => ({ status: 200, data: { versionCode: 0 } }), get: () => ({ status: 200, data: { versionCode: 0 } }) },
  };

  window.androidBridge = {
    postMessage(json) {
      const call = JSON.parse(json);
      const { callbackId, pluginId, methodName, options } = call;
      if (pluginId === 'Console') return;
      phone.calls.push({ name: pluginId + '.' + methodName, options });
      if (methodName === 'addListener') { (phone.listeners[pluginId + ':' + options.eventName] ||= []).push(callbackId); return; }
      if (methodName === 'removeListener') { const l = phone.listeners[pluginId + ':' + options.eventName] || []; const i = l.indexOf(options.callbackId); if (i >= 0) l.splice(i, 1); return; }
      const reply = (success, data, error) => setTimeout(() => window.Capacitor.fromNative({ callbackId, pluginId, methodName, success, data, error }), 0);
      const handler = (handlers[pluginId] || {})[methodName];
      if (!handler) return reply(false, null, { message: `${pluginId}.${methodName} is not implemented in the fake phone` });
      Promise.resolve().then(() => handler(options || {})).then(data => reply(true, data === undefined ? {} : data), e => reply(false, null, { message: String(e.message || e) }));
    },
  };
})();
