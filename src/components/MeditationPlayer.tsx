import { useEffect, useMemo, useRef, useState } from 'react';
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

type Status = 'preparing' | 'playing' | 'paused' | 'done';

export default function MeditationPlayer({ meditation, settings, onSaveBench, onClose, onComplete }: Props) {
  const { segments } = meditation;
  const [status, setStatus] = useState<Status>('preparing');
  const [index, setIndex] = useState(0);
  const [voice, setVoice] = useState<VoiceKind | null>(null);

  const engineRef = useRef<VoiceEngine | null>(null);
  const runRef = useRef(0);
  const indexRef = useRef(0);

  const lineId = (i: number) => `${meditation.id}-${i}`;

  const { totalSeconds, startsAt } = useMemo(() => {
    const starts: number[] = [];
    let t = 0;
    segments.forEach(s => {
      starts.push(t);
      t += estimateSeconds([s]);
    });
    return { totalSeconds: t, startsAt: starts };
  }, [segments]);

  async function run(from: number) {
    const token = ++runRef.current;
    const live = () => token === runRef.current;
    setStatus('playing');

    for (let i = from; i < segments.length; i++) {
      if (!live()) return;
      indexRef.current = i;
      setIndex(i);
      const { text, pause } = segments[i];
      try {
        await engineRef.current!.speak(lineId(i), text);
      } catch {
        if (!live()) return;
        // The natural voice failed on this device: carry on with the phone's own voice.
        engineRef.current = fallbackEngine();
        setVoice('system');
        await engineRef.current.speak(lineId(i), text);
      }
      if (!live()) return;
      await new Promise(r => setTimeout(r, pause * 1000));
    }
    if (live()) setStatus('done');
  }

  useEffect(() => {
    let cancelled = false;
    keepScreenAwake(true);
    chooseEngine(settings.voiceChoice, settings.voiceBench, onSaveBench).then(engine => {
      if (cancelled) return;
      engineRef.current = engine;
      setVoice(engine.kind);
      engine.preload(segments.map((s, i) => ({ id: lineId(i), text: s.text })));
      run(0);
    });
    return () => {
      cancelled = true;
      runRef.current++;
      engineRef.current?.stop();
      keepScreenAwake(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function pause() {
    runRef.current++;
    engineRef.current?.halt();
    setStatus('paused');
  }

  function skip(by: number) {
    const target = Math.max(0, Math.min(segments.length - 1, indexRef.current + by));
    runRef.current++;
    engineRef.current?.halt().then(() => run(target));
  }

  if (status === 'done') {
    return (
      <div className="exercise-overlay">
        <div className="completion-screen">
          <span className="completion-icon">🌿</span>
          <div className="completion-title">Welcome back.</div>
          <div className="completion-msg">
            Take a moment before you move on. This meditation is saved, so you can return to it any time.
          </div>
          <button className="btn btn-primary mt-6" onClick={onComplete}>Finish</button>
          <button className="btn btn-ghost" onClick={() => run(0)}>Play again</button>
        </div>
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
              <button className="player-btn player-btn-main" onClick={() => run(indexRef.current)} aria-label="Resume">
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
