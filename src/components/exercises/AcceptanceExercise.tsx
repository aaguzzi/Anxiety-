import { useState } from 'react';
import { ExerciseProps } from '../../types';
import CompletionScreen, { StepBack, useStepStart, WaitingButton } from './CompletionScreen';

// ─── Make Room ────────────────────────────────────────
// Each step's colour fills its number while it is the current step, under a white letter: the
// darker 'ink' shades, so the letter reads (5.9:1 or more).
const MAKE_ROOM_STEPS = [
  {
    letter: 'N',
    title: 'Notice the thought',
    color: 'var(--cat-defusion-ink)',
    desc: 'Step back from the anxious thought. Instead of "I\'m going to panic," try: "I notice my mind is predicting danger." You don\'t need to fight the thought — just unhook from it.',
    prompt: 'What thought is your mind currently running? Write it, then try labeling it as just a thought.',
  },
  {
    letter: 'A',
    title: 'Allow',
    color: 'var(--cat-acceptance-ink)',
    desc: 'Allow the bodily sensations of anxiety to be present — racing heart, tight chest, shaky hands. Don\'t try to stop them. Say to yourself: "I allow this feeling to be here." Resistance amplifies anxiety; allowing reduces it.',
    prompt: 'What sensations are you feeling in your body right now? Describe them without judgment.',
  },
  {
    letter: 'T',
    title: 'Turn toward',
    color: 'var(--cat-values-ink)',
    desc: 'Instead of escaping the feeling, turn toward it with curiosity: "What is my mind trying to protect me from?" Approach it gently, at your own pace. This is about the feeling, not about putting yourself in real danger — if a situation is genuinely unsafe, or connected to trauma, it\'s okay to step back and work on it with a professional.',
    prompt: 'What is anxiety trying to warn you about? What would happen if you moved toward that fear rather than away?',
  },
  {
    letter: 'E',
    title: 'Engage',
    color: 'var(--cat-grounding-ink)',
    desc: 'Engage with your life. Do the thing anxiety was stopping you from doing — or simply get on with your day. You don\'t need to feel good to take action. Anxiety can ride along.',
    prompt: 'What is one thing you can do right now, even with anxiety present? Make it specific.',
  },
];

export function MakeRoom({ onComplete }: ExerciseProps) {
  const [step, setStep] = useState(0);
  const [reflections, setReflections] = useState<string[]>(['', '', '', '']);
  const [done, setDone] = useState(false);
  const stepRef = useStepStart<HTMLDivElement>(step);

  function handleNext() {
    if (step < MAKE_ROOM_STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <CompletionScreen>
        <span className="completion-icon">🌊</span>
        <div className="completion-title">You faced it.</div>
        <div className="completion-msg">
          Making room isn't about eliminating anxiety. It's about changing your relationship with it — from struggle to willingness. That's where freedom lives.
        </div>
        <button className="btn btn-primary mt-6" onClick={onComplete}>Finish</button>
      </CompletionScreen>
    );
  }

  return (
    <div>
      <div className="step-list">
        {MAKE_ROOM_STEPS.map((s, i) => (
          <div key={s.letter} className={`step-row ${i > step ? 'inactive' : ''}`} ref={i === step ? stepRef : undefined}>
            <div className={`step-num ${i === step ? 'current' : i < step ? 'done' : ''}`}
              style={i === step ? { backgroundColor: s.color } : {}}>
              {i < step ? '✓' : s.letter}
            </div>
            <div className="step-body">
              <div className="step-title">{s.title}</div>
              {i === step && (
                <>
                  <div className="step-desc">{s.desc}</div>
                  <textarea
                    className="step-reflection"
                    placeholder={s.prompt}
                    aria-label={s.prompt}
                    value={reflections[i]}
                    onChange={e => {
                      const next = [...reflections];
                      next[i] = e.target.value;
                      setReflections(next);
                    }}
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        className="btn btn-primary w-full"
        onClick={handleNext}
      >
        {step < MAKE_ROOM_STEPS.length - 1 ? `Next: ${MAKE_ROOM_STEPS[step + 1].title}` : 'Complete'}
      </button>
      {step > 0 && <StepBack onClick={() => setStep(s => s - 1)} />}
    </div>
  );
}

// ─── Soften and Allow ─────────────────────────────────
export function SoftenAllow({ onComplete }: ExerciseProps) {
  const [phase, setPhase] = useState<'locate' | 'describe' | 'soften' | 'allow' | 'done'>('locate');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const stepRef = useStepStart<HTMLDivElement>(phase);

  const phases = {
    locate: {
      title: 'Locate the feeling',
      instruction: 'Bring your attention inward. Where in your body do you feel anxiety or discomfort right now? Chest? Stomach? Throat? Shoulders?',
      placeholder: 'Where do you feel it? (e.g. tight chest, knot in stomach...)',
      label: 'Where do you feel it?',
      value: location,
      onChange: setLocation,
      next: 'describe' as const,
      back: null,
      btnLabel: 'I found it',
      need: 'Write where you feel it to continue.',
    },
    describe: {
      title: 'Describe it',
      instruction: 'Observe the sensation with curiosity. If this feeling had a size, shape, weight, color, or texture — what would it be? Describing it creates a bit of distance.',
      placeholder: 'Describe the sensation (e.g. tight band, heavy stone, pulsing heat...)',
      label: 'Describe the sensation',
      value: description,
      onChange: setDescription,
      next: 'soften' as const,
      back: 'locate' as const,
      btnLabel: 'Continue',
      need: 'Describe it in a few words to continue.',
    },
  };

  if (phase === 'soften') {
    return (
      <div ref={stepRef}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16 }}>Breathe space around it</div>
        <p style={{ fontSize: 16, fontFamily: 'Georgia, serif', lineHeight: 1.8, color: 'var(--text-1)', marginBottom: 20 }}>
          Take a slow, gentle breath. As you breathe, imagine the air flowing around the feeling — not pushing it away, but creating space for it to exist.
        </p>
        <p style={{ fontSize: 16, fontFamily: 'Georgia, serif', lineHeight: 1.8, color: 'var(--text-1)', marginBottom: 20 }}>
          The goal isn't to make the feeling disappear. It's to stop fighting it. What you resist, persists. What you allow, can pass.
        </p>
        <p style={{ fontSize: 16, fontFamily: 'Georgia, serif', lineHeight: 1.8, color: 'var(--text-1)', marginBottom: 32 }}>
          Take 3 slow breaths. With each exhale, imagine softening slightly around <em>{location || 'that area'}</em>.
        </p>
        <button
          className="btn btn-primary w-full"
          onClick={() => setPhase('allow')}
        >
          I've taken 3 breaths
        </button>
        <StepBack onClick={() => setPhase('describe')} />
      </div>
    );
  }

  if (phase === 'allow') {
    return (
      <div ref={stepRef}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16 }}>Allow it to be here</div>
        <p style={{ fontSize: 16, fontFamily: 'Georgia, serif', lineHeight: 1.8, color: 'var(--text-1)', marginBottom: 20 }}>
          Say these words to yourself, and mean them:
        </p>
        <div style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          padding: '20px 24px',
          borderLeft: '4px solid var(--cat-acceptance)',
          marginBottom: 24,
        }}>
          <p style={{ fontSize: 18, fontFamily: 'Georgia, serif', lineHeight: 1.8, color: 'var(--text-1)' }}>
            "I allow this feeling to be here.<br />
            I don't have to like it.<br />
            I don't have to change it.<br />
            I just make room for it."
          </p>
        </div>
        <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 28 }}>
          Notice what happens when you stop fighting. Often the feeling doesn't disappear — but its grip loosens.
        </p>
        <button
          className="btn btn-primary w-full"
          onClick={() => { setPhase('done'); }}
        >
          Complete practice
        </button>
        <StepBack onClick={() => setPhase('soften')} />
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <CompletionScreen>
        <span className="completion-icon">🌊</span>
        <div className="completion-title">Opening, not closing.</div>
        <div className="completion-msg">
          Acceptance doesn't mean giving up. It means stopping the war with your own experience — and from that place of peace, you can choose freely.
        </div>
        <button className="btn btn-primary mt-6" onClick={onComplete}>Finish</button>
      </CompletionScreen>
    );
  }

  const p = phases[phase as 'locate' | 'describe'];
  const back = p.back;

  return (
    <div ref={stepRef}>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16 }}>{p.title}</div>
      <p id="soften-instruction" style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20 }}>{p.instruction}</p>
      <input
        type="text"
        className="label-input"
        placeholder={p.placeholder}
        aria-label={p.label}
        aria-describedby="soften-instruction"
        value={p.value}
        onChange={e => p.onChange(e.target.value)}
      />
      <WaitingButton className="mt-6" ready={!!p.value.trim()} need={p.need} onClick={() => setPhase(p.next)}>
        {p.btnLabel}
      </WaitingButton>
      {back && <StepBack onClick={() => setPhase(back)} />}
    </div>
  );
}
