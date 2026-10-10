import { useState } from 'react';
import { ExerciseProps } from '../../types';

export default function OneSmallStep({ onComplete }: ExerciseProps) {
  const [form, setForm] = useState({
    blocking: '',
    value: '',
    step: '',
    when: '',
  });
  const [done, setDone] = useState(false);

  function update(key: keyof typeof form, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  const canSubmit = Object.values(form).every(v => v.trim().length > 0);

  if (done) {
    return (
      <div className="completion-screen">
        <span className="completion-icon">🌱</span>
        <div className="completion-title">A step forward.</div>
        <div style={{ width: '100%', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.8, textAlign: 'left' }}>
          <div style={{ marginBottom: 12 }}>
            <strong style={{ color: 'var(--text-1)' }}>What I'm committed to:</strong><br />
            {form.step}
          </div>
          <div style={{ marginBottom: 12 }}>
            <strong style={{ color: 'var(--text-1)' }}>Why it matters:</strong><br />
            {form.value}
          </div>
          <div>
            <strong style={{ color: 'var(--text-1)' }}>When:</strong><br />
            {form.when}
          </div>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-3)', maxWidth: 300, lineHeight: 1.6, textAlign: 'center' }}>
          You don't need to feel ready. You don't need anxiety to go away. You just need to take one step.
        </p>
        <button className="btn btn-primary mt-2" onClick={onComplete}>Finish</button>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 28 }}>
        Anxiety keeps us small by convincing us we can't act until we feel better. This exercise identifies one step you can take <em>right now</em> — not despite anxiety, but alongside it.
      </p>

      <div className="step-form">
        <div className="form-group">
          <label className="form-label">What is anxiety stopping you from doing?</label>
          <div className="form-hint">A conversation, a task, a decision, something you've been avoiding...</div>
          <textarea
            className="form-textarea"
            placeholder="e.g. Sending that email I've been putting off for a week..."
            value={form.blocking}
            onChange={e => update('blocking', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Why does this matter to you?</label>
          <div className="form-hint">Connect it to a value — not a should, but a genuine care.</div>
          <textarea
            className="form-textarea"
            placeholder="e.g. Because I value being reliable, and this person deserves a response..."
            value={form.value}
            onChange={e => update('value', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">What is ONE small step you can take today?</label>
          <div className="form-hint">Make it concrete and achievable in the next 24 hours.</div>
          <textarea
            className="form-textarea"
            placeholder="e.g. Write a draft of the email, even if I don't send it..."
            value={form.step}
            onChange={e => update('step', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">When and where will you do it?</label>
          <div className="form-hint">An implementation intention makes it 2–3× more likely to happen.</div>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Today at 3pm, at my desk, before checking email..."
            value={form.when}
            onChange={e => update('when', e.target.value)}
          />
        </div>
      </div>

      <button
        className="btn btn-primary w-full"
        style={{ backgroundColor: 'var(--cat-action)', opacity: canSubmit ? 1 : 0.4 }}
        disabled={!canSubmit}
        onClick={() => setDone(true)}
      >
        I commit to this step
      </button>
    </div>
  );
}
