import { useEffect, useRef, useState } from 'react';
import { Settings, VoiceChoice } from '../types';
import { benchVerdict, chooseEngine, neuralAvailable, runBenchmark, VoiceEngine, VOICE_LABEL } from '../lib/voice';

const CHOICES: { value: VoiceChoice; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: 'neural', label: 'Natural voice' },
  { value: 'system', label: 'Phone voice' },
];

const SAMPLE = 'Take a slow breath in, and let it go. There is nothing you need to fix right now.';

interface Props {
  settings: Settings;
  onChange: (update: (prev: Settings) => Settings) => void;
}

export default function MeditationSettings({ settings, onChange }: Props) {
  const [hasNeural, setHasNeural] = useState<boolean | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sampleVoice, setSampleVoice] = useState<string | null>(null);
  const engineRef = useRef<VoiceEngine | null>(null);

  useEffect(() => {
    neuralAvailable().then(setHasNeural);
    return () => { engineRef.current?.stop(); };
  }, []);

  async function playSample() {
    setTesting(true);
    setSampleVoice(null);
    try {
      await engineRef.current?.stop();
      const engine = await chooseEngine(
        settings.voiceChoice,
        settings.voiceBench,
        bench => onChange(prev => ({ ...prev, voiceBench: bench })),
      );
      engineRef.current = engine;
      setSampleVoice(VOICE_LABEL[engine.kind]);
      await engine.speak('settings-sample', SAMPLE);
    } catch {
      setSampleVoice('The natural voice could not start on this device. Try "Phone voice".');
    } finally {
      setTesting(false);
    }
  }

  async function retest() {
    setTesting(true);
    const bench = await runBenchmark();
    if (bench) onChange(prev => ({ ...prev, voiceBench: bench }));
    setTesting(false);
  }

  const bench = settings.voiceBench;
  const speedText = {
    untested: "This device's speed is measured the first time the natural voice is used.",
    ok: `This device generates the natural voice at ${bench ? (1 / bench.rtf).toFixed(1) : ''}× speaking speed, so Automatic uses it.`,
    slow: `This device generates the natural voice at only ${bench ? (1 / bench.rtf).toFixed(1) : ''}× speaking speed, so Automatic uses the phone voice.`,
    'low-memory': "This device doesn't have enough memory for the natural voice, so Automatic uses the phone voice.",
  }[benchVerdict(bench)];

  return (
    <div className="settings-section" id="meditation-settings">
      <div className="section-label">Custom meditations</div>
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

        <div className="settings-row-title mt-6">Voice</div>
        {hasNeural === false ? (
          <p className="settings-row-sub">
            Meditations are read by your device's built-in voice. The natural voice is available in the Android app.
          </p>
        ) : (
          <>
            <div className="chip-row">
              {CHOICES.map(c => (
                <button
                  key={c.value}
                  className={`chip ${settings.voiceChoice === c.value ? 'selected' : ''}`}
                  aria-pressed={settings.voiceChoice === c.value}
                  onClick={() => onChange(prev => ({ ...prev, voiceChoice: c.value }))}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="settings-row-sub mt-2">{speedText}</p>
          </>
        )}

        <div className="voice-actions">
          <button className="btn btn-outline" disabled={testing} onClick={playSample}>
            {testing ? 'Working…' : 'Play a sample'}
          </button>
          {hasNeural && (
            <button className="btn btn-ghost" disabled={testing} onClick={retest}>Re-test speed</button>
          )}
        </div>
        {sampleVoice && <p className="settings-row-sub mt-2" role="status">{sampleVoice}</p>}
      </div>
    </div>
  );
}
