import { useState } from 'react';
import { Meditation } from '../types';
import { estimateSeconds, generateMeditation, ScriptError } from '../lib/meditationScript';

const IDEAS = [
  'Winding down before sleep',
  'Stress about work',
  'Racing thoughts',
  'Before a difficult conversation',
  'Feeling overwhelmed',
];

const LENGTHS = [3, 5, 10];

interface Props {
  apiKey: string;
  meditations: Meditation[];
  onCreated: (m: Meditation) => void;
  onPlay: (m: Meditation) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
}

export default function Meditate({ apiKey, meditations, onCreated, onPlay, onDelete, onOpenSettings }: Props) {
  const [prompt, setPrompt] = useState('');
  const [minutes, setMinutes] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const hasKey = apiKey.trim().length > 0;

  async function create() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const meditation = await generateMeditation(apiKey.trim(), prompt, minutes);
      onCreated(meditation);
      setPrompt('');
    } catch (e) {
      setError(e instanceof ScriptError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const saved = [...meditations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <div className="toolbox-header">
        <div className="toolbox-title">Meditate</div>
        <div className="toolbox-sub">A guided meditation written for this moment</div>
      </div>

      <div className="home-section">
        {!hasKey ? (
          <div className="card settings-card">
            <div className="settings-row-title">One-time setup</div>
            <p className="settings-row-sub mb-4">
              Custom meditations are written by Claude. Add your Anthropic API key in Settings to turn this on.
              The voice itself runs on your phone.
            </p>
            <button className="btn btn-primary w-full" onClick={onOpenSettings}>Add API key</button>
          </div>
        ) : (
          <div className="card settings-card">
            <label className="settings-row-title" htmlFor="med-prompt">What would you like help with?</label>
            <textarea
              id="med-prompt"
              className="form-textarea w-full mt-2"
              placeholder="e.g. I can't switch off after work and my chest feels tight"
              maxLength={600}
              value={prompt}
              disabled={busy}
              onChange={e => setPrompt(e.target.value)}
            />
            <div className="chip-row">
              {IDEAS.map(idea => (
                <button key={idea} className="chip" disabled={busy} onClick={() => setPrompt(idea)}>{idea}</button>
              ))}
            </div>

            <div className="settings-row-title mt-4">Length</div>
            <div className="chip-row">
              {LENGTHS.map(m => (
                <button
                  key={m}
                  className={`chip ${minutes === m ? 'selected' : ''}`}
                  aria-pressed={minutes === m}
                  disabled={busy}
                  onClick={() => setMinutes(m)}
                >
                  {m} min
                </button>
              ))}
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="btn btn-primary w-full mt-4" disabled={!prompt.trim() || busy} onClick={create}>
              {busy ? 'Writing your meditation…' : 'Create meditation'}
            </button>
            {busy && <p className="caption-text mt-2 text-center">This usually takes 10 to 30 seconds.</p>}
          </div>
        )}
      </div>

      {saved.length > 0 && (
        <div className="home-section">
          <div className="home-section-title">Your meditations</div>
          <div className="quick-exercises">
            {saved.map(m => (
              <div key={m.id} className="card saved-med">
                <button className="saved-med-main" onClick={() => onPlay(m)}>
                  <span className="saved-med-play" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z" /></svg>
                  </span>
                  <span className="saved-med-text">
                    <span className="exercise-card-title">{m.title}</span>
                    <span className="settings-row-sub">
                      {Math.max(1, Math.round(estimateSeconds(m.segments) / 60))} min ·{' '}
                      {new Date(m.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {m.prompt}
                    </span>
                  </span>
                </button>
                {confirmId === m.id ? (
                  <div className="saved-med-confirm">
                    <button className="btn btn-ghost danger-text" onClick={() => { onDelete(m.id); setConfirmId(null); }}>Delete</button>
                    <button className="btn btn-ghost" onClick={() => setConfirmId(null)}>Keep</button>
                  </div>
                ) : (
                  <button className="saved-med-remove" onClick={() => setConfirmId(m.id)} aria-label={`Delete ${m.title}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
