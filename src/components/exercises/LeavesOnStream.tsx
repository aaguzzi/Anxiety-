import { useState, useRef } from 'react';
import { ExerciseProps } from '../../types';

interface Leaf {
  id: number;
  text: string;
  duration: number;
  topOffset: number;
}

export default function LeavesOnStream({ onComplete }: ExerciseProps) {
  const [thought, setThought] = useState('');
  const [leaves, setLeaves] = useState<Leaf[]>([]);
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);
  const nextId = useRef(0);

  function addLeaf() {
    const text = thought.trim();
    if (!text) return;
    const leaf: Leaf = {
      id: nextId.current++,
      text,
      duration: 7 + Math.random() * 4,
      topOffset: 30 + Math.random() * 40,
    };
    setLeaves(prev => [...prev, leaf]);
    setCount(c => c + 1);
    setThought('');

    setTimeout(() => {
      setLeaves(prev => prev.filter(l => l.id !== leaf.id));
    }, (leaf.duration + 0.5) * 1000);
  }

  if (done) {
    return (
      <div className="completion-screen">
        <span className="completion-icon">🍃</span>
        <div className="completion-title">Well practiced.</div>
        <div className="completion-msg">
          You placed {count} thought{count !== 1 ? 's' : ''} on leaves and watched them float away. You are not your thoughts — you are the observer.
        </div>
        <button className="btn btn-primary mt-6" onClick={onComplete}>Finish</button>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 8 }}>
        Imagine you're sitting beside a gently flowing stream. Autumn leaves drift past on the surface.
      </p>
      <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20 }}>
        Type each thought — worry, judgment, sensation, anything — and place it on a leaf. Watch it float away without holding on.
      </p>

      <div className="stream-wrap">
        <div className="stream-line" />
        <div className="stream-line-2" />
        {leaves.map(leaf => (
          <div
            key={leaf.id}
            className="leaf"
            style={{
              top: `${leaf.topOffset}%`,
              '--leaf-dur': `${leaf.duration}s`,
            } as React.CSSProperties}
          >
            {leaf.text}
          </div>
        ))}
        {leaves.length === 0 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: 'var(--text-3)',
            fontStyle: 'italic',
          }}>
            the stream is waiting...
          </div>
        )}
      </div>

      <div className="thought-input-row">
        <input
          type="text"
          className="thought-input"
          placeholder="Type a thought and place it on a leaf..."
          value={thought}
          onChange={e => setThought(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addLeaf()}
        />
        <button className="thought-add-btn" onClick={addLeaf} aria-label="Add leaf">
          +
        </button>
      </div>

      {count > 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
          {count} thought{count !== 1 ? 's' : ''} placed on the stream.
        </p>
      )}

      {count >= 3 && (
        <button
          className="btn btn-primary w-full"
          style={{ backgroundColor: 'var(--cat-defusion)' }}
          onClick={() => setDone(true)}
        >
          Complete practice
        </button>
      )}
    </div>
  );
}
