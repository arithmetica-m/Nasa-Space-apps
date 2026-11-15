import type { CrewMember, RoleId } from './types';
import type { ChironEvent } from './events';
import { crewNow, roleName, rolesOf, type EmergencyCase, type Plan, type Task } from './plan';
import { crew as baseCrew } from './data';
import type { LinkStatus } from '../link/link';

// THE EMERGENCY BOARD: who is assigned, who is available, and what happened, for the live
// emergency screen and for each person's CHIRON LINK band. Both read the same shared log,
// so they always show the same thing.

export type TaskState = 'NOT STARTED' | 'IN PROGRESS' | 'COMPLETED';
export type CrewState = 'PATIENT' | 'ASSIGNED' | 'AVAILABLE' | 'UNAVAILABLE';

export interface CrewLine {
  member: CrewMember;
  state: CrewState;
  roles: RoleId[];
  roleText: string;           // "Medical lead"
  responsibility: string;     // the step they are on, or their first step
  taskState?: TaskState;
  current?: Task;
  done: number;
  total: number;
  why?: string;               // why unavailable
}

const finished = (t: Task) => t.status === 'done' || t.status === 'cannot';

export function crewLines(c: EmergencyCase, plan: Plan, log: ChironEvent[], links: Record<string, LinkStatus>): CrewLine[] {
  return crewNow(log).map((member) => {
    const roles = rolesOf(plan.roles, member.id);
    const theirs = plan.tasks.filter((t) => roles.includes(t.step.role));
    const done = theirs.filter(finished).length;
    const current = theirs.find((t) => t.status === 'ready') ?? theirs.find((t) => t.status === 'blocked') ?? theirs.find((t) => t.status === 'waiting');
    const base = { member, roles, roleText: roles.map((r) => roleName[r]).join(' · '), done, total: theirs.length, current };
    if (member.id === c.patientId) return { ...base, state: 'PATIENT' as const, responsibility: '' };
    if (theirs.length) {
      const taskState: TaskState = done === theirs.length ? 'COMPLETED' : done > 0 || theirs.some((t) => t.status === 'ready') ? 'IN PROGRESS' : 'NOT STARTED';
      const show = current ?? theirs[theirs.length - 1];
      return { ...base, state: 'ASSIGNED' as const, taskState, responsibility: show.step.ask?.question ?? show.step.text };
    }
    const l = links[member.id];
    const why = !member.available ? 'marked unavailable' : l && !l.connected ? 'LINK band offline: check in person' : l?.eva ? 'on EVA' : undefined;
    return { ...base, state: why ? 'UNAVAILABLE' as const : 'AVAILABLE' as const, responsibility: '', why };
  });
}

export interface Update { t: number; text: string; tone: 'red' | 'amber' | 'plain' }
const nameOf = (id: string) => baseCrew.find((m) => m.id === id)?.name.split(' ')[0] ?? id;

// Everything that happened, newest first, each with its time.
export function liveUpdates(c: EmergencyCase, plan: Plan, log: ChironEvent[], now: number): Update[] {
  const out: Update[] = [{ t: c.startedAt, text: `Emergency started by ${nameOf(c.startedBy)}${c.reason ? ` (${c.reason})` : ''}`, tone: 'red' }];
  const stepText = (id: string) => { const s = plan.tasks.find((t) => t.step.id === id)?.step; return s ? s.ask?.question ?? s.text : id; };
  for (const [id, o] of Object.entries(c.outcomes)) {
    out.push(o.outcome === 'cannot' ? { t: o.t, text: `${nameOf(o.by)} could not do: ${stepText(id)}`, tone: 'amber' }
      : o.outcome === 'done' ? { t: o.t, text: `${nameOf(o.by)} finished: ${stepText(id)}`, tone: 'plain' }
        : { t: o.t, text: `${stepText(id)} → ${o.outcome.toUpperCase()} (${nameOf(o.by)})`, tone: 'plain' });
  }
  for (const m of c.measures) out.push({ t: m.t, text: `${plan.procedure?.measurements?.find((x) => x.key === m.key)?.label ?? m.key}: ${m.value} (${m.source === 'link' ? 'LINK band, simulated' : `measured by ${nameOf(m.by)}`})`, tone: 'plain' });
  for (const [role, a] of Object.entries(c.assignments) as [RoleId, { crewId: string; t: number; by: string }][]) out.push({ t: a.t, text: `${roleName[role]} is now ${nameOf(a.crewId)} (changed by ${nameOf(a.by)})`, tone: 'amber' });
  for (const e of log) {
    if (e.type === 'vitals' && e.eid === c.eid) out.push({ t: e.t, text: `${nameOf(e.by)} observed: ${e.note}`, tone: /worse|harder|not responding/i.test(e.note ?? '') ? 'red' : 'plain' });
    if (e.type === 'verify' && e.eid === c.eid) out.push({ t: e.t, text: `${nameOf(e.by)} confirmed: ${stepText(e.stepId)}`, tone: 'plain' });
  }
  for (const m of c.messages) {
    if (m.direction === 'in' && m.arrivesAt <= now) out.push({ t: m.arrivesAt, text: `Earth: ${m.body}`, tone: 'plain' });
    if (m.report?.n === 1 && m.sentAt) out.push({ t: m.sentAt, text: 'First report sent to Earth. Updates follow automatically.', tone: 'plain' });
  }
  return out.sort((a, b) => b.t - a.t);
}
