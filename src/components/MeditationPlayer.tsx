import { useEffect, useMemo, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Meditation, Settings, VoiceBench } from '../types';
import {
  BackgroundSession, chooseEngine, fallbackEngine, keepScreenAwake, SessionState, VoiceEngine, voiceSettingsKey,
} from '../lib/voice';
import { DEFAULT_SOUND_VOLUME, playSounds, SOUND_LAYERS } from '../lib/sounds';
import { clearPosition, savedPosition, savePosition } from '../lib/positions';
import { estimateSeconds, splitSentences } from '../lib/meditationScript';

interface Props {
  meditation: Meditation;
  settings: Settings;
  /** The Voice & sounds screen is open on top of the player. */
  voicePanelOpen: boolean;
  onOpenVoice: () => void;
  onChangeSettings: (update: (prev: Settings) => Settings) => void;
  onSaveBench: (bench: VoiceBench) => void;
  onClose: () => void;
  onComplete: () => void;
}

type Status = 'preparing' | 'playing' | 'paused' | 'done' | 'error';

function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function MeditationPlayer({
  meditation, settings, voicePanelOpen, onOpenVoice, onChangeSettings, onSaveBench, onClose, onComplete,
}: Props) {
  const segments = useMemo(() => splitSentences(meditation.segments), [meditation.segments]);
  const [resumeFrom] = useState(() => savedPosition(meditation.id, segments.length));
  const [status, setStatus] = useState<Status>('preparing');
  const [index, setIndexState] = useState(resumeFrom);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [slowStart, setSlowStart] = useState(false);
  const [showResumed, setShowResumed] = useState(resumeFrom > 0);
  // Where the listener is dragging the position slider to, in seconds, until it settles.
  const [scrub, setScrub] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const speed = settings.speechSpeed;
  const pauseScale = settings.pauseScale;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const engineRef = useRef<VoiceEngine | null>(null);
  // Set while the phone itself is playing the meditation (natural voices), so it survives screen-off.
  const backgroundRef = useRef<BackgroundSession | null>(null);
  // False until the playback service has confirmed it started; a "stopped" before then is a failed start.
  const backgroundLiveRef = useRef(false);
  // Bumped to abandon a start that is still getting ready.
  const startRef = useRef(0);
  const runRef = useRef(0);
  const statusRef = useRef<Status>('preparing');
  const indexRef = useRef(resumeFrom);
  // The voice settings the current playback was started with.
  const voiceKeyRef = useRef('');
  // Where playback is, so a pause in the silence after a line resumes with the rest of that silence
  // instead of repeating the line.
  const posRef = useRef({ index: 0, gapEndsAt: 0 });
  const resumeRef = useRef({ index: 0, delayMs: 0 });
  // Time spent on the current sentence, for the clock: seconds banked, plus since when it's running.
  const lineClockRef = useRef<{ banked: number; since: number | null }>({ banked: 0, since: null });
  // What to do when the Voice & sounds screen closes.
  const afterPanelRef = useRef<'resume' | 'restart' | 'nothing' | null>(null);
  const scrubTimer = useRef<number | undefined>(undefined);

  const lineId = (i: number) => `${meditation.id}-${i}`;

  function lineSeconds(): number {
    const c = lineClockRef.current;
    return c.banked + (c.since === null ? 0 : (Date.now() - c.since) / 1000);
  }

  function show(next: Status) {
    const c = lineClockRef.current;
    if (next === 'playing' && c.since === null) c.since = Date.now();
    if (next !== 'playing' && c.since !== null) lineClockRef.current = { banked: lineSeconds(), since: null };
    statusRef.current = next;
    setStatus(next);
  }

  function moveTo(i: number) {
    if (i !== indexRef.current) setShowResumed(false);
    indexRef.current = i;
    lineClockRef.current = { banked: 0, since: statusRef.current === 'playing' ? Date.now() : null };
    setIndexState(i);
  }

  const { totalSeconds, startsAt, lengths } = useMemo(() => {
    const starts: number[] = [];
    const each: number[] = [];
    let t = 0;
    segments.forEach(s => {
      const seconds = estimateSeconds([s], speed, pauseScale);
      starts.push(t);
      each.push(seconds);
      t += seconds;
    });
    return { totalSeconds: Math.max(1, t), startsAt: starts, lengths: each };
  }, [segments, speed, pauseScale]);

  async function run(from: number, delayMs = 0) {
    const token = ++runRef.current;
    const live = () => token === runRef.current;
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
    show('playing');

    if (delayMs > 0) {
      posRef.current = { index: from - 1, gapEndsAt: Date.now() + delayMs };
      await wait(delayMs);
    }

    for (let i = from; i < segments.length; i++) {
      if (!live()) return;
      posRef.current = { index: i, gapEndsAt: 0 };
      moveTo(i);
      const text = segments[i].text;
      const pause = segments[i].pause * settingsRef.current.pauseScale * engineRef.current!.pauseStretch;
      try {
        await engineRef.current!.speak(lineId(i), text);
      } catch {
        if (!live()) return;
        if (engineRef.current!.voice.id === 'system') {
          show('error');
          return;
        }
        // The natural voice failed on this device: carry on with the phone's own voice.
        await engineRef.current!.stop();
        engineRef.current = fallbackEngine(settingsRef.current.speechSpeed);
        setVoiceName(engineRef.current.voice.label);
        try {
          await engineRef.current.speak(lineId(i), text);
        } catch {
          if (live()) show('error');
          return;
        }
      }
      if (!live()) return;
      posRef.current = { index: i, gapEndsAt: Date.now() + pause * 1000 };
      await wait(pause * 1000);
    }
    if (live()) show('done');
  }

  function onBackgroundState(state: SessionState) {
    if (!backgroundRef.current) return;
    if (state.status === 'stopped' || state.status === 'none') {
      // Stopped from the notification.
      if (backgroundLiveRef.current && statusRef.current !== 'done') onClose();
      return;
    }
    const at = Math.min(state.index, segments.length - 1);
    if (at !== indexRef.current) moveTo(at);
    if (state.status === 'error') {
      // The natural voice failed part-way: carry on from here with the phone's own voice.
      backgroundRef.current = null;
      engineRef.current = fallbackEngine(settingsRef.current.speechSpeed);
      setVoiceName(engineRef.current.voice.label);
      playSounds(true); // the session that was playing them is gone
      run(state.index);
    } else {
      show(state.status);
    }
  }

  async function startInBackground(session: BackgroundSession, from: number) {
    backgroundRef.current = session;
    backgroundLiveRef.current = false;
    show('preparing');
    await session.start(
      meditation.title,
      segments.map((s, i) => ({
        key: lineId(i),
        text: s.text,
        pauseSeconds: s.pause * settingsRef.current.pauseScale * engineRef.current!.pauseStretch,
      })),
      onBackgroundState,
      from,
    );
    backgroundLiveRef.current = true;
    // From here the phone plays the background sounds along with the session.
    playSounds(false);
  }

  /** Starts (or restarts) playback from a sentence, with the voice settings as they are now. */
  async function start(from: number) {
    const mine = ++startRef.current;
    const current = () => mine === startRef.current;
    runRef.current++;
    const previous = backgroundRef.current;
    backgroundRef.current = null;
    await previous?.stop();
    await engineRef.current?.stop();
    if (!current()) return;
    moveTo(from);
    show('preparing');

    const engine = await chooseEngine(settingsRef.current, onSaveBench);
    if (!current()) return;
    engineRef.current = engine;
    voiceKeyRef.current = voiceSettingsKey(settingsRef.current);
    setVoiceName(engine.voice.label);
    setSlowStart(engine.slowToPrepare);
    if (engine.background) {
      try {
        await startInBackground(engine.background, from);
        // Abandoned while it was starting (e.g. closed during the notification permission prompt).
        if (!current()) engine.background.stop();
        return;
      } catch {
        // The playback service couldn't start: fall back to timing the lines from this screen.
        backgroundRef.current = null;
      }
      if (!current()) return;
    }
    engine.preload(segments.slice(from).map((s, i) => ({ key: lineId(from + i), text: s.text })));
    // Slower voices get a longer head start so the first minute isn't full of waits.
    const lead = engine.slowToPrepare ? 4 : 2;
    await engine.whenReady(segments.slice(from, from + lead).map((_, i) => lineId(from + i)));
    if (current()) run(from);
  }

  function pause() {
    if (backgroundRef.current) return backgroundRef.current.pause();
    if (statusRef.current !== 'playing') return;
    const { index: i, gapEndsAt } = posRef.current;
    resumeRef.current = gapEndsAt > 0
      ? { index: i + 1, delayMs: Math.max(0, gapEndsAt - Date.now()) }
      : { index: i, delayMs: 0 };
    runRef.current++;
    engineRef.current?.halt();
    show('paused');
  }

  function resume() {
    if (backgroundRef.current) return backgroundRef.current.resume();
    const { index: i, delayMs } = resumeRef.current;
    run(i, delayMs);
  }

  /** Jumps to a sentence; past the last one finishes. Stays paused if paused. */
  function seek(target: number) {
    const to = Math.max(0, target);
    if (backgroundRef.current) {
      backgroundRef.current.seek(to);
      if (to < segments.length) moveTo(to);
      return;
    }
    const token = ++runRef.current;
    if (to >= segments.length) {
      engineRef.current?.halt();
      show('done');
      return;
    }
    posRef.current = { index: to, gapEndsAt: 0 };
    resumeRef.current = { index: to, delayMs: 0 };
    moveTo(to);
    if (statusRef.current === 'paused') {
      engineRef.current?.halt();
      return;
    }
    engineRef.current?.halt().then(() => {
      if (token === runRef.current) run(to);
    });
  }

  function skip(by: number) {
    if (backgroundRef.current) return backgroundRef.current.skip(by);
    // Paused inside the silence after a line: that line is still the current one.
    const paused = resumeRef.current;
    const current = statusRef.current === 'paused'
      ? (paused.delayMs > 0 ? paused.index - 1 : paused.index)
      : posRef.current.index;
    seek(current + by);
  }

  function onScrub(seconds: number) {
    setScrub(seconds);
    window.clearTimeout(scrubTimer.current);
    // Jump once the slider has settled, however it was moved (drag, tap or keys).
    scrubTimer.current = window.setTimeout(() => {
      let target = 0;
      while (target < segments.length - 1 && startsAt[target + 1] <= seconds) target++;
      seek(target);
      setScrub(null);
    }, 300);
  }

  function openVoice() {
    const now = statusRef.current;
    if (now === 'playing') {
      afterPanelRef.current = 'resume';
      pause();
    } else if (now === 'preparing') {
      if (backgroundRef.current) {
        afterPanelRef.current = 'resume';
        backgroundRef.current.pause();
      } else {
        // Still getting ready on this screen: drop that and start again afterwards.
        afterPanelRef.current = 'restart';
        startRef.current++;
        runRef.current++;
        engineRef.current?.stop();
        show('paused');
      }
    } else {
      afterPanelRef.current = 'nothing';
    }
    onOpenVoice();
  }

  function toggleSound(id: string) {
    onChangeSettings(prev => {
      const current = prev.sounds[id] ?? { on: false, volume: DEFAULT_SOUND_VOLUME };
      return { ...prev, sounds: { ...prev.sounds, [id]: { ...current, on: !current.on } } };
    });
  }

  useEffect(() => {
    start(resumeFrom);
    // The spoken lines are timed from the app, which Android suspends in the background.
    const listener = CapApp.addListener('appStateChange', state => {
      if (backgroundRef.current) {
        if (state.isActive) backgroundRef.current.sync().then(onBackgroundState);
      } else if (!state.isActive) {
        pause();
      }
    });
    return () => {
      startRef.current++;
      runRef.current++;
      window.clearTimeout(scrubTimer.current);
      backgroundRef.current?.stop();
      backgroundRef.current = null;
      engineRef.current?.stop();
      keepScreenAwake(false);
      playSounds(false);
      listener.then(l => l.remove());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Back from Voice & sounds: carry on from the same sentence, with the new voice if it changed.
  useEffect(() => {
    if (voicePanelOpen || afterPanelRef.current === null) return;
    const then = afterPanelRef.current;
    afterPanelRef.current = null;
    if (statusRef.current === 'done' || statusRef.current === 'error') return;
    if (voiceSettingsKey(settingsRef.current) !== voiceKeyRef.current || then === 'restart') start(indexRef.current);
    else if (then === 'resume') resume();
  }, [voicePanelOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const active = status === 'preparing' || status === 'playing';
    // Background playback doesn't need the screen, and plays the background sounds itself;
    // in-app timing needs both done from here.
    if (backgroundRef.current) {
      keepScreenAwake(false);
      return;
    }
    keepScreenAwake(active);
    if (!voicePanelOpen) playSounds(active);
  }, [status, voicePanelOpen]);

  useEffect(() => {
    if (status === 'done') clearPosition(meditation.id);
    else if (status === 'playing' || status === 'paused') savePosition(meditation.id, index);
  }, [status, index, meditation.id]);

  // Keeps the clock moving through each sentence and the silence after it.
  useEffect(() => {
    if (status !== 'playing') return;
    const timer = window.setInterval(() => setTick(t => t + 1), 500);
    return () => window.clearInterval(timer);
  }, [status]);

  if (status === 'done' || status === 'error') {
    return (
      <div className="exercise-overlay player-overlay">
        {status === 'done' ? (
          <div className="completion-screen">
            <span className="completion-icon">🌿</span>
            <div className="completion-title">Welcome back.</div>
            <div className="completion-msg">
              Take a moment before you move on. This meditation is saved, so you can return to it any time.
            </div>
            <button className="btn btn-primary mt-6" onClick={onComplete}>Finish</button>
            <button className="btn btn-ghost" onClick={() => start(0)}>Play again</button>
          </div>
        ) : (
          <div className="completion-screen">
            <div className="completion-title">The voice couldn't start</div>
            <div className="completion-msg">
              Your phone didn't speak the meditation. Check that a text-to-speech voice is installed
              (Android Settings → Accessibility → Text-to-speech), or choose a different voice.
            </div>
            <button className="btn btn-primary mt-6" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    );
  }

  const elapsed = Math.min(totalSeconds, (startsAt[index] ?? 0) + Math.min(lengths[index] ?? 0, lineSeconds()));
  const shown = scrub ?? elapsed;
  const busy = status === 'preparing';

  return (
    <div className="exercise-overlay player-overlay">
      <div className="exercise-overlay-inner">
        <div className="exercise-top-bar">
          <button className="back-btn" onClick={onClose} aria-label="Close meditation">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
          <button className="player-voice-btn" onClick={openVoice}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" strokeLinecap="round" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
            Voice &amp; sounds
          </button>
        </div>

        <div className="player-body">
          <div className="player-title">{meditation.title}</div>
          <div className="player-voice">
            {status === 'paused' ? 'Paused' : voiceName ? `Read by ${voiceName}` : '\u00a0'}
          </div>

          <div className={`player-orb ${status === 'playing' ? 'breathing' : ''}`} />

          <div className="player-caption" aria-live="polite">
            {busy ? (
              <span className="player-status">
                {slowStart
                  ? 'Preparing the voice… This one takes up to a minute the first time; replays start straight away.'
                  : 'Preparing the voice…'}
              </span>
            ) : (
              <span key={index}>{segments[index].text}</span>
            )}
          </div>

          {showResumed && (
            <div className="player-resumed">
              Picking up where you left off.{' '}
              <button onClick={() => seek(0)}>Start from the beginning</button>
            </div>
          )}

          <input
            type="range"
            className="slider player-seek"
            aria-label="Position in the meditation"
            aria-valuetext={`${clock(shown)} of ${clock(totalSeconds)}`}
            min={0}
            max={Math.round(totalSeconds)}
            step={1}
            value={Math.round(shown)}
            disabled={busy}
            onChange={e => onScrub(Number(e.target.value))}
          />
          <div className="player-time">
            <span>{clock(shown)}</span>
            <button className="player-restart" onClick={() => seek(0)} disabled={busy || (index === 0 && status === 'paused')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Start over
            </button>
            <span>{clock(totalSeconds)}</span>
          </div>

          <div className="player-controls">
            <button className="player-btn" onClick={() => skip(-1)} disabled={busy} aria-label="Previous line">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
            </button>
            {status === 'paused' ? (
              <button className="player-btn player-btn-main" onClick={resume} aria-label="Resume">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z" /></svg>
              </button>
            ) : (
              <button className="player-btn player-btn-main" onClick={pause} disabled={busy} aria-label="Pause">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
              </button>
            )}
            <button className="player-btn" onClick={() => skip(1)} disabled={busy} aria-label="Next line">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
            </button>
          </div>

          <div className="player-sounds">
            <div className="player-sounds-label">Background sounds</div>
            <div className="player-sounds-row">
              {SOUND_LAYERS.map(layer => {
                const on = !!settings.sounds[layer.id]?.on;
                return (
                  <button
                    key={layer.id}
                    className={`chip ${on ? 'selected' : ''}`}
                    aria-pressed={on}
                    onClick={() => toggleSound(layer.id)}
                  >
                    {layer.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
