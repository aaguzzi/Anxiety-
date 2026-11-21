import { useState } from 'react';
import { ExerciseProps } from '../../types';
import CompletionScreen, { StepBack, useStepStart, WaitingButton } from './CompletionScreen';

const DOMAINS = [
  { id: 'relationships', emoji: '💞', name: 'Relationships' },
  { id: 'health', emoji: '🏃', name: 'Health' },
  { id: 'work', emoji: '💼', name: 'Work & Career' },
  { id: 'growth', emoji: '📚', name: 'Personal Growth' },
  { id: 'fun', emoji: '🎨', name: 'Fun & Creativity' },
  { id: 'community', emoji: '🤝', name: 'Community' },
  { id: 'family', emoji: '🏠', name: 'Family' },
  { id: 'spirit', emoji: '✨', name: 'Meaning & Spirit' },
];

export default function ValuesCompass({ onComplete }: ExerciseProps) {
  const [phase, setPhase] = useState<'select' | 'intend' | 'done'>('select');
  const [selected, setSelected] = useState<string[]>([]);
  const [intentions, setIntentions] = useState<Record<string, string>>({});
  const stepRef = useStepStart<HTMLDivElement>(phase);

  function toggleDomain(id: string) {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(d => d !== id)
        : prev.length < 3 ? [...prev, id] : prev
    );
  }

  function setIntention(id: string, val: string) {
    setIntentions(prev => ({ ...prev, [id]: val }));
  }

  const anyIntention = selected.some(id => intentions[id]?.trim());

  if (phase === 'done') {
    const selectedDomains = DOMAINS.filter(d => selected.includes(d.id) && intentions[d.id]?.trim());
    return (
      <CompletionScreen>
        <span className="completion-icon">🧭</span>
        <div className="completion-title">Compass set.</div>
        <div className="completion-msg user-text">
          {selectedDomains.map(d => (
            <div key={d.id} style={{ marginBottom: 12, textAlign: 'left' }}>
              <strong>{d.emoji} {d.name}:</strong>{' '}
              <span style={{ color: 'var(--text-2)' }}>{intentions[d.id]}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-3)', maxWidth: 300, lineHeight: 1.6 }}>
          Let these intentions orient you today — not as pressure, but as a compass.
        </p>
        <button className="btn btn-primary mt-4" onClick={onComplete}>Finish</button>
      </CompletionScreen>
    );
  }

  if (phase === 'intend') {
    const selectedDomains = DOMAINS.filter(d => selected.includes(d.id));
    return (
      <div ref={stepRef}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>Set an intention</div>
        <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 24 }}>
          For each area, write one small intention — not a goal, not a to-do. A direction. Something that reflects what you want to stand for.
        </p>

        <div className="values-intentions">
          {selectedDomains.map(d => (
            <div className="intention-row" key={d.id}>
              <label className="intention-label" htmlFor={`intention-${d.id}`}>{d.emoji} {d.name}</label>
              <input
                id={`intention-${d.id}`}
                type="text"
                className="intention-input"
                placeholder={`I want to show up as... / I value...`}
                value={intentions[d.id] ?? ''}
                onChange={e => setIntention(d.id, e.target.value)}
              />
            </div>
          ))}
        </div>

        <WaitingButton ready={anyIntention} need="Write at least one intention to continue." onClick={() => setPhase('done')}>
          Set my compass
        </WaitingButton>
        <StepBack onClick={() => setPhase('select')} />
      </div>
    );
  }

  return (
    <div ref={stepRef}>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>Choose up to 3 areas</div>
      <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
        Select the life areas that matter most to you right now — or that anxiety is most affecting.
      </p>

      <div className="values-domains">
        {DOMAINS.map(d => (
          <button
            type="button"
            key={d.id}
            className={`domain-card ${selected.includes(d.id) ? 'selected' : ''}`}
            aria-pressed={selected.includes(d.id)}
            onClick={() => toggleDomain(d.id)}
          >
            <span className="domain-emoji" aria-hidden="true">{d.emoji}</span>
            <span className="domain-name">{d.name}</span>
          </button>
        ))}
      </div>

      <WaitingButton ready={selected.length > 0} need="Choose at least one area to continue." onClick={() => setPhase('intend')}>
        {selected.length > 0 ? `Continue with ${selected.length} area${selected.length !== 1 ? 's' : ''}` : 'Continue'}
      </WaitingButton>
    </div>
  );
}
