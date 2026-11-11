import { useEffect, useRef, useState } from 'react';
import { Settings } from '../types';
import {
  automaticVoice, benchVerdict, chooseEngine, InstalledModels, installedModels, PAUSE_SCALES, SPEEDS, VoiceEngine,
  VOICE_GROUPS, voiceOption, VOICES,
} from '../lib/voice';

const SAMPLE = 'Take a slow breath in, and let it go. There is nothing you need to fix right now.';

interface Props {
  settings: Settings;
  onChange: (update: (prev: Settings) => Settings) => void;
}

export default function MeditationSettings({ settings, onChange }: Props) {
  const [installed, setInstalled] = useState<InstalledModels | null>(null);
  const [showKey, setShowKey] = useState(false);
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

  const selected = voiceOption(settings.voiceChoice).id;
  const voices = VOICES.filter(v => !v.model || installed?.[v.model]);

  async function listen(voiceId: string) {
    const request = ++requestRef.current;
    await engineRef.current?.stop();
    if (listening === voiceId) {
      setListening(null);
      return;
    }
    setListening(voiceId);
    setNote(null);
    try {
      const engine = await chooseEngine(
        { ...settings, voiceChoice: voiceId },
        bench => onChange(prev => ({ ...prev, voiceBench: bench })),
      );
      if (request !== requestRef.current) return;
      engineRef.current = engine;
      if (engine.voice.id !== voiceId && voiceId !== 'auto') {
        setNote(`${voiceOption(voiceId).label} isn't available on this device, so this is the phone voice.`);
      } else if (voiceId === 'auto') {
        setNote(`Automatic is using: ${engine.voice.label}.`);
      } else if (engine.slowToPrepare) {
        setNote('Preparing this voice… the first listen takes a few seconds.');
      }
      await engine.speak('sample', SAMPLE);
    } catch {
      if (request === requestRef.current) setNote("That voice couldn't start on this device. Try another one.");
    } finally {
      if (request === requestRef.current) setListening(null);
    }
  }

  const bench = settings.voiceBench;
  const autoText = !installed || benchVerdict(bench) === 'untested'
    ? ''
    : benchVerdict(bench) === 'low-memory'
      ? "This device doesn't have enough memory for the natural voices, so Automatic uses the phone voice."
      : `On this device Automatic uses ${automaticVoice(bench, installed).label}.`;

  return (
    <div className="settings-section" id="meditation-settings">
      <div className="section-label">Meditation voice</div>
      <div className="card settings-card">
        <div className="settings-row-title">Voice</div>
        <p className="settings-row-sub">Tap Listen to hear each one at your chosen speed.</p>
        {VOICE_GROUPS.map(({ group, note: groupNote }) => {
          const inGroup = voices.filter(v => v.group === group);
          if (inGroup.length === 0) return null;
          return (
            <div key={group} className="voice-group">
              <div className="voice-group-title">{group}</div>
              {groupNote && <div className="voice-detail">{groupNote}</div>}
              <div className="voice-list">
                {inGroup.map(v => (
                  <div key={v.id} className={`voice-row ${selected === v.id ? 'selected' : ''}`}>
                    <button
                      className="voice-pick"
                      aria-pressed={selected === v.id}
                      onClick={() => onChange(prev => ({ ...prev, voiceChoice: v.id }))}
                    >
                      <span className="voice-name">{selected === v.id ? '✓ ' : ''}{v.label}</span>
                      <span className="voice-detail">{v.detail}</span>
                    </button>
                    <button className="voice-listen" onClick={() => listen(v.id)} aria-label={`Listen to ${v.label}`}>
                      {listening === v.id ? 'Stop' : 'Listen'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {note && <p className="settings-row-sub mt-2" role="status">{note}</p>}
        {selected === 'auto' && autoText && <p className="settings-row-sub mt-2">{autoText}</p>}
        {installed && !installed.piper && (
          <p className="settings-row-sub mt-2">More natural voices are available in the Android app.</p>
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
        <p className="settings-row-sub mt-2">Longer silences make a meditation last longer than its stated length.</p>
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
