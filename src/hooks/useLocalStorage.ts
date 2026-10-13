import { useState, useEffect } from 'react';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return initialValue;
      const parsed = JSON.parse(item) as T;
      // Fill in fields added in newer app versions so older saved data can't crash the app.
      return isPlainObject(initialValue) && isPlainObject(parsed)
        ? ({ ...initialValue, ...parsed } as T)
        : parsed;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch {
      // storage full or unavailable; keep in-memory state
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
