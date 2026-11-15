import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, CircleDashed, Mic, Satellite, Siren, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import { missions } from '../../data/missions';
import { buildEarthReport, categoryText, reportSignature } from '../../emergency/report';
import { recordsFor } from '../../lib/crewHealth';
import { linkFor, withLinkEvents } from '../../link/link';
import { Reasoning } from '../Reasoning';
import { medicalOf } from '../../library/advice';
import { CrewRoles, Handover, Measurements, PlannerOverview, measureStates, planReasoning } from './ResponseExtras';
import { phaseOf } from '../MissionTimeline';
import type { DemoMedicalProfile, Procedure, RoleId } from '../../emergency/types';
import { DELAY_MIN, buildPlan, casesFrom, crewNow, roleName, rolesOf } from '../../emergency/plan';
import { publish, useLog, useSyncStatus } from '../../emergency/sync';
import { newId } from '../../emergency/events';
import { crew } from '../../emergency/data';
import { speak } from '../VoiceControl';
import { EMERGENCY_VOICE_EVENT, type EmergencyVoice } from '../../lib/voiceCommands';

type Tab = 'measure' | 'crew' | 'record' | 'earth' | 'plan';


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

const UPDATE_EVERY_MIN = 5; // demo interval
const hm = (t: number) => `${new Date(t).toISOString().slice(11, 16)} GMT`;

interface Props {
  eid: string;
  kb: Procedure[];
  account: string;
  onLeave: () => void;
  listening?: boolean;
  voiceSupported?: boolean;
  onVoice?: () => void;
}

export function Response({ eid, kb, account, onLeave, listening, voiceSupported, onVoice }: Props) {
  const log = useLog();
  const sync = useSyncStatus();
  const cases = useMemo(() => casesFrom(log), [log]);
  const c = cases.find((item) => item.eid === eid);
  const plan = useMemo(() => c ? buildPlan(c, kb, log, cases) : undefined, [c, kb, log, cases]);
  const [cannot, setCannot] = useState<string>();
  const [accessReason, setAccessReason] = useState('Emergency assessment');
  const [medicalAccessed, setMedicalAccessed] = useState(false);
  const [tab, setTab] = useState<Tab>();
  const [readAloud, setReadAloud] = useState(true);
  const [ending, setEnding] = useState(false);
  // Voice commands reach the newest version of the handler through this ref.
  const voiceRef = useRef<(action: NonNullable<EmergencyVoice['action']>) => void>(() => undefined);
  useEffect(() => {
    const onVoiceCommand = (e: Event) => { const d = (e as CustomEvent<EmergencyVoice>).detail; if (d?.action) voiceRef.current(d.action); };
    window.addEventListener(EMERGENCY_VOICE_EVENT, onVoiceCommand);
    return () => window.removeEventListener(EMERGENCY_VOICE_EVENT, onVoiceCommand);
  }, []);

  // ---- Automatic reports to Earth ----
  // The device that reported the emergency sends them. If it goes quiet for 6 minutes, any open device takes over.
  const [now, setNow] = useState(Date.now());
  const [reportOpen, setReportOpen] = useState(false);
  const sentRef = useRef(new Set<number>()); // never send the same update number twice
  const [handoverSeen, setHandoverSeen] = useState(false);
  const [showHandover, setShowHandover] = useState(false);
  // Every crew member's LINK band (simulated), for measurements, locations and task delivery.
  const links = useMemo(() => (c ? Object.fromEntries(crew.map((m) => [m.id, withLinkEvents(linkFor(m.id, recordsFor(missions[c.mission], m.id), now), log)])) : {}), [c?.mission, now, log]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);
  const reports = c ? c.messages.filter((m) => m.report) : [];
  const lastReport = reports[reports.length - 1];
  const sig = c ? reportSignature(c) : '';
  const amSender = !!c && (account === c.startedBy || (!!lastReport && now - lastReport.sentAt > 6 * 60_000));
  const sendReport = () => {
    if (!c || !plan) return;
    const medical = medicalOf(c.patientId);
    const n = Math.max(0, ...reports.map((m) => m.report!.n)) + 1;
    if (sentRef.current.has(n)) return;
    sentRef.current.add(n);
    const ms = measureStates(c, plan, links[c.patientId]);
    const missing = ms.filter((s) => s.value === undefined).map((s) => s.m.label);
    const live = ms.filter((s) => s.live).map((s) => `${hm(s.t!)} ${s.m.label}: ${s.value} (patient's LINK wearable, live, simulated)`);
    const r = buildEarthReport(c, plan, missions[c.mission], medical, n, UPDATE_EVERY_MIN, missing, live);
    const t = Date.now();
    publish({ type: 'message', eid, by: account, message: { id: newId(), direction: 'out', authority: 'chiron', title: r.title, body: r.body, sentAt: t, arrivesAt: t + DELAY_MIN[c.mission] * 60_000, report: { n, sig } } });
  };
  useEffect(() => {
    if (!c || !plan || !amSender) return;
    if (!lastReport) { sendReport(); return; }
    // Something new was recorded: send an update once things settle for a few seconds.
    if (lastReport.report!.sig !== sig) { const t = setTimeout(sendReport, 8000); return () => clearTimeout(t); }
    if (c.ended) return;
    // Nothing new: still send a regular update so Earth knows the situation.
    const t = setTimeout(sendReport, Math.max(0, lastReport.sentAt + UPDATE_EVERY_MIN * 60_000 - Date.now()));
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, lastReport?.id, amSender, !!c, !!plan]);

  if (!c || !plan) return null;
  if (c.ended) {
    return (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-void text-center">
        <div className="font-serif text-3xl tracking-[0.1em] text-marble">EMERGENCY ENDED</div>
        <p className="text-xl text-marble/70">Everything is saved in the medical log. Earth has the final report.</p>
        <button onClick={onLeave} className="min-h-16 bg-marble px-8 text-xl font-semibold text-void">BACK HOME</button>
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
  const states = measureStates(c, plan, links[c.patientId]);
  const myRoles = rolesOf(plan.roles, account);
  const isPatient = c.patientId === account;
  const isLead = myRoles.includes('lead');
  const isMedicalAccessAuthorized = isLead || !!me?.qualifications.some((qualification) => qualification === 'cmo' || qualification === 'cmo-backup');
  const mine = plan.tasks.filter((task) => myRoles.includes(task.step.role));
  const activeTask = mine.find((task) => task.status === 'ready')
    ?? mine.find((task) => task.status === 'blocked')
    ?? mine.find((task) => task.status === 'waiting');

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
  const allDone = plan.tasks.length > 0 && plan.tasks.every((task) => task.status === 'done' || task.status === 'cannot');
  const openMedicalRecord = () => {
    publish({ type: 'medical-access', eid, by: account, patientId: c.patientId, reason: accessReason });
    setMedicalAccessed(true);
  };
  const medicalAccessEvents = log.filter((event) => event.type === 'medical-access' && event.eid === eid && event.patientId === c.patientId);

  // ---- What this person should see right now ----
  const stepText = !activeTask ? '' : activeTask.status === 'waiting' ? 'Wait for your crew.' : activeTask.status === 'blocked' ? 'Get the medical lead.' : activeTask.step.ask?.question ?? activeTask.step.text;
  const needsConfirm = !!activeTask && activeTask.status === 'ready' && activeTask.step.verify === 'clinical' && !c.verified.has(activeTask.step.id);
  const doneCount = mine.filter((task) => task.status === 'done' || task.status === 'cannot').length;
  const minutes = Math.max(0, Math.round((now - c.startedAt) / 60_000));
  const missingCount = states.filter((s) => s.value === undefined).length;
  const earthLine = lastReport
    ? `${lastReport.report!.n === 1 ? 'First report' : `Update ${lastReport.report!.n}`} ${lastReport.arrivesAt <= now ? 'reached Earth' : lastReport.arrivesAt - now < 60_000 ? 'reaches Earth in seconds' : `reaches Earth in ${Math.round((lastReport.arrivesAt - now) / 60_000)} min`}`
    : 'Writing the first report…';
  const reply = [...c.messages].reverse().find((m) => m.direction === 'in' && m.arrivesAt <= now);

  // Voice: done / yes / no / can't / repeat / confirm, and for the patient: worse / better.
  voiceRef.current = (action) => {
    if (isPatient) {
      if (action === 'worse' || action === 'better') { publish({ type: 'vitals', eid, by: account, note: `Patient reports feeling ${action}` }); speak(`Your crew knows you feel ${action}.`); }
      else speak('Say worse or better.');
      return;
    }
    if (!activeTask) { speak('You have no step right now.'); return; }
    if (action === 'repeat') { speak(stepText); return; }
    if (activeTask.status !== 'ready') { speak(stepText); return; }
    if (action === 'yes' || action === 'no') {
      if (activeTask.step.ask) { complete(activeTask.step.id, action); speak(`Recorded: ${action}.`); } else speak('This step is not a question. Say done when it is finished.');
    } else if (action === 'cannot') { setCannot(activeTask.step.id); speak(activeTask.step.ifCannot ?? 'Tell the medical lead.'); }
    else if (action === 'confirm') {
      if (needsConfirm && isLead) { publish({ type: 'verify', eid, by: account, stepId: activeTask.step.id }); speak('Confirmed.'); } else speak('Nothing to confirm.');
    } else if (action === 'next') {
      const r = advanceStep();
      speak(r === 'advanced' ? 'Done.' : r === 'answer' ? 'Answer yes or no.' : needsConfirm ? (isLead ? 'Say confirm first.' : 'The medical lead must confirm this step.') : 'Waiting for your crew.');
    }
  };

  const TABS: { id: Tab; label: string; badge?: string; show: boolean }[] = [
    { id: 'measure', label: 'MEASURE', badge: missingCount ? `${missingCount} needed` : 'all in', show: !isPatient && states.length > 0 },
    { id: 'crew', label: 'CREW', show: true },
    { id: 'record', label: 'MEDICAL RECORD', show: !isPatient && isMedicalAccessAuthorized },
    { id: 'earth', label: 'EARTH', badge: reply ? 'reply' : undefined, show: true },
    { id: 'plan', label: 'PLAN', show: !isPatient },
  ];

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto bg-[#080b11]" style={{ animation: 'fade-in 0.3s ease-out' }}>
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b-2 border-[#e45b5b] bg-[#1a0c0e]/95 px-4 py-3 backdrop-blur md:px-8">
        <Siren className="shrink-0 animate-pulse text-[#ff8585]" size={28} />
        <div className="mr-auto min-w-0">
          <h1 className="truncate text-xl font-semibold text-marble md:text-2xl">{plan.patient.name} · {categoryText[c.category]}</h1>
          <div className="text-sm text-[#ff9c9c]">{minutes} min · {sync === 'relay' ? 'all crew devices connected' : 'this device only'} · {earthLine}</div>
        </div>
        {voiceSupported && (
          <button type="button" onClick={onVoice} aria-pressed={listening}
            className={`flex min-h-14 items-center gap-2 border-2 px-4 text-base ${listening ? 'border-[#5cc8a8] bg-[#5cc8a8]/15 text-[#7bd5b8]' : 'border-marble/30 text-marble/80'}`}>
            <Mic size={20} /> {listening ? 'LISTENING' : 'VOICE'}
          </button>
        )}
        <button type="button" onClick={() => setReadAloud(!readAloud)} aria-pressed={readAloud} aria-label="Read steps aloud"
          className={`flex min-h-14 items-center gap-2 border-2 px-4 text-base ${readAloud ? 'border-gold/70 text-gold' : 'border-marble/30 text-marble/60'}`}>
          {readAloud ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
        <button onClick={onLeave} className="flex min-h-14 items-center gap-2 border-2 border-marble/30 px-4 text-base text-marble/80 hover:border-marble/60"><ArrowLeft size={18} /> HOME</button>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 p-4 pb-28 md:p-6">
        {plan.alerts[0] && <p role="alert" className="border-l-4 border-[#e45b5b] bg-[#e45b5b]/10 px-4 py-3 text-xl font-medium text-marble">{plan.alerts[0]}</p>}
        {c.assignments.lead?.crewId === account && !handoverSeen && <Handover c={c} plan={plan} states={states} onClose={() => setHandoverSeen(true)} />}

        {/* THE ONE THING TO DO NOW */}
        {isPatient ? (
          <section className="border-2 border-[#e45b5b]/50 bg-[#e45b5b]/[0.06] p-6 text-center md:p-10">
            <h2 className="text-3xl font-semibold text-marble md:text-4xl">Your crew is helping you.</h2>
            <p className="mt-2 text-xl text-marble/75">{plan.roles.lead.person ? `${plan.roles.lead.person.name.split(' ')[0]} is leading.` : ''} Stay still and tell them how you feel.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button onClick={() => publish({ type: 'vitals', eid, by: account, note: 'Patient reports feeling worse' })} className="min-h-24 border-2 border-[#e45b5b] bg-[#e45b5b]/15 text-2xl font-semibold text-[#ffb3b3]">I FEEL WORSE</button>
              <button onClick={() => publish({ type: 'vitals', eid, by: account, note: 'Patient reports feeling better' })} className="min-h-24 border-2 border-[#5cc8a8]/70 text-2xl font-semibold text-[#9be3cc]">I FEEL BETTER</button>
            </div>
          </section>
        ) : plan.missing ? (
          <section role="alert" className="border-2 border-[#e39b4b]/70 bg-[#e39b4b]/[0.08] p-6 md:p-8">
            <h2 className="text-3xl font-semibold leading-tight text-marble md:text-4xl">CHIRON has no approved procedure for this on this mission.</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-7 text-2xl text-marble/90">
              <li>Use the paper emergency card.</li>
              <li>Stay with {plan.patient.name.split(' ')[0]}.</li>
              <li>Record measurements here: Earth gets them automatically.</li>
            </ol>
          </section>
        ) : activeTask ? (
          <section aria-labelledby="step-heading" aria-live="polite"
            className={`border-2 p-5 md:p-8 ${activeTask.status === 'ready' ? 'border-[#e45b5b]/70 bg-[#101721]' : 'border-[#e39b4b]/60 bg-[#e39b4b]/[0.06]'}`}>
            {readAloud && <SpeakStep key={`${activeTask.step.id}-${activeTask.status}`} text={stepText} />}
            <div className="flex flex-wrap items-center justify-between gap-2 text-base text-[#ff9c9c]">
              <span className="font-semibold tracking-wide">YOUR STEP {Math.min(doneCount + 1, mine.length)} OF {mine.length}</span>
              <span className="text-marble/60">{myRoles.map((r) => roleName[r]).join(' · ')}</span>
            </div>
            <div className="mt-2 flex gap-1" aria-hidden="true">{mine.map((t) => <span key={t.step.id} className={`h-2 flex-1 ${t.status === 'done' || t.status === 'cannot' ? 'bg-[#5cc8a8]' : t === activeTask ? 'bg-[#e45b5b]' : 'bg-marble/15'}`} />)}</div>

            <h2 id="step-heading" className="mt-5 text-3xl font-semibold leading-tight text-marble md:text-5xl">{stepText}</h2>
            {activeTask.status === 'ready' && activeTask.step.why && <p className="mt-3 text-lg text-marble/60">Why: {activeTask.step.why}</p>}
            {activeTask.status !== 'ready' && <p className="mt-4 text-xl text-[#f3c28d]">{activeTask.status === 'waiting' ? 'Another crew step must finish first. CHIRON will show your step as soon as it does.' : `Missing equipment: ${activeTask.blockedBy ?? 'ask the medical lead'}.`}</p>}

            {activeTask.status === 'ready' && activeTask.step.ask && (
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button onClick={() => complete(activeTask.step.id, 'yes')} className="min-h-24 border-2 border-marble/50 bg-marble/[0.06] text-3xl font-semibold text-marble hover:bg-marble/15">YES</button>
                <button onClick={() => complete(activeTask.step.id, 'no')} className="min-h-24 border-2 border-marble/50 bg-marble/[0.06] text-3xl font-semibold text-marble hover:bg-marble/15">NO</button>
              </div>
            )}

            {needsConfirm && (isLead
              ? <button type="button" onClick={() => publish({ type: 'verify', eid, by: account, stepId: activeTask.step.id })}
                  className="mt-6 flex min-h-20 w-full items-center justify-center gap-3 border-2 border-[#5cc8a8] bg-[#5cc8a8]/10 px-4 text-xl font-semibold text-[#9be3cc]"><ShieldCheck size={26} /> CONFIRM: THE CHECKLIST WAS FOLLOWED</button>
              : <p className="mt-6 border-l-4 border-[#e39b4b] bg-[#e39b4b]/10 px-4 py-3 text-xl text-[#f3c28d]">Waiting for {plan.roles.lead.person?.name.split(' ')[0] ?? 'the medical lead'} to confirm this step.</p>)}

            {activeTask.status === 'ready' && !activeTask.step.ask && !needsConfirm && (
              <button onClick={() => { advanceStep(); }} className="mt-6 flex min-h-24 w-full items-center justify-center gap-3 bg-[#e45b5b] px-5 text-3xl font-bold text-[#16090a] hover:bg-[#ff8585]"><Check size={34} strokeWidth={3} /> DONE</button>
            )}

            {cannot === activeTask.step.id ? (
              <div className="mt-4 border-2 border-[#e39b4b]/70 bg-[#e39b4b]/10 p-4">
                <p className="text-2xl text-marble">{activeTask.step.ifCannot ?? 'Tell the medical lead.'}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button onClick={() => complete(activeTask.step.id, 'cannot')} className="min-h-16 bg-[#e39b4b] px-5 text-xl font-semibold text-[#17100a]">RECORD AND GO ON</button>
                  <button onClick={() => setCannot(undefined)} className="min-h-16 border-2 border-marble/30 px-5 text-xl text-marble/80">BACK TO THE STEP</button>
                </div>
              </div>
            ) : activeTask.status === 'ready' && (
              <button onClick={() => setCannot(activeTask.step.id)} className="mt-3 min-h-16 w-full border-2 border-marble/25 px-5 text-xl text-marble/75 hover:border-marble/50">I CAN’T DO THIS</button>
            )}
            <p className="mt-3 text-center text-base text-marble/45">Voice: “done” · “yes” · “no” · “can’t” · “repeat”</p>
          </section>
        ) : (
          <section className="border-2 border-[#63c9a8]/40 bg-[#63c9a8]/[0.05] p-8 text-center">
            <CircleDashed className="mx-auto text-marble/40" size={36} />
            <h2 className="mt-3 text-3xl font-semibold text-marble">{mine.length ? 'Your steps are done.' : 'No task for you yet. Stay close.'}</h2>
            <p className="mt-2 text-xl text-marble/65">Watch the crew list below. CHIRON will show your step if you are needed.</p>
          </section>
        )}

        {/* WHO IS DOING WHAT: always in view */}
        <ul aria-label="Crew" className="grid gap-2 sm:grid-cols-2">
          {crewNow(log).map((member) => {
            const roles = rolesOf(plan.roles, member.id);
            const theirs = plan.tasks.filter((task) => roles.includes(task.step.role));
            const current = theirs.find((t) => t.status === 'ready') ?? theirs.find((t) => t.status === 'blocked') ?? theirs.find((t) => t.status === 'waiting');
            const finished = theirs.filter((t) => t.status === 'done' || t.status === 'cannot').length;
            const patient = member.id === c.patientId;
            const offline = links[member.id] && !links[member.id].connected;
            return (
              <li key={member.id} className={`border px-4 py-3 ${patient ? 'border-[#e45b5b]/50 bg-[#e45b5b]/[0.06]' : member.id === account ? 'border-gold/50' : 'border-marble/10'}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg text-marble">{member.name}{member.id === account ? ' (you)' : ''}</span>
                  <span className="text-sm text-marble/55">{patient ? 'PATIENT' : roles.length ? `${roles.map((r: RoleId) => roleName[r]).join(' · ')} · ${finished}/${theirs.length}` : 'standing by'}</span>
                </div>
                {!patient && <p className={`text-base ${current?.status === 'ready' ? 'text-marble/80' : 'text-marble/50'}`}>{current ? (current.status === 'ready' ? `Now: ${current.step.ask?.question ?? current.step.text}` : current.status === 'waiting' ? 'Waiting for another step' : 'Blocked: missing equipment') : theirs.length ? 'All steps done' : 'No task'}</p>}
                {offline && !patient && <p className="text-sm text-[#f3c28d]">Band offline: tell them in person.</p>}
              </li>
            );
          })}
        </ul>

        {!isPatient && <PlannerOverview c={c} plan={plan} states={states} links={links} phase={phaseOf(missions[c.mission])} />}

        {/* MORE: one panel open at a time */}
        <div role="tablist" aria-label="More" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {TABS.filter((t) => t.show).map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setTab(tab === t.id ? undefined : t.id)}
              className={`min-h-16 border-2 px-2 text-base font-semibold tracking-wide ${tab === t.id ? 'border-gold bg-gold/15 text-gold' : 'border-marble/20 text-marble/85 hover:border-marble/50'}`}>
              {t.label}{t.badge && <span className={`block text-sm font-normal ${t.badge.includes('needed') || t.badge === 'reply' ? 'text-[#f3c28d]' : 'text-marble/50'}`}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {tab === 'measure' && <Measurements eid={eid} account={account} states={states} patientLink={links[c.patientId]} now={now} />}

        {tab === 'crew' && (
          <section className="border border-marble/15 bg-[#101721] p-4">
            <h2 className="text-lg font-semibold text-marble">Change who does what</h2>
            <div className="mt-3"><CrewRoles eid={eid} account={account} plan={plan} c={c} links={links} log={log} /></div>
          </section>
        )}

        {tab === 'record' && (
          <section className="border border-[#e5c27b]/40 bg-[#e5c27b]/[0.04] p-4">
            <h2 className="text-lg font-semibold text-marble">{plan.patient.name}’s medical record</h2>
            <p className="text-base text-marble/60">Private. Opening it is written in the medical log with your name.</p>
            {!medicalAccessed ? (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="min-w-[220px] flex-1 text-base text-marble/70">Why do you need it?
                  <select value={accessReason} onChange={(event) => setAccessReason(event.target.value)} className="mt-1 min-h-14 w-full border border-marble/25 bg-[#080b11] px-3 text-lg text-marble">
                    <option>Emergency assessment</option>
                    <option>Check allergy or medication relevance</option>
                    <option>Review medical restriction or history</option>
                  </select>
                </label>
                <button type="button" onClick={openMedicalRecord} className="min-h-14 border-2 border-[#e5c27b]/70 px-5 text-lg font-semibold text-[#e5c27b] hover:bg-[#e5c27b]/10">OPEN THE RECORD</button>
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {([['Allergies', relevantMedical.allergies], ['Medications', relevantMedical.medications], ['Restrictions', relevantMedical.restrictions], ['History', relevantMedical.history]] as const).map(([label, values]) => (
                  <div key={label} className="border border-marble/10 p-3">
                    <div className="text-sm tracking-wide text-marble/50">{label.toUpperCase()}</div>
                    <div className="mt-1 text-xl text-marble">{values.length ? values.join(', ') : 'None recorded'}</div>
                  </div>
                ))}
              </div>
            )}
            {medicalAccessEvents.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-marble/10 pt-2 text-sm text-marble/60">
                {medicalAccessEvents.map((event) => event.type === 'medical-access' && <li key={event.id}>{hm(event.t)} · opened by {crew.find((member) => member.id === event.by)?.name ?? event.by} · {event.reason}</li>)}
              </ul>
            )}
          </section>
        )}

        {tab === 'earth' && (
          <section className="border border-[#8fb8ff]/40 bg-[#8fb8ff]/[0.06] p-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-marble"><Satellite size={20} className="text-[#8fb8ff]" /> Earth is updated automatically</h2>
            <p className="mt-1 text-lg text-marble">{earthLine}. <span className="text-marble/60">A new update goes when anything changes, at least every {UPDATE_EVERY_MIN} min. Private medical message.</span></p>
            {reply && <p className="mt-2 border-l-4 border-[#8fb8ff] bg-[#8fb8ff]/10 px-3 py-2 text-xl text-[#d7e4ff]">Earth: {reply.body}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={sendReport} className="min-h-14 border-2 border-[#8fb8ff]/60 px-5 text-lg text-[#d7e4ff] hover:bg-[#8fb8ff]/10">SEND AN UPDATE NOW</button>
              {lastReport && <button type="button" onClick={() => setReportOpen(!reportOpen)} className="min-h-14 border-2 border-marble/25 px-5 text-lg text-marble/80">{reportOpen ? 'HIDE THE REPORT' : 'SEE WHAT WAS SENT'}</button>}
            </div>
            {reportOpen && lastReport && <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap border border-marble/10 bg-void/70 p-3 font-sans text-base leading-relaxed text-marble/85">{lastReport.body}</pre>}
          </section>
        )}

        {tab === 'plan' && (
          <section className="space-y-3 border border-marble/15 bg-[#101721] p-4">
            <h2 className="text-lg font-semibold text-marble">{plan.procedure ? `${plan.procedure.title} · v${plan.procedure.version}` : 'No approved procedure'}</h2>
            <ol className="space-y-1">
              {plan.tasks.map((t, i) => (
                <li key={t.step.id} className={`flex gap-3 text-base ${t.status === 'done' ? 'text-marble/45' : 'text-marble/90'}`}>
                  <span className="w-6 shrink-0 text-right text-marble/50">{i + 1}</span>
                  <span className="flex-1">{t.step.ask?.question ?? t.step.text} <span className="text-sm text-marble/50">· {plan.roles[t.step.role]?.person?.name.split(' ')[0] ?? roleName[t.step.role]}{t.status === 'done' ? ' · done' : t.status === 'cannot' ? ' · could not do' : ''}</span></span>
                </li>
              ))}
            </ol>
            {(plan.warnings.length > 0 || plan.alerts.length > 1) && <p className="border-l-4 border-[#e39b4b] bg-[#e39b4b]/10 px-3 py-2 text-base text-[#f3c28d]">{[...plan.warnings, ...plan.alerts.slice(1)].join(' ')}</p>}
            <Reasoning title="HOW CHIRON BUILT THIS PLAN" steps={planReasoning(c, plan, states, links)} />
            <button type="button" onClick={() => setShowHandover(!showHandover)} className="min-h-14 w-full border-2 border-marble/25 px-4 text-lg text-marble/85">{showHandover ? 'HIDE THE HANDOVER SUMMARY' : 'HANDOVER SUMMARY (FOR WHOEVER TAKES OVER)'}</button>
            {showHandover && <Handover c={c} plan={plan} states={states} />}
          </section>
        )}

        {isLead && (
          ending ? (
            <div className="grid gap-3 border-2 border-[#e39b4b]/60 p-3 sm:grid-cols-2">
              <button onClick={() => publish({ type: 'end', eid, by: account })} className="min-h-16 bg-[#e39b4b] text-xl font-semibold text-[#17100a]">YES, END IT FOR EVERYONE</button>
              <button onClick={() => setEnding(false)} className="min-h-16 border-2 border-marble/30 text-xl text-marble/85">KEEP GOING</button>
            </div>
          ) : (
            <button onClick={() => (allDone ? publish({ type: 'end', eid, by: account }) : setEnding(true))}
              className={`min-h-16 w-full border-2 text-xl font-semibold ${allDone ? 'border-[#5cc8a8] bg-[#5cc8a8]/10 text-[#9be3cc]' : 'border-marble/25 text-marble/70'}`}>
              {allDone ? 'ALL STEPS DONE · END THE EMERGENCY' : 'END THE EMERGENCY'}
            </button>
          )
        )}
      </main>
    </div>
  );
}

// Reads a new step aloud once, when it appears.
function SpeakStep({ text }: { text: string }) {
  useEffect(() => { if (text) speak(text); }, [text]);
  return null;
}
