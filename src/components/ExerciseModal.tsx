import { Exercise } from '../types';
import { categoryMeta } from '../data/exercises';
import BoxBreathing from './exercises/BreathingExercise';
import { PhysiologicalSigh, Breathing478 } from './exercises/BreathingExercise';
import { Grounding54321, BodyScan } from './exercises/GroundingExercise';
import LeavesOnStream from './exercises/LeavesOnStream';
import { ThoughtLabeling, NameTheStory } from './exercises/ThoughtLabeling';
import { MakeRoom, SoftenAllow } from './exercises/AcceptanceExercise';
import ValuesCompass from './exercises/ValuesCompass';
import { ObserverSelf, PresentMoment } from './exercises/MindfulnessExercise';
import OneSmallStep from './exercises/CommittedAction';

type ExerciseComponent = React.FC<{ onComplete: () => void }>;

const EXERCISE_MAP: Record<string, ExerciseComponent> = {
  BoxBreathing,
  PhysiologicalSigh,
  Breathing478,
  Grounding54321,
  BodyScan,
  LeavesOnStream,
  ThoughtLabeling,
  NameTheStory,
  MakeRoom,
  SoftenAllow,
  ValuesCompass,
  ObserverSelf,
  PresentMoment,
  OneSmallStep,
};

interface Props {
  exercise: Exercise;
  onClose: () => void;
  onComplete: () => void;
}

export default function ExerciseModal({ exercise, onClose, onComplete }: Props) {
  const meta = categoryMeta[exercise.category];
  const Component = EXERCISE_MAP[exercise.component];

  return (
    <div className="exercise-overlay">
      <div className="exercise-overlay-inner">
        <div className="exercise-top-bar">
          <button className="back-btn" onClick={onClose} aria-label="Go back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span
            className="exercise-cat-label"
            style={{ color: meta.color }}
          >
            {meta.emoji} {meta.label}
          </span>
        </div>

        <div className="exercise-scroll">
          <div className="exercise-title">{exercise.title}</div>
          <div className="exercise-subtitle">{exercise.subtitle}</div>
          <div className="exercise-rationale">
            <strong>ACT principle:</strong> {exercise.actPrinciple} — {exercise.description}
          </div>

          {Component ? (
            <Component onComplete={onComplete} />
          ) : (
            <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Exercise coming soon.</div>
          )}
        </div>
      </div>
    </div>
  );
}
