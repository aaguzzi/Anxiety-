import { Category, Exercise } from '../types';
import { categoryMeta } from '../data/exercises';

interface Props {
  exercise: Exercise;
  onClick: (exercise: Exercise) => void;
  completed?: boolean;
}

/** A category's pill: a pale tint of its colour with the words in its dark shade. */
export function CategoryBadge({ category }: { category: Category }) {
  const meta = categoryMeta[category];
  return (
    <span className="badge badge-cat" style={{ backgroundColor: `${meta.color}29`, color: meta.ink }}>
      {meta.emoji} {meta.label}
    </span>
  );
}

export default function ExerciseCard({ exercise, onClick, completed = false }: Props) {
  const meta = categoryMeta[exercise.category];

  return (
    <button
      type="button"
      className="exercise-card"
      style={{ borderColor: completed ? `${meta.color}40` : 'transparent' }}
      onClick={() => onClick(exercise)}
    >
      <span className="exercise-card-top">
        <span className="exercise-card-titles">
          <span className="exercise-card-title">
            {completed && <span style={{ marginRight: 6 }}>✓</span>}
            {exercise.title}
          </span>
          <span className="exercise-card-subtitle">{exercise.subtitle}</span>
        </span>
      </span>
      <span className="exercise-card-desc">{exercise.description}</span>
      <span className="exercise-card-footer">
        <CategoryBadge category={exercise.category} />
        <span className="badge badge-duration">{exercise.duration}</span>
      </span>
    </button>
  );
}
