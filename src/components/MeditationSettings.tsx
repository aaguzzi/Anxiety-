import { useEffect, useRef, useState } from 'react';
import { Settings } from '../types';
import {
  automaticVoice, benchVerdict, chooseEngine, FEATURED_VOICES, InstalledModels, installedModels, PACES,
  PAUSE_SCALES, SPEEDS, VoiceEngine, VoiceOption, voiceOption, VOICES,
} from '../lib/voice';

const SAMPLE = 'Take a slow breath in, and let it go. There is nothing you need to fix right now.';

interface Props {
  settings: Settings;
  onChange: (update: (prev: Settings) => Settings) => void;
}

export default function MeditationSettings({ settings, onChange }: Props) {
  const [installed, setInstalled] = useState<InstalledModels | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [listening, setListening] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const engineRef = useRef<VoiceEngine | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    installedModels().then(setInstalled);
    return () => {
      requestRef.current++;
      engineRef.current?.stop();
    };
  }, []);

  const chosen = voiceOption(settings.voiceChoice);
  // A voice this build doesn't include behaves as Automatic, so show it that way.
  const selected = installed && chosen.model && !installed[chosen.model] ? 'auto' : chosen.id;
  const available = VOICES.filter(v => !v.model || installed?.[v.model]);
  const hasNatural = available.some(v => v.model);
  // Up front: Automatic and a few curated voices (plus whatever is selected, so its tick is visible).
  const isFeatured = (v: VoiceOption) =>
    FEATURED_VOICES.includes(v.id) || v.id === selected || (!hasNatural && v.id === 'system');
  const featured = available.filter(isFeatured);
  const others = available.filter(v => !isFeatured(v));

  const pace = PACES.find(p => p.speed === settings.speechSpeed && p.pauseScale === settings.pauseScale);

  async function stopSample() {
    requestRef.current++;
    setListening(null);
    await engineRef.current?.stop();
  }

  // Choosing a voice plays it, so the choice is made by ear.
  async function choose(voiceId: string) {
    onChange(prev => ({ ...prev, voiceChoice: voiceId }));
    await engineRef.current?.stop();
    const request = ++requestRef.current;
    setListening(voiceId);
    setNote(null);
    try {
      const engine = await chooseEngine(
        { ...settings, voiceChoice: voiceId },
        bench => onChange(prev => ({ ...prev, voiceBench: bench })),
      );
      if (request !== requestRef.current) return;
      engineRef.current = engine;
      if (voiceId === 'auto') setNote(`Automatic is using ${engine.voice.label} on this device.`);
      else if (engine.slowToPrepare) setNote('Preparing the sample…');
      await engine.speak('sample', SAMPLE);
      if (request === requestRef.current) setNote(null);
    } catch {
      if (request === requestRef.current) setNote("That voice couldn't start on this device. Try another one.");
    } finally {
      if (request === requestRef.current) setListening(null);
    }
  }

  function voiceRow(v: VoiceOption) {
    const playing = listening === v.id;
    return (
      <div key={v.id} className={`voice-row ${selected === v.id ? 'selected' : ''}`}>
        <button className="voice-pick" aria-pressed={selected === v.id} onClick={() => choose(v.id)}>
          <span className="voice-name">{selected === v.id ? '✓ ' : ''}{v.label}</span>
          <span className="voice-detail">{v.detail}</span>
        </button>
        {playing && (
          <button className="voice-listen" onClick={stopSample} aria-label={`Stop the ${v.label} sample`}>Stop</button>
        )}
      </div>
    );
  }

  const bench = settings.voiceBench;
  const autoText = !installed || !hasNatural || benchVerdict(bench) === 'untested'
    ? ''
    : benchVerdict(bench) === 'low-memory'
      ? "This device doesn't have enough memory for the natural voices, so Automatic uses the phone voice."
      : `On this device Automatic uses ${automaticVoice(bench, installed).label}.`;

  return (
    <div className="settings-section" id="meditation-settings">
      <div className="section-label">Meditation voice</div>
      <div className="card settings-card">
        <div className="settings-row-title">Voice</div>
        <p className="settings-row-sub">Tap a voice to choose it and hear a sample.</p>
        <div className="voice-list">{featured.map(voiceRow)}</div>
        {note && <p className="settings-row-sub mt-2" role="status">{note}</p>}
        {selected === 'auto' && !note && autoText && <p className="settings-row-sub mt-2">{autoText}</p>}
        {installed && !hasNatural && (
          <p className="settings-row-sub mt-2">Natural voices are available in the Android app.</p>
        )}

        <div className="settings-row-title mt-6">Pace</div>
        <div className="chip-row">
          {PACES.map(p => (
            <button
              key={p.id}
              className={`chip ${pace?.id === p.id ? 'selected' : ''}`}
              aria-pressed={pace?.id === p.id}
              onClick={() => onChange(prev => ({ ...prev, speechSpeed: p.speed, pauseScale: p.pauseScale }))}
            >
              {p.label}
            </button>
          ))}
          {!pace && <span className="chip selected" aria-label="Custom pace selected">Custom</span>}
        </div>
        <p className="settings-row-sub mt-2">
          {pace?.id === 'brisk' && 'Natural speaking speed with shorter silences.'}
          {pace?.id === 'calm' && 'Slow speech with silences as written.'}
          {pace?.id === 'slow' && 'Slow speech with silences twice as long. Meditations run longer than their stated length.'}
          {!pace && 'Set under Advanced.'}
        </p>

        <button
          className="btn btn-ghost advanced-toggle"
          aria-expanded={showAdvanced}
          onClick={() => setShowAdvanced(open => !open)}
        >
          {showAdvanced ? 'Hide advanced options' : 'Advanced options'}
        </button>

        {showAdvanced && (
          <div className="advanced-panel">
            {others.length > 0 && (
              <>
                <div className="settings-row-title">More voices</div>
                <div className="voice-list">{others.map(voiceRow)}</div>
              </>
            )}

            {installed?.supertonic && (
              <>
                <div className="settings-row-title mt-6">Sound quality</div>
                <div className="chip-row">
                  {([['best', 'Best sound'], ['fast', 'Start sooner']] as const).map(([value, label]) => (
                    <button
                      key={value}
                      className={`chip ${settings.voiceQuality === value ? 'selected' : ''}`}
                      aria-pressed={settings.voiceQuality === value}
                      onClick={() => onChange(prev => ({ ...prev, voiceQuality: value }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="settings-row-sub mt-2">
                  "Start sooner" prepares a new meditation about three times faster, with a slightly rougher voice.
                </p>
              </>
            )}

            <div className="settings-row-title mt-6">Speaking speed</div>
            <div className="chip-row">
              {SPEEDS.map(s => (
                <button
                  key={s.value}
                  className={`chip ${settings.speechSpeed === s.value ? 'selected' : ''}`}
                  aria-pressed={settings.speechSpeed === s.value}
                  onClick={() => onChange(prev => ({ ...prev, speechSpeed: s.value }))}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {installed?.supertonic && settings.speechSpeed < 0.75 && (
              <p className="settings-row-sub mt-2">
                The natural voices stay clear by not speaking slower than "Slow". At this setting they leave longer silences instead.
              </p>
            )}

            <div className="settings-row-title mt-6">Silences between lines</div>
            <div className="chip-row">
              {PAUSE_SCALES.map(p => (
                <button
                  key={p.value}
                  className={`chip ${settings.pauseScale === p.value ? 'selected' : ''}`}
                  aria-pressed={settings.pauseScale === p.value}
                  onClick={() => onChange(prev => ({ ...prev, pauseScale: p.value }))}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="section-label mt-6" id="custom-meditations">Custom meditations</div>
      <div className="card settings-card">
        <label className="settings-row-title" htmlFor="api-key">Anthropic API key</label>
        <p className="settings-row-sub mb-4">
          Used to write your meditation scripts. The key is stored only on this device. What you type when
          creating a meditation is sent to Anthropic; nothing else leaves your phone.
        </p>
        <div className="key-row">
          <input
            id="api-key"
            type={showKey ? 'text' : 'password'}
            className="form-input"
            placeholder="sk-ant-…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={settings.anthropicKey}
            onChange={e => { const v = e.target.value.trim(); onChange(prev => ({ ...prev, anthropicKey: v })); }}
          />
          <button className="btn btn-secondary key-toggle" onClick={() => setShowKey(s => !s)}>
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
    </div>
  );
}
