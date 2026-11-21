import { useState } from 'react';
import { ExerciseProps } from '../../types';
import CompletionScreen, { WaitingButton } from './CompletionScreen';

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

  const canSubmit = form.step.trim().length > 0;

  if (done) {
    return (
      <CompletionScreen>
        <span className="completion-icon">🌱</span>
        <div className="completion-title">A step forward.</div>
        <div className="user-text" style={{ width: '100%', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.8, textAlign: 'left' }}>
          <div style={{ marginBottom: 12 }}>
            <strong style={{ color: 'var(--text-1)' }}>What I'm committed to:</strong><br />
            {form.step}
          </div>
          {form.value.trim() && (
            <div style={{ marginBottom: 12 }}>
              <strong style={{ color: 'var(--text-1)' }}>Why it matters:</strong><br />
              {form.value}
            </div>
          )}
          {form.when.trim() && (
            <div>
              <strong style={{ color: 'var(--text-1)' }}>When:</strong><br />
              {form.when}
            </div>
          )}
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-3)', maxWidth: 300, lineHeight: 1.6, textAlign: 'center' }}>
          You don't need to feel ready. You don't need anxiety to go away. You just need to take one step.
        </p>
        <button className="btn btn-primary mt-2" onClick={onComplete}>Finish</button>
      </CompletionScreen>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 28 }}>
        Anxiety keeps us small by convincing us we can't act until we feel better. This exercise identifies one step you can take <em>right now</em> — not despite anxiety, but alongside it.
      </p>

      <div className="step-form">
        <div className="form-group">
          <label className="form-label" htmlFor="oss-blocking">What is anxiety stopping you from doing?</label>
          <div className="form-hint" id="oss-blocking-hint">A conversation, a task, a decision, something you've been avoiding...</div>
          <textarea
            id="oss-blocking"
            aria-describedby="oss-blocking-hint"
            className="form-textarea"
            placeholder="e.g. Sending that email I've been putting off for a week..."
            value={form.blocking}
            onChange={e => update('blocking', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="oss-value">Why does this matter to you?</label>
          <div className="form-hint" id="oss-value-hint">Connect it to a value — not a should, but a genuine care.</div>
          <textarea
            id="oss-value"
            aria-describedby="oss-value-hint"
            className="form-textarea"
            placeholder="e.g. Because I value being reliable, and this person deserves a response..."
            value={form.value}
            onChange={e => update('value', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="oss-step">
            What is ONE small step you can take today? <span className="form-required">(needed to continue)</span>
          </label>
          <div className="form-hint" id="oss-step-hint">Make it concrete and achievable in the next 24 hours.</div>
          <textarea
            id="oss-step"
            aria-describedby="oss-step-hint"
            className="form-textarea"
            placeholder="e.g. Write a draft of the email, even if I don't send it..."
            value={form.step}
            onChange={e => update('step', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="oss-when">When and where will you do it?</label>
          <div className="form-hint" id="oss-when-hint">Deciding exactly when and where makes it easier to follow through.</div>
          <input
            id="oss-when"
            aria-describedby="oss-when-hint"
            type="text"
            className="form-input"
            placeholder="e.g. Today at 3pm, at my desk, before checking email..."
            value={form.when}
            onChange={e => update('when', e.target.value)}
          />
        </div>
      </div>

      <WaitingButton ready={canSubmit} need="Write the one small step you can take today to continue." onClick={() => setDone(true)}>
        I commit to this step
      </WaitingButton>
    </div>
  );
}
