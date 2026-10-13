import { useState } from 'react';
import { ExerciseProps } from '../../types';

// ─── Observer Self ────────────────────────────────────
const OBSERVER_SLIDES = [
  {
    icon: '☁️',
    text: 'Close your eyes for a moment, or soften your gaze. Take a slow breath.',
  },
  {
    icon: '🌤️',
    text: 'You have had thousands of thoughts today. Worries, plans, memories, judgments. Notice: you have been watching all of them.',
  },
  {
    icon: '🌥️',
    text: 'There is a part of you that has been present for every experience in your life — every emotion, every thought, every sensation. That part is always here.',
  },
  {
    icon: '⛅',
    text: 'Thoughts are like weather. They appear, they pass. Emotions are like weather. They arise, they move on. But you — the observer — are the sky.',
  },
  {
    icon: '🌈',
    text: 'The sky doesn\'t become the storm. It holds the storm. No matter how dark the clouds get, the sky remains. You are that sky.',
  },
  {
    icon: '✨',
    text: 'From this place of observing — not judging, not fixing — you can watch anxiety arise without being swept away by it. You are bigger than your anxiety.',
  },
  {
    icon: '🌅',
    text: 'Take a breath. You are the observer. You always have been. Anxiety is weather. You are the sky.',
  },
];

export function ObserverSelf({ onComplete }: ExerciseProps) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="completion-screen">
        <span className="completion-icon">☁️</span>
        <div className="completion-title">The sky remains.</div>
        <div className="completion-msg">
          No matter what weather passes through, the observer in you is always here — steady, spacious, and free.
        </div>
        <button className="btn btn-primary mt-6" onClick={onComplete}>Finish</button>
      </div>
    );
  }

  const slide = OBSERVER_SLIDES[idx];
  const isLast = idx === OBSERVER_SLIDES.length - 1;

  return (
    <div>
      <div className="meditation-scene">
        <div key={idx + '-icon'} className="meditation-icon">{slide.icon}</div>
        <div key={idx + '-text'} className="meditation-text">{slide.text}</div>
        <div className="meditation-progress">
          {OBSERVER_SLIDES.map((_, i) => (
            <div
              key={i}
              className={`meditation-dot ${i === idx ? 'active' : ''}`}
            />
          ))}
        </div>
      </div>

      <button
        className="btn btn-primary w-full mt-6"
        style={{ backgroundColor: 'var(--cat-mindfulness)' }}
        onClick={() => {
          if (isLast) setDone(true);
          else setIdx(i => i + 1);
        }}
      >
        {isLast ? 'Complete' : 'Continue'}
      </button>
    </div>
  );
}

// ─── Coming Back to Now ───────────────────────────────
export function PresentMoment({ onComplete }: ExerciseProps) {
  const [answers, setAnswers] = useState({ doing: '', noticing: '', intention: '' });
  const [done, setDone] = useState(false);

  function update(key: keyof typeof answers, val: string) {
    setAnswers(a => ({ ...a, [key]: val }));
  }

  const allFilled = Object.values(answers).some(v => v.trim().length > 0);

  if (done) {
    return (
      <div className="completion-screen">
        <span className="completion-icon">🌿</span>
        <div className="completion-title">You're here.</div>
        <div className="completion-msg">
          You just landed in the present moment. Carry your intention forward — not as pressure, but as a gentle compass.
        </div>
        <div style={{ width: '100%', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px 20px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, textAlign: 'left' }}>
          {answers.doing.trim() && <><strong>Right now:</strong> {answers.doing}<br /></>}
          {answers.noticing.trim() && <><strong>Noticing:</strong> {answers.noticing}<br /></>}
          {answers.intention.trim() && <><strong>Intention:</strong> {answers.intention}</>}
        </div>
        <button className="btn btn-primary mt-4" onClick={onComplete}>Finish</button>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 28 }}>
        Three questions to anchor you in this moment. Keep answers short — even a few words is enough.
      </p>

      <div className="anchor-questions">
        <div className="anchor-q">
          <div className="anchor-q-label">1. What am I doing right now?</div>
          <div className="anchor-q-sub">Describe the activity, not the worry.</div>
          <textarea
            className="anchor-textarea"
            placeholder="e.g. sitting at my desk, on the bus, at home..."
            value={answers.doing}
            onChange={e => update('doing', e.target.value)}
          />
        </div>

        <div className="anchor-q">
          <div className="anchor-q-label">2. What do I notice right now?</div>
          <div className="anchor-q-sub">Sights, sounds, sensations, emotions — just as they are.</div>
          <textarea
            className="anchor-textarea"
            placeholder="e.g. traffic outside, tension in my shoulders, afternoon light..."
            value={answers.noticing}
            onChange={e => update('noticing', e.target.value)}
          />
        </div>

        <div className="anchor-q">
          <div className="anchor-q-label">3. What is my intention for the next hour?</div>
          <div className="anchor-q-sub">Not a goal — a way of being. How do you want to show up?</div>
          <textarea
            className="anchor-textarea"
            placeholder="e.g. be present with what I'm doing, be kind to myself..."
            value={answers.intention}
            onChange={e => update('intention', e.target.value)}
          />
        </div>
      </div>

      <button
        className="btn btn-primary w-full"
        style={{ backgroundColor: 'var(--cat-mindfulness)', opacity: allFilled ? 1 : 0.4 }}
        disabled={!allFilled}
        onClick={() => setDone(true)}
      >
        Anchor complete
      </button>
    </div>
  );
}
