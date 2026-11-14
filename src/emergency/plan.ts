import type { MissionId } from '../types';
import type { ChironEvent } from './events';
import type { Category, CrewMember, EarthMessage, InventoryItem, Procedure, RoleId, Step } from './types';
import { crew as baseCrew, inventoryFor } from './data';
import { assignRoles, checkResources, resolveProcedure, roleName, type ResourceCheck, type Roles } from './engine';

// Demo scale for signal travel: one real second stands for one minute.
export const DELAY_MIN: Record<MissionId, number> = { iss: 0.05, moon: 0.05, 'mars-transit': 11, 'mars-surface': 18 };
export const DEMO_SPO2_ESCALATE = 90; // demo value, not an approved limit
export const DEMO_HR_ESCALATE = 130; // demo value, not an approved limit

const name = (id: string) => baseCrew.find((c) => c.id === id)?.name ?? id;

// ---------- Shared state rebuilt from the log ----------

export function crewNow(log: ChironEvent[]): CrewMember[] {
  const avail = new Map<string, boolean>();
  for (const e of log) if (e.type === 'crew') avail.set(e.crewId, e.available);
  return baseCrew.map((c) => ({ ...c, available: avail.get(c.id) ?? c.available }));
}

export function inventoryNow(log: ChironEvent[], mission: MissionId): InventoryItem[] {
  const items = inventoryFor(mission);
  for (const e of log) {
    if (e.type !== 'item' || e.mission !== mission) continue;
    const it = items.find((i) => i.id === e.itemId);
    if (it) { it.status = e.status; it.log.push({ time: new Date(e.t).toISOString().slice(11, 16), by: name(e.by), change: e.note }); }
  }
  return items;
}

export interface EmergencyCase {
  eid: string;
  category: Category;
  patientId: string;
  mission: MissionId;
  reason?: string;
  startedAt: number;
  startedBy: string;
  ended: boolean;
  outcomes: Record<string, { outcome: 'done' | 'cannot' | 'yes' | 'no'; by: string; t: number }>;
  verified: Set<string>;
  vitals: { t: number; by: string; spo2?: number; hr?: number; note?: string }[];
  messages: EarthMessage[];
}

export function casesFrom(log: ChironEvent[]): EmergencyCase[] {
  const map = new Map<string, EmergencyCase>();
  let linkLost = false;
  const queued: EarthMessage[] = [];
  for (const e of log) {
    if (e.type === 'start') {
      map.set(e.eid, { eid: e.eid, category: e.category, patientId: e.patientId, mission: e.mission, reason: e.reason, startedAt: e.t, startedBy: e.by, ended: false, outcomes: {}, verified: new Set(), vitals: [], messages: [] });
      continue;
    }
    if (e.type === 'link') {
      linkLost = e.lost;
      // Queued reports leave the moment the link returns.
      if (!e.lost) for (const m of queued.splice(0)) { const d = m.arrivesAt; m.sentAt = e.t; m.arrivesAt = e.t + d; }
      continue;
    }
    const c = 'eid' in e ? map.get(e.eid) : undefined;
    if (!c) continue;
    if (e.type === 'step') c.outcomes[e.stepId] = { outcome: e.outcome, by: e.by, t: e.t };
    if (e.type === 'verify') c.verified.add(e.stepId);
    if (e.type === 'vitals') c.vitals.push({ t: e.t, by: e.by, spo2: e.spo2, hr: e.hr, note: e.note });
    if (e.type === 'end') c.ended = true;
    if (e.type === 'message') {
      const m = { ...e.message };
      // While queued, arrivesAt holds only the travel time; it becomes a time when sent.
      if (m.direction === 'out' && linkLost) { m.arrivesAt = m.arrivesAt - m.sentAt; m.sentAt = 0; queued.push(m); }
      c.messages.push(m);
    }
  }
  return [...map.values()];
}

// ---------- The adaptive plan ----------

export type TaskStatus = 'done' | 'cannot' | 'ready' | 'waiting' | 'blocked';
export interface Task {
  step: Step;
  status: TaskStatus;
  assignee?: CrewMember;
  waitingFor: string[];
  blockedBy?: string;
}

export interface Plan {
  procedure?: Procedure;
  missing?: string;
  roles: Roles;
  warnings: string[];
  checks: ResourceCheck[];
  tasks: Task[];
  alerts: string[];
  patient: CrewMember;
}

export function buildPlan(c: EmergencyCase, kb: Procedure[], log: ChironEvent[], allCases: EmergencyCase[]): Plan {
  const crew = crewNow(log);
  // Patients in other active emergencies cannot help here.
  const busyPatients = new Set(allCases.filter((x) => !x.ended && x.eid !== c.eid).map((x) => x.patientId));
  const pool = crew.map((m) => (busyPatients.has(m.id) ? { ...m, available: false } : m));
  const patient = crew.find((m) => m.id === c.patientId)!;
  const { procedure, reason } = resolveProcedure(kb, c.category, c.mission);
  const { roles, warnings } = assignRoles(pool, c.patientId, c.category, procedure);
  const inventory = inventoryNow(log, c.mission);
  const checks = procedure ? checkResources(procedure, inventory) : [];
  const alerts: string[] = [];

  const steps = procedure?.steps ?? [];

  // Surface a missing resource without inventing steps outside the scenario procedure.
  for (const ch of checks.filter((x) => !x.ok && !x.alternative)) {
    alerts.push(`${ch.name} is ${ch.status}. No approved alternative is listed.`);
  }

  // Flag reported changes for the crew; do not generate clinical instructions.
  const last = c.vitals[c.vitals.length - 1];
  const prev = [...c.vitals].reverse().find((v, i) => i > 0 && v.spo2 !== undefined);
  const falling = last?.spo2 !== undefined && prev?.spo2 !== undefined && last.spo2 < prev.spo2 - 2;
  const esc = last && ((last.spo2 !== undefined && last.spo2 < DEMO_SPO2_ESCALATE) || (last.hr !== undefined && last.hr > DEMO_HR_ESCALATE) || falling || /worse/i.test(last.note ?? ''));
  if (esc) {
    const why = last.spo2 !== undefined && last.spo2 < DEMO_SPO2_ESCALATE ? `blood oxygen ${last.spo2}%` : last.hr !== undefined && last.hr > DEMO_HR_ESCALATE ? `heart rate ${last.hr} bpm` : falling ? 'blood oxygen falling' : 'patient reports feeling worse';
    alerts.unshift(`Notify the medical lead: reported change (${why}).`);
  }

  const relevant = (s: Step) => !s.when || c.outcomes[s.when.step]?.outcome === s.when.answer;
  const decided = (s: Step) => !s.when || !!c.outcomes[s.when.step];
  const settled = (id: string) => {
    const s = steps.find((step) => step.id === id);
    if (!s) return true;
    if (!decided(s)) return false;
    if (!relevant(s)) return true;
    return !!c.outcomes[id];
  };

  const tasks: Task[] = steps
    .filter((step) => decided(step) ? relevant(step) : true)
    .map((step) => {
      const o = c.outcomes[step.id]?.outcome;
      const waitingFor = (step.after ?? []).filter((id) => !settled(id));
      const unusable = (step.equipment ?? []).map((id) => checks.find((ch) => ch.itemId === id)).find((ch) => ch && !ch.ok && !ch.alternative);
      let status: TaskStatus = o === 'cannot' ? 'cannot' : o ? 'done' : !decided(step) || waitingFor.length ? 'waiting' : 'ready';
      if (status === 'ready' && unusable) status = 'blocked';
      return { step, status, assignee: roles[step.role].person, waitingFor, blockedBy: unusable ? `${unusable.name} is ${unusable.status}` : undefined };
    });

  return { procedure, missing: reason, roles, warnings, checks, tasks, alerts, patient };
}

export { roleName };
export const rolesOf = (roles: Roles, crewId: string) => (Object.keys(roles) as RoleId[]).filter((r) => roles[r].person?.id === crewId);
