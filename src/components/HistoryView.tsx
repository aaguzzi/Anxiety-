import { useMemo, useState } from 'react';
import { CheckinEntry } from '../types';
import { CategoryBadge } from './ExerciseCard';

interface Props {
  checkins: CheckinEntry[];
  onClose: () => void;
}

/** How many check-ins are drawn at first, and how many more each 'Show older' adds. */
const PAGE = 60;

interface Month {
  key: string;
  label: string;
  count: number;
  average: number;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

export default function HistoryView({ checkins, onClose }: Props) {
  const sorted = useMemo(() => [...checkins].sort((a, b) => b.at.localeCompare(a.at)), [checkins]);
  const [limit, setLimit] = useState(PAGE);

  // Each month's summary counts all of its check-ins, also those not shown yet.
  const months = useMemo(() => {
    const m = new Map<string, Month & { sum: number }>();
    for (const c of sorted) {
      const d = new Date(c.at);
      const key = monthKey(d);
      let e = m.get(key);
      if (!e) {
        e = { key, label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), count: 0, average: 0, sum: 0 };
        m.set(key, e);
      }
      e.count++;
      e.sum += c.level;
    }
    for (const e of m.values()) e.average = Math.round((e.sum / e.count) * 10) / 10;
    return m;
  }, [sorted]);

  // The shown check-ins, in their months, newest first.
  const groups = useMemo(() => {
    const out: { month: Month; items: CheckinEntry[] }[] = [];
    for (const c of sorted.slice(0, limit)) {
      const month = months.get(monthKey(new Date(c.at)))!;
      if (out.length === 0 || out[out.length - 1].month !== month) out.push({ month, items: [] });
      out[out.length - 1].items.push(c);
    }
    return out;
  }, [sorted, limit, months]);

  const thisYear = new Date().getFullYear();
  const older = sorted.length - limit;

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

          {groups.map(({ month, items }) => (
            <section key={month.key} className="history-month" aria-labelledby={`month-${month.key}`}>
              <div className="history-month-head">
                <h2 className="section-label history-month-title" id={`month-${month.key}`}>{month.label}</h2>
                <div className="history-month-summary">
                  {month.count} check-in{month.count !== 1 ? 's' : ''} · average anxiety {month.average}/10
                </div>
              </div>
              <div className="history-list">
                {items.map(c => {
                  const d = new Date(c.at);
                  return (
                    <div key={c.id} className="card history-item">
                      <div className="history-top">
                        <div>
                          <div className="history-date">
                            {d.toLocaleDateString(undefined, {
                              weekday: 'short', month: 'short', day: 'numeric',
                              ...(d.getFullYear() !== thisYear ? { year: 'numeric' } : {}),
                            })}
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
                          {c.focus.map(f => <CategoryBadge key={f} category={f} />)}
                        </div>
                      )}
                      {c.note && <div className="history-note user-text">{c.note}</div>}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {older > 0 && (
            <button className="btn btn-secondary w-full mt-4" onClick={() => setLimit(l => l + PAGE)}>
              Show older check-ins ({older} more)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
