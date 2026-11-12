import { useState } from 'react';
import { ExerciseProps } from '../../types';

// Keep the thought verbatim ("…the thought that I'm worthless"); only soften a leading capital
// on ordinary words so the sentence reads naturally.
export function asEmbeddedThought(raw: string): string {
  const t = raw.trim().replace(/[.!?…]+$/, '');
  if (/^I\b/.test(t) || /^[A-Z]{2,}\b/.test(t)) return t;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

// ─── Thought Labeling ─────────────────────────────────
export function ThoughtLabeling({ onComplete }: ExerciseProps) {
  const [thought, setThought] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [count, setCount] = useState(0);
  const [finished, setFinished] = useState(false);

  function submit() {
    if (!thought.trim()) return;
    setSubmitted(true);
    setCount(c => c + 1);
  }

  function nextThought() {
    setThought('');
    setSubmitted(false);
  }

  if (finished) {
    return (
      <div className="completion-screen">
        <span className="completion-icon">🍃</span>
        <div className="completion-title">Nicely done.</div>
        <div className="completion-msg">
          Each time you say "I notice I'm having the thought that…" you create a moment of space between you and your mind. That space is freedom.
        </div>
        <button className="btn btn-primary mt-6" onClick={onComplete}>Finish</button>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 24 }}>
        When we fuse with a thought, it feels like fact. This exercise creates distance by labeling thoughts <em>as thoughts</em> — not truths.
      </p>

      <div className="label-input-group">
        <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', display: 'block', marginBottom: 8 }}>
          Write a current anxious thought:
        </label>
        <input
          type="text"
          className="label-input"
          placeholder="e.g. I'm going to fail this..."
          value={thought}
          onChange={e => { setThought(e.target.value); setSubmitted(false); }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          disabled={submitted}
        />
        {!submitted && (
          <button
            className="btn btn-primary w-full mt-4"
            style={{ backgroundColor: 'var(--cat-defusion)' }}
            disabled={!thought.trim()}
            onClick={submit}
          >
            Notice it
          </button>
        )}
      </div>

      {submitted && thought && (
        <div className="label-transform">
          <div className="label-box">
            <div className="label-box-tag">Step 1 — Defusion</div>
            <div className="label-box-text">
              I'm having the thought that <em>{asEmbeddedThought(thought)}</em>.
            </div>
          </div>
          <div className="label-box">
            <div className="label-box-tag">Step 2 — Deeper defusion</div>
            <div className="label-box-text">
              I notice I'm having the thought that <em>{asEmbeddedThought(thought)}</em>.
            </div>
          </div>
          <div className="label-box" style={{ borderColor: 'var(--cat-grounding)' }}>
            <div className="label-box-tag" style={{ color: 'var(--cat-grounding)' }}>Notice</div>
            <div className="label-box-text" style={{ fontSize: 14, fontStyle: 'normal', fontFamily: 'inherit' }}>
              How does it feel different to observe the thought rather than be inside it?
            </div>
          </div>

          <button className="btn btn-secondary w-full mt-4" onClick={nextThought}>
            Notice another thought
          </button>
          <button className="btn btn-primary w-full mt-4" onClick={() => setFinished(true)}>
            Finish ({count} noticed)
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Name the Story ───────────────────────────────────
export function NameTheStory({ onComplete }: ExerciseProps) {
  const [storyName, setStoryName] = useState('');
  const [practiced, setPracticed] = useState(false);

  return (
    <div>
      <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20 }}>
        Our minds tell familiar stories — the same worries, self-doubts, and predictions on repeat. These stories feel urgent and real, but they're just your mind doing what minds do.
      </p>

      <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 24 }}>
        Naming the story creates distance. Instead of being swept up in it, you can notice: <em>"There it goes again."</em>
      </p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', display: 'block', marginBottom: 8 }}>
          What is your mind's recurring anxiety story?
        </label>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>
          Examples: "The I'm not good enough story", "The Something bad will happen story", "The I can't cope story"
        </p>
        <input
          type="text"
          className="label-input"
          placeholder='The "___" story'
          value={storyName}
          onChange={e => setStoryName(e.target.value)}
        />
      </div>

      {storyName.trim() && (
        <div>
          <div className="label-box" style={{ marginBottom: 20 }}>
            <div className="label-box-tag">Your practice phrase</div>
            <div className="label-box-text" style={{ fontSize: 18 }}>
              "Oh, there goes {/^the\b/i.test(storyName.trim()) ? '' : 'the '}{storyName.trim().replace(/^The\b/, 'the')} again."
            </div>
          </div>

          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20 }}>
            Say it out loud a few times. Notice how naming the story changes your relationship to it. You're not the story — you're the one who notices it.
          </p>

          {!practiced ? (
            <button
              className="btn btn-primary w-full"
              style={{ backgroundColor: 'var(--cat-defusion)' }}
              onClick={() => setPracticed(true)}
            >
              I practiced the phrase
            </button>
          ) : (
            <div>
              <div style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 24, padding: '16px 20px', background: 'var(--surface)', borderRadius: 'var(--radius)' }}>
                Whenever that story shows up — in an anxious moment, a hard conversation, or lying awake at night — you can simply notice: <em>"There it goes again."</em> No need to argue with it or push it away.
              </div>
              <button className="btn btn-primary w-full" onClick={onComplete}>
                Finish
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ThoughtLabeling;
