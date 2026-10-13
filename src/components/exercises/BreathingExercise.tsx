import { useState, useEffect, useRef } from 'react';
import { ExerciseProps } from '../../types';

type Phase = 'ready' | 'inhale' | 'hold-in' | 'exhale' | 'hold-out' | 'done';

interface CycleConfig {
  label: string;
  phases: { phase: Phase; duration: number; label: string }[];
  cycles: number;
  color: string;
}

function BreathingVisual({ phase, duration, color }: { phase: Phase; duration: number; color: string }) {
  const isExpanding = phase === 'inhale';
  const isHeld = phase === 'hold-in' || phase === 'hold-out';
  const size = isExpanding ? 160 : isHeld && phase === 'hold-in' ? 160 : 80;

  return (
    <div className="breathing-ring-wrap">
      <div
        className="breathing-ring"
        style={{
          width: size + 40,
          height: size + 40,
          color,
          transition: `width ${duration}s ease-in-out, height ${duration}s ease-in-out`,
        }}
      />
      <div
        className="breathing-circle"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          opacity: 0.18,
          transition: `width ${duration}s ease-in-out, height ${duration}s ease-in-out`,
        }}
      />
    </div>
  );
}

function BreathingEngine({ config, onComplete }: { config: CycleConfig; onComplete: () => void }) {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [skipHolds, setSkipHolds] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [count, setCount] = useState(0);

  const hasHolds = config.phases.some(p => p.phase.startsWith('hold'));
  const phases = skipHolds ? config.phases.filter(p => !p.phase.startsWith('hold')) : config.phases;
  const currentPhase = started ? phases[phaseIdx] : { phase: 'ready' as Phase, duration: 0, label: 'Ready' };

  useEffect(() => {
    if (!started || paused) return;
    const t = setInterval(() => setCount(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [started, paused]);

  useEffect(() => {
    if (!started || count > 0) return;
    const next = phaseIdx + 1;
    if (next < phases.length) {
      setPhaseIdx(next);
      setCount(phases[next].duration);
    } else if (cycle < config.cycles) {
      setCycle(cycle + 1);
      setPhaseIdx(0);
      setCount(phases[0].duration);
    } else {
      setStarted(false);
      onComplete();
    }
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps

  function begin() {
    setPhaseIdx(0);
    setCycle(1);
    setCount(phases[0].duration);
    setPaused(false);
    setStarted(true);
  }

  function stop() {
    setStarted(false);
    setPaused(false);
  }

  return (
    <div className="breathing-scene">
      <BreathingVisual
        phase={paused ? 'ready' : currentPhase.phase}
        duration={currentPhase.duration}
        color={config.color}
      />

      <div className="breathing-phase">
        <span className="breathing-phase-label">{paused ? 'Paused' : currentPhase.label}</span>
        {started && count > 0 && (
          <div className="breathing-countdown">{count}</div>
        )}
      </div>

      <div className="breathing-cycle-info">
        {started ? `Cycle ${cycle} of ${config.cycles}` : `${config.cycles} cycles · ${phases.map(p => p.duration).join('-')}`}
      </div>

      {!started && (
        <>
          {hasHolds && (
            <div className="hold-option">
              <label className="hold-toggle">
                <input type="checkbox" checked={skipHolds} onChange={e => setSkipHolds(e.target.checked)} />
                Skip the breath-holds
              </label>
              <p className="caption-text">
                If holding your breath feels uncomfortable or makes you dizzy, skip the holds and just breathe in and out slowly.
              </p>
            </div>
          )}
          <button
            className="btn btn-primary breathing-start-btn"
            style={{ backgroundColor: config.color, minWidth: 180 }}
            onClick={begin}
          >
            Begin
          </button>
        </>
      )}

      {started && (
        <div className="breathing-controls">
          <button className="btn btn-secondary" onClick={() => setPaused(p => !p)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button className="btn btn-ghost" onClick={stop}>Stop</button>
        </div>
      )}
    </div>
  );
}

// ─── Box Breathing (4-4-4-4) ─────────────────────────
export default function BoxBreathing({ onComplete }: ExerciseProps) {
  const config: CycleConfig = {
    label: 'Box Breathing',
    color: '#5B8FA8',
    cycles: 4,
    phases: [
      { phase: 'inhale',   duration: 4, label: 'Breathe in' },
      { phase: 'hold-in',  duration: 4, label: 'Hold' },
      { phase: 'exhale',   duration: 4, label: 'Breathe out' },
      { phase: 'hold-out', duration: 4, label: 'Hold' },
    ],
  };
  return <BreathingEngine config={config} onComplete={onComplete} />;
}

// ─── 4-7-8 Breathing ──────────────────────────────────
export function Breathing478({ onComplete }: ExerciseProps) {
  const config: CycleConfig = {
    label: '4-7-8 Breathing',
    color: '#7A9EB8',
    cycles: 4,
    phases: [
      { phase: 'inhale',  duration: 4, label: 'Breathe in' },
      { phase: 'hold-in', duration: 7, label: 'Hold' },
      { phase: 'exhale',  duration: 8, label: 'Breathe out slowly' },
    ],
  };
  return <BreathingEngine config={config} onComplete={onComplete} />;
}

// ─── Physiological Sigh ───────────────────────────────
export function PhysiologicalSigh({ onComplete, autoStart = false, reps = 5 }: ExerciseProps & { autoStart?: boolean; reps?: number }) {
  const [step, setStep] = useState(0);
  const [rep, setRep] = useState(1);
  const totalReps = reps;

  const steps = [
    { label: 'First inhale', detail: 'Breathe in deeply through your nose — fill your lungs about 80%.', duration: 3 },
    { label: 'Top-up inhale', detail: 'Take a short second inhale through your nose to fully expand your lungs.', duration: 2 },
    { label: 'Long exhale', detail: 'Slowly breathe out through your mouth — take twice as long as the inhale.', duration: 6 },
  ];

  const [count, setCount] = useState(steps[0].duration);
  const [running, setRunning] = useState(autoStart);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    setCount(steps[step].duration);
    timerRef.current = setInterval(() => {
      setCount(c => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          const nextStep = step + 1;
          if (nextStep >= steps.length) {
            if (rep >= totalReps) {
              setRunning(false);
              onComplete();
            } else {
              setRep(r => r + 1);
              setStep(0);
            }
          } else {
            setStep(nextStep);
          }
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [running, step, rep]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = steps[running ? step : 0];

  return (
    <div className="breathing-scene">
      <div className="breathing-ring-wrap">
        <div
          className="breathing-ring"
          style={{
            width: running && step === 2 ? 80 : 160,
            height: running && step === 2 ? 80 : 160,
            color: '#6B9E7A',
            transition: `width ${current.duration}s ease-in-out, height ${current.duration}s ease-in-out`,
          }}
        />
        <div
          className="breathing-circle"
          style={{
            width: running && step === 2 ? 60 : 120,
            height: running && step === 2 ? 60 : 120,
            backgroundColor: '#6B9E7A',
            opacity: 0.18,
            transition: `width ${current.duration}s ease-in-out, height ${current.duration}s ease-in-out`,
          }}
        />
      </div>

      <div className="breathing-phase" style={{ textAlign: 'center' }}>
        <span className="breathing-phase-label">{current.label}</span>
        <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5 }}>{current.detail}</div>
        {running && count > 0 && <div className="breathing-countdown" style={{ marginTop: 8 }}>{count}</div>}
      </div>

      <div className="breathing-cycle-info">
        {running ? `Sigh ${rep} of ${totalReps}` : `${totalReps} sighs · a long, slow breath out`}
      </div>

      {!running && (
        <button
          className="btn btn-primary"
          style={{ backgroundColor: '#6B9E7A', minWidth: 180 }}
          onClick={() => { setRunning(true); setStep(0); setRep(1); }}
        >
          Begin
        </button>
      )}
    </div>
  );
}
