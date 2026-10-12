import { CheckinEntry } from '../types';
import { categoryMeta } from '../data/exercises';

interface Props {
  checkins: CheckinEntry[];
  onClose: () => void;
}

export default function HistoryView({ checkins, onClose }: Props) {
  const sorted = [...checkins].sort((a, b) => b.at.localeCompare(a.at));

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
          <div className="exercise-title">Check-in history</div>
          <p className="exercise-subtitle">Noticing patterns, not judging them.</p>

          {sorted.length === 0 && (
            <p className="settings-row-sub">No check-ins yet. Your entries will appear here.</p>
          )}

          <div className="history-list">
            {sorted.map(c => {
              const d = new Date(c.at);
              return (
                <div key={c.id} className="card history-item">
                  <div className="history-top">
                    <div>
                      <div className="history-date">
                        {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="history-time">
                        {d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="history-level">{c.level}<span>/10</span></div>
                  </div>
                  {c.feeling && <div className="history-feeling">{c.feeling}</div>}
                  {c.focus.length > 0 && (
                    <div className="exercise-card-footer">
                      {c.focus.map(f => (
                        <span key={f} className="badge badge-duration">{categoryMeta[f].emoji} {categoryMeta[f].label}</span>
                      ))}
                    </div>
                  )}
                  {c.note && <div className="history-note">{c.note}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
