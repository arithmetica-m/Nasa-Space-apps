import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, CircleDashed, Siren, ShieldCheck } from 'lucide-react';
import type { DemoMedicalProfile, Procedure, RoleId } from '../../emergency/types';
import { DELAY_MIN, buildPlan, casesFrom, crewNow, roleName, rolesOf } from '../../emergency/plan';
import { publish, useLog, useSyncStatus } from '../../emergency/sync';
import { newId } from '../../emergency/events';
import { crew } from '../../emergency/data';
import { NEXT_STEP_EVENT, speak } from '../VoiceControl';

const categoryLabel = {
  dcs: 'Pressure or EVA concern',
  respiratory: 'Breathing difficulty',
  anaphylaxis: 'Allergic reaction',
  behavioral: 'Crew support',
};

function isDemoMedicalProfile(value: unknown): value is DemoMedicalProfile {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return ['allergies', 'medications', 'restrictions', 'history'].every((field) => Array.isArray(record[field]))
    && ['author', 'version', 'baselineNotes', 'updatedAt'].every((field) => typeof record[field] === 'string')
    && ['sample', 'draft', 'demo-reviewed'].includes(String(record.status))
    && (record.reviewedAt === undefined || typeof record.reviewedAt === 'string');
}

function localMedicalProfile(crewId: string): DemoMedicalProfile | undefined {
  try {
    const raw = localStorage.getItem(`chiron-medical-profile-v1-${crewId}`);
    if (!raw) return undefined;
    const value: unknown = JSON.parse(raw);
    if (!isDemoMedicalProfile(value)) {
      console.warn('Ignoring malformed local demo medical profile.');
      return undefined;
    }
    return value;
  } catch (error) {
    console.warn('Could not read the local demo medical profile.', error);
    return undefined;
  }
}

interface Props {
  eid: string;
  kb: Procedure[];
  account: string;
  onLeave: () => void;
}

export function Response({ eid, kb, account, onLeave }: Props) {
  const log = useLog();
  const sync = useSyncStatus();
  const cases = useMemo(() => casesFrom(log), [log]);
  const c = cases.find((item) => item.eid === eid);
  const plan = useMemo(() => c ? buildPlan(c, kb, log, cases) : undefined, [c, kb, log, cases]);
  const [cannot, setCannot] = useState<string>();
  const [accessReason, setAccessReason] = useState('Emergency assessment');
  const [medicalAccessed, setMedicalAccessed] = useState(false);
  const advanceStepRef = useRef<() => 'advanced' | 'answer' | 'waiting' | 'none'>(() => 'none');
  useEffect(() => {
    const onNextStep = () => {
      const result = advanceStepRef.current();
      speak(result === 'advanced' ? 'Moving to the next step.'
        : result === 'answer' ? 'Please answer the question on screen.'
          : result === 'waiting' ? 'This step is waiting for your crew.'
            : 'There are no more steps for you.');
    };
    window.addEventListener(NEXT_STEP_EVENT, onNextStep);
    return () => window.removeEventListener(NEXT_STEP_EVENT, onNextStep);
  }, []);

  if (!c || !plan) return null;
  if (c.ended) {
    return (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-void text-center">
        <div className="font-serif text-2xl tracking-[0.1em] text-marble">SUPPORT RESPONSE CLOSED</div>
        <p className="text-marble/70">The response lead closed this scenario. Return to the mission overview.</p>
        <button onClick={onLeave} className="bg-marble px-5 py-3 font-mono text-xs tracking-wider text-void">BACK TO WATCH</button>
      </div>
    );
  }

  const me = crewNow(log).find((member) => member.id === account);
  const patientRecord = crew.find((member) => member.id === c.patientId);
  const localProfile = localMedicalProfile(c.patientId);
  const reviewedMedical = localProfile?.status === 'demo-reviewed' ? localProfile : undefined;
  const relevantMedical = reviewedMedical ?? {
    allergies: patientRecord?.medical.allergies ?? [],
    medications: patientRecord?.medical.medications ?? [],
    restrictions: patientRecord?.medical.restrictions ?? [],
    history: patientRecord?.medical.history ?? patientRecord?.medical.conditions ?? [],
    baselineNotes: patientRecord?.medical.notes ?? '',
  };
  const myRoles = rolesOf(plan.roles, account);
  const isPatient = c.patientId === account;
  const isLead = myRoles.includes('lead');
  const isMedicalAccessAuthorized = isLead || !!me?.qualifications.some((qualification) => qualification === 'cmo' || qualification === 'cmo-backup');
  const mine = plan.tasks.filter((task) => myRoles.includes(task.step.role));
  const activeTask = mine.find((task) => task.status === 'ready')
    ?? mine.find((task) => task.status === 'blocked')
    ?? mine.find((task) => task.status === 'waiting');
  const latest = [...c.vitals].reverse()[0];

  const complete = (stepId: string, outcome: 'done' | 'cannot' | 'yes' | 'no') => {
    publish({ type: 'step', eid, by: account, stepId, outcome });
    setCannot(undefined);
  };
  const advanceStep = (): 'advanced' | 'answer' | 'waiting' | 'none' => {
    if (activeTask?.status === 'ready' && activeTask.step.ask) return 'answer';
    if (activeTask?.status === 'ready') {
      if (activeTask.step.verify === 'clinical' && !c.verified.has(activeTask.step.id)) return 'waiting';
      complete(activeTask.step.id, 'done');
      return 'advanced';
    }
    return activeTask ? 'waiting' : 'none';
  };
  advanceStepRef.current = advanceStep;
  const reportStatus = () => {
    const finished = plan.tasks.filter((task) => task.status === 'done').length;
    const message = {
      id: newId(),
      direction: 'out' as const,
      authority: 'chiron' as const,
      title: 'Crew medical status update',
      body: `${finished} of ${plan.tasks.length} scenario actions marked complete. ${latest?.note ? 'Crew observation recorded.' : 'No new crew observation recorded.'}`,
      sentAt: Date.now(),
      arrivesAt: Date.now() + DELAY_MIN[c.mission] * 60_000,
    };
    publish({ type: 'message', eid, by: account, message });
  };
  const openMedicalRecord = () => {
    publish({ type: 'medical-access', eid, by: account, patientId: c.patientId, reason: accessReason });
    setMedicalAccessed(true);
  };
  const medicalAccessEvents = log.filter((event) => event.type === 'medical-access' && event.eid === eid && event.patientId === c.patientId);

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto bg-[#080b11]" style={{ animation: 'fade-in 0.3s ease-out' }}>
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-[#e45b5b]/50 bg-[#100c10]/95 px-4 py-4 backdrop-blur md:px-8">
        <Siren className="shrink-0 animate-pulse text-[#ff8585]" size={20} />
        <div className="mr-auto min-w-0">
          <div className="font-mono text-[10px] tracking-[0.2em] text-[#ff8585]">EMERGENCY · {sync === 'relay' ? 'CREW CONNECTED' : 'LOCAL RESPONSE'}</div>
          <h1 className="mt-1 truncate text-lg font-semibold text-marble md:text-xl">{plan.patient.name} · {categoryLabel[c.category]}</h1>
        </div>
        <button onClick={onLeave} className="flex min-h-11 items-center gap-2 border border-marble/25 px-3 text-xs text-marble/75 hover:border-marble/50"><ArrowLeft size={14} /> OVERVIEW</button>
        {isLead && <button onClick={() => publish({ type: 'end', eid, by: account })} className="min-h-11 border border-marble/40 px-4 text-xs text-marble hover:border-marble">CLOSE RESPONSE</button>}
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 p-4 pb-10 md:p-8">
        <section className="mb-4 border border-marble/10 bg-marble/[0.03] p-3">
          <p className="text-xs font-mono tracking-wider text-marble/65">
            {plan.missing ? 'NO GUIDE · USE APPROVED PAPER INSTRUCTIONS' : 'TRAINING GUIDE · FOLLOW APPROVED MISSION INSTRUCTIONS'}
          </p>
        </section>

        {plan.alerts[0] && <p role="alert" className="mb-4 border-l-4 border-[#e45b5b] bg-[#e45b5b]/10 px-4 py-3 text-lg font-medium text-marble">{plan.alerts[0]}</p>}
        {(plan.warnings.length > 0 || plan.alerts.length > 1) && (
          <details className="mb-4 border border-[#e39b4b]/40 p-3 text-sm text-[#f3c28d]">
            <summary className="cursor-pointer">Important notes</summary>
            <p className="mt-2">{[...plan.warnings, ...plan.alerts.slice(1)].join(' ')}</p>
          </details>
        )}

        {!isPatient && isMedicalAccessAuthorized && (
          <details className="mb-4 border border-[#e5c27b]/40 bg-[#e5c27b]/[0.04] p-4">
            <summary className="cursor-pointer font-semibold text-[#e5c27b]">Emergency medical summary</summary>
            <div className="font-mono text-[10px] tracking-[0.17em] text-[#e5c27b]">RESTRICTED · EMERGENCY ACCESS</div>
            <h2 id="medical-record-access-title" className="mt-1 text-base font-semibold text-marble">Relevant medical summary · {plan.patient.name}</h2>
            <p className="mt-1 text-xs text-marble/55">Visible only during this active response to the assigned response lead or designated medical crew role. Access is recorded in the shared event log. All example records are simulated. This prototype role-gating is not production security.</p>
            <p className="mt-1 text-[10px] text-[#e5c27b]">{reviewedMedical ? `Demo-reviewed profile · v${reviewedMedical.version} · ${reviewedMedical.author} · ${reviewedMedical.reviewedAt ? new Date(reviewedMedical.reviewedAt).toLocaleString() : 'date unavailable'}` : localProfile?.status === 'draft' ? 'A local profile draft exists but is not shown as reviewed; displaying seeded demo data only.' : 'No demo-reviewed local profile; displaying seeded demo data only.'}</p>
            {!medicalAccessed ? (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="min-w-[220px] flex-1 text-xs text-marble/70">
                  Reason for access
                  <select value={accessReason} onChange={(event) => setAccessReason(event.target.value)} className="mt-1 min-h-11 w-full border border-marble/20 bg-[#080b11] px-3 text-sm text-marble">
                    <option>Emergency assessment</option>
                    <option>Check allergy or medication relevance</option>
                    <option>Review medical restriction or history</option>
                  </select>
                </label>
                <button type="button" onClick={openMedicalRecord} className="min-h-11 border border-[#e5c27b]/60 px-4 text-xs font-semibold tracking-wider text-[#e5c27b] hover:bg-[#e5c27b]/10">ACCESS & RECORD</button>
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  ['Allergies', relevantMedical.allergies],
                  ['Medications', relevantMedical.medications],
                  ['Restrictions', relevantMedical.restrictions],
                  ['Relevant history', relevantMedical.history],
                ].map(([label, values]) => (
                  <div key={String(label)} className="border border-marble/10 p-3">
                    <div className="font-mono text-[9px] tracking-wider text-marble/45">{label}</div>
                    <div className="mt-1 text-sm text-marble">{Array.isArray(values) && values.length ? values.join(', ') : 'None recorded in this demo profile'}</div>
                  </div>
                ))}
              </div>
            )}
            {medicalAccessEvents.length > 0 && (
              <details className="mt-3 border-t border-marble/10 pt-2">
                <summary className="cursor-pointer text-xs text-marble/60">Access audit · {medicalAccessEvents.length} event(s)</summary>
                <ul className="mt-2 space-y-1 text-[11px] text-marble/55">
                  {medicalAccessEvents.map((event) => event.type === 'medical-access' && <li key={event.id}>{new Date(event.t).toLocaleString()} · {crew.find((member) => member.id === event.by)?.name ?? event.by} · {event.reason}</li>)}
                </ul>
              </details>
            )}
          </details>
        )}

        {isPatient ? (
          <section className="border border-[#e45b5b]/40 bg-[#e45b5b]/[0.06] p-5 text-center md:p-8">
            <h2 className="text-2xl font-semibold text-marble">Your crew is helping you.</h2>
            <p className="mt-2 text-lg text-marble/70">Tell them if you feel better or worse.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button onClick={() => publish({ type: 'vitals', eid, by: account, note: 'Patient reports feeling worse' })} className="min-h-12 border-2 border-[#e45b5b]/70 px-5 text-sm text-[#ff9999]">I feel worse</button>
              <button onClick={() => publish({ type: 'vitals', eid, by: account, note: 'Patient reports feeling better' })} className="min-h-12 border border-marble/35 px-5 text-sm text-marble/80">I feel better</button>
            </div>
          </section>
        ) : activeTask ? (
          <section aria-labelledby="assigned-steps-heading" className="mx-auto w-full max-w-3xl">
            <div className="mb-3 font-mono text-[10px] tracking-[0.17em] text-[#ff8585]">YOUR NEXT STEP · {me?.name.toUpperCase()}</div>
            <div aria-live="polite" className={`min-h-64 border p-6 md:p-10 ${activeTask.status === 'blocked' ? 'border-[#e39b4b]/60 bg-[#e39b4b]/[0.06]' : 'border-[#e45b5b]/40 bg-[#101721]'}`}>
              <h2 id="assigned-steps-heading" className="text-2xl font-semibold leading-tight text-marble md:text-4xl">
                {activeTask.status === 'waiting'
                  ? 'Wait for your crew.'
                  : activeTask.status === 'blocked'
                    ? 'Get the medical lead.'
                    : activeTask.step.ask?.question ?? activeTask.step.text}
              </h2>
              {activeTask.status !== 'ready' && <p className="mt-4 text-lg text-[#f3c28d]">
                {activeTask.status === 'waiting' ? 'Another crew step must happen first.' : `Equipment unavailable: ${activeTask.blockedBy ?? 'check with the medical lead'}.`}
              </p>}
              {activeTask.status === 'ready' && activeTask.step.ask && (
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button onClick={() => complete(activeTask.step.id, 'yes')} className="min-h-14 border border-marble/35 text-lg text-marble">Yes</button>
                  <button onClick={() => complete(activeTask.step.id, 'no')} className="min-h-14 border border-marble/35 text-lg text-marble">No</button>
                </div>
              )}
              {activeTask.status === 'ready' && activeTask.step.verify === 'clinical' && (
                isLead
                  ? <label className="mt-5 flex items-center gap-3 text-base text-marble/80">
                    <input type="checkbox" checked={c.verified.has(activeTask.step.id)} disabled={c.verified.has(activeTask.step.id)} onChange={() => publish({ type: 'verify', eid, by: account, stepId: activeTask.step.id })} />
                    <ShieldCheck size={18} className="text-[#63c9a8]" /> Confirm approved instructions were followed
                  </label>
                  : <p className="mt-5 text-base text-marble/60">The medical lead must confirm this step.</p>
              )}
              {cannot === activeTask.step.id && (
                <div className="mt-5 border border-[#e39b4b]/50 p-4">
                  <p className="text-lg text-marble">{activeTask.step.ifCannot}</p>
                  <button onClick={() => complete(activeTask.step.id, 'cannot')} className="mt-4 min-h-12 bg-[#e39b4b] px-5 text-sm font-semibold text-[#17100a]">RECORD AND CONTINUE</button>
                </div>
              )}
              <div className="mt-7 flex flex-wrap gap-3">
                {activeTask.status === 'ready' && !activeTask.step.ask && (
                  <button onClick={() => { advanceStep(); }} disabled={activeTask.step.verify === 'clinical' && !c.verified.has(activeTask.step.id)}
                    className="flex min-h-14 flex-1 items-center justify-center gap-2 bg-[#e45b5b] px-5 text-lg font-semibold text-[#16090a] hover:bg-[#ff8585] disabled:opacity-40">
                    <Check size={20} /> NEXT STEP
                  </button>
                )}
                {activeTask.status === 'ready' && (
                  <button onClick={() => setCannot(cannot === activeTask.step.id ? undefined : activeTask.step.id)} className="min-h-14 border border-marble/25 px-5 text-base text-marble/75">I can’t do this</button>
                )}
              </div>
            </div>
            <div className="mt-2 text-right text-xs text-marble/45">Say “next step” to continue when this step is done.</div>
          </section>
        ) : (
          <section className="mx-auto w-full max-w-3xl border border-[#63c9a8]/30 bg-[#63c9a8]/[0.04] p-8 text-center">
            <CircleDashed className="mx-auto text-marble/35" size={30} />
            <h2 className="mt-3 text-2xl font-semibold text-marble">{mine.length ? 'Your steps are done.' : 'Stand by for your crew.'}</h2>
          </section>
        )}

        <details className="mt-5 border border-marble/10 bg-marble/[0.02]">
          <summary className="cursor-pointer px-4 py-3 text-sm text-marble/75">Crew assignments and Mission Control</summary>
          <div className="space-y-4 border-t border-marble/10 p-4">
            <ul className="grid gap-2 sm:grid-cols-2">
              {crewNow(log).map((member) => {
                const roles = rolesOf(plan.roles, member.id);
                const assigned = plan.tasks.filter((task) => roles.includes(task.step.role));
                const doneCount = assigned.filter((task) => task.status === 'done').length;
                return <li key={member.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-marble">{member.name}{member.id === account ? ' · you' : ''}</span>
                  <span className="text-right text-xs text-marble/50">{member.id === c.patientId ? 'Receiving support' : roles.length ? `${roles.map((role: RoleId) => roleName[role]).join(', ')} · ${doneCount}/${assigned.length}` : 'Stand by'}</span>
                </li>;
              })}
            </ul>
            <div className="border-t border-marble/10 pt-3">
              <div className="font-mono text-[9px] tracking-[0.14em] text-marble/45">MISSION CONTROL MEDICAL REPORT</div>
              {c.messages.filter((message) => message.direction === 'in' && message.arrivesAt <= Date.now()).length === 0
                ? <p className="mt-2 text-sm text-marble/50">No messages received.</p>
                : <ul className="mt-2 space-y-2">{c.messages.filter((message) => message.direction === 'in' && message.arrivesAt <= Date.now()).map((message) => (
                  <li key={message.id} className="border-l-2 border-[#8fb8ff]/70 pl-3">
                    <div className="text-sm text-marble">{message.title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-marble/60">{message.body}</p>
                  </li>
                ))}</ul>}
              <button onClick={reportStatus} className="mt-3 min-h-10 border border-marble/25 px-4 text-xs text-marble/75 hover:border-marble/50">Send status summary</button>
            </div>
          </div>
        </details>

        {isLead && plan.tasks.every((task) => task.status === 'done' || task.status === 'cannot') && (
          <button onClick={() => publish({ type: 'end', eid, by: account })} className="mt-5 min-h-12 w-full border border-[#63c9a8]/50 text-sm text-[#7bd5b8] hover:bg-[#63c9a8]/[0.06]">CLOSE COMPLETED RESPONSE</button>
        )}
      </main>
    </div>
  );
}
