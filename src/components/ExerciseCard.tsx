import { Exercise } from '../types';
import { categoryMeta } from '../data/exercises';

interface Props {
  exercise: Exercise;
  onClick: (exercise: Exercise) => void;
  completed?: boolean;
}

export default function ExerciseCard({ exercise, onClick, completed = false }: Props) {
  const meta = categoryMeta[exercise.category];

  return (
    <div
      className="exercise-card"
      style={{ borderColor: completed ? `${meta.color}40` : 'transparent' }}
      onClick={() => onClick(exercise)}
    >
      <div className="exercise-card-top">
        <div className="exercise-card-titles">
          <div className="exercise-card-title">
            {completed && <span style={{ marginRight: 6 }}>✓</span>}
            {exercise.title}
          </div>
          <div className="exercise-card-subtitle">{exercise.subtitle}</div>
        </div>
      </div>
      <div className="exercise-card-desc">{exercise.description}</div>
      <div className="exercise-card-footer">
        <span
          className="badge badge-cat"
          style={{ backgroundColor: meta.color }}
        >
          {meta.emoji} {meta.label}
        </span>
        <span className="badge badge-duration">{exercise.duration}</span>
      </div>
    </div>
  );
}
