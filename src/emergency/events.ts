import type { MissionId } from '../types';
import type { Category, EarthMessage, ItemStatus, RoleId } from './types';
import type { LibraryEntry } from '../library/entries';

// Everything that happens in an emergency is an event in one shared, append-only log.
// Every device rebuilds the same picture from the same log, which also gives the
// timeline and an audit trail.

type Base = { id: string; t: number; by: string };

export type ChironEvent = Base & (
  | { type: 'start'; eid: string; category: Category; patientId: string; mission: MissionId; reason?: string }
  | { type: 'step'; eid: string; stepId: string; outcome: 'done' | 'cannot' | 'yes' | 'no' }
  | { type: 'verify'; eid: string; stepId: string }
  | { type: 'item'; mission: MissionId; itemId: string; status: ItemStatus; note: string }
  | { type: 'vitals'; eid: string; spo2?: number; hr?: number; note?: string }
  | { type: 'crew'; crewId: string; available: boolean }
  | { type: 'message'; eid: string; message: EarthMessage }
  | { type: 'link'; lost: boolean }
  | { type: 'support'; to: string; from: string }
  | { type: 'medical-access'; eid: string; patientId: string; reason: string }
  | { type: 'end'; eid: string }
  // A new version of a medical library entry, released by Mission Control. Crew devices cannot send this.
  | { type: 'library'; entry: LibraryEntry; note: string; sig?: string }
  // A measurement recorded during an emergency (by hand, or taken from the patient's LINK wearable).
  | { type: 'measure'; eid: string; key: string; value: string; source: 'manual' | 'link' | 'device'; device?: string }
  // The crew changed who does a role (CHIRON's suggestion is only a suggestion).
  | { type: 'assign'; eid: string; role: RoleId; crewId: string }
  // The physical emergency button on a CHIRON LINK wearable was pressed.
  | { type: 'sos'; crewId: string; location: string; readings: string; comms: boolean }
  | { type: 'sos-clear'; sosId: string }
  // A new reading from a CHIRON LINK wearable (simulated), sent to CORE.
  | { type: 'link-reading'; crewId: string; key: 'hr' | 'spo2' | 'skin' | 'activity'; value: number }
  // Back to the band's normal simulated readings.
  | { type: 'link-clear'; crewId: string }
  // The response lead confirms CHIRON's proposed assignments (a snapshot of who does which role).
  | { type: 'confirm-roles'; eid: string; roles: Partial<Record<RoleId, string>>; lead?: string }
  // Alert lifecycle: someone saw it (acknowledged), a medical officer reviewed it.
  | { type: 'alert-ack'; alertId: string; crewId: string }
  | { type: 'alert-review'; alertId: string; crewId: string; note: string }
  // Personal baselines: a medical officer proposes a change, Mission Control approves it as a new version.
  | { type: 'baseline-proposal'; crewId: string; indicator: string; low: number; high: number; reason: string }
  | { type: 'baseline'; crewId: string; indicator: string; low: number; high: number; version: number; reason: string; proposalId?: string }
  // Medical State Capsule: an entry recorded on the band while offline, and a resolved conflict.
  // A band connected or disconnected (simulated).
  | { type: 'band'; crewId: string; connected: boolean }
  | { type: 'capsule-entry'; crewId: string; entryId: string; text: string; recordedAt: number }
  | { type: 'capsule-resolve'; crewId: string; field: string; kept: 'core' | 'capsule'; value: string[] }
  // Someone other than the owner opened a medical profile (medical officer, or logged emergency access).
  | { type: 'profile-access'; crewId: string; role: 'medical' | 'emergency'; reason?: string }
);

// Distributes Omit over the union, so each event kind keeps its own fields.
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewEvent = DistOmit<ChironEvent, 'id' | 't'>;

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
