import { useState, useRef } from 'react';
import { Exercise, Category, CheckinEntry } from '../types';
import { questions } from '../data/questions';
import { exercises } from '../data/exercises';
import ExerciseCard from './ExerciseCard';

interface Props {
  onOpenSOS: () => void;
  onOpenExercise: (exercise: Exercise) => void;
  onSaveCheckin: (entry: CheckinEntry) => void;
  onUpdateNote: (id: string, note: string) => void;
}

type Phase = 'intensity' | 'questions' | 'results';

const LEVEL_WORDS = ['Calm', 'Calm', 'Mild', 'Mild', 'Noticeable', 'Moderate', 'Moderate', 'Strong', 'Strong', 'Intense', 'Overwhelming'];

export default function CheckIn({ onOpenSOS, onOpenExercise, onSaveCheckin, onUpdateNote }: Props) {
  const [phase, setPhase] = useState<Phase>('intensity');
  const [level, setLevel] = useState(5);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [recommended, setRecommended] = useState<Exercise[]>([]);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const submitted = useRef(false);
  const advancing = useRef(false);
  const [highDistress, setHighDistress] = useState(false);

  function handleSelect(optionId: string) {
    if (submitted.current || advancing.current) return;
    const newAnswers = [...answers];
    newAnswers[currentQ] = optionId;
    setAnswers(newAnswers);

    if (currentQ < questions.length - 1) {
      advancing.current = true;
      const next = currentQ + 1;
      setTimeout(() => {
        setCurrentQ(next);
        advancing.current = false;
      }, 220);
    } else {
      submitted.current = true;
      computeResults(newAnswers);
    }
  }

  function computeResults(finalAnswers: string[]) {
    const scores: Partial<Record<Category, number>> = {};

    finalAnswers.forEach((answerId, qi) => {
      const opt = questions[qi].options.find(o => o.id === answerId);
      if (!opt) return;
      Object.entries(opt.scores).forEach(([cat, score]) => {
        const c = cat as Category;
        scores[c] = (scores[c] ?? 0) + (score ?? 0);
      });
    });

    const topCats = (Object.entries(scores) as [Category, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([c]) => c);

    setRecommended(topCats.flatMap(cat => exercises.filter(e => e.category === cat).slice(0, 2)));

    const id = String(Date.now());
    onSaveCheckin({
      id,
      at: new Date().toISOString(),
      level,
      feeling: questions[0].options.find(o => o.id === finalAnswers[0])?.text,
      focus: topCats,
    });
    setEntryId(id);
    setHighDistress(level >= 8 || finalAnswers[0] === 'q1-overwhelmed');
    setPhase('results');
  }

  function saveNote() {
    if (!entryId) return;
    onUpdateNote(entryId, note.trim());
    setNoteSaved(true);
  }

  function reset() {
    submitted.current = false;
    setHighDistress(false);
    setPhase('intensity');
    setLevel(5);
    setCurrentQ(0);
    setAnswers([]);
    setRecommended([]);
    setEntryId(null);
    setNote('');
    setNoteSaved(false);
  }

  if (phase === 'intensity') {
    return (
      <div className="checkin-wrap">
        <div className="progress-bar">
          {[0, ...questions].map((_, i) => (
            <div key={i} className={`progress-seg ${i === 0 ? 'done' : ''}`} />
          ))}
        </div>
        <div className="q-text">How strong is your anxiety right now?</div>
        <div className="q-sub">There's no right answer. Just notice.</div>

        <div className="intensity-display">
          <span className="intensity-num">{level}</span>
          <span className="intensity-word">{LEVEL_WORDS[level]}</span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={level}
          onChange={e => setLevel(Number(e.target.value))}
          className="intensity-slider"
          aria-label="Anxiety level from 0 to 10"
        />
        <div className="intensity-ends">
          <span>0 · Calm</span>
          <span>10 · Overwhelming</span>
        </div>

        <button className="btn btn-primary w-full mt-8" onClick={() => setPhase('questions')}>
          Continue
        </button>
      </div>
    );
  }

  if (phase === 'results') {
    return (
      <div className="results-wrap">
        <div className="results-hero">
          <span className="results-icon">🌿</span>
          <div className="results-title">Here's what might help</div>
          <div className="results-sub">
            Based on your check-in, these practices fit what you're experiencing right now.
          </div>
        </div>

        {highDistress && (
          <div className="card distress-card">
            <div className="distress-title">That sounds really hard right now</div>
            <p className="distress-text">If it feels like too much, start with SOS, or talk to someone.</p>
            <button className="btn btn-primary w-full" style={{ backgroundColor: 'var(--cat-acceptance)' }} onClick={onOpenSOS}>
              Open SOS
            </button>
            <a className="btn btn-outline w-full mt-4" href="tel:988">Call or text 988</a>
          </div>
        )}

        <div className="results-section-title">Recommended for you</div>
        <div className="results-exercises">
          {recommended.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} onClick={onOpenExercise} />
          ))}
        </div>

        <div className="results-section-title">Add a note (optional)</div>
        <div className="card settings-card mb-6">
          <div className="settings-row-sub mb-4">Saved: anxiety {level}/10. What's on your mind, or what happened just before?</div>
          <textarea
            className="form-textarea w-full"
            placeholder="e.g. Big meeting this afternoon, didn't sleep well..."
            value={note}
            onChange={e => { setNote(e.target.value); setNoteSaved(false); }}
          />
          <button
            className="btn btn-secondary w-full mt-4"
            disabled={!note.trim() || noteSaved}
            onClick={saveNote}
          >
            {noteSaved ? 'Note saved ✓' : 'Save note'}
          </button>
        </div>

        <div className="results-retake">
          <button className="btn btn-ghost" onClick={reset}>Take the check-in again</button>
        </div>
      </div>
    );
  }

  const q = questions[currentQ];
  const selectedId = answers[currentQ];

  return (
    <div className="checkin-wrap">
      <div className="progress-bar">
        {[0, ...questions].map((_, i) => (
          <div key={i} className={`progress-seg ${i <= currentQ + 1 ? 'done' : ''}`} />
        ))}
      </div>

      <div className="q-text">{q.text}</div>
      <div className="q-sub">{q.subtitle}</div>

      <div className="options-stack">
        {q.options.map(opt => (
          <button
            key={opt.id}
            className={`option-btn ${selectedId === opt.id ? 'selected' : ''}`}
            onClick={() => handleSelect(opt.id)}
          >
            <span className="option-emoji">{opt.emoji}</span>
            <span className="option-text">{opt.text}</span>
          </button>
        ))}
      </div>

      <button
        className="btn btn-ghost mt-4"
        onClick={() => (currentQ === 0 ? setPhase('intensity') : setCurrentQ(currentQ - 1))}
      >
        ← Back
      </button>
    </div>
  );
}
