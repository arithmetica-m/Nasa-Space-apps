import { useMemo } from 'react';
import type { ChironEvent } from '../emergency/events';
import { useLog } from '../emergency/sync';
import { LIBRARY, type LibraryEntry } from './entries';

// The library on this device = the released entries + any newer versions sent by Mission Control.
// Updates arrive through the same shared log as everything else, so every crew device gets them,
// and the log keeps who changed what and when.

export interface LibraryUpdate { t: number; by: string; id: string; title: string; version: string; note: string }

const newer = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }) > 0;

export function libraryFrom(log: ChironEvent[]) {
  const byId = new Map<string, LibraryEntry>(LIBRARY.map((e) => [e.id, e]));
  const updates: LibraryUpdate[] = [];
  for (const e of log) {
    // Only Mission Control can change the library. Anything else is ignored.
    if (e.type !== 'library' || e.by !== 'earth') continue;
    const current = byId.get(e.entry.id);
    if (current && !newer(e.entry.version, current.version)) continue;
    byId.set(e.entry.id, e.entry);
    updates.push({ t: e.t, by: e.by, id: e.entry.id, title: e.entry.title, version: e.entry.version, note: e.note });
  }
  return { entries: [...byId.values()], updates: updates.reverse() };
}

export function useLibrary() {
  const log = useLog();
  return useMemo(() => libraryFrom(log), [log]);
}
