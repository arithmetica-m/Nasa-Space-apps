import { useMemo } from 'react';
import type { ChironEvent } from '../emergency/events';
import { useLog } from '../emergency/sync';
import { LIBRARY, type LibraryEntry } from './entries';
import { verifyUpdate } from './integrity';

// The library on this device = the released entries + any newer versions sent by Mission Control.
// Updates arrive through the same shared log as everything else, so every crew device gets them,
// and the log keeps who changed what and when.

export interface LibraryUpdate { t: number; by: string; id: string; title: string; version: string; note: string }
export interface RejectedUpdate { t: number; by: string; title: string; version: string; reason: string }

const newer = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }) > 0;

export function libraryFrom(log: ChironEvent[]) {
  const byId = new Map<string, LibraryEntry>(LIBRARY.map((e) => [e.id, e]));
  const updates: LibraryUpdate[] = [];
  const rejected: RejectedUpdate[] = [];
  for (const e of log) {
    if (e.type !== 'library') continue;
    // Only Mission Control can change the library, and only with a valid integrity check.
    if (e.by !== 'earth') { rejected.push({ t: e.t, by: e.by, title: e.entry.title, version: e.entry.version, reason: 'Not sent by Mission Control' }); continue; }
    if (!verifyUpdate(e.entry, e.note, e.sig)) { rejected.push({ t: e.t, by: e.by, title: e.entry.title, version: e.entry.version, reason: 'Integrity check failed: the entry was changed or not signed' }); continue; }
    const current = byId.get(e.entry.id);
    if (current && !newer(e.entry.version, current.version)) continue;
    byId.set(e.entry.id, e.entry);
    updates.push({ t: e.t, by: e.by, id: e.entry.id, title: e.entry.title, version: e.entry.version, note: e.note });
  }
  return { entries: [...byId.values()], updates: updates.reverse(), rejected: rejected.reverse() };
}

export function useLibrary() {
  const log = useLog();
  return useMemo(() => libraryFrom(log), [log]);
}
