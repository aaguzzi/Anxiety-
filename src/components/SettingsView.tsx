import { useState } from 'react';
import { Settings } from '../types';
import { applyReminder, remindersSupported, ReminderResult } from '../lib/reminders';
import { formatTime12 } from '../lib/dates';
import CrisisLines from './CrisisLines';

export const PRIVACY_URL = 'https://d2l5gmsioco5hq.cloudfront.net/privacy.html';

interface Props {
  settings: Settings;
  onChange: (update: (prev: Settings) => Settings) => void;
  onDeleteAll: () => void;
  onClose: () => void;
}

export default function SettingsView({ settings, onChange, onDeleteAll, onClose }: Props) {
  const [status, setStatus] = useState<ReminderResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const supported = remindersSupported();

  async function updateReminder(enabled: boolean, time: string) {
    setBusy(true);
    try {
      const result = await applyReminder(enabled, time);
      setStatus(result);
      onChange(prev => ({ ...prev, reminderEnabled: result === 'scheduled', reminderTime: time }));
    } finally {
      setBusy(false);
    }
  }

  const statusText =
    status === 'denied' ? 'Notifications are blocked. Turn them on in Android Settings → Apps → Anxiety Companion → Notifications.'
    : settings.reminderEnabled ? `Reminder set for ${formatTime12(settings.reminderTime)} every day.`
    : 'Off';

  return (
    <div className="exercise-overlay">
      <div className="exercise-overlay-inner">
        <div className="exercise-top-bar">
          <button className="back-btn" onClick={onClose} aria-label="Go back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="exercise-scroll">
          <div className="exercise-title mb-6">Settings</div>

          <div className="settings-section">
            <div className="section-label">Daily reminder</div>
            <div className="card settings-card">
              {supported ? (
                <>
                  <div className="settings-row">
                    <div>
                      <div className="settings-row-title">Recentering reminder</div>
                      <div className="settings-row-sub">{statusText}</div>
                    </div>
                    <button
                      role="switch"
                      aria-checked={settings.reminderEnabled}
                      aria-label="Daily reminder"
                      className={`switch ${settings.reminderEnabled ? 'on' : ''}`}
                      disabled={busy}
                      onClick={() => updateReminder(!settings.reminderEnabled, settings.reminderTime)}
                    >
                      <span className="switch-knob" />
                    </button>
                  </div>
                  <div className="settings-row">
                    <label className="settings-row-title" htmlFor="reminder-time">Time</label>
                    <input
                      id="reminder-time"
                      type="time"
                      className="time-input"
                      value={settings.reminderTime}
                      disabled={busy}
                      onChange={e => e.target.value && updateReminder(settings.reminderEnabled, e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <div className="settings-row-sub">Daily reminders are available in the Android app.</div>
              )}
            </div>
          </div>

          <div className="settings-section">
            <div className="section-label">Trusted contact</div>
            <div className="card settings-card">
              <div className="settings-row-sub mb-4">Someone you can call from the SOS screen.</div>
              <input
                type="text"
                className="form-input w-full mb-4"
                placeholder="Name"
                maxLength={60}
                value={settings.contactName}
                onChange={e => { const v = e.target.value; onChange(prev => ({ ...prev, contactName: v })); }}
              />
              <input
                type="tel"
                className="form-input w-full"
                placeholder="Phone number"
                maxLength={30}
                value={settings.contactPhone}
                onChange={e => { const v = e.target.value; onChange(prev => ({ ...prev, contactPhone: v })); }}
              />
            </div>
          </div>

          <div className="settings-section">
            <div className="section-label">Crisis support</div>
            <CrisisLines />
          </div>

          <div className="settings-section">
            <div className="section-label">Your data</div>
            <div className="card settings-card">
              <p className="settings-row-sub mb-4">
                Everything you enter stays on this device and is not included in cloud backups.
              </p>
              <a className="btn btn-outline w-full mb-4" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
                Privacy policy
              </a>
              {!confirmDelete ? (
                <button className="btn btn-ghost w-full danger-text" onClick={() => setConfirmDelete(true)}>
                  Delete all my data
                </button>
              ) : (
                <div className="delete-confirm">
                  <p className="settings-row-sub mb-4">
                    This permanently erases your check-ins, notes, practice history and settings. It can't be undone.
                  </p>
                  <button className="btn btn-primary w-full danger-bg" onClick={onDeleteAll}>Yes, delete everything</button>
                  <button className="btn btn-ghost w-full mt-4" onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              )}
            </div>
          </div>

          <div className="settings-section">
            <div className="section-label">About</div>
            <div className="card settings-card">
              <p className="settings-row-sub">
                Anxiety Companion offers self-help practices inspired by mindfulness and acceptance-based approaches.
                It is not a substitute for professional care, diagnosis, or treatment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
