import { useState } from 'react';
import { Settings } from '../types';
import { applyReminder, remindersSupported, ReminderResult } from '../lib/reminders';
import { formatTime12 } from '../lib/dates';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}

export default function SettingsView({ settings, onChange, onClose }: Props) {
  const [status, setStatus] = useState<ReminderResult | null>(null);
  const [busy, setBusy] = useState(false);
  const supported = remindersSupported();

  async function updateReminder(enabled: boolean, time: string) {
    setBusy(true);
    try {
      const result = await applyReminder(enabled, time);
      setStatus(result);
      onChange({ ...settings, reminderEnabled: result === 'scheduled', reminderTime: time });
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
                value={settings.contactName}
                onChange={e => onChange({ ...settings, contactName: e.target.value })}
              />
              <input
                type="tel"
                className="form-input w-full"
                placeholder="Phone number"
                value={settings.contactPhone}
                onChange={e => onChange({ ...settings, contactPhone: e.target.value })}
              />
            </div>
          </div>

          <div className="settings-section">
            <div className="section-label">Crisis support</div>
            <div className="card settings-card">
              <p className="settings-row-sub">
                In Canada and the US, call or text <a href="tel:988">988</a> any time, day or night.
                If you are in immediate danger, call <a href="tel:911">911</a>.
              </p>
            </div>
          </div>

          <div className="settings-section">
            <div className="section-label">About</div>
            <div className="card settings-card">
              <p className="settings-row-sub">
                Anxiety Companion offers self-help practices inspired by mindfulness and acceptance-based approaches.
                It is not a substitute for professional care, diagnosis, or treatment.
                Everything you enter stays on this device.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
