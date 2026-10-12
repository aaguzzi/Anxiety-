import { useState, useCallback, useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Tab, Exercise, AppState, CheckinEntry, PracticeHistory, Settings } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { localDateKey } from './lib/dates';
import Navigation from './components/Navigation';
import Home from './components/Home';
import CheckIn from './components/CheckIn';
import Toolbox from './components/Toolbox';
import ExerciseModal from './components/ExerciseModal';
import SOSFlow from './components/SOSFlow';
import SettingsView from './components/SettingsView';
import HistoryView from './components/HistoryView';

const defaultState: AppState = {
  completedToday: [],
  streak: 0,
  lastActiveDate: '',
};

const defaultSettings: Settings = {
  reminderEnabled: false,
  reminderTime: '08:00',
  contactName: '',
  contactPhone: '',
};

type Overlay = 'none' | 'sos' | 'settings' | 'history';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [appState, setAppState] = useLocalStorage<AppState>('anxiety-companion', defaultState);
  const [checkins, setCheckins] = useLocalStorage<CheckinEntry[]>('ac-checkins', []);
  const [history, setHistory] = useLocalStorage<PracticeHistory>('ac-history', {});
  const [settings, setSettings] = useLocalStorage<Settings>('ac-settings', defaultSettings);

  const navRef = useRef({ tab, activeExercise, overlay });
  navRef.current = { tab, activeExercise, overlay };

  useEffect(() => {
    const listener = CapApp.addListener('backButton', () => {
      const { tab: t, activeExercise: ex, overlay: o } = navRef.current;
      if (o !== 'none') setOverlay('none');
      else if (ex) setActiveExercise(null);
      else if (t !== 'home') setTab('home');
      else CapApp.exitApp();
    });
    return () => { listener.then(l => l.remove()); };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = LocalNotifications.addListener('localNotificationActionPerformed', () => {
      setOverlay('none');
      setActiveExercise(null);
      setTab('home');
    });
    return () => { listener.then(l => l.remove()); };
  }, []);

  const today = localDateKey();
  const completedToday = appState.lastActiveDate === today ? appState.completedToday : [];

  const recordPractice = useCallback((exerciseId: string) => {
    setAppState(prev => {
      const isNewDay = prev.lastActiveDate !== today;
      const daysDiff = prev.lastActiveDate
        ? Math.round((new Date(today).getTime() - new Date(prev.lastActiveDate).getTime()) / 86400000)
        : 1;
      const newStreak = isNewDay
        ? daysDiff === 1 ? prev.streak + 1 : 1
        : prev.streak;
      const done = isNewDay ? [exerciseId] : [...new Set([...prev.completedToday, exerciseId])];
      return { completedToday: done, streak: newStreak, lastActiveDate: today };
    });
    setHistory(prev => ({ ...prev, [today]: [...(prev[today] ?? []), exerciseId] }));
  }, [today, setAppState, setHistory]);

  const handleExerciseComplete = useCallback((exerciseId: string) => {
    recordPractice(exerciseId);
    setActiveExercise(null);
  }, [recordPractice]);

  const saveCheckin = useCallback((entry: CheckinEntry) => {
    setCheckins(prev => [...prev, entry]);
  }, [setCheckins]);

  const updateNote = useCallback((id: string, note: string) => {
    setCheckins(prev => prev.map(c => (c.id === id ? { ...c, note } : c)));
  }, [setCheckins]);

  return (
    <div className="app">
      <div className="screen">
        {tab === 'home' && (
          <Home
            appState={{ ...appState, completedToday }}
            checkins={checkins}
            history={history}
            settings={settings}
            onOpenExercise={setActiveExercise}
            onOpenSettings={() => setOverlay('settings')}
            onOpenHistory={() => setOverlay('history')}
            onStartCheckin={() => setTab('checkin')}
          />
        )}
        {tab === 'checkin' && (
          <CheckIn onOpenExercise={setActiveExercise} onSaveCheckin={saveCheckin} onUpdateNote={updateNote} />
        )}
        {tab === 'toolbox' && (
          <Toolbox onOpenExercise={setActiveExercise} completedToday={completedToday} />
        )}
      </div>

      <Navigation activeTab={tab} onTabChange={setTab} />

      {!activeExercise && overlay === 'none' && (
        <button className="sos-fab" onClick={() => setOverlay('sos')} aria-label="SOS: I need help calming down now">
          SOS
        </button>
      )}

      {activeExercise && (
        <ExerciseModal
          exercise={activeExercise}
          onClose={() => setActiveExercise(null)}
          onComplete={() => handleExerciseComplete(activeExercise.id)}
        />
      )}

      {overlay === 'sos' && (
        <SOSFlow
          settings={settings}
          onClose={() => setOverlay('none')}
          onFinish={() => { recordPractice('sos'); setOverlay('none'); }}
        />
      )}
      {overlay === 'settings' && (
        <SettingsView settings={settings} onChange={setSettings} onClose={() => setOverlay('none')} />
      )}
      {overlay === 'history' && (
        <HistoryView checkins={checkins} onClose={() => setOverlay('none')} />
      )}
    </div>
  );
}
