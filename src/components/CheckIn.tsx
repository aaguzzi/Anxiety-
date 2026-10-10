import { useState } from 'react';
import { Exercise, Category } from '../types';
import { questions } from '../data/questions';
import { exercises } from '../data/exercises';
import ExerciseCard from './ExerciseCard';

interface Props {
  onOpenExercise: (exercise: Exercise) => void;
}

type Phase = 'questions' | 'results';

export default function CheckIn({ onOpenExercise }: Props) {
  const [phase, setPhase] = useState<Phase>('questions');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [recommended, setRecommended] = useState<Exercise[]>([]);

  function handleSelect(optionId: string) {
    const newAnswers = [...answers];
    newAnswers[currentQ] = optionId;
    setAnswers(newAnswers);

    if (currentQ < questions.length - 1) {
      setTimeout(() => setCurrentQ(q => q + 1), 220);
    } else {
      computeResults([...newAnswers]);
    }
  }

  function computeResults(finalAnswers: string[]) {
    const scores: Partial<Record<Category, number>> = {};

    finalAnswers.forEach((answerId, qi) => {
      const q = questions[qi];
      const opt = q.options.find(o => o.id === answerId);
      if (!opt) return;
      Object.entries(opt.scores).forEach(([cat, score]) => {
        const c = cat as Category;
        scores[c] = (scores[c] ?? 0) + (score ?? 0);
      });
    });

    const sorted = (Object.entries(scores) as [Category, number][])
      .sort((a, b) => b[1] - a[1]);

    const topCats = sorted.slice(0, 2).map(([c]) => c);

    const recs: Exercise[] = [];
    topCats.forEach(cat => {
      const catExercises = exercises.filter(e => e.category === cat).slice(0, 2);
      recs.push(...catExercises);
    });

    setRecommended(recs);
    setPhase('results');
  }

  function reset() {
    setPhase('questions');
    setCurrentQ(0);
    setAnswers([]);
    setRecommended([]);
  }

  if (phase === 'results') {
    return (
      <div className="results-wrap">
        <div className="results-hero">
          <span className="results-icon">🌿</span>
          <div className="results-title">Here's what might help</div>
          <div className="results-sub">
            Based on your check-in, these practices are tailored to what you're experiencing right now.
          </div>
        </div>

        <div className="results-section-title">Recommended for you</div>
        <div className="results-exercises">
          {recommended.map(ex => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              onClick={onOpenExercise}
            />
          ))}
        </div>

        <div className="results-retake">
          <button className="btn btn-ghost" onClick={reset}>
            Take the check-in again
          </button>
        </div>
      </div>
    );
  }

  const q = questions[currentQ];
  const selectedId = answers[currentQ];

  return (
    <div className="checkin-wrap">
      <div className="progress-bar">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`progress-seg ${i <= currentQ ? 'done' : ''}`}
          />
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
    </div>
  );
}
