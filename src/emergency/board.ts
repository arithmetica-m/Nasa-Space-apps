import type { CrewMember, RoleId } from './types';
import type { ChironEvent } from './events';
import { crewNow, roleName, rolesOf, type EmergencyCase, type Plan, type Task } from './plan';
import { crew as baseCrew } from './data';
import { WARNING_RULES, type LinkStatus } from '../link/link';
import { categoryText } from './report';
import { measurementError } from '../lib/measurementValidation';

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
  const stepText = (id: string) => { const s = plan.tasks.find((t) => t.step.id === id)?.step; return s ? s.summary ?? s.ask?.question ?? s.text : id; };
  for (const [id, o] of Object.entries(c.outcomes)) {
    out.push(o.outcome === 'cannot' ? { t: o.t, text: `${nameOf(o.by)} couldn't: ${stepText(id)}`, tone: 'amber' }
      : o.outcome === 'done' ? { t: o.t, text: `${nameOf(o.by)}: ${stepText(id)}`, tone: 'plain' }
        : { t: o.t, text: `${stepText(id)} — ${o.outcome.toUpperCase()} (${nameOf(o.by)})`, tone: 'plain' });
  }
  for (const m of c.measures) out.push({ t: m.t, text: `${plan.procedure?.measurements?.find((x) => x.key === m.key)?.label ?? m.key}: ${m.value} (${m.source === 'link' ? 'LINK band, simulated' : m.source === 'device' ? 'blood-pressure cuff, simulated' : `measured by ${nameOf(m.by)}`})`, tone: 'plain' });
  for (const [role, a] of Object.entries(c.assignments) as [RoleId, { crewId: string; t: number; by: string }][]) out.push({ t: a.t, text: `${roleName[role]} is now ${nameOf(a.crewId)} (changed by ${nameOf(a.by)})`, tone: 'amber' });
  for (const e of log) {
    if (e.type === 'confirm-roles' && e.eid === c.eid) out.push({ t: e.t, text: `Assignments confirmed by ${nameOf(e.by)}`, tone: 'plain' });
    if (e.type === 'vitals' && e.eid === c.eid) out.push({ t: e.t, text: `${nameOf(e.by)} observed: ${e.note}`, tone: /worse|harder|not responding/i.test(e.note ?? '') ? 'red' : 'plain' });
    if (e.type === 'verify' && e.eid === c.eid) out.push({ t: e.t, text: `${nameOf(e.by)} confirmed: ${stepText(e.stepId)}`, tone: 'plain' });
  }
  for (const m of c.messages) {
    if (m.direction === 'in' && m.arrivesAt <= now) out.push({ t: m.arrivesAt, text: `Earth: ${m.body}`, tone: 'plain' });
    if (m.report?.n === 1 && m.sentAt) out.push({ t: m.sentAt, text: 'First report sent to Earth. Updates follow automatically.', tone: 'plain' });
  }
  return out.sort((a, b) => b.t - a.t);
}

// Patient summary: only recorded findings, readings, and treatment responses appear here.
export interface SituationLine { text: string; tone: 'red' | 'amber' | 'plain'; t?: number }
export function situation(c: EmergencyCase, plan: Plan, states: { m: { key: string; label: string }; value?: string; t?: number; live?: boolean; source?: string }[], log: ChironEvent[], patientLink?: LinkStatus): SituationLine[] {
  const out: SituationLine[] = [{ text: `Reported event: ${categoryText[c.category]}`, tone: 'amber', t: c.startedAt }];
  if (c.reason && !/voice/i.test(c.reason)) out.push({ text: `Symptoms: ${c.reason}`, tone: 'plain', t: c.startedAt });

  const steps = new Map((plan.procedure?.steps ?? []).map((step) => [step.id, step]));
  for (const [stepId, outcome] of Object.entries(c.outcomes)) {
    const step = steps.get(stepId);
    // Hand-written finding first; otherwise the answer, the treatment recorded, or what could not be done.
    const text = step?.findings?.[outcome.outcome]
      ?? (step?.ask && (outcome.outcome === 'yes' || outcome.outcome === 'no') ? `${step.ask.question} ${outcome.outcome.toUpperCase()}`
        : outcome.outcome === 'done' && step?.record ? `✓ ${step.record}`
          : outcome.outcome === 'cannot' && step ? `Could not be done: ${step.record ?? step.text}` : undefined);
    const bad = !!step?.ask?.bad && step.ask.bad === outcome.outcome;
    if (text) out.push({ text, tone: bad || /no improvement|could not|not improving/i.test(text) ? 'red' : 'plain', t: outcome.t });
  }

  const observationGroups: { key: string; labels: string[] }[] = [
    { key: 'breathing-sign', labels: ['Breathing difficulty observed', 'No breathing difficulty observed'] },
    { key: 'swelling', labels: ['Visible swelling observed', 'No visible swelling observed'] },
    { key: 'rash', labels: ['Rash observed', 'No rash observed'] },
    { key: 'faintness', labels: ['Faintness or collapse observed', 'No faintness or collapse observed'] },
    { key: 'alertness', labels: ['Awake and talking', 'Alert and responsive', 'Not responding'] },
    { key: 'breathing-trend', labels: ['Breathing easier', 'Breathing harder'] },
  ];
  const observations = log.filter((e) => e.type === 'vitals' && e.eid === c.eid && e.note);
  for (const group of observationGroups) {
    const latest = [...observations].reverse().find((e) => e.type === 'vitals' && group.labels.includes(e.note ?? ''));
    if (latest?.type === 'vitals' && latest.note) {
      const tone = new Set(['Breathing difficulty observed', 'Visible swelling observed', 'Rash observed', 'Faintness or collapse observed', 'Not responding', 'Breathing harder']).has(latest.note) ? 'red' : 'plain';
      out.push({ text: latest.note, tone, t: latest.t });
    }
  }
  const recognized = new Set(observationGroups.flatMap((group) => group.labels));
  const latestOtherObservation = [...observations].reverse().find((event) => event.type === 'vitals' && event.note && !recognized.has(event.note));
  const otherNote = latestOtherObservation?.type === 'vitals' ? latestOtherObservation.note : undefined;
  if (latestOtherObservation?.type === 'vitals' && otherNote) {
    out.push({ text: otherNote, tone: /worse|harder|not responding/i.test(otherNote) ? 'red' : 'plain', t: latestOtherObservation.t });
  }

  // Latest valid readings only. Plausibility checks are data-quality safeguards, not diagnoses.
  for (const st of states) {
    if (st.value === undefined) continue;
    if (measurementError(st.m.key, st.value)) {
      out.push({ text: `${st.m.label}: recorded value needs checking; excluded from the summary.`, tone: 'amber', t: st.t });
      continue;
    }
    const n = parseFloat(st.value);
    const rule = WARNING_RULES.find((w) => w.key === st.m.key && Number.isFinite(n) && w.test(n));
    out.push({ text: `${st.m.label}: ${st.value}${rule ? ` · demo alert: ${rule.rule} (not a diagnosis)` : ''}`, tone: rule ? 'red' : 'plain', t: st.t });
  }
  if (patientLink && !patientLink.connected) out.push({ text: 'Wearable readings are offline; no current sensor values are available.', tone: 'amber' });
  return [out[0], ...out.slice(1).filter((x) => x.t).sort((a, b) => a.t! - b.t!), ...out.slice(1).filter((x) => !x.t)];
}
