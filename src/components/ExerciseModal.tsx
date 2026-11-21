import { useCallback, useRef } from 'react';
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
import { ReachedEndContext } from './exercises/CompletionScreen';

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
  /** The round button at the top, the phone's back gesture and 'Finish' all just leave. */
  onClose: () => void;
  /** The exercise reached its closing screen: counted once per opening, before anything is tapped. */
  onReachedEnd: () => void;
}

export default function ExerciseModal({ exercise, onClose, onReachedEnd }: Props) {
  const meta = categoryMeta[exercise.category];
  const Component = EXERCISE_MAP[exercise.component];
  const counted = useRef(false);
  const reachedEnd = useCallback(() => {
    if (counted.current) return;
    counted.current = true;
    onReachedEnd();
  }, [onReachedEnd]);
  // 'Finish' only appears at the end, so it counts too (once) in case an end screen did not.
  const finish = useCallback(() => { reachedEnd(); onClose(); }, [reachedEnd, onClose]);

  const rationale = (
    <div className="exercise-rationale">
      <strong>ACT principle:</strong> {exercise.actPrinciple} — {exercise.description}
    </div>
  );
  // A breathing exercise is something to start, so its circle and 'Begin' come first and the
  // explanation follows them.
  const rationaleFirst = exercise.category !== 'breathing';

  return (
    <div className="exercise-overlay exercise-modal">
      <div className="exercise-overlay-inner">
        <div className="exercise-top-bar">
          <button className="back-btn" onClick={onClose} aria-label="Close exercise">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span
            className="exercise-cat-label"
            style={{ color: meta.ink }}
          >
            {meta.emoji} {meta.label}
          </span>
        </div>

        <div className="exercise-scroll">
          <div className="exercise-title">{exercise.title}</div>
          <div className="exercise-subtitle">{exercise.subtitle}</div>
          {rationaleFirst && rationale}

          <ReachedEndContext.Provider value={reachedEnd}>
            {Component ? (
              <Component onComplete={finish} />
            ) : (
              <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Exercise coming soon.</div>
            )}
          </ReachedEndContext.Provider>

          {!rationaleFirst && rationale}
        </div>
      </div>
    </div>
  );
}
