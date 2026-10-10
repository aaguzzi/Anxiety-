import { AppState, Exercise } from '../types';
import { exercises } from '../data/exercises';
import ExerciseCard from './ExerciseCard';

const ACT_QUOTES = [
  { text: 'You don\'t have to believe every thought your mind produces.', source: 'ACT Principle — Defusion' },
  { text: 'Anxiety is not the enemy. Avoidance is.', source: 'ACT Principle — Acceptance' },
  { text: 'You are the sky. Everything else is just weather passing through.', source: 'ACT Principle — Self-as-Context' },
  { text: 'Act from your values, not from your fears.', source: 'ACT Principle — Committed Action' },
  { text: 'The present moment is the only place where life actually happens.', source: 'ACT Principle — Present Moment' },
  { text: 'What you resist, persists. What you allow, can pass.', source: 'ACT Principle — Acceptance' },
  { text: 'Willingness is not wanting discomfort. It\'s choosing to have it in service of what matters.', source: 'ACT Principle — Values' },
  { text: 'Your mind is doing its job. You don\'t have to do everything it says.', source: 'ACT Principle — Defusion' },
];

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

const TIME_CONFIG: Record<TimeOfDay, {
  label: string;
  greeting: string;
  tagline: string;
  featuredId: string;
  quickIds: string[];
}> = {
  morning: {
    label: 'Good morning',
    greeting: 'Start with presence.',
    tagline: 'A few minutes to ground yourself before the day begins.',
    featuredId: 'box-breathing',
    quickIds: ['present-moment', '5-4-3-2-1', 'values-compass'],
  },
  afternoon: {
    label: 'Good afternoon',
    greeting: 'How are you doing?',
    tagline: 'A quick reset to reconnect with yourself midday.',
    featuredId: '5-4-3-2-1',
    quickIds: ['physiological-sigh', 'thought-labeling', 'present-moment'],
  },
  evening: {
    label: 'Good evening',
    greeting: 'Time to decompress.',
    tagline: 'Let the day settle. You don\'t have to carry it all.',
    featuredId: 'soften-allow',
    quickIds: ['leaves-on-stream', 'body-scan', 'one-small-step'],
  },
  night: {
    label: 'Good night',
    greeting: 'Ease into rest.',
    tagline: 'Quiet the mind and prepare for sleep.',
    featuredId: '4-7-8',
    quickIds: ['observer-self', 'body-scan', 'soften-allow'],
  },
};

interface Props {
  appState: AppState;
  onOpenExercise: (exercise: Exercise) => void;
}

export default function Home({ appState, onOpenExercise }: Props) {
  const tod = getTimeOfDay();
  const config = TIME_CONFIG[tod];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const quote = ACT_QUOTES[dayOfYear % ACT_QUOTES.length];

  const featuredExercise = exercises.find(e => e.id === config.featuredId)!;
  const quickExercises = config.quickIds.map(id => exercises.find(e => e.id === id)!).filter(Boolean);

  return (
    <div>
      <div className="home-hero">
        <div className="home-time-label">{config.label}</div>
        <div className="home-greeting">{config.greeting}</div>
        <div className="home-tagline">{config.tagline}</div>
        {appState.streak > 0 && (
          <div className="streak-row">
            <div className="streak-chip">
              🔥 {appState.streak} day{appState.streak !== 1 ? 's' : ''} in a row
            </div>
          </div>
        )}
      </div>

      <div className="quote-block">
        <div className="quote-text">"{quote.text}"</div>
        <div className="quote-source">{quote.source}</div>
      </div>

      <div
        className="featured-card"
        onClick={() => onOpenExercise(featuredExercise)}
      >
        <div className="featured-badge">Featured Practice</div>
        <div className="featured-title">{featuredExercise.title}</div>
        <div className="featured-sub">{featuredExercise.subtitle}</div>
        <button className="featured-action">
          Start · {featuredExercise.duration}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="home-section">
        <div className="home-section-title">Quick practices</div>
        <div className="quick-exercises">
          {quickExercises.map(ex => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              onClick={onOpenExercise}
              completed={appState.completedToday.includes(ex.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
