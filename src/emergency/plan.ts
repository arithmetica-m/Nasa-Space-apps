import type { MissionId } from '../types';
import type { ChironEvent } from './events';
import type { Category, CrewMember, EarthMessage, InventoryItem, Procedure, RoleId, Step } from './types';
import { crew as baseCrew, inventoryFor } from './data';
import { assignRoles, checkResources, resolveProcedure, roleName, type RankContext, type ResourceCheck, type Roles } from './engine';
import { bandInfo } from '../link/link';
import { skillStatus } from '../train/training';

// Demo scale for signal travel: one real second stands for one minute.
export const DELAY_MIN: Record<MissionId, number> = { iss: 0.05, moon: 0.05, 'mars-transit': 11, 'mars-surface': 18 };

const name = (id: string) => baseCrew.find((c) => c.id === id)?.name ?? id;

// ---------- Shared state rebuilt from the log ----------

export function crewNow(log: ChironEvent[]): CrewMember[] {
  const avail = new Map<string, boolean>();
  for (const e of log) if (e.type === 'crew') avail.set(e.crewId, e.available);
  return baseCrew.map((c) => ({ ...c, available: avail.get(c.id) ?? c.available }));
}

// Equipment held by active emergencies, oldest first. A later emergency sees only what is left.
export function withReservations(items: InventoryItem[], cases: EmergencyCase[], kb: Procedure[], exceptEid?: string): InventoryItem[] {
  const out = items.map((i) => ({ ...i, reservedFor: [] as NonNullable<InventoryItem['reservedFor']> }));
  for (const c of [...cases].filter((x) => !x.ended && x.eid !== exceptEid).sort((a, b) => a.startedAt - b.startedAt)) {
    const { procedure } = resolveProcedure(kb, c.category, c.mission);
    for (const req of procedure?.equipment ?? []) {
      const it = out.find((i) => i.id === req.itemId);
      if (!it) continue;
      const take = Math.min(req.quantity, it.quantity);
      if (take <= 0) continue;
      it.quantity -= take;
      it.reservedFor.push({ eid: c.eid, who: name(c.patientId), quantity: take });
      if (it.quantity <= 0 && it.status === 'available') it.status = 'reserved';
    }
  }
  return out;
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
  measures: { key: string; value: string; source: 'manual' | 'link' | 'device'; t: number; by: string }[];
  assignments: Partial<Record<RoleId, { crewId: string; t: number; by: string }>>;
  messages: EarthMessage[];
}

export function casesFrom(log: ChironEvent[]): EmergencyCase[] {
  const map = new Map<string, EmergencyCase>();
  let linkLost = false;
  const queued: EarthMessage[] = [];
  for (const e of log) {
    if (e.type === 'start') {
      map.set(e.eid, { eid: e.eid, category: e.category, patientId: e.patientId, mission: e.mission, reason: e.reason, startedAt: e.t, startedBy: e.by, ended: false, outcomes: {}, verified: new Set(), vitals: [], messages: [], measures: [], assignments: {} });
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
    if (e.type === 'measure') c.measures.push({ key: e.key, value: e.value, source: e.source, t: e.t, by: e.by });
    if (e.type === 'assign') c.assignments[e.role] = { crewId: e.crewId, t: e.t, by: e.by };
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
  confirmed: boolean;            // the lead confirmed exactly these assignments
  confirmedAt?: { t: number; by: string };
}

export function buildPlan(c: EmergencyCase, kb: Procedure[], log: ChironEvent[], allCases: EmergencyCase[]): Plan {
  const crew = crewNow(log);
  // Patients in other active emergencies cannot help here.
  const busyPatients = new Set(allCases.filter((x) => !x.ended && x.eid !== c.eid && x.mission === c.mission).map((x) => x.patientId));
  const pool = crew.map((m) => (busyPatients.has(m.id) ? { ...m, available: false } : m));
  const patient = crew.find((m) => m.id === c.patientId)!;
  const { procedure, reason } = resolveProcedure(kb, c.category, c.mission);
  const ctx: RankContext = {
    place: Object.fromEntries(pool.map((m) => { const b = bandInfo(m.id, log); return [m.id, { location: b.location, fresh: b.connected, busy: b.eva || /EVA/.test(b.activity) }]; })),
    patientPlace: bandInfo(c.patientId, log).location,
    refresherDue: new Set(pool.filter((m) => skillStatus(m.id, c.mission).find((x) => x.skill.id === c.category)?.due).map((m) => m.id)),
  };
  const { roles, warnings } = assignRoles(pool, c.patientId, c.category, procedure, ctx);
  // The crew can change any suggestion. Their choice always wins.
  for (const [role, a] of Object.entries(c.assignments) as [RoleId, { crewId: string }][]) {
    const person = crew.find((m) => m.id === a.crewId);
    if (person) roles[role] = { person, note: 'Chosen by the crew' };
  }
  const inventory = withReservations(inventoryNow(log, c.mission), allCases.filter((x) => x.mission === c.mission && x.startedAt < c.startedAt), kb, c.eid);
  const checks = procedure ? checkResources(procedure, inventory) : [];
  const alerts: string[] = [];

  const steps = procedure?.steps ?? [];

  // Surface a missing resource without inventing steps outside the scenario procedure.
  for (const ch of checks.filter((x) => !x.ok && !x.alternative)) {
    alerts.push(`${ch.name} is ${ch.status}. No approved alternative is listed.`);
  }

  // Surface only an explicit crew report. CHIRON has no approved clinical limits.
  const last = c.vitals[c.vitals.length - 1];
  void last;

  const conditions = (s: Step) => s.when ? (Array.isArray(s.when) ? s.when : [s.when]) : [];
  const relevant = (s: Step) => {
    const when = conditions(s);
    return !when.length || when.some((condition) => c.outcomes[condition.step]?.outcome === condition.answer);
  };
  const decided = (s: Step) => {
    const when = conditions(s);
    return !when.length || relevant(s) || when.every((condition) => !!c.outcomes[condition.step]);
  };
  const settled = (id: string) => {
    const s = steps.find((step) => step.id === id);
    if (!s) return true;
    if (!decided(s)) return false;
    if (!relevant(s)) return true;
    return !!c.outcomes[id];
  };

  const tasks: Task[] = steps
    .filter((step) => !step.when || (decided(step) && relevant(step)))
    .map((step) => {
      const o = c.outcomes[step.id]?.outcome;
      const waitingFor = (step.after ?? []).filter((id) => !settled(id));
      const unusable = (step.equipment ?? []).map((id) => checks.find((ch) => ch.itemId === id)).find((ch) => ch && !ch.ok && !ch.alternative);
      let status: TaskStatus = o === 'cannot' ? 'cannot' : o ? 'done' : !decided(step) || waitingFor.length ? 'waiting' : 'ready';
      if (status === 'ready' && unusable) status = 'blocked';
      return { step, status, assignee: roles[step.role].person, waitingFor, blockedBy: unusable ? `${unusable.name} is ${unusable.status}` : undefined };
    });

  // Assignments stay PROPOSED until the response lead confirms them. Any later change
  // (a reassignment, someone becoming unavailable) makes them PROPOSED again.
  const conf = [...log].reverse().find((e) => e.type === 'confirm-roles' && e.eid === c.eid);
  const current = Object.fromEntries((Object.keys(roles) as RoleId[]).map((r) => [r, roles[r].person?.id ?? '']));
  const confirmed = !!conf && conf.type === 'confirm-roles' && (Object.keys(current) as RoleId[]).every((r) => (conf.roles[r] ?? '') === current[r]);
  return { procedure, missing: reason, roles, warnings, checks, tasks, alerts, patient, confirmed, confirmedAt: conf ? { t: conf.t, by: conf.by } : undefined };
}

export { roleName };
export const rolesOf = (roles: Roles, crewId: string) => (Object.keys(roles) as RoleId[]).filter((r) => roles[r].person?.id === crewId);
