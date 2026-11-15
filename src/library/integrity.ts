import type { LibraryEntry } from './entries';

// INTEGRITY CHECK FOR LIBRARY UPDATES.
// Mission Control attaches a checksum computed with its key; crew devices recompute it and
// reject any update that does not match (a changed or forged entry).
// PROTOTYPE: a keyed FNV-1a checksum with a demo key held in the app. It shows the workflow;
// a real system would use public-key signatures (Mission Control signs, devices only verify).
const DEMO_KEY = 'chiron-mission-control-demo-key';

function fnv(text: string, seed: number) {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

export function signUpdate(entry: LibraryEntry, note: string) {
  const body = `${DEMO_KEY}|${JSON.stringify(entry)}|${note}`;
  return fnv(body, 2166136261) + fnv(body.split('').reverse().join(''), 3339675911);
}

export const verifyUpdate = (entry: LibraryEntry, note: string, sig?: string) => !!sig && sig === signUpdate(entry, note);
