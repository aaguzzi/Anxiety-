import { useState } from 'react';
import { ExerciseProps } from '../../types';

// ─── DARE Response ────────────────────────────────────
const DARE_STEPS = [
  {
    letter: 'D',
    title: 'Defuse',
    color: '#8B7DB8',
    desc: 'Step back from the anxious thought. Instead of "I\'m going to panic," try: "I notice my mind is predicting danger." You don\'t need to fight the thought — just unhook from it.',
    prompt: 'What thought is your mind currently running? Write it, then try labeling it as just a thought.',
  },
  {
    letter: 'A',
    title: 'Allow',
    color: '#B87A7A',
    desc: 'Allow the bodily sensations of anxiety to be present — racing heart, tight chest, shaky hands. Don\'t try to stop them. Say to yourself: "I allow this feeling to be here." Resistance amplifies anxiety; allowing reduces it.',
    prompt: 'What sensations are you feeling in your body right now? Describe them without judgment.',
  },
  {
    letter: 'R',
    title: 'Run toward',
    color: '#B8956A',
    desc: 'Instead of escaping the anxiety, turn toward it. Get curious: "What is my mind trying to protect me from?" Approach the feeling rather than fleeing it. The more you run toward anxiety, the less power it has.',
    prompt: 'What is anxiety trying to warn you about? What would happen if you moved toward that fear rather than away?',
  },
  {
    letter: 'E',
    title: 'Engage',
    color: '#6B9E7A',
    desc: 'Engage with your life. Do the thing anxiety was stopping you from doing — or simply get on with your day. You don\'t need to feel good to take action. Anxiety can ride along.',
    prompt: 'What is one thing you can do right now, even with anxiety present? Make it specific.',
  },
];

export function DAREResponse({ onComplete }: ExerciseProps) {
  const [step, setStep] = useState(0);
  const [reflections, setReflections] = useState<string[]>(['', '', '', '']);
  const [done, setDone] = useState(false);

  function handleNext() {
    if (step < DARE_STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="completion-screen">
        <span className="completion-icon">🌊</span>
        <div className="completion-title">You faced it.</div>
        <div className="completion-msg">
          The DARE response isn't about eliminating anxiety. It's about changing your relationship with it — from struggle to willingness. That's where freedom lives.
        </div>
        <button className="btn btn-primary mt-6" onClick={onComplete}>Finish</button>
      </div>
    );
  }

  const current = DARE_STEPS[step];

  return (
    <div>
      <div className="step-list">
        {DARE_STEPS.map((s, i) => (
          <div key={s.letter} className={`step-row ${i > step ? 'inactive' : ''}`}>
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
        style={{ backgroundColor: current.color }}
        onClick={handleNext}
      >
        {step < DARE_STEPS.length - 1 ? `Next: ${DARE_STEPS[step + 1].title}` : 'Complete DARE'}
      </button>
    </div>
  );
}

// ─── Soften and Allow ─────────────────────────────────
export function SoftenAllow({ onComplete }: ExerciseProps) {
  const [phase, setPhase] = useState<'locate' | 'describe' | 'soften' | 'allow' | 'done'>('locate');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const phases = {
    locate: {
      title: 'Locate the feeling',
      instruction: 'Bring your attention inward. Where in your body do you feel anxiety or discomfort right now? Chest? Stomach? Throat? Shoulders?',
      placeholder: 'Where do you feel it? (e.g. tight chest, knot in stomach...)',
      value: location,
      onChange: setLocation,
      next: 'describe' as const,
      btnLabel: 'I found it',
    },
    describe: {
      title: 'Describe it',
      instruction: 'Observe the sensation with curiosity. If this feeling had a size, shape, weight, color, or texture — what would it be? Describing it creates a bit of distance.',
      placeholder: 'Describe the sensation (e.g. tight band, heavy stone, pulsing heat...)',
      value: description,
      onChange: setDescription,
      next: 'soften' as const,
      btnLabel: 'Continue',
    },
  };

  if (phase === 'soften') {
    return (
      <div>
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
          style={{ backgroundColor: 'var(--cat-acceptance)' }}
          onClick={() => setPhase('allow')}
        >
          I've taken 3 breaths
        </button>
      </div>
    );
  }

  if (phase === 'allow') {
    return (
      <div>
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
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="completion-screen">
        <span className="completion-icon">🌊</span>
        <div className="completion-title">Opening, not closing.</div>
        <div className="completion-msg">
          Acceptance doesn't mean giving up. It means stopping the war with your own experience — and from that place of peace, you can choose freely.
        </div>
        <button className="btn btn-primary mt-6" onClick={onComplete}>Finish</button>
      </div>
    );
  }

  const p = phases[phase as 'locate' | 'describe'];

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16 }}>{p.title}</div>
      <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20 }}>{p.instruction}</p>
      <input
        type="text"
        className="label-input"
        placeholder={p.placeholder}
        value={p.value}
        onChange={e => p.onChange(e.target.value)}
      />
      <button
        className="btn btn-primary w-full mt-6"
        style={{ backgroundColor: 'var(--cat-acceptance)' }}
        disabled={!p.value.trim()}
        onClick={() => setPhase(p.next)}
      >
        {p.btnLabel}
      </button>
    </div>
  );
}
