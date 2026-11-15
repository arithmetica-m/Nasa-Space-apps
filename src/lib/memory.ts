import type { MissionId } from '../types';
import type { ChironEvent } from '../emergency/events';
import { casesFrom, roleName } from '../emergency/plan';
import type { RoleId } from '../emergency/types';
import { crew, procedures } from '../emergency/data';
import { indicators } from '../data/indicators';
import { categoryText } from '../emergency/report';
import { practiceRecords, SKILLS } from '../train/training';
import { ACTIVITIES, sessions } from '../recover/recovery';

// MISSION MEDICAL MEMORY: one structured, time-ordered record of medical events,
// rebuilt from the shared log and the records on this device. It records what happened,
// what was measured, what was done and what stayed uncertain, for later review and training.

export interface MemoryItem { t: number; kind: string; who: string; title: string; detail?: string; group?: string }

const stepText = (id: string) => procedures.flatMap((p) => p.steps).find((s) => s.id === id)?.text ?? `step ${id}`;
const measureName = (key: string) => procedures.flatMap((p) => p.measurements ?? []).find((m) => m.key === key)?.label ?? indicators.find((i) => i.id === key)?.name ?? key;
const short = (s: string) => (s.length > 90 ? `${s.slice(0, 88)}…` : s);

const name = (id: string) => crew.find((c) => c.id === id)?.name ?? id;

export function missionMemory(log: ChironEvent[], mission: MissionId, checkIns: Record<string, { at: number; symptoms: string[]; values: Record<string, number> }>, crewId?: string): MemoryItem[] {
  const out: MemoryItem[] = [];
  const mine = (id: string) => !crewId || id === crewId;

  for (const [id, ci] of Object.entries(checkIns)) {
    if (!mine(id)) continue;
    out.push({ t: ci.at, kind: 'Check-in', who: name(id), title: `Daily check-in (${Object.keys(ci.values).length} readings)`, detail: ci.symptoms.length ? `Symptoms: ${ci.symptoms.join(', ')}` : 'No symptoms' });
  }
  for (const m of crew) {
    if (!mine(m.id)) continue;
    try {
      const reports = JSON.parse(localStorage.getItem(`chiron-body-reports-v1-${m.id}`) ?? '[]') as { region: string; note: string; at: string }[];
      for (const r of reports) out.push({ t: Date.parse(r.at), kind: 'Symptom', who: m.name, title: `Reported: ${r.note}` });
    } catch { /* ignore unreadable local data */ }
  }
  for (const c of casesFrom(log).filter((x) => x.mission === mission)) {
    const involved = c.patientId === crewId || Object.values(c.outcomes).some((o) => o.by === crewId);
    if (crewId && !involved) continue;
    out.push({ t: c.startedAt, kind: 'Emergency', who: name(c.patientId), title: `${categoryText[c.category]}: ${name(c.patientId)}`, detail: c.ended ? 'closed' : 'still active', group: c.eid });
    for (const [step, o] of Object.entries(c.outcomes)) out.push({ t: o.t, kind: 'Step', who: name(o.by), title: `${o.outcome === 'cannot' ? 'Could not do' : o.outcome === 'done' ? 'Done' : `Answered ${o.outcome}`}: ${short(stepText(step))}`, detail: name(o.by), group: c.eid });
    for (const ms of c.measures) out.push({ t: ms.t, kind: 'Measurement', who: name(c.patientId), title: `${measureName(ms.key)}: ${ms.value}`, detail: ms.source === 'link' ? 'from LINK wearable' : ms.source === 'device' ? 'from simulated blood-pressure cuff' : `measured by ${name(ms.by)}`, group: c.eid });
    for (const [role, a] of Object.entries(c.assignments) as [RoleId, { crewId: string; t: number; by: string }][]) out.push({ t: a.t, kind: 'Task', who: name(a.crewId), title: `${roleName[role]}: ${name(a.crewId)}`, detail: `chosen by ${name(a.by)}`, group: c.eid });
    for (const e of log) if (e.type === 'medical-access' && e.eid === c.eid) out.push({ t: e.t, kind: 'Record', who: name(e.by), title: `${name(e.by)} opened ${name(e.patientId)}’s medical record`, detail: e.reason || undefined, group: c.eid });
    for (const msg of c.messages.filter((x) => x.report)) out.push({ t: msg.sentAt || c.startedAt, kind: 'Earth', who: 'CHIRON', title: `Sent to Earth: ${msg.title}`, group: c.eid });
  }
  for (const e of log) {
    if (e.type !== 'profile-access' || !mine(e.crewId)) continue;
    out.push({ t: e.t, kind: 'Access', who: name(e.by), title: `${name(e.by)} opened ${name(e.crewId)}’s medical profile`, detail: e.role === 'emergency' ? `emergency access: ${e.reason ?? 'no reason given'}` : 'medical officer access' });
  }
  for (const e of log) {
    if (e.type === 'capsule-entry' && mine(e.crewId)) out.push({ t: e.recordedAt, kind: 'Capsule', who: name(e.crewId), title: `Recorded on the band while offline: ${e.text}`, detail: `reconciled ${new Date(e.t).toISOString().slice(11, 16)} GMT` });
    if (e.type === 'capsule-resolve' && mine(e.crewId)) out.push({ t: e.t, kind: 'Capsule', who: name(e.crewId), title: `${e.field} reconciled: kept ${e.kept === 'core' ? 'the CORE version' : 'the band version'}`, detail: e.by === 'chiron' ? 'automatic: only the band had changed' : `chosen by ${name(e.by)}` });
    if (e.type === 'confirm-roles') { const c = casesFrom(log).find((x) => x.eid === e.eid); if (c && (!crewId || c.patientId === crewId)) out.push({ t: e.t, kind: 'Task', who: name(e.by), title: 'Assignments confirmed by the response lead', group: e.eid }); }
    if ((e.type === 'alert-ack' || e.type === 'alert-review') && mine(e.crewId)) out.push({ t: e.t, kind: 'Alert', who: name(e.by), title: `LINK warning ${e.type === 'alert-ack' ? 'acknowledged' : 'reviewed by a medical officer'}`, detail: e.by === 'shared-dashboard' ? 'from the shared dashboard' : name(e.by) });
    if ((e.type === 'baseline-proposal' || e.type === 'baseline') && mine(e.crewId)) out.push({ t: e.t, kind: 'Baseline', who: name(e.by), title: `${e.type === 'baseline' ? `Baseline v${e.version} approved` : 'Baseline change proposed'}: ${e.indicator} ${e.low}–${e.high}`, detail: e.reason });
  }
  for (const r of practiceRecords()) {
    if (!mine(r.crewId)) continue;
    out.push({ t: r.t, kind: 'Training', who: name(r.crewId), title: `Practised: ${SKILLS.find((s) => s.id === r.skillId)?.name ?? r.skillId}`, detail: `score ${r.score}/${r.total}` });
  }
  for (const m of crew) {
    if (!mine(m.id)) continue;
    for (const s of sessions(m.id)) out.push({ t: Date.parse(s.day), kind: 'Recovery', who: name(m.id), title: `Done: ${ACTIVITIES.find((a) => a.id === s.activityId)?.label ?? s.activityId}` });
  }
  return out.filter((x) => Number.isFinite(x.t)).sort((a, b) => b.t - a.t);
}
