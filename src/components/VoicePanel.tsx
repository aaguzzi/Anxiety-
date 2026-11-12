import { useEffect, useRef, useState } from 'react';
import { Settings } from '../types';
import {
  automaticVoice, benchVerdict, chooseEngine, InstalledModels, installedModels, MIN_STUDIO_SPEED, PACES,
  PAUSE_RANGE, SPEED_RANGE, VOICE_GROUPS, VoiceEngine, VoiceOption, voiceOption, VOICES,
} from '../lib/voice';
import { DEFAULT_SOUND_VOLUME, playSounds, SOUND_LAYERS, soundsSupported } from '../lib/sounds';

const SAMPLE = 'Take a slow breath in, and let it go. There is nothing you need to fix right now.';

interface Props {
  settings: Settings;
  onChange: (update: (prev: Settings) => Settings) => void;
  /** Opened over a meditation that is waiting to carry on. */
  duringMeditation?: boolean;
  /** That meditation has lines queued for the voice, which stopping a sample must not cancel. */
  keepQueued?: boolean;
  onClose: () => void;
}

interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  text: string;
  onChange: (value: number) => void;
  /** Called when the listener lets go of the slider. */
  onCommit?: () => void;
}

function Slider({ id, label, value, min, max, step, text, onChange, onCommit }: SliderProps) {
  return (
    <div className="slider-row">
      <div className="slider-head">
        <label htmlFor={id}>{label}</label>
        <span className="slider-value">{text}</span>
      </div>
      <input
        id={id}
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={e => { if (/^(Arrow|Home|End|Page)/.test(e.key)) onCommit?.(); }}
      />
    </div>
  );
}

const percent = (v: number) => `${Math.round(v * 100)}%`;

function amount(v: number): string {
  if (v <= 0) return 'Off';
  return v < 0.35 ? `A little · ${percent(v)}` : v < 0.7 ? `Medium · ${percent(v)}` : `A lot · ${percent(v)}`;
}

/** Voice, pace and background sounds in one place, reachable from the Meditate tab and the player. */
export default function VoicePanel({ settings, onChange, duringMeditation, keepQueued, onClose }: Props) {
  const [installed, setInstalled] = useState<InstalledModels | null>(null);
  const [listening, setListening] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const engineRef = useRef<VoiceEngine | null>(null);
  const requestRef = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  // stop() drops everything queued on the phone, not only this screen's sample: that is what makes
  // tapping through several voices quick. When the meditation behind this screen has lines of its
  // own queued, halt() is used instead, which leaves the queue alone.
  const keepQueuedRef = useRef(!!keepQueued);
  keepQueuedRef.current = !!keepQueued;
  const silence = () => (keepQueuedRef.current ? engineRef.current?.halt() : engineRef.current?.stop());

  useEffect(() => {
    installedModels().then(setInstalled);
    // The chosen sounds play while this screen is open, so they can be set by ear.
    playSounds(true);
    return () => {
      requestRef.current++;
      silence();
      playSounds(false);
    };
  }, []);

  const chosen = voiceOption(settings.voiceChoice);
  // A voice this build doesn't include behaves as Automatic, so show it that way.
  const selected = installed && chosen.model && !installed[chosen.model] ? 'auto' : chosen.id;
  const available = VOICES.filter(v => !v.model || installed?.[v.model]);
  const hasNatural = available.some(v => v.model);
  const pace = PACES.find(p => p.speed === settings.speechSpeed && p.pauseScale === settings.pauseScale);

  async function stopSample() {
    requestRef.current++;
    setListening(null);
    await silence();
  }

  // Everything here is chosen by ear: picking a voice or letting go of a slider plays the sample.
  async function playSample(using: Settings) {
    await silence();
    const request = ++requestRef.current;
    setListening(using.voiceChoice);
    setNote(null);
    try {
      const engine = await chooseEngine(using, bench => onChange(prev => ({ ...prev, voiceBench: bench })));
      if (request !== requestRef.current) return;
      engineRef.current = engine;
      if (using.voiceChoice === 'auto') setNote(`Automatic is using ${engine.voice.label} on this device.`);
      else if (engine.slowToPrepare) setNote('Preparing the sample…');
      await engine.speak('sample', SAMPLE);
      if (request === requestRef.current) setNote(null);
    } catch {
      if (request === requestRef.current) setNote("That voice couldn't start on this device. Try another one.");
    } finally {
      if (request === requestRef.current) {
        setListening(null);
        // Hand the speaker back, so music that went quiet for the sample comes up again.
        engineRef.current?.halt();
      }
    }
  }

  function choose(voiceId: string) {
    onChange(prev => ({ ...prev, voiceChoice: voiceId }));
    playSample({ ...settingsRef.current, voiceChoice: voiceId });
  }

  const set = (patch: Partial<Settings>) => onChange(prev => ({ ...prev, ...patch }));
  const replay = () => playSample(settingsRef.current);

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

  function setLayer(id: string, patch: { on?: boolean; volume?: number }) {
    onChange(prev => {
      const current = prev.sounds[id] ?? { on: false, volume: DEFAULT_SOUND_VOLUME };
      return { ...prev, sounds: { ...prev.sounds, [id]: { ...current, ...patch } } };
    });
  }

  const anySound = SOUND_LAYERS.some(l => settings.sounds[l.id]?.on);

  return (
    <div className="exercise-overlay voice-panel">
      <div className="exercise-overlay-inner">
        <div className="exercise-top-bar">
          <button className="back-btn" onClick={onClose} aria-label={duringMeditation ? 'Back to the meditation' : 'Go back'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="exercise-scroll">
          <div className="exercise-title">Voice &amp; sounds</div>
          <p className="settings-row-sub mt-2 mb-6">
            {duringMeditation
              ? 'Your meditation is paused. It carries on from the same sentence, with these settings, when you go back.'
              : 'Set by ear: tap a voice or move a slider to hear it.'}
          </p>

          <div className="settings-section">
            <div className="section-label">Voice</div>
            <div className="card settings-card">
              {VOICE_GROUPS.map(group => {
                const voices = available.filter(v => v.group === group);
                if (voices.length === 0) return null;
                return (
                  <div key={group} className="voice-group">
                    {group !== 'Recommended' && <div className="voice-group-title">{group}</div>}
                    <div className="voice-list">{voices.map(voiceRow)}</div>
                  </div>
                );
              })}
              {note && <p className="settings-row-sub mt-2" role="status">{note}</p>}
              {selected === 'auto' && !note && autoText && <p className="settings-row-sub mt-2">{autoText}</p>}
              {installed && !hasNatural && (
                <p className="settings-row-sub mt-2">Natural voices are available in the Android app.</p>
              )}
            </div>
          </div>

          <div className="settings-section">
            <div className="section-label">Fine-tune the voice</div>
            <div className="card settings-card">
              <Slider
                id="voice-softness"
                label="Softness"
                value={settings.voiceSoftness}
                min={0}
                max={1}
                step={0.05}
                text={amount(settings.voiceSoftness)}
                onChange={v => set({ voiceSoftness: v })}
                onCommit={replay}
              />
              <p className="settings-row-sub">Takes the edge off the voice and makes it warmer.</p>

              <Slider
                id="voice-speed"
                label="Speaking speed"
                value={settings.speechSpeed}
                min={SPEED_RANGE.min}
                max={SPEED_RANGE.max}
                step={SPEED_RANGE.step}
                text={`${percent(settings.speechSpeed)} of natural`}
                onChange={v => set({ speechSpeed: v })}
                onCommit={replay}
              />
              {hasNatural && settings.speechSpeed < MIN_STUDIO_SPEED && (
                <p className="settings-row-sub">
                  The natural voices stay clear by not speaking slower than 75%. Below that they leave longer silences instead.
                </p>
              )}

              <Slider
                id="voice-pauses"
                label="Silences between lines"
                value={settings.pauseScale}
                min={PAUSE_RANGE.min}
                max={PAUSE_RANGE.max}
                step={PAUSE_RANGE.step}
                text={settings.pauseScale === 1 ? 'As written' : `${settings.pauseScale.toFixed(1)}× as long`}
                onChange={v => set({ pauseScale: v })}
              />

              <Slider
                id="voice-space"
                label="Room echo"
                value={settings.voiceSpace}
                min={0}
                max={1}
                step={0.05}
                text={amount(settings.voiceSpace)}
                onChange={v => set({ voiceSpace: v })}
                onCommit={replay}
              />
              <p className="settings-row-sub">Off by default. Adds the echo of a quiet room around the voice.</p>

              <div className="settings-row-title mt-4">Quick pace</div>
              <div className="chip-row">
                {PACES.map(p => (
                  <button
                    key={p.id}
                    className={`chip ${pace?.id === p.id ? 'selected' : ''}`}
                    aria-pressed={pace?.id === p.id}
                    onClick={() => set({ speechSpeed: p.speed, pauseScale: p.pauseScale })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {installed?.supertonic && (
                <>
                  <div className="settings-row-title mt-4">Sound quality</div>
                  <div className="chip-row">
                    {([['best', 'Best sound'], ['fast', 'Start sooner']] as const).map(([value, label]) => (
                      <button
                        key={value}
                        className={`chip ${settings.voiceQuality === value ? 'selected' : ''}`}
                        aria-pressed={settings.voiceQuality === value}
                        onClick={() => set({ voiceQuality: value })}
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

              <button className="btn btn-outline w-full mt-4" onClick={listening ? stopSample : replay}>
                {listening ? 'Stop the sample' : 'Play a sample'}
              </button>
            </div>
          </div>

          <div className="settings-section">
            <div className="section-label">Background sounds</div>
            <div className="card settings-card">
              <p className="settings-row-sub">
                Switch on any mix of sounds to play under the voice. They keep playing with the screen off and fade out when the meditation ends.
              </p>
              {!soundsSupported() && (
                <p className="settings-row-sub mt-2">Background sounds play in the Android app.</p>
              )}
              <div className="sound-list">
                {SOUND_LAYERS.map(layer => {
                  const state = settings.sounds[layer.id] ?? { on: false, volume: DEFAULT_SOUND_VOLUME };
                  return (
                    <div key={layer.id} className={`sound-row ${state.on ? 'on' : ''}`}>
                      <div className="settings-row">
                        <div>
                          <div className="settings-row-title">{layer.label}</div>
                          <div className="settings-row-sub">{layer.detail}</div>
                        </div>
                        <button
                          role="switch"
                          aria-checked={state.on}
                          aria-label={layer.label}
                          className={`switch ${state.on ? 'on' : ''}`}
                          onClick={() => setLayer(layer.id, { on: !state.on })}
                        >
                          <span className="switch-knob" />
                        </button>
                      </div>
                      {state.on && (
                        <Slider
                          id={`sound-${layer.id}`}
                          label="Volume"
                          value={state.volume}
                          min={0.05}
                          max={1}
                          step={0.05}
                          text={percent(state.volume)}
                          onChange={v => setLayer(layer.id, { volume: v })}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              {anySound && (
                <button
                  className="btn btn-ghost w-full mt-4"
                  onClick={() => onChange(prev => ({
                    ...prev,
                    sounds: Object.fromEntries(Object.entries(prev.sounds).map(([id, s]) => [id, { ...s, on: false }])),
                  }))}
                >
                  Turn all sounds off
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
