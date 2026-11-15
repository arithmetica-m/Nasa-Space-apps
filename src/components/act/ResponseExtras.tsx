import { useState } from 'react';
import { ClipboardList, Watch } from 'lucide-react';
import type { CrewMember, Measurement, Qualification, RoleId } from '../../emergency/types';
import { DELAY_MIN, crewNow, roleName, type EmergencyCase, type Plan } from '../../emergency/plan';
import { publish } from '../../emergency/sync';
import type { ChironEvent } from '../../emergency/events';
import { crew } from '../../emergency/data';
import { ago, type LinkStatus } from '../../link/link';
import { medicalOf } from '../../library/advice';
import { Reasoning, type ReasonStep } from '../Reasoning';

const hm = (t: number) => `${new Date(t).toISOString().slice(11, 16)} GMT`;
const nameOf = (id: string) => crew.find((c) => c.id === id)?.name ?? id;

const QUAL: Record<Qualification, string> = {
  cmo: 'Crew Medical Officer', 'cmo-backup': 'backup Crew Medical Officer', 'life-support': 'life-support trained',
  eva: 'EVA trained', comms: 'trained on the medical communication link', 'peer-support': 'peer-support trained',
};

// ---------- Measurements ----------

export interface MeasureState { m: Measurement; value?: string; source?: string; t?: number; live?: boolean }

// What the medical team needs measured, and what is still missing. LINK values count only while the band is live.
export function measureStates(c: EmergencyCase, plan: Plan, patientLink?: LinkStatus): MeasureState[] {
  return (plan.procedure?.measurements ?? [])
    .filter((m) => {
      const after = m.afterStep ? (Array.isArray(m.afterStep) ? m.afterStep : [m.afterStep]) : [];
      return !after.length || after.some((stepId) => c.outcomes[stepId]?.outcome === 'done');
    })
    .map((m) => {
    const rec = [...c.measures].reverse().find((x) => x.key === m.key);
    if (rec) return { m, value: rec.value, source: rec.source === 'link' ? 'LINK wearable (simulated), added to the record' : `entered by ${nameOf(rec.by)}`, t: rec.t };
    const lr = m.source === 'link' ? patientLink?.readings.find((r) => r.key === m.key) : undefined;
    if (lr && lr.value !== undefined && lr.live) return { m, value: `${lr.value} ${lr.unit}`, source: 'LINK wearable, live (simulated)', t: lr.t, live: true };
    return { m };
  });
}

export function Measurements({ eid, account, states, patientLink, now }: { eid: string; account: string; states: MeasureState[]; patientLink?: LinkStatus; now: number }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  if (!states.length) return null;
  const missing = states.filter((s) => s.value === undefined).length;
  const record = (key: string, value: string, source: 'manual' | 'link') => {
    if (!value.trim()) return;
    publish({ type: 'measure', eid, by: account, key, value: value.trim(), source });
    setDraft((d) => ({ ...d, [key]: '' }));
  };
  return (
    <section className="border border-marble/15 bg-[#101721] p-4" aria-labelledby="measure-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="measure-title" className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-marble/70"><ClipboardList size={16} /> MEASUREMENTS</h2>
        <span className={`font-mono text-xs tracking-[0.15em] ${missing ? 'text-[#f3c28d]' : 'text-[#7bd5b8]'}`}>{missing ? `${missing} STILL NEEDED` : 'ALL COLLECTED'}</span>
      </div>
      {patientLink && !patientLink.connected && <p className="mt-2 text-sm text-[#f3c28d]"><Watch size={14} className="mr-1 inline" />The patient’s LINK band is offline ({ago(patientLink.lastSync, now)}). Take every reading by hand.</p>}
      <ul className="mt-3 divide-y divide-marble/10">
        {states.map((s) => (
          <li key={s.m.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
            <span className="min-w-[200px] flex-1 text-xl text-marble">{s.m.label}</span>
            {s.value !== undefined ? (
              <span className="text-right">
                <span className="text-xl text-marble">{s.value}</span>
                <span className="block text-xs text-marble/50">{s.source}{s.t ? ` · ${hm(s.t)}` : ''}</span>
                {s.live && <button type="button" onClick={() => record(s.m.key, s.value!, 'link')} className="mt-1 min-h-12 border-2 border-gold/70 px-4 text-base font-semibold text-gold">SAVE TO THE RECORD</button>}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs tracking-[0.15em] text-[#f3c28d]">NEEDED</span>
                <input value={draft[s.m.key] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [s.m.key]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && record(s.m.key, draft[s.m.key] ?? '', 'manual')}
                  placeholder={s.m.unit ?? 'type it'} aria-label={s.m.label} className="min-h-14 w-36 border-2 border-marble/30 bg-transparent px-3 text-xl text-marble" />
                <button type="button" onClick={() => record(s.m.key, draft[s.m.key] ?? '', 'manual')} className="min-h-14 border-2 border-gold/70 px-5 text-lg font-semibold text-gold">SAVE</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-mute">Missing readings are shown as needed, never estimated. Everything recorded goes into the next report to Earth.</p>
    </section>
  );
}

// ---------- Crew roles: suggestion, reasons, and the crew's own choice ----------

export function roleReasons(role: RoleId, person: CrewMember | undefined, plan: Plan, c: EmergencyCase, links: Record<string, LinkStatus>): string[] {
  if (!person) return ['Nobody is available for this role.'];
  const l = links[person.id];
  const pl = links[c.patientId];
  const out = [
    `Training: ${person.qualifications.map((q) => QUAL[q]).join(', ') || 'none recorded'}.`,
    plan.roles[role].note ? `Rule: ${plan.roles[role].note}.` : 'Rule: first free crew member with the right training.',
    l ? (pl && l.location === pl.location ? `Location: in the ${l.location}, with the patient.` : `Location: ${l.connected ? '' : 'last known '}${l.location}${pl ? ` (patient in the ${pl.location})` : ''}.`) : 'Location: unknown.',
    l ? `Current work: ${l.activity}.` : 'Current work: unknown.',
  ];
  if (l && !l.connected) out.push('Their LINK band is offline: tell them in person.');
  return out;
}

export function CrewRoles({ eid, account, plan, c, links, log }: { eid: string; account: string; plan: Plan; c: EmergencyCase; links: Record<string, LinkStatus>; log: ChironEvent[] }) {
  const available = crewNow(log).filter((m) => m.available && m.id !== c.patientId);
  return (
    <ul className="space-y-3">
      {(Object.keys(plan.roles) as RoleId[]).map((role) => {
        const person = plan.roles[role].person;
        const l = person ? links[person.id] : undefined;
        return (
          <li key={role} className="border border-marble/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-base text-marble"><span className="text-marble/55">{roleName[role]}:</span> {person?.name ?? 'nobody'}{person?.id === account ? ' (you)' : ''}</span>
              <label className="flex items-center gap-2 text-sm text-marble/60">Change
                <select value={person?.id ?? ''} onChange={(e) => publish({ type: 'assign', eid, by: account, role, crewId: e.target.value })}
                  className="min-h-10 border border-marble/20 bg-[#080b11] px-2 text-sm text-marble">
                  {available.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
            </div>
            <p className={`text-sm ${l?.connected ? 'text-[#7bd5b8]' : 'text-[#f3c28d]'}`}>
              {l?.connected ? 'Task sent to their LINK band · receipt confirmed' : 'LINK offline: task not delivered, tell them in person'}
            </p>
            {c.assignments[role] && <p className="text-xs text-marble/50">Changed by {nameOf(c.assignments[role]!.by)} at {hm(c.assignments[role]!.t)}</p>}
            <Reasoning title="WHY THIS PERSON?" steps={[{ label: 'WHAT CHIRON CONSIDERED', lines: roleReasons(role, person, plan, c, links) }]} />
          </li>
        );
      })}
      <li className="text-xs text-mute">CHIRON suggests; the crew decides. Any change goes to every device and into the record.</li>
    </ul>
  );
}

// ---------- Handover ----------

export function handoverLines(c: EmergencyCase, plan: Plan, states: MeasureState[]) {
  const done = plan.tasks.filter((t) => t.status === 'done');
  const cannot = plan.tasks.filter((t) => t.status === 'cannot');
  const left = plan.tasks.filter((t) => t.status !== 'done' && t.status !== 'cannot');
  const answers = plan.tasks.filter((t) => t.step.ask && c.outcomes[t.step.id]);
  return {
    happened: `${plan.patient.name}: ${plan.procedure?.title ?? c.category}, reported by ${nameOf(c.startedBy)} at ${hm(c.startedAt)}.`,
    checked: answers.map((t) => `${t.step.ask!.question} → ${c.outcomes[t.step.id].outcome.toUpperCase()}`),
    done: done.map((t) => `${t.step.text} (${nameOf(c.outcomes[t.step.id].by)}, ${hm(c.outcomes[t.step.id].t)})`),
    measured: states.filter((s) => s.value !== undefined).map((s) => `${s.m.label}: ${s.value}`),
    left: left.map((t) => `${t.step.text}${t.status === 'blocked' ? ` (blocked: ${t.blockedBy})` : ''}`),
    uncertain: [
      ...states.filter((s) => s.value === undefined).map((s) => `Not measured yet: ${s.m.label}`),
      ...cannot.map((t) => `Could not be done: ${t.step.text}`),
      ...plan.alerts,
    ],
  };
}

export function Handover({ c, plan, states, onClose }: { c: EmergencyCase; plan: Plan; states: MeasureState[]; onClose?: () => void }) {
  const h = handoverLines(c, plan, states);
  const block = (title: string, items: string[], empty: string) => (
    <div>
      <div className="font-mono text-[11px] tracking-[0.2em] text-marble/50">{title}</div>
      {items.length ? <ul className="mt-0.5 space-y-0.5 text-base text-marble">{items.map((x) => <li key={x}>• {x}</li>)}</ul> : <p className="text-base text-marble/55">{empty}</p>}
    </div>
  );
  return (
    <section className="mb-5 border-2 border-[#8fb8ff]/60 bg-[#8fb8ff]/[0.06] p-4" aria-labelledby="handover-title">
      <h2 id="handover-title" className="font-mono text-xs tracking-[0.2em] text-[#8fb8ff]">HANDOVER: WHERE THINGS STAND</h2>
      <div className="mt-2 space-y-2">
        {block('WHAT HAPPENED', [h.happened], '')}
        {block('WHAT HAS BEEN CHECKED', h.checked, 'Nothing checked yet.')}
        {block('STEPS DONE', h.done, 'No steps done yet.')}
        {block('MEASUREMENTS AVAILABLE', h.measured, 'None yet.')}
        {block('STILL TO DO', h.left, 'Nothing left.')}
        {block('UNCERTAIN OR MISSING', h.uncertain, 'Nothing flagged.')}
      </div>
      {onClose && <button type="button" onClick={onClose} className="mt-3 min-h-11 bg-[#8fb8ff] px-4 font-mono text-xs tracking-[0.15em] text-[#0a1220]">I HAVE READ THIS</button>}
    </section>
  );
}

// ---------- The response planner: how CHIRON built this plan ----------

export function planReasoning(c: EmergencyCase, plan: Plan, states: MeasureState[], links: Record<string, LinkStatus>): ReasonStep[] {
  const med = medicalOf(c.patientId);
  const delay = DELAY_MIN[c.mission];
  const p = plan.procedure;
  return [
    { label: 'INFORMATION AVAILABLE', lines: [
      `Patient: ${plan.patient.name}. Allergies: ${med.allergies.join(', ') || 'none recorded'}. History: ${med.history.join(', ') || 'none recorded'}.`,
      ...states.filter((s) => s.value !== undefined).map((s) => `${s.m.label}: ${s.value} (${s.source}${s.t ? `, ${hm(s.t)}` : ''})`),
      ...plan.tasks.filter((t) => t.step.ask && c.outcomes[t.step.id]).map((t) => `${t.step.ask!.question} → ${c.outcomes[t.step.id].outcome}`),
    ] },
    { label: 'INFORMATION MISSING', lines: states.filter((s) => s.value === undefined).map((s) => s.m.label).concat(plan.tasks.filter((t) => t.step.ask && !c.outcomes[t.step.id]).map((t) => `Not answered: ${t.step.ask!.question}`)).map((x) => `• ${x}`).concat(['Missing information is never estimated.']) },
    { label: 'PROCEDURE CHOSEN', lines: p
      ? [`Emergency type reported by ${nameOf(c.startedBy)}: ${c.category}.`, `Used: ${p.id} “${p.title}” v${p.version}, the newest locally loaded version for this mission (${p.source.name}).`, 'This is a demo workflow, not a flight-approved protocol.']
      : [plan.missing ?? 'No procedure is loaded for this event.', 'CHIRON will not adapt another procedure on its own.'] },
    { label: 'EQUIPMENT CHECKED', lines: plan.checks.length ? plan.checks.map((ch) => `${ch.name}: ${ch.ok ? 'available' : ch.status}${!ch.ok && ch.alternative ? ` → approved alternative in the procedure: ${ch.alternative.name}` : !ch.ok ? ' → no approved alternative' : ''} (${ch.location})`) : ['No equipment listed.'] },
    { label: 'CREW SUGGESTED', lines: (Object.keys(plan.roles) as RoleId[]).map((r) => `${roleName[r]}: ${plan.roles[r].person?.name ?? 'nobody'}. ${roleReasons(r, plan.roles[r].person, plan, c, links).slice(0, 3).join(' ')}`) },
    { label: 'LIMITATIONS', lines: [
      `Earth delay ${delay} min each way${delay >= 5 ? ': the crew must act before Earth can answer' : ''}.`,
      ...plan.warnings,
      ...Object.values(links).filter((l) => !l.connected).map((l) => `${nameOf(l.crewId)}’s LINK band is offline.`),
    ] },
    { label: 'NEEDS MEDICAL CONFIRMATION', lines: [
      ...plan.tasks.filter((t) => t.step.verify === 'clinical').map((t) => `“${t.step.text}” must be confirmed by the medical lead.`),
      'This demo cannot replace a diagnosis or mission-approved treatment plan.',
    ] },
  ];
}

// RESPONSE PLANNER OVERVIEW: the seven things CHIRON connects into one plan, at a glance.
// ok = ready, warn = a limit to know about, missing = information or resource not there.
type Tone = 'ok' | 'warn' | 'missing';
const TONE: Record<Tone, string> = { ok: 'border-[#5cc8a8]/40 text-[#7bd5b8]', warn: 'border-[#e39b4b]/60 text-[#f3c28d]', missing: 'border-[#e45b5b]/60 text-[#ff8585]' };

export function PlannerOverview({ c, plan, states, links, phase }: { c: EmergencyCase; plan: Plan; states: MeasureState[]; links: Record<string, LinkStatus>; phase: string }) {
  const med = medicalOf(c.patientId);
  const delay = DELAY_MIN[c.mission];
  const have = states.filter((s) => s.value !== undefined).length;
  const missingKit = plan.checks.filter((ch) => !ch.ok && !ch.alternative);
  const altKit = plan.checks.filter((ch) => !ch.ok && ch.alternative);
  const helpers = crew.filter((m) => m.id !== c.patientId);
  const reachable = helpers.filter((m) => links[m.id]?.connected);
  const lead = plan.roles.lead.person;
  const people = new Set(plan.tasks.map((t) => plan.roles[t.step.role]?.person?.id).filter(Boolean)).size;

  const factors: { label: string; tone: Tone; text: string }[] = [
    { label: 'PATIENT', tone: have === states.length ? 'ok' : have ? 'warn' : 'missing', text: `${plan.patient.name.split(' ')[0]} · ${have} of ${states.length} measurements in` },
    { label: 'MEDICAL HISTORY', tone: med.allergies.length ? 'warn' : 'ok', text: med.allergies.length ? `Allergy: ${med.allergies.join(', ')}` : med.history.length ? med.history[0] : 'Nothing relevant on record' },
    { label: 'MISSION', tone: links[c.patientId]?.eva ? 'warn' : 'ok', text: `${phase}${links[c.patientId]?.eva ? ' · on EVA' : ''}` },
    { label: 'EQUIPMENT', tone: missingKit.length ? 'missing' : altKit.length ? 'warn' : 'ok', text: missingKit.length ? `${missingKit.length} item(s) missing` : altKit.length ? `${altKit.length} replaced by approved alternative` : `All ${plan.checks.length} item${plan.checks.length === 1 ? '' : 's'} available` },
    { label: 'CREW SKILLS', tone: lead && (lead.qualifications.includes('cmo') || lead.qualifications.includes('cmo-backup')) ? 'ok' : 'warn', text: lead ? `Lead: ${lead.name.split(' ')[0]}${lead.qualifications.includes('cmo') ? ' (medical officer)' : lead.qualifications.includes('cmo-backup') ? ' (backup medical officer)' : ' (not medically trained)'}` : 'No lead available' },
    { label: 'AVAILABILITY', tone: reachable.length === helpers.length ? 'ok' : 'warn', text: `${reachable.length} of ${helpers.length} helpers reachable on LINK` },
    { label: 'EARTH', tone: delay >= 5 ? 'warn' : 'ok', text: delay >= 5 ? `${delay} min each way: act first` : `${delay < 1 ? 'seconds' : `${delay} min`} delay: ask Earth` },
  ];

  return (
    <section aria-label="Response planner" className="mb-4 border border-gold/30 bg-gold/[0.03] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-xs tracking-[0.22em] text-gold">RESPONSE PLANNER</h2>
        <span className="text-sm text-marble/70">{plan.procedure ? `${plan.procedure.title} v${plan.procedure.version} · ${plan.tasks.length} steps · ${people} people · demo` : 'No procedure loaded: use mission instructions'}</span>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
        {factors.map((f) => (
          <li key={f.label} className={`border-l-4 bg-void/60 px-2 py-1.5 ${TONE[f.tone]}`}>
            <div className="font-mono text-[10px] tracking-[0.15em]">{f.label}</div>
            <div className="text-sm leading-snug text-marble">{f.text}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
