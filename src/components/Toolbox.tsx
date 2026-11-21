import { useState } from 'react';
import { Exercise, Category } from '../types';
import { exercises, categoryMeta } from '../data/exercises';
import ExerciseCard from './ExerciseCard';

interface Props {
  onOpenExercise: (exercise: Exercise) => void;
  completedToday: string[];
}

type Filter = 'all' | Category;

export default function Toolbox({ onOpenExercise, completedToday }: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = filter === 'all'
    ? exercises
    : exercises.filter(e => e.category === filter);

  const categories = Object.entries(categoryMeta) as [Category, typeof categoryMeta[Category]][];

  return (
    <div>
      <div className="toolbox-header">
        <div className="toolbox-title">Toolbox</div>
        <div className="toolbox-sub">{exercises.length} ACT-based practices</div>
      </div>

      <div className="filter-scroll">
        <button
          className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        {categories.map(([key, meta]) => (
          <button
            key={key}
            className={`filter-chip ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key)}
            style={filter === key ? {} : { borderColor: `${meta.color}50` }}
          >
            {meta.emoji} {meta.label}
          </button>
        ))}
      </div>

      <div className="toolbox-list">
        {filtered.map(ex => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            onClick={onOpenExercise}
            completed={completedToday.includes(ex.id)}
          />
        ))}
      </div>
      <div style={{ height: 16 }} />
    </div>
  );
}
