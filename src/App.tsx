import { useState, useCallback, useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Tab, Exercise, CheckinEntry, PracticeHistory, Settings } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { localDateKey } from './lib/dates';
import { cancelReminder } from './lib/reminders';
import Navigation from './components/Navigation';
import Home from './components/Home';
import CheckIn from './components/CheckIn';
import Toolbox from './components/Toolbox';
import ExerciseModal from './components/ExerciseModal';
import SOSFlow from './components/SOSFlow';
import SettingsView from './components/SettingsView';
import HistoryView from './components/HistoryView';
import WelcomeSheet from './components/WelcomeSheet';

const STORAGE_KEYS = ['anxiety-companion', 'ac-checkins', 'ac-history', 'ac-settings'];

const defaultSettings: Settings = {
  reminderEnabled: false,
  reminderTime: '08:00',
  contactName: '',
  contactPhone: '',
  onboarded: false,
};

type Overlay = 'none' | 'sos' | 'settings' | 'history';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [overlay, setOverlay] = useState<Overlay>('none');
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
  const completedToday = history[today] ?? [];
  const monthPrefix = today.slice(0, 7);
  const practicesThisMonth = Object.entries(history)
    .filter(([day]) => day.startsWith(monthPrefix))
    .reduce((n, [, ids]) => n + ids.filter(id => id !== 'sos').length, 0);

  const recordPractice = useCallback((exerciseId: string) => {
    // Read the date at completion time, not render time, so a session that crosses midnight lands on the right day.
    const day = localDateKey();
    setHistory(prev => ({ ...prev, [day]: [...(prev[day] ?? []), exerciseId] }));
  }, [setHistory]);

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

  const deleteAllData = useCallback(async () => {
    await cancelReminder();
    STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
    window.location.reload();
  }, []);

  return (
    <div className="app">
      <div className="screen">
        {tab === 'home' && (
          <Home
            completedToday={completedToday}
            practicesThisMonth={practicesThisMonth}
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
          <CheckIn
            onOpenSOS={() => setOverlay('sos')}
            onOpenExercise={setActiveExercise}
            onSaveCheckin={saveCheckin}
            onUpdateNote={updateNote}
          />
        )}
        {tab === 'toolbox' && (
          <Toolbox onOpenExercise={setActiveExercise} completedToday={completedToday} />
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

      {overlay === 'none' && settings.onboarded && (
        <button
          className={`sos-fab ${activeExercise ? 'in-exercise' : ''}`}
          onClick={() => setOverlay('sos')}
          aria-label="SOS: I need help calming down now"
        >
          SOS
        </button>
      )}

      {overlay === 'sos' && (
        <SOSFlow
          settings={settings}
          onClose={() => setOverlay('none')}
          onFinish={() => { recordPractice('sos'); setOverlay('none'); }}
        />
      )}
      {overlay === 'settings' && (
        <SettingsView
          settings={settings}
          onChange={setSettings}
          onDeleteAll={deleteAllData}
          onClose={() => setOverlay('none')}
        />
      )}
      {overlay === 'history' && (
        <HistoryView checkins={checkins} onClose={() => setOverlay('none')} />
      )}

      {!settings.onboarded && (
        <WelcomeSheet onAccept={() => setSettings(prev => ({ ...prev, onboarded: true }))} />
      )}
    </div>
  );
}
