/** Remembers how far into each meditation the listener got, so it can be picked up again. */
const KEY = 'ac-med-positions';
/** Older than this and it's a fresh sitting, not an interruption. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
/** Stopping in the first few sentences isn't worth resuming. */
const MIN_INDEX = 3;

type Saved = Record<string, { index: number; at: number }>;

function load(): Saved {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Saved;
  } catch {
    return {};
  }
}

function store(saved: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // storage unavailable: resuming is a convenience
  }
}

/** The sentence to resume a meditation from, or 0 to start at the beginning. */
export function savedPosition(id: string, sentences: number): number {
  const entry = load()[id];
  if (!entry || Date.now() - entry.at > MAX_AGE_MS) return 0;
  return entry.index >= MIN_INDEX && entry.index < sentences - 1 ? entry.index : 0;
}

export function savePosition(id: string, index: number): void {
  const saved = load();
  saved[id] = { index, at: Date.now() };
  store(saved);
}

export function clearPosition(id: string): void {
  const saved = load();
  if (!(id in saved)) return;
  delete saved[id];
  store(saved);
}
