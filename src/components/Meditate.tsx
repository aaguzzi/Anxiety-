import { useState } from 'react';
import { Meditation, MeditationSetup } from '../types';
import { BALANCES, ENDINGS, estimateSeconds, LENGTHS, POSITIONS, PRACTICES } from '../lib/meditationScript';
import { STARTER_GROUPS, starterMeditations } from '../data/starterMeditations';

const IDEAS = [
  'Winding down before sleep',
  'Stress about work',
  'Racing thoughts',
  'Before a difficult conversation',
  'Feeling overwhelmed',
];

interface Props {
  hasKey: boolean;
  speechSpeed: number;
  pauseScale: number;
  /** One line saying which voice and sounds are in use. */
  voiceSummary: string;
  meditations: Meditation[];
  setup: MeditationSetup;
  busy: boolean;
  error: string | null;
  onSetup: (setup: MeditationSetup) => void;
  onCreate: (prompt: string, setup: MeditationSetup) => Promise<boolean>;
  onPlay: (m: Meditation) => void;
  onDelete: (id: string) => void;
  onOpenVoice: () => void;
  onOpenKey: () => void;
}

interface ChoiceProps<T extends string | number> {
  title: string;
  options: readonly { id: T; label: string }[];
  value: T;
  disabled: boolean;
  onPick: (id: T) => void;
}

function Choice<T extends string | number>({ title, options, value, disabled, onPick }: ChoiceProps<T>) {
  return (
    <>
      <div className="settings-row-title mt-4">{title}</div>
      <div className="chip-row" role="group" aria-label={title}>
        {options.map(o => (
          <button
            key={o.id}
            className={`chip ${value === o.id ? 'selected' : ''}`}
            aria-pressed={value === o.id}
            disabled={disabled}
            onClick={() => onPick(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </>
  );
}

function minutesOf(m: Meditation, speed: number, pauseScale: number): number {
  return Math.max(1, Math.round(estimateSeconds(m.segments, speed, pauseScale) / 60));
}

function PlayIcon() {
  return (
    <span className="saved-med-play" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z" /></svg>
    </span>
  );
}

export default function Meditate({
  hasKey, speechSpeed, pauseScale, voiceSummary, meditations, setup, busy, error,
  onSetup, onCreate, onPlay, onDelete, onOpenVoice, onOpenKey,
}: Props) {
  const [prompt, setPrompt] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const set = (patch: Partial<MeditationSetup>) => onSetup({ ...setup, ...patch });

  async function create() {
    if (!prompt.trim() || busy) return;
    if (await onCreate(prompt, setup)) setPrompt('');
  }

  const saved = [...meditations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <div className="toolbox-header">
        <div className="toolbox-title">Meditate</div>
        <div className="toolbox-sub">Guided meditations, read aloud on your phone</div>
      </div>

      <button className="card voice-card" onClick={onOpenVoice}>
        <span className="voice-card-text">
          <span className="exercise-card-title">Voice &amp; sounds</span>
          <span className="settings-row-sub">{voiceSummary}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {STARTER_GROUPS.map(group => (
        <div className="home-section" key={group}>
          <div className="home-section-title">{group}</div>
          <div className="quick-exercises">
            {starterMeditations.filter(m => m.group === group).map(m => (
              <div key={m.id} className="card saved-med">
                <button className="saved-med-main" onClick={() => onPlay(m)}>
                  <PlayIcon />
                  <span className="saved-med-text">
                    <span className="exercise-card-title">{m.title}</span>
                    <span className="settings-row-sub">{minutesOf(m, speechSpeed, pauseScale)} min · {m.prompt}</span>
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="home-section">
        <div className="home-section-title">Make your own</div>
        {!hasKey ? (
          <div className="card settings-card">
            <p className="settings-row-sub mb-4">
              Describe what's on your mind and get a meditation written for it. This uses Claude, Anthropic's AI,
              and needs your own Anthropic API key (a paid developer account). The voice itself runs on your phone.
            </p>
            <button className="btn btn-primary w-full" onClick={onOpenKey}>Add API key</button>
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

            <Choice
              title="Length"
              options={LENGTHS.map(m => ({ id: m, label: `${m} min` }))}
              value={setup.minutes}
              disabled={busy}
              onPick={minutes => set({ minutes })}
            />
            <Choice title="Practice" options={PRACTICES} value={setup.practice} disabled={busy} onPick={practice => set({ practice })} />
            <Choice title="Guidance" options={BALANCES} value={setup.balance} disabled={busy} onPick={balance => set({ balance })} />
            <Choice title="I'll be" options={POSITIONS} value={setup.position} disabled={busy} onPick={position => set({ position })} />
            <Choice title="End by bringing me" options={ENDINGS} value={setup.ending} disabled={busy} onPick={ending => set({ ending })} />

            <label className="settings-row-title mt-4 block" htmlFor="med-notes">Anything to include or leave out? (optional)</label>
            <input
              id="med-notes"
              type="text"
              className="form-input w-full mt-2"
              placeholder="e.g. no counting breaths; mention the sea"
              maxLength={200}
              value={setup.notes}
              disabled={busy}
              onChange={e => set({ notes: e.target.value })}
            />

            {error && !busy && <p className="form-error" role="alert">{error}</p>}

            <button className="btn btn-primary w-full mt-4" disabled={busy || !prompt.trim()} onClick={create}>
              {busy ? 'Writing your meditation…' : 'Create meditation'}
            </button>
            {busy && (
              <p className="caption-text mt-2 text-center">
                This usually takes under a minute. It will be saved below even if you leave this screen.
              </p>
            )}
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
                  <PlayIcon />
                  <span className="saved-med-text">
                    <span className="exercise-card-title">{m.title}</span>
                    <span className="settings-row-sub">
                      {minutesOf(m, speechSpeed, pauseScale)} min ·{' '}
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
