import { useEffect, useMemo, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Meditation, Settings, VoiceBench } from '../types';
import { chooseEngine, fallbackEngine, keepScreenAwake, VoiceEngine, VoiceKind, VOICE_LABEL } from '../lib/voice';
import { estimateSeconds } from '../lib/meditationScript';

interface Props {
  meditation: Meditation;
  settings: Settings;
  onSaveBench: (bench: VoiceBench) => void;
  onClose: () => void;
  onComplete: () => void;
}

type Status = 'preparing' | 'playing' | 'paused' | 'done' | 'error';

export default function MeditationPlayer({ meditation, settings, onSaveBench, onClose, onComplete }: Props) {
  const { segments } = meditation;
  const [status, setStatus] = useState<Status>('preparing');
  const [index, setIndex] = useState(0);
  const [voice, setVoice] = useState<VoiceKind | null>(null);

  const engineRef = useRef<VoiceEngine | null>(null);
  const runRef = useRef(0);
  const statusRef = useRef<Status>('preparing');
  // Where playback is, so a pause in the silence after a line resumes with the rest of that silence
  // instead of repeating the line.
  const posRef = useRef({ index: 0, gapEndsAt: 0 });
  const resumeRef = useRef({ index: 0, delayMs: 0 });

  const lineId = (i: number) => `${meditation.id}-${i}`;

  function show(next: Status) {
    statusRef.current = next;
    setStatus(next);
  }

  const { totalSeconds, startsAt } = useMemo(() => {
    const starts: number[] = [];
    let t = 0;
    segments.forEach(s => {
      starts.push(t);
      t += estimateSeconds([s]);
    });
    return { totalSeconds: t, startsAt: starts };
  }, [segments]);

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
      setIndex(i);
      const { text, pause } = segments[i];
      try {
        await engineRef.current!.speak(lineId(i), text);
      } catch {
        if (!live()) return;
        if (engineRef.current!.kind === 'system') {
          show('error');
          return;
        }
        // The natural voice failed on this device: carry on with the phone's own voice.
        await engineRef.current!.stop();
        engineRef.current = fallbackEngine();
        setVoice('system');
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

  function pause() {
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
    const { index: i, delayMs } = resumeRef.current;
    run(i, delayMs);
  }

  function skip(by: number) {
    const current = statusRef.current === 'paused' ? resumeRef.current.index : posRef.current.index;
    const target = Math.max(0, current + by);
    const token = ++runRef.current;
    if (target >= segments.length) {
      engineRef.current?.halt();
      show('done');
      return;
    }
    posRef.current = { index: target, gapEndsAt: 0 };
    resumeRef.current = { index: target, delayMs: 0 };
    setIndex(target);
    if (statusRef.current === 'paused') {
      engineRef.current?.halt();
      return;
    }
    engineRef.current?.halt().then(() => {
      if (token === runRef.current) run(target);
    });
  }

  useEffect(() => {
    let cancelled = false;
    chooseEngine(settings.voiceChoice, settings.voiceBench, onSaveBench).then(async engine => {
      if (cancelled) return;
      engineRef.current = engine;
      setVoice(engine.kind);
      engine.preload(segments.map((s, i) => ({ id: lineId(i), text: s.text })));
      await engine.whenReady([lineId(0), lineId(1)]);
      if (!cancelled) run(0);
    });
    // The spoken lines are timed from the app, which Android suspends in the background.
    const listener = CapApp.addListener('appStateChange', state => {
      if (!state.isActive) pause();
    });
    return () => {
      cancelled = true;
      runRef.current++;
      engineRef.current?.stop();
      keepScreenAwake(false);
      listener.then(l => l.remove());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    keepScreenAwake(status === 'preparing' || status === 'playing');
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
            <button className="btn btn-ghost" onClick={() => run(0)}>Play again</button>
          </div>
        ) : (
          <div className="completion-screen">
            <div className="completion-title">The voice couldn't start</div>
            <div className="completion-msg">
              Your phone didn't speak the meditation. Check that a text-to-speech voice is installed
              (Android Settings → Accessibility → Text-to-speech), or choose a different voice in this app's Settings.
            </div>
            <button className="btn btn-primary mt-6" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    );
  }

  const elapsed = startsAt[index] ?? 0;
  const remainingMin = Math.max(1, Math.round((totalSeconds - elapsed) / 60));

  return (
    <div className="exercise-overlay player-overlay">
      <div className="exercise-overlay-inner">
        <div className="exercise-top-bar">
          <button className="back-btn" onClick={onClose} aria-label="Close meditation">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
          {voice && <span className="badge badge-duration">{VOICE_LABEL[voice]}</span>}
        </div>

        <div className="player-body">
          <div className="player-title">{meditation.title}</div>

          <div className={`player-orb ${status === 'playing' ? 'breathing' : ''}`} />

          <div className="player-caption" aria-live="polite">
            {status === 'preparing' ? (
              <span className="player-status">Preparing the voice…</span>
            ) : (
              <span key={index}>{segments[index].text}</span>
            )}
          </div>

          <div className="player-progress" role="progressbar" aria-valuemin={0} aria-valuemax={totalSeconds} aria-valuenow={elapsed}>
            <div className="player-progress-fill" style={{ width: `${(elapsed / totalSeconds) * 100}%` }} />
          </div>
          <div className="player-time">
            {status === 'paused' ? 'Paused' : `About ${remainingMin} min left`}
          </div>

          <div className="player-controls">
            <button className="player-btn" onClick={() => skip(-1)} disabled={status === 'preparing'} aria-label="Previous line">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
            </button>
            {status === 'paused' ? (
              <button className="player-btn player-btn-main" onClick={resume} aria-label="Resume">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z" /></svg>
              </button>
            ) : (
              <button className="player-btn player-btn-main" onClick={pause} disabled={status === 'preparing'} aria-label="Pause">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
              </button>
            )}
            <button className="player-btn" onClick={() => skip(1)} disabled={status === 'preparing'} aria-label="Next line">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
