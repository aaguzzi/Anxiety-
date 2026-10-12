import { useState } from 'react';
import { CheckinEntry, PracticeHistory } from '../types';
import { lastNDays, localDateKey } from '../lib/dates';

interface Props {
  checkins: CheckinEntry[];
  history: PracticeHistory;
}

interface DayStat {
  key: string;
  label: string;
  longLabel: string;
  avg: number | null;
  count: number;
  practices: number;
}

export default function WeekChart({ checkins, history }: Props) {
  const days: DayStat[] = lastNDays(7).map(d => {
    const key = localDateKey(d);
    const levels = checkins.filter(c => localDateKey(new Date(c.at)) === key).map(c => c.level);
    return {
      key,
      label: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
      longLabel: d.toLocaleDateString(undefined, { weekday: 'long' }),
      avg: levels.length ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10 : null,
      count: levels.length,
      practices: (history[key] ?? []).length,
    };
  });

  const [selected, setSelected] = useState(days.length - 1);
  const sel = days[selected];

  const caption = sel.avg === null
    ? `${sel.longLabel} · no check-ins`
    : `${sel.longLabel} · anxiety ${sel.avg}/10 · ${sel.count} check-in${sel.count !== 1 ? 's' : ''}`;

  return (
    <div className="week-chart">
      <div className="week-caption" aria-live="polite">
        {caption}
        {sel.practices > 0 && ` · ${sel.practices} practice${sel.practices !== 1 ? 's' : ''}`}
      </div>

      <div className="week-plot">
        <div className="week-gridline" style={{ bottom: '100%' }}><span>10</span></div>
        <div className="week-gridline" style={{ bottom: '50%' }}><span>5</span></div>
        <div className="week-gridline week-baseline" style={{ bottom: 0 }}><span>0</span></div>

        <div className="week-bars">
          {days.map((d, i) => (
            <button
              key={d.key}
              className={`week-slot ${i === selected ? 'selected' : ''}`}
              onClick={() => setSelected(i)}
              aria-label={`${d.longLabel}: ${d.avg === null ? 'no check-ins' : `anxiety ${d.avg} out of 10`}${d.practices ? `, ${d.practices} practices` : ''}`}
            >
              {d.avg !== null && (
                <span className="week-bar" style={{ height: `${Math.max(d.avg, 0.3) * 10}%` }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="week-labels">
        {days.map((d, i) => (
          <div key={d.key} className={`week-label ${i === selected ? 'selected' : ''}`}>
            <span>{d.label}</span>
            <span className={`week-dot ${d.practices > 0 ? 'on' : ''}`} />
          </div>
        ))}
      </div>

      <div className="week-legend">
        <span><span className="legend-swatch" /> Average anxiety (0–10)</span>
        <span><span className="week-dot on" /> Practice done</span>
      </div>
    </div>
  );
}
