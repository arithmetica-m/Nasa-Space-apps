import type { Mission } from '../types';
import type { EmergencyCase, Plan } from './plan';
import { crew } from './data';

// The report CHIRON drafts and sends to Earth automatically during an emergency.
//
// What it is based on:
//  - NASA-STD-3001 Vol 1, 6.2 (V1 6002, V1 6003): medical messages to and from the ground are
//    PRIVATE medical communications; with a communication delay they are sent store-and-forward.
//  - NASA Exploration Medical Capability: ground flight surgeons and the crew share one
//    time-stamped medical record, so every update carries the full timeline, not just the news.
//  - The standard emergency handover order used by medical teams: what happened and when,
//    patient background, observations, actions taken (with times), problems, and what the
//    crew needs from the ground.
// No public NASA template exists for this report, so the layout is ours. CHIRON only reports
// what the crew recorded. It never adds a diagnosis or a treatment.

const gmt = (t: number) => `${new Date(t).toISOString().slice(11, 16)} GMT`;

export const categoryText = {
  dcs: 'Suspected decompression sickness after EVA',
  respiratory: 'Breathing or cabin air problem',
  anaphylaxis: 'Severe allergic reaction',
  behavioral: 'Acute psychological distress',
} as const;

export interface MedicalSummary { allergies: string[]; medications: string[]; restrictions: string[]; history: string[] }

// A short fingerprint of everything recorded so far. A new update is sent when it changes.
export const reportSignature = (c: EmergencyCase) =>
  JSON.stringify({
    outcomes: c.outcomes,
    vitals: c.vitals,
    measures: c.measures,
    verified: [...c.verified],
    assignments: c.assignments,
    ended: c.ended,
  });

export function buildEarthReport(c: EmergencyCase, plan: Plan, mission: Mission, medical: MedicalSummary, n: number, nextUpdateMin: number, missing: string[] = [], live: string[] = []) {
  const name = (id: string) => crew.find((m) => m.id === id)?.name ?? id;
  const p = plan.patient;
  const list = (xs: string[]) => (xs.length ? xs.join(', ') : 'none recorded');
  const done = plan.tasks.filter((t) => t.status === 'done' || t.status === 'cannot');
  const answers = plan.tasks.filter((t) => t.step.ask && c.outcomes[t.step.id]);
  const lead = plan.roles.lead.person;

  const lines: string[] = [];
  lines.push(`PRIVATE MEDICAL COMMUNICATION · ${mission.name} · mission day ${mission.today}`);
  lines.push(`${n === 1 ? 'Initial report' : `Update ${n}`} · sent automatically by CHIRON at ${gmt(Date.now())}`);
  lines.push('');
  lines.push('WHAT HAPPENED');
  lines.push(`• ${categoryText[c.category]}, reported by ${name(c.startedBy)} at ${gmt(c.startedAt)}${c.reason ? ` (${c.reason})` : ''}.`);
  lines.push(`• Status: ${c.ended ? 'response closed by the crew' : 'response in progress'}.`);
  lines.push('');
  lines.push('PATIENT');
  lines.push(`• ${p.name}, ${p.position}.`);
  lines.push(`• Allergies: ${list(medical.allergies)}. Medications: ${list(medical.medications)}.`);
  lines.push(`• Restrictions: ${list(medical.restrictions)}. Relevant history: ${list(medical.history)}.`);
  lines.push('');
  lines.push('OBSERVATIONS (as recorded by the crew)');
  if (!answers.length && !c.vitals.length && !c.measures.length && !live.length) lines.push('• None recorded yet. No measurements taken.');
  const label = (k: string) => plan.procedure?.measurements?.find((m) => m.key === k)?.label ?? k;
  for (const m of c.measures) lines.push(`• ${gmt(m.t)} ${label(m.key)}: ${m.value} (${m.source === 'link' ? 'LINK wearable, simulated' : m.source === 'device' ? 'blood-pressure cuff, simulated' : `entered by ${name(m.by)}`})`);
  for (const l of live) lines.push(`• ${l}`);
  if (missing.length) lines.push(`• NOT YET MEASURED: ${missing.join('; ')}.`);
  for (const t of answers) lines.push(`• ${gmt(c.outcomes[t.step.id].t)} ${t.step.ask!.question} → ${c.outcomes[t.step.id].outcome.toUpperCase()}`);
  for (const v of c.vitals) {
    const parts = [v.hr !== undefined ? `HR ${v.hr}` : '', v.spo2 !== undefined ? `SpO₂ ${v.spo2}%` : '', v.note ?? ''].filter(Boolean);
    lines.push(`• ${gmt(v.t)} ${parts.join(' · ')} (${name(v.by)})`);
  }
  lines.push('');
  lines.push(`ACTIONS TAKEN (${done.length} of ${plan.tasks.length} steps)`);
  if (!done.length) lines.push('• None completed yet.');
  for (const t of done) {
    const o = c.outcomes[t.step.id];
    lines.push(`• ${gmt(o.t)} ${o.outcome === 'cannot' ? 'COULD NOT DO: ' : ''}${t.step.text} (${name(o.by)})`);
  }
  const problems = [...plan.alerts, ...plan.tasks.filter((t) => t.status === 'blocked').map((t) => `${t.blockedBy}: blocks “${t.step.text}”`)];
  if (problems.length) {
    lines.push('');
    lines.push('PROBLEMS');
    for (const x of problems) lines.push(`• ${x}`);
  }
  lines.push('');
  lines.push('CREW');
  lines.push(`• Response lead: ${lead ? `${lead.name} (${plan.roles.lead.note || 'medical lead'})` : 'NO CLINICALLY TRAINED CREW AVAILABLE'}.`);
  lines.push('');
  lines.push('REQUEST TO EARTH');
  lines.push(plan.missing
    ? '• No matching procedure is loaded in the demo library. Please send mission direction.'
    : '• Please review and send mission guidance. The crew is following a demonstration workflow, not a flight-approved medical protocol.');
  if (!c.ended) lines.push(`• Next automatic update within ${nextUpdateMin} min, or sooner if anything changes.`);

  return {
    title: `${n === 1 ? 'Initial emergency report' : `Automatic update ${n}`} · ${p.name}`,
    body: lines.join('\n'),
  };
}
