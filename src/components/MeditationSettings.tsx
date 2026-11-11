import { useState } from 'react';
import { Settings } from '../types';

interface Props {
  settings: Settings;
  onChange: (update: (prev: Settings) => Settings) => void;
  onOpenVoice: () => void;
}

export default function MeditationSettings({ settings, onChange, onOpenVoice }: Props) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="settings-section" id="meditation-settings">
      <div className="section-label">Meditations</div>
      <div className="card settings-card">
        <div className="settings-row-title">Voice &amp; sounds</div>
        <p className="settings-row-sub mb-4">
          The voice, its pace and the background sounds have their own screen. It also opens from the Meditate tab
          and from any meditation while it plays.
        </p>
        <button className="btn btn-outline w-full" onClick={onOpenVoice}>Open Voice &amp; sounds</button>
      </div>

      <div className="section-label mt-6" id="custom-meditations">Custom meditations</div>
      <div className="card settings-card">
        <label className="settings-row-title" htmlFor="api-key">Anthropic API key</label>
        <p className="settings-row-sub mb-4">
          Used to write your meditation scripts. The key is stored only on this device. What you type when
          creating a meditation is sent to Anthropic; nothing else leaves your phone.
        </p>
        <div className="key-row">
          <input
            id="api-key"
            type={showKey ? 'text' : 'password'}
            className="form-input"
            placeholder="sk-ant-…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={settings.anthropicKey}
            onChange={e => { const v = e.target.value.trim(); onChange(prev => ({ ...prev, anthropicKey: v })); }}
          />
          <button className="btn btn-secondary key-toggle" onClick={() => setShowKey(s => !s)}>
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
    </div>
  );
}
