import { useState, useEffect } from 'react';
import { ExerciseProps } from '../../types';
import CompletionScreen, { useStepStart } from './CompletionScreen';

type Phase = 'ready' | 'inhale' | 'hold-in' | 'exhale' | 'hold-out' | 'done';

interface CycleConfig {
  label: string;
  phases: { phase: Phase; duration: number; label: string }[];
  cycles: number;
  color: string;
  /** A darker shade for the circle's edge, at least 3:1 against the page so the guide stays visible. */
  edge: string;
}

function BreathingVisual({ phase, duration, color, edge }: { phase: Phase; duration: number; color: string; edge: string }) {
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
          backgroundColor: color + '59', // a soft fill (35%) inside a solid edge
          boxShadow: `inset 0 0 0 2px ${edge}`,
          transition: `width ${duration}s ease-in-out, height ${duration}s ease-in-out`,
        }}
      />
    </div>
  );
}

// The end of the Toolbox breathing exercises.
function BreathingDone({ onFinish, onAgain }: { onFinish: () => void; onAgain: () => void }) {
  return (
    <CompletionScreen>
      <span className="completion-icon">🌬️</span>
      <div className="completion-title">Nicely done.</div>
      <div className="completion-msg">
        Notice how your body feels now, whatever that is. You can come back to this breath any time.
      </div>
      <button className="btn btn-primary mt-6" onClick={onFinish}>Finish</button>
      <button className="btn btn-ghost" onClick={onAgain}>Go again</button>
    </CompletionScreen>
  );
}

function BreathingEngine({ config, onComplete }: { config: CycleConfig; onComplete: () => void }) {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [skipHolds, setSkipHolds] = useState(false);
  const [finished, setFinished] = useState(false);
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
      setFinished(true);
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

  // Begin may have been scrolled to at large text: starting brings the circle back into view.
  const sceneRef = useStepStart<HTMLDivElement>(started);

  if (finished) {
    return <BreathingDone onFinish={onComplete} onAgain={() => { setFinished(false); begin(); }} />;
  }

  return (
    <div className="breathing-scene" ref={sceneRef}>
      <BreathingVisual
        phase={paused ? 'ready' : currentPhase.phase}
        duration={currentPhase.duration}
        color={config.color}
        edge={config.edge}
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
                If holding your breath makes you dizzy or uncomfortable, just breathe in and out.
              </p>
            </div>
          )}
          <button className="btn btn-primary breathing-start-btn" onClick={begin}>
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
    edge: '#3F6F84',
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
    edge: '#4A7390',
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
const SIGH_STEPS = [
  { label: 'First inhale', detail: 'Breathe in deeply through your nose — fill your lungs about 80%.', duration: 3 },
  { label: 'Top-up inhale', detail: 'Take a short second inhale through your nose to fully expand your lungs.', duration: 2 },
  { label: 'Long exhale', detail: 'Slowly breathe out through your mouth — take twice as long as the inhale.', duration: 6 },
];
// The circle at rest and breathed out, after the first inhale (about 80%), and full after the top-up,
// so each of the two inhales visibly fills it.
const SIGH_SIZES = [104, 128, 60];
const SIGH_REST = 60;

// In SOS (autoStart) it starts at once and moves on by itself when done; in the Toolbox it waits
// for Begin, can be paused, and ends on its own closing screen.
export function PhysiologicalSigh({ onComplete, autoStart = false, reps = 5 }: ExerciseProps & { autoStart?: boolean; reps?: number }) {
  const [running, setRunning] = useState(autoStart);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [step, setStep] = useState(0);
  const [rep, setRep] = useState(1);
  const [count, setCount] = useState(SIGH_STEPS[0].duration);
  const totalReps = reps;

  useEffect(() => {
    if (!running || paused) return;
    const t = setInterval(() => setCount(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [running, paused]);

  useEffect(() => {
    if (!running || count > 0) return;
    if (step + 1 < SIGH_STEPS.length) {
      setStep(step + 1);
      setCount(SIGH_STEPS[step + 1].duration);
    } else if (rep < totalReps) {
      setRep(rep + 1);
      setStep(0);
      setCount(SIGH_STEPS[0].duration);
    } else {
      setRunning(false);
      if (autoStart) onComplete();
      else setFinished(true);
    }
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps

  function begin() {
    setStep(0);
    setRep(1);
    setCount(SIGH_STEPS[0].duration);
    setPaused(false);
    setRunning(true);
  }

  // A pause starts the sigh again from its first inhale: the two inhales belong together.
  function togglePause() {
    if (paused) { setStep(0); setCount(SIGH_STEPS[0].duration); }
    setPaused(p => !p);
  }

  const sceneRef = useStepStart<HTMLDivElement>(running);

  if (finished) {
    return <BreathingDone onFinish={onComplete} onAgain={() => { setFinished(false); begin(); }} />;
  }

  const moving = running && !paused;
  const current = SIGH_STEPS[step];
  const size = moving ? SIGH_SIZES[step] : SIGH_REST;
  const transition = `${moving ? current.duration : 0.8}s ease-in-out`;
  const label = !running ? 'Ready' : paused ? 'Paused' : current.label;
  const detail = !running
    ? 'Two breaths in through your nose, then one long breath out. Tap Begin when you\'re ready.'
    : paused ? 'Resume when you\'re ready. It starts again from the first inhale.' : current.detail;

  return (
    <div className="breathing-scene" ref={sceneRef}>
      <div className="breathing-ring-wrap">
        <div
          className="breathing-ring"
          style={{
            width: size + 40,
            height: size + 40,
            color: '#6B9E7A',
            transition: `width ${transition}, height ${transition}`,
          }}
        />
        <div
          className="breathing-circle"
          style={{
            width: size,
            height: size,
            backgroundColor: '#6B9E7A59', // a soft fill (35%) inside a solid edge (3.98:1 on the page)
            boxShadow: 'inset 0 0 0 2px #4E7F5C',
            transition: `width ${transition}, height ${transition}`,
          }}
        />
      </div>

      <div className="breathing-phase">
        <span className="breathing-phase-label">{label}</span>
        <div className="breathing-phase-detail">{detail}</div>
        {moving && count > 0 && <div className="breathing-countdown" style={{ marginTop: 8 }}>{count}</div>}
      </div>

      <div className="breathing-cycle-info">
        {running ? `Sigh ${rep} of ${totalReps}` : `${totalReps} sighs · about ${totalReps * 11} seconds`}
      </div>

      {!running && (
        <button className="btn btn-primary breathing-start-btn" onClick={begin}>
          Begin
        </button>
      )}

      {running && !autoStart && (
        <div className="breathing-controls">
          <button className="btn btn-secondary" onClick={togglePause}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button className="btn btn-ghost" onClick={() => { setRunning(false); setPaused(false); }}>Stop</button>
        </div>
      )}
    </div>
  );
}
