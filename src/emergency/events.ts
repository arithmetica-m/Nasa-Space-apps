import type { MissionId } from '../types';
import type { Category, EarthMessage, ItemStatus } from './types';

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
);

// Distributes Omit over the union, so each event kind keeps its own fields.
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewEvent = DistOmit<ChironEvent, 'id' | 't'>;

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
