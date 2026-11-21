import { Fragment, useLayoutEffect, useRef, useState } from 'react';
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

/** How many of the person's own meditations show before 'Show all'. */
const YOURS_SHOWN = 3;

interface SavedRowProps {
  meditation: Meditation;
  minutes: number;
  confirming: boolean;
  onPlay: () => void;
  onAskDelete: () => void;
  onDelete: () => void;
  onKeep: () => void;
}

/** One of the person's own meditations: its title, what they asked for (up to three lines, with
 *  'Show more' when there is more) and its length and date. */
function SavedRow({ meditation: m, minutes, confirming, onPlay, onAskDelete, onDelete, onKeep }: SavedRowProps) {
  const promptRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);

  // Whether the three lines hide part of the request; checked again whenever the width or text size changes.
  useLayoutEffect(() => {
    const el = promptRef.current;
    if (!el) return;
    const check = () => setCut(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const date = new Date(m.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div className="card saved-med">
      <button className="saved-med-main" onClick={onPlay}>
        <PlayIcon />
        <span className="saved-med-text">
          <span className="exercise-card-title user-text">{m.title}</span>
          <span ref={promptRef} id={`prompt-${m.id}`} className={`settings-row-sub saved-med-prompt user-text${open ? ' open' : ''}`}>
            {m.prompt}
          </span>
          <span className="settings-row-sub">{minutes} min · {date}</span>
        </span>
      </button>
      {!confirming && (
        <button className="saved-med-remove" onClick={onAskDelete} aria-label={`Delete ${m.title}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {(cut || open) && (
        <button className="saved-med-more" aria-expanded={open} aria-controls={`prompt-${m.id}`} onClick={() => setOpen(o => !o)}>
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
      {confirming && (
        <div className="saved-med-confirm">
          <button className="btn btn-ghost danger-text" onClick={onDelete}>Delete</button>
          <button className="btn btn-ghost" onClick={onKeep}>Keep</button>
        </div>
      )}
    </div>
  );
}

export default function Meditate({
  hasKey, speechSpeed, pauseScale, voiceSummary, meditations, setup, busy, error,
  onSetup, onCreate, onPlay, onDelete, onOpenVoice, onOpenKey,
}: Props) {
  const [prompt, setPrompt] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const set = (patch: Partial<MeditationSetup>) => onSetup({ ...setup, ...patch });

  async function create() {
    if (!prompt.trim() || busy) return;
    if (await onCreate(prompt, setup)) setPrompt('');
  }

  const saved = [...meditations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const shown = showAll ? saved : saved.slice(0, YOURS_SHOWN);

  // The person's own meditations, newest first: straight after 'For right now', so the ones they come
  // back to replay are near the top, and the meditations for a hard moment stay first.
  const yours = saved.length > 0 && (
    <div className="home-section">
      <div className="home-section-title">Your meditations</div>
      <div className="quick-exercises">
        {shown.map(m => (
          <SavedRow
            key={m.id}
            meditation={m}
            minutes={minutesOf(m, speechSpeed, pauseScale)}
            confirming={confirmId === m.id}
            onPlay={() => onPlay(m)}
            onAskDelete={() => setConfirmId(m.id)}
            onDelete={() => { onDelete(m.id); setConfirmId(null); }}
            onKeep={() => setConfirmId(null)}
          />
        ))}
      </div>
      {saved.length > YOURS_SHOWN && (
        <button className="btn btn-ghost w-full mt-2" aria-expanded={showAll} onClick={() => setShowAll(v => !v)}>
          {showAll ? 'Show fewer' : `Show all ${saved.length}`}
        </button>
      )}
    </div>
  );

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

      {STARTER_GROUPS.map((group, i) => (
        <Fragment key={group}>
          <div className="home-section">
            <div className="home-section-title">{group}</div>
            <div className="quick-exercises">
              {starterMeditations.filter(m => m.group === group).map(m => (
                <div key={m.id} className="card saved-med">
                  <button className="saved-med-main" onClick={() => onPlay(m)}>
                    <PlayIcon />
                    <span className="saved-med-text">
                      <span className="exercise-card-title">{m.title}</span>
                      {/* When to use it: in full, on as many lines as it takes. */}
                      <span className="settings-row-sub">{minutesOf(m, speechSpeed, pauseScale)} min · {m.prompt}</span>
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
          {i === 0 && yours}
        </Fragment>
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

            <button
              className="btn btn-primary w-full mt-4"
              disabled={busy || !prompt.trim()}
              aria-describedby={!busy && !prompt.trim() ? 'med-need' : undefined}
              onClick={create}
            >
              {busy ? 'Writing your meditation…' : 'Create meditation'}
            </button>
            {!busy && !prompt.trim() && (
              <p id="med-need" className="btn-need">Write what you'd like help with (at the top) to create one.</p>
            )}
            {busy && (
              <p className="caption-text mt-2 text-center">
                This usually takes under a minute. It will be saved under Your meditations, even if you leave this screen.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
