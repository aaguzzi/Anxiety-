import { useState, useCallback, useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Tab, Exercise, CheckinEntry, PracticeHistory, Settings, Meditation, MeditationSetup } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { localDateKey } from './lib/dates';
import { cancelReminder } from './lib/reminders';
import { clearVoiceCache, dropOutdatedVoiceCache, InstalledModels, installedModels, voiceOption } from './lib/voice';
import { activeSounds, applySounds } from './lib/sounds';
import { clearPosition } from './lib/positions';
import { AppUpdate, checkForUpdate } from './lib/update';
import { DEFAULT_SETUP, generateMeditation, ScriptError } from './lib/meditationScript';
import Navigation from './components/Navigation';
import Home from './components/Home';
import CheckIn from './components/CheckIn';
import Toolbox from './components/Toolbox';
import ExerciseModal from './components/ExerciseModal';
import SOSFlow from './components/SOSFlow';
import SettingsView from './components/SettingsView';
import HistoryView from './components/HistoryView';
import WelcomeSheet from './components/WelcomeSheet';
import Meditate from './components/Meditate';
import MeditationPlayer from './components/MeditationPlayer';
import VoicePanel from './components/VoicePanel';

const STORAGE_KEYS = [
  'anxiety-companion', 'ac-checkins', 'ac-history', 'ac-settings', 'ac-meditations', 'ac-med-positions', 'ac-voice-engine',
];

const defaultSettings: Settings = {
  reminderEnabled: false,
  reminderTime: '08:00',
  contactName: '',
  contactPhone: '',
  onboarded: false,
  anthropicKey: '',
  voiceChoice: 'auto',
  voiceBench: null,
  speechSpeed: 0.75,
  pauseScale: 1,
  voiceQuality: 'best',
  voiceSoftness: 0.3,
  voiceSpace: 0.15,
  sounds: {},
  meditationSetup: DEFAULT_SETUP,
};

type Overlay = 'none' | 'sos' | 'settings' | 'history' | 'voice';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [checkins, setCheckins] = useLocalStorage<CheckinEntry[]>('ac-checkins', []);
  const [history, setHistory] = useLocalStorage<PracticeHistory>('ac-history', {});
  const [settings, setSettings] = useLocalStorage<Settings>('ac-settings', defaultSettings);
  const [meditations, setMeditations] = useLocalStorage<Meditation[]>('ac-meditations', []);
  const [activeMeditation, setActiveMeditation] = useState<Meditation | null>(null);
  const [writing, setWriting] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const [focusKey, setFocusKey] = useState(false);
  // Voice & sounds can be opened from Settings; closing it goes back there.
  const [voiceFromSettings, setVoiceFromSettings] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const [update, setUpdate] = useState<AppUpdate | null>(null);

  const [installed, setInstalled] = useState<InstalledModels | null>(null);

  useEffect(() => {
    checkForUpdate().then(setUpdate);
    dropOutdatedVoiceCache();
    installedModels().then(setInstalled);
  }, []);

  // The phone mixes the background sounds itself; keep it told which ones are on.
  useEffect(() => {
    applySounds(settings.sounds);
  }, [settings.sounds]);

  const closeVoice = useCallback(() => {
    setOverlay(voiceFromSettings ? 'settings' : 'none');
    setVoiceFromSettings(false);
  }, [voiceFromSettings]);
  const closeVoiceRef = useRef(closeVoice);
  closeVoiceRef.current = closeVoice;

  const navRef = useRef({ tab, activeExercise, overlay, activeMeditation });
  navRef.current = { tab, activeExercise, overlay, activeMeditation };

  useEffect(() => {
    const listener = CapApp.addListener('backButton', () => {
      const { tab: t, activeExercise: ex, overlay: o, activeMeditation: med } = navRef.current;
      if (o === 'voice') closeVoiceRef.current();
      else if (o !== 'none') setOverlay('none');
      else if (med) setActiveMeditation(null);
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
      setActiveMeditation(null);
      setTab('home');
    });
    return () => { listener.then(l => l.remove()); };
  }, []);

  useEffect(() => {
    screenRef.current?.scrollTo(0, 0);
  }, [tab]);

  // Lives here, not in the Meditate tab, so leaving the tab can't lose (or double-charge for) a script in flight.
  const createMeditation = useCallback(async (prompt: string, setup: MeditationSetup): Promise<boolean> => {
    if (writing.busy) return false;
    setWriting({ busy: true, error: null });
    try {
      const meditation = await generateMeditation(settings.anthropicKey.trim(), prompt, setup);
      setMeditations(prev => [...prev, meditation]);
      setWriting({ busy: false, error: null });
      const nav = navRef.current;
      if (nav.tab === 'meditate' && nav.overlay === 'none' && !nav.activeExercise && !nav.activeMeditation) {
        setActiveMeditation(meditation);
      }
      return true;
    } catch (e) {
      setWriting({ busy: false, error: e instanceof ScriptError ? e.message : 'Something went wrong. Try again.' });
      return false;
    }
  }, [writing.busy, settings.anthropicKey, setMeditations]);

  const sounds = activeSounds(settings.sounds);
  const chosenVoice = voiceOption(settings.voiceChoice);
  // A voice this build doesn't include behaves as Automatic.
  const voiceLabel = chosenVoice.model && installed && !installed[chosenVoice.model] ? 'Automatic' : chosenVoice.label;
  const voiceSummary = `${voiceLabel} · ${sounds.length ? sounds.join(', ') : 'no background sounds'}`;

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
    clearVoiceCache();
    STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
    window.location.reload();
  }, []);

  return (
    <div className="app">
      <div className="screen" ref={screenRef}>
        {tab === 'home' && (
          <Home
            completedToday={completedToday}
            practicesThisMonth={practicesThisMonth}
            checkins={checkins}
            history={history}
            settings={settings}
            update={update}
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
        {tab === 'meditate' && (
          <Meditate
            hasKey={settings.anthropicKey.trim().length > 0}
            speechSpeed={settings.speechSpeed}
            pauseScale={settings.pauseScale}
            voiceSummary={voiceSummary}
            meditations={meditations}
            setup={{ ...DEFAULT_SETUP, ...settings.meditationSetup }}
            busy={writing.busy}
            error={writing.error}
            onSetup={setup => setSettings(prev => ({ ...prev, meditationSetup: setup }))}
            onCreate={createMeditation}
            onPlay={setActiveMeditation}
            onDelete={id => {
              clearVoiceCache(`${id}-`);
              clearPosition(id);
              setMeditations(prev => prev.filter(m => m.id !== id));
            }}
            onOpenVoice={() => setOverlay('voice')}
            onOpenKey={() => { setFocusKey(true); setOverlay('settings'); }}
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

      {activeMeditation && (
        <MeditationPlayer
          key={activeMeditation.id}
          meditation={activeMeditation}
          settings={settings}
          voicePanelOpen={overlay === 'voice'}
          onOpenVoice={() => setOverlay('voice')}
          onChangeSettings={setSettings}
          onSaveBench={bench => setSettings(prev => ({ ...prev, voiceBench: bench }))}
          onClose={() => setActiveMeditation(null)}
          onComplete={() => { recordPractice('meditation'); setActiveMeditation(null); }}
        />
      )}

      {overlay === 'none' && settings.onboarded && (
        <button
          className={`sos-fab ${activeExercise || activeMeditation ? 'in-exercise' : ''}`}
          onClick={() => { setActiveMeditation(null); setOverlay('sos'); }}
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
          focusKey={focusKey}
          update={update}
          onOpenVoice={() => { setFocusKey(false); setVoiceFromSettings(true); setOverlay('voice'); }}
          onClose={() => { setFocusKey(false); setOverlay('none'); }}
        />
      )}
      {overlay === 'voice' && (
        <VoicePanel
          settings={settings}
          onChange={setSettings}
          duringMeditation={!!activeMeditation}
          onClose={closeVoice}
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
