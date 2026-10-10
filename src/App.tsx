import { useState, useCallback } from 'react';
import { Tab, Exercise, AppState } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import Navigation from './components/Navigation';
import Home from './components/Home';
import CheckIn from './components/CheckIn';
import Toolbox from './components/Toolbox';
import ExerciseModal from './components/ExerciseModal';

const defaultState: AppState = {
  completedToday: [],
  streak: 0,
  lastActiveDate: '',
};

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [appState, setAppState] = useLocalStorage<AppState>('anxiety-companion', defaultState);

  const today = new Date().toISOString().slice(0, 10);

  const handleExerciseComplete = useCallback((exerciseId: string) => {
    setAppState(prev => {
      const isNewDay = prev.lastActiveDate !== today;
      const daysDiff = prev.lastActiveDate
        ? Math.floor((new Date(today).getTime() - new Date(prev.lastActiveDate).getTime()) / 86400000)
        : 1;
      const newStreak = isNewDay
        ? daysDiff === 1 ? prev.streak + 1 : 1
        : prev.streak;
      const completedToday = isNewDay ? [exerciseId] : [...new Set([...prev.completedToday, exerciseId])];
      return { completedToday, streak: newStreak, lastActiveDate: today };
    });
    setActiveExercise(null);
  }, [today, setAppState]);

  const openExercise = useCallback((exercise: Exercise) => {
    setActiveExercise(exercise);
  }, []);

  return (
    <div className="app">
      <div className="screen">
        {tab === 'home' && (
          <Home appState={appState} onOpenExercise={openExercise} />
        )}
        {tab === 'checkin' && (
          <CheckIn onOpenExercise={openExercise} />
        )}
        {tab === 'toolbox' && (
          <Toolbox onOpenExercise={openExercise} completedToday={appState.completedToday} />
        )}
      </div>

      <Navigation activeTab={tab} onTabChange={setTab} />

      {activeExercise && (
        <ExerciseModal
          exercise={activeExercise}
          onClose={() => setActiveExercise(null)}
          onComplete={() => handleExerciseComplete(activeExercise.id)}
        />
      )}
    </div>
  );
}
