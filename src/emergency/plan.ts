import type { MissionId } from '../types';
import type { ChironEvent } from './events';
import type { Category, CrewMember, EarthMessage, InventoryItem, Procedure, RoleId, Step, TimelineEntry } from './types';
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

export function linkLost(log: ChironEvent[]) {
  let lost = false;
  for (const e of log) if (e.type === 'link') lost = e.lost;
  return lost;
}

// ---------- The adaptive plan ----------

export type TaskStatus = 'done' | 'cannot' | 'ready' | 'waiting' | 'blocked';
export interface Task {
  step: Step;
  status: TaskStatus;
  assignee?: CrewMember;
  added?: string; // why CHIRON added it, for tasks that are not in the approved procedure
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

  const steps: { step: Step; added?: string }[] = (procedure?.steps ?? []).map((s) => ({ step: s }));

  // Adaptive: an item with no approved alternative becomes a question for Earth.
  for (const ch of checks.filter((x) => !x.ok && !x.alternative)) {
    steps.push({
      step: { id: `x-item-${ch.itemId}`, role: 'earth', text: `Tell Earth that ${ch.name.toLowerCase()} is ${ch.status}, and ask for approved options.`, why: 'The approved procedure needs it and lists no alternative.', verify: 'confirm', ifCannot: 'Queue the message; it leaves when the link returns.' },
      added: `Added by CHIRON: ${ch.name} unavailable`,
    });
    alerts.push(`${ch.name} is ${ch.status}. No approved alternative is listed.`);
  }

  // Adaptive: escalation when a recorded observation meets a demo escalation rule.
  const last = c.vitals[c.vitals.length - 1];
  const prev = [...c.vitals].reverse().find((v, i) => i > 0 && v.spo2 !== undefined);
  const falling = last?.spo2 !== undefined && prev?.spo2 !== undefined && last.spo2 < prev.spo2 - 2;
  const esc = last && ((last.spo2 !== undefined && last.spo2 < DEMO_SPO2_ESCALATE) || (last.hr !== undefined && last.hr > DEMO_HR_ESCALATE) || falling || /worse/i.test(last.note ?? ''));
  if (esc) {
    const why = last.spo2 !== undefined && last.spo2 < DEMO_SPO2_ESCALATE ? `blood oxygen ${last.spo2}%` : last.hr !== undefined && last.hr > DEMO_HR_ESCALATE ? `heart rate ${last.hr} bpm` : falling ? 'blood oxygen falling' : 'patient reports feeling worse';
    const tag = `x-esc-${last.t}`;
    steps.push(
      { step: { id: `${tag}-lead`, role: 'lead', text: `Escalation: ${why}. Follow the escalation section of the approved card.`, why: 'A demo escalation rule was met. Limits are demo values, not approved ones.', verify: 'clinical', ifCannot: 'Tell Earth immediately.' }, added: 'Added by CHIRON: escalation' },
      { step: { id: `${tag}-earth`, role: 'earth', text: `Send an urgent update to the flight surgeon: ${why}.`, why: 'Earth must know when the situation gets worse.', verify: 'confirm', ifCannot: 'Queue it as urgent.' }, added: 'Added by CHIRON: escalation' },
    );
    alerts.unshift(`Escalation: ${why} (demo rule).`);
  }

  // Adaptive: a repeat observation is due if none has been recorded for a while.
  const lastObs = last?.t ?? c.startedAt;
  if (procedure && Date.now() - lastObs > 60_000) {
    steps.push({ step: { id: `x-obs-${Math.floor((Date.now() - c.startedAt) / 60_000)}`, role: 'monitor', text: 'Next observation is due. Record blood oxygen, heart rate and how the patient feels.', why: procedure.monitoring[0] ?? 'Regular observations show whether things are improving.', verify: 'confirm', ifCannot: 'Ask another crew member.' }, added: 'Added by CHIRON: monitoring schedule (demo: every minute)' });
  }

  const relevant = (s: Step) => !s.when || c.outcomes[s.when.step]?.outcome === s.when.answer;
  const decided = (s: Step) => !s.when || !!c.outcomes[s.when.step];
  const settled = (id: string) => {
    const s = steps.find((x) => x.step.id === id)?.step;
    if (!s) return true;
    if (!decided(s)) return false;
    if (!relevant(s)) return true;
    return !!c.outcomes[id];
  };

  const tasks: Task[] = steps
    .filter(({ step }) => decided(step) ? relevant(step) : true)
    .map(({ step, added }) => {
      const o = c.outcomes[step.id]?.outcome;
      const waitingFor = (step.after ?? []).filter((id) => !settled(id));
      const unusable = (step.equipment ?? []).map((id) => checks.find((ch) => ch.itemId === id)).find((ch) => ch && !ch.ok && !ch.alternative);
      let status: TaskStatus = o === 'cannot' ? 'cannot' : o ? 'done' : !decided(step) || waitingFor.length ? 'waiting' : 'ready';
      if (status === 'ready' && unusable) status = 'blocked';
      return { step, status, assignee: roles[step.role].person, added, waitingFor, blockedBy: unusable ? `${unusable.name} is ${unusable.status}` : undefined };
    });

  return { procedure, missing: reason, roles, warnings, checks, tasks, alerts, patient };
}

// ---------- Timeline from the log ----------

export function timelineFor(c: EmergencyCase, log: ChironEvent[], plan: Plan): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  const stepText = (id: string) => plan.tasks.find((t) => t.step.id === id)?.step.text ?? id;
  for (const e of log) {
    if ('eid' in e && e.eid !== c.eid) continue;
    if (e.type === 'start' && e.eid === c.eid) out.push({ time: e.t, who: name(e.by), kind: 'report', text: `Emergency reported for ${name(e.patientId)}${e.reason ? ` (${e.reason})` : ''}.` });
    if (e.type === 'step') out.push({ time: e.t, who: name(e.by), kind: e.outcome === 'cannot' ? 'warning' : 'task', text: e.outcome === 'yes' || e.outcome === 'no' ? `Answered ${e.outcome.toUpperCase()}: ${plan.tasks.find((t) => t.step.id === e.stepId)?.step.ask?.question ?? ''}` : `${e.outcome === 'cannot' ? 'Could not complete' : 'Done'}: ${stepText(e.stepId)}` });
    if (e.type === 'verify') out.push({ time: e.t, who: name(e.by), kind: 'assessment', text: `Medical lead verified: ${stepText(e.stepId)}` });
    if (e.type === 'vitals') out.push({ time: e.t, who: name(e.by), kind: 'assessment', text: `Observation: ${[e.spo2 !== undefined && `SpO2 ${e.spo2}%`, e.hr !== undefined && `HR ${e.hr} bpm`, e.note].filter(Boolean).join(' · ')}` });
    if (e.type === 'item' && e.mission === c.mission && e.t >= c.startedAt) out.push({ time: e.t, who: name(e.by), kind: 'equipment', text: e.note });
    if (e.type === 'crew' && e.t >= c.startedAt) out.push({ time: e.t, who: name(e.by), kind: 'status', text: `${name(e.crewId)} marked ${e.available ? 'available' : 'unavailable'}. Roles updated.` });
    if (e.type === 'message') {
      // Messages from Earth appear only once they have actually arrived.
      if (e.message.direction === 'in') { if (e.message.arrivesAt <= Date.now()) out.push({ time: e.message.arrivesAt, who: 'Earth', kind: 'earth', text: `From Earth: ${e.message.title}` }); }
      else out.push({ time: e.t, who: name(e.by), kind: 'earth', text: `To Earth: ${e.message.title}` });
    }
    if (e.type === 'link' && e.t >= c.startedAt) out.push({ time: e.t, who: name(e.by), kind: 'status', text: e.lost ? 'Link to Earth lost. Reports queued.' : 'Link to Earth restored. Queued reports sent.' });
    if (e.type === 'end') out.push({ time: e.t, who: name(e.by), kind: 'status', text: 'Stood down.' });
  }
  return out.sort((a, b) => b.time - a.time);
}

export { roleName };
export const rolesOf = (roles: Roles, crewId: string) => (Object.keys(roles) as RoleId[]).filter((r) => roles[r].person?.id === crewId);
