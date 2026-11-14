import { useEffect, useState } from 'react';

// Local-first storage: the knowledge base and inventory live on the device,
// so everything works with no link to Earth.
export function usePersisted<T>(key: string, initial: () => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch { /* storage unavailable: start from the initial value */ }
    return initial();
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value]);
  return [value, setValue] as const;
}

export const clock = (t: number | Date = Date.now()) => new Date(t).toISOString().slice(11, 19);
