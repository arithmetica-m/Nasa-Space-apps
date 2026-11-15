import type { ChironEvent } from '../emergency/events';
import { medicalOf } from '../library/advice';
import type { LinkStatus } from '../link/link';
import { casesFrom } from '../emergency/plan';
import { categoryText } from '../emergency/report';

// MEDICAL STATE CAPSULE (CONTINUITY).
// Each astronaut's band keeps an offline copy of their essential medical state, so it can be
// read even when CORE is unreachable. Things recorded on the band while offline are kept in the
// capsule. When the band reconnects, CHIRON reconciles both ways:
//   - entries made offline are added to the shared log (never lost, never duplicated);
//   - if the same field was changed on both sides, nothing is overwritten: a medical officer chooses.
// PROTOTYPE: the "band" storage is this browser's localStorage; the band itself is simulated.

export type RecordField = 'allergies' | 'medications' | 'history' | 'restrictions';
export const FIELD_LABEL: Record<RecordField, string> = { allergies: 'Allergies', medications: 'Medications', history: 'Medical history', restrictions: 'Restrictions' };

export interface CapsuleEntry { id: string; text: string; t: number }
export interface Capsule {
  crewId: string;
  syncedAt?: number;
  record: Record<RecordField, string[]>;
  readings: { label: string; value: string; t?: number }[];
  openEmergencies: string[];
  offline: CapsuleEntry[];                          // recorded on the band, not yet in CORE
  edits: Partial<Record<RecordField, string[]>>;    // record changed on the band while offline
}

const key = (id: string) => `chiron-capsule-v1-${id}`;

export function snapshot(crewId: string, link: LinkStatus | undefined, log: ChironEvent[]): Capsule {
  const m = medicalOf(crewId);
  return {
    crewId, syncedAt: Date.now(),
    record: { allergies: m.allergies, medications: m.medications, history: m.history, restrictions: m.restrictions },
    readings: (link?.readings ?? []).filter((r) => r.value !== undefined).map((r) => ({ label: r.label, value: `${r.value} ${r.unit}`, t: r.t })),
    openEmergencies: casesFrom(log).filter((c) => !c.ended && c.patientId === crewId).map((c) => categoryText[c.category]),
    offline: [], edits: {},
  };
}

export function loadCapsule(crewId: string, link: LinkStatus | undefined, log: ChironEvent[]): Capsule {
  try { const raw = localStorage.getItem(key(crewId)); if (raw) return JSON.parse(raw) as Capsule; } catch { /* fall through */ }
  const c = snapshot(crewId, link, log);
  saveCapsule(c);
  return c;
}
export function saveCapsule(c: Capsule) {
  try { localStorage.setItem(key(c.crewId), JSON.stringify(c)); } catch { /* storage unavailable */ }
}

// What must happen before band and CORE agree again.
export function pending(c: Capsule, log: ChironEvent[]) {
  const inCore = new Set(log.filter((e) => e.type === 'capsule-entry').map((e) => (e.type === 'capsule-entry' ? e.entryId : '')));
  const entries = c.offline.filter((e) => !inCore.has(e.id));
  const core = medicalOf(c.crewId);
  const same = (a?: string[], b?: string[]) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  const changed = (Object.keys(c.edits) as RecordField[]).filter((f) => !same(c.edits[f], core[f]));
  // Only the band changed since the last sync: take the band's version automatically.
  const automatic = changed.filter((f) => same(core[f], c.record[f])).map((f) => ({ field: f, value: c.edits[f]! }));
  // Both sides changed: a conflict for a medical officer.
  const conflicts = changed.filter((f) => !same(core[f], c.record[f])).map((f) => ({ field: f, core: core[f], capsule: c.edits[f]! }));
  return { entries, automatic, conflicts };
}

// Keep the band's version of a field: write it to the medical record on this device.
export function applyToRecord(crewId: string, field: RecordField, value: string[]) {
  const k = `chiron-medical-profile-v1-${crewId}`;
  const m = medicalOf(crewId);
  let rec: Record<string, unknown> = {};
  try { rec = JSON.parse(localStorage.getItem(k) ?? '{}'); } catch { /* new record */ }
  const next = { allergies: m.allergies, medications: m.medications, restrictions: m.restrictions, history: m.history, baselineNotes: '', author: 'Reconciled from the Medical State Capsule', version: 'capsule', ...rec, [field]: value, status: 'draft', updatedAt: new Date().toISOString() };
  try { localStorage.setItem(k, JSON.stringify(next)); } catch { /* storage unavailable */ }
}
