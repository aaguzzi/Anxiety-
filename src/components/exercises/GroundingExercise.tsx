import { useState } from 'react';
import { ExerciseProps } from '../../types';

// ─── 5-4-3-2-1 Grounding ──────────────────────────────
const SENSES = [
  { count: 5, sense: 'SEE', prompt: 'Name 5 things you can see right now.' },
  { count: 4, sense: 'FEEL', prompt: 'Name 4 things you can physically feel.' },
  { count: 3, sense: 'HEAR', prompt: 'Name 3 things you can hear.' },
  { count: 2, sense: 'SMELL', prompt: 'Name 2 things you can smell (or imagine).' },
  { count: 1, sense: 'TASTE', prompt: 'Name 1 thing you can taste right now.' },
];

export function Grounding54321({ onComplete }: ExerciseProps) {
  const [inputs, setInputs] = useState<string[][]>(
    SENSES.map(s => Array(s.count).fill(''))
  );
  const [done, setDone] = useState(false);

  function handleChange(si: number, ii: number, val: string) {
    setInputs(prev => {
      const next = prev.map(row => [...row]);
      next[si][ii] = val;
      return next;
    });
  }

  const [ticked, setTicked] = useState<boolean[][]>(SENSES.map(s => Array(s.count).fill(false)));
  const isDone = (si: number, ii: number) => ticked[si][ii] || inputs[si][ii].trim().length > 0;
  const doneCount = SENSES.reduce((n, s, si) => n + Array.from({ length: s.count }, (_, ii) => isDone(si, ii)).filter(Boolean).length, 0);

  function toggleTick(si: number, ii: number) {
    setTicked(prev => {
      const next = prev.map(row => [...row]);
      next[si][ii] = !next[si][ii];
      return next;
    });
  }

  if (done) {
    return (
      <div className="completion-screen">
        <span className="completion-icon">🌿</span>
        <div className="completion-title">You're here.</div>
        <div className="completion-msg">
          You just anchored yourself in the present moment through your senses. Whatever you notice now is fine, just as it is.
        </div>
        <button className="btn btn-primary mt-6" onClick={onComplete}>Finish</button>
      </div>
    );
  }

  return (
    <div>
      {SENSES.map((s, si) => (
        <div className="sense-block" key={s.sense}>
          <div className="sense-heading">
            <span className="sense-num">{s.count}</span>
            <div>
              <div className="sense-name">things I can {s.sense.toLowerCase()}</div>
              <div className="sense-prompt">{s.prompt}</div>
            </div>
          </div>
          <div className="sense-inputs">
            {Array.from({ length: s.count }, (_, ii) => (
              <div className="sense-input-row" key={ii}>
                <button
                  type="button"
                  className={`sense-check ${isDone(si, ii) ? 'done' : ''}`}
                  onClick={() => toggleTick(si, ii)}
                  aria-label={`Mark ${s.sense.toLowerCase()} item ${ii + 1} as noticed`}
                  aria-pressed={isDone(si, ii)}
                />
                <input
                  type="text"
                  className={`sense-input ${inputs[si][ii].trim() ? 'filled' : ''}`}
                  placeholder="Tap the circle, or type it (optional)"
                  value={inputs[si][ii]}
                  onChange={e => handleChange(si, ii, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <button className="btn btn-primary w-full mt-4" onClick={() => setDone(true)}>
        {doneCount === 15 ? 'Complete grounding' : 'Finish'}
      </button>
      <div style={{ height: 16 }} />
    </div>
  );
}

// ─── Body Scan ────────────────────────────────────────
const BODY_REGIONS = [
  { area: 'Feet & legs', prompt: 'Bring your attention to your feet and legs. Notice any sensations — warmth, pressure, tingling, heaviness. You don\'t need to change anything. Just notice.' },
  { area: 'Hips & belly', prompt: 'Shift your attention to your hips, lower back, and belly. Notice the rise and fall of your breath here. If there\'s tension, breathe space around it without trying to fix it.' },
  { area: 'Chest & shoulders', prompt: 'Bring awareness to your chest and shoulders. This is where anxiety often lives. Notice tightness or restriction. Breathe gently into it — softening rather than releasing.' },
  { area: 'Arms & hands', prompt: 'Notice your arms, elbows, forearms, and hands. Allow them to be heavy. Let gravity hold them.' },
  { area: 'Neck & jaw', prompt: 'Bring attention to your neck, throat, and jaw. The jaw especially holds a lot. Let your teeth part slightly if they\'re clenched. Soften.' },
  { area: 'Face & head', prompt: 'Gently notice your scalp, forehead, eyes, and cheeks. Let the muscles around your eyes soften. Imagine tension dissolving like morning fog.' },
  { area: 'Whole body', prompt: 'Now hold your whole body in awareness. You don\'t need to fix anything you found. Your body is doing its best. Thank it for carrying you today.' },
];

export function BodyScan({ onComplete }: ExerciseProps) {
  const [regionIdx, setRegionIdx] = useState(-1);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="completion-screen">
        <span className="completion-icon">🌊</span>
        <div className="completion-title">Well done.</div>
        <div className="completion-msg">
          You just practiced acceptance with your body — meeting sensation with curiosity instead of struggle.
        </div>
        <button className="btn btn-primary mt-6" onClick={onComplete}>Finish</button>
      </div>
    );
  }

  if (regionIdx === -1) {
    return (
      <div>
        <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 28 }}>
          A body scan helps you check in with physical sensation using curiosity instead of judgment. You won't be trying to relax — just to notice.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 32 }}>
          Find a comfortable position. You can close your eyes or soften your gaze.
        </p>
        <button className="btn btn-primary w-full" onClick={() => setRegionIdx(0)}>
          Begin body scan
        </button>
      </div>
    );
  }

  const region = BODY_REGIONS[regionIdx];
  const isLast = regionIdx === BODY_REGIONS.length - 1;

  return (
    <div>
      <div style={{
        display: 'flex',
        gap: 6,
        marginBottom: 28,
      }}>
        {BODY_REGIONS.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 99,
              background: i <= regionIdx ? 'var(--cat-grounding)' : 'var(--border)',
              transition: 'background 0.3s ease',
            }}
          />
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cat-grounding)', marginBottom: 10 }}>
        {regionIdx + 1} of {BODY_REGIONS.length}
      </div>

      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', marginBottom: 20 }}>
        {region.area}
      </div>

      <div
        key={regionIdx}
        style={{
          fontSize: 17,
          fontFamily: 'Georgia, serif',
          color: 'var(--text-1)',
          lineHeight: 1.8,
          marginBottom: 36,
          animation: 'fadeIn 600ms ease forwards',
        }}
      >
        {region.prompt}
      </div>

      <button
        className="btn btn-primary w-full"
        style={{ backgroundColor: 'var(--cat-grounding)' }}
        onClick={() => {
          if (isLast) setDone(true);
          else setRegionIdx(i => i + 1);
        }}
      >
        {isLast ? 'Complete scan' : 'Continue'}
      </button>
    </div>
  );
}
