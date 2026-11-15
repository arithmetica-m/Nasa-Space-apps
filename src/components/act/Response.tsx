import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Mic, ShieldCheck, Users, Volume2, VolumeX } from 'lucide-react';
import { crewLines, liveUpdates, situation } from '../../emergency/board';
import { missions } from '../../data/missions';
import { buildEarthReport, categoryText, reportSignature } from '../../emergency/report';
import { recordsFor } from '../../lib/crewHealth';
import { linkFor, withLinkEvents } from '../../link/link';
import { Reasoning } from '../Reasoning';
import { medicalOf } from '../../library/advice';
import { CrewRoles, Handover, PlannerOverview, measureStates, planReasoning } from './ResponseExtras';
import { phaseOf } from '../MissionTimeline';
import type { DemoMedicalProfile, Procedure } from '../../emergency/types';
import { DELAY_MIN, buildPlan, casesFrom, crewNow, rolesOf } from '../../emergency/plan';
import { publish, useLog } from '../../emergency/sync';
import { newId } from '../../emergency/events';
import { crew } from '../../emergency/data';
import { speak, stopSpeaking } from '../VoiceControl';
import { EMERGENCY_VOICE_EVENT, type EmergencyVoice } from '../../lib/voiceCommands';
import { measurementError, numericRange } from '../../lib/measurementValidation';
import { openProtocol } from '../Explained';

type Tab = 'record' | 'earth' | 'plan';


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
  const cases = useMemo(() => casesFrom(log), [log]);
  const c = cases.find((item) => item.eid === eid);
  const plan = useMemo(() => c ? buildPlan(c, kb, log, cases) : undefined, [c, kb, log, cases]);
  const [cannot, setCannot] = useState<string>();
  const [accessReason, setAccessReason] = useState('Emergency assessment');
  const [medicalAccessed, setMedicalAccessed] = useState(false);
  const [tab, setTab] = useState<Tab>();
  const [readAloud, setReadAloud] = useState(true);
  const [ending, setEnding] = useState(false);
  const [view, setView] = useState<'main' | 'crew'>('main');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [measurementErrors, setMeasurementErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [showAll, setShowAll] = useState(false);
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
  const sentRef = useRef(new Set<number>()); // never send the same update number twice
  const [handoverSeen, setHandoverSeen] = useState(false);
  const [showHandover, setShowHandover] = useState(false);
  // Every crew member's LINK band (simulated), for measurements, locations and task delivery.
  const links = useMemo(() => (c ? Object.fromEntries(crew.map((m) => [m.id, withLinkEvents(linkFor(m.id, recordsFor(missions[c.mission], m.id), now), log)])) : {}), [c?.mission, now, log]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
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

  // ---- The live emergency screen ----
  const lines = crewLines(c, plan, log, links);
  const updates = liveUpdates(c, plan, log, now);
  const minutes = Math.max(0, Math.round((now - c.startedAt) / 60_000));
  const textOf = (t: { step: { text: string; ask?: { question: string } } }) => t.step.ask?.question ?? t.step.text;

  const patientMed = medicalOf(c.patientId);
  const recordText = [...patientMed.allergies, ...patientMed.history, ...patientMed.medications, ...patientMed.restrictions].join(' ').toLowerCase();
  const happening = situation(c, plan, states, log, links[c.patientId]);
  const saveMeasurement = (key: string) => {
    const value = (draft[key] ?? '').trim();
    const error = measurementError(key, value);
    setMeasurementErrors((current) => ({ ...current, [key]: error ?? '' }));
    if (error) return;
    publish({ type: 'measure', eid: c.eid, by: account, key, value, source: 'manual' });
    setDraft((current) => ({ ...current, [key]: '' }));
  };
  const syncDemoCuff = () => {
    const value = '118/76';
    const error = measurementError('bp', value);
    if (error) {
      setMeasurementErrors((current) => ({ ...current, bp: error }));
      return;
    }
    publish({ type: 'measure', eid: c.eid, by: account, key: 'bp', value, source: 'device' });
    setDraft((current) => ({ ...current, bp: '' }));
    setMeasurementErrors((current) => ({ ...current, bp: '' }));
  };

  // Voice: done / yes / no / can't / repeat / confirm act on this device's own step.
  voiceRef.current = (action) => {
    if (isPatient) { speak('Your crew is helping you.'); return; }
    if (!activeTask) { speak('You have no step right now.'); return; }
    const text = activeTask.status === 'ready' ? textOf(activeTask) : 'Wait for your crew.';
    const confirm = activeTask.status === 'ready' && activeTask.step.verify === 'clinical' && !c.verified.has(activeTask.step.id);
    if (action === 'repeat' || activeTask.status !== 'ready') { speak(text); return; }
    if (action === 'yes' || action === 'no') {
      if (activeTask.step.ask) { complete(activeTask.step.id, action); speak(`Recorded: ${action}.`); } else speak('This step is not a question. Say done when it is finished.');
    } else if (action === 'cannot') { setCannot(activeTask.step.id); speak(activeTask.step.ifCannot ?? 'Tell the medical lead.'); }
    else if (action === 'confirm') {
      if (confirm && isLead) { publish({ type: 'verify', eid, by: account, stepId: activeTask.step.id }); speak('Confirmed.'); } else speak('Nothing to confirm.');
    } else if (action === 'next') {
      const r = advanceStep();
      speak(r === 'advanced' ? 'Done.' : r === 'answer' ? 'Answer yes or no.' : confirm ? (isLead ? 'Say confirm first.' : 'The medical lead must confirm this step.') : 'Waiting for your crew.');
    }
  };

  // This device reads its own person's current step aloud, once, when it appears.
  const speakNow = readAloud && !isPatient && activeTask?.status === 'ready' ? <SpeakStep key={activeTask.step.id} text={`${me?.name.split(' ')[0] ?? ''}: ${textOf(activeTask)}`} /> : null;

  const header = (
    <header className="sticky top-0 z-10 border-b-4 border-[#e45b5b] bg-[#1a0c0e] px-4 py-3 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <div className="text-base font-semibold tracking-wide text-[#ff8585]">EMERGENCY ACTIVE · {minutes} MIN</div>
          <h1 className="text-3xl font-bold leading-tight text-marble md:text-5xl">{plan.patient.name}</h1>
          <div className="text-xl text-marble/90 md:text-2xl">{categoryText[c.category]}</div>
        </div>
        <button type="button" onClick={() => setView(view === 'crew' ? 'main' : 'crew')}
          className="flex min-h-16 items-center gap-2 bg-marble px-5 text-lg font-bold text-void hover:bg-white">
          <Users size={22} /> {view === 'crew' ? 'BACK TO THE PATIENT' : 'VIEW CREW ASSIGNMENTS'}
        </button>
        {voiceSupported && (
          <button type="button" onClick={onVoice} aria-pressed={listening} aria-label="Voice commands"
            className={`flex min-h-16 min-w-16 items-center justify-center border-2 ${listening ? 'border-[#5cc8a8] bg-[#5cc8a8]/15 text-[#7bd5b8]' : 'border-marble/30 text-marble/80'}`}><Mic size={22} /></button>
        )}
        <button type="button" onClick={() => setReadAloud(!readAloud)} aria-pressed={readAloud} aria-label="Read steps aloud"
          className={`flex min-h-16 min-w-16 items-center justify-center border-2 ${readAloud ? 'border-gold/70 text-gold' : 'border-marble/30 text-marble/60'}`}>{readAloud ? <Volume2 size={22} /> : <VolumeX size={22} />}</button>
        <button type="button" onClick={() => setEnding(true)} aria-expanded={ending} aria-controls="end-emergency-confirmation"
          className="min-h-16 border-2 border-[#e39b4b] bg-[#e39b4b]/15 px-5 text-lg font-bold text-[#f3c28d] hover:bg-[#e39b4b]/25">END EMERGENCY</button>
        <button onClick={onLeave} aria-label="Back to the dashboard" className="flex min-h-16 items-center gap-2 border-2 border-marble/30 px-4 text-lg text-marble/80 hover:border-marble/60"><ArrowLeft size={20} /> EXIT</button>
      </div>
      {ending && (
        <section id="end-emergency-confirmation" aria-labelledby="end-emergency-title" className="mx-auto mt-4 w-full max-w-5xl space-y-3 border-2 border-[#e39b4b]/60 bg-[#1a0c0e] p-4">
          <h2 id="end-emergency-title" className="text-2xl font-bold text-marble">End this emergency for everyone?</h2>
          <p className="text-lg text-marble/85">This closes the active response on every device and keeps the medical log.</p>
          {!allDone && <p className="text-lg text-[#f3c28d]">Some procedure steps are unfinished. End the response only when the crew is ready to stop.</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => { stopSpeaking(); publish({ type: 'end', eid, by: account }); }} className="min-h-16 bg-[#e39b4b] px-5 text-xl font-semibold text-[#17100a]">YES, END EMERGENCY</button>
            <button type="button" onClick={() => setEnding(false)} className="min-h-16 border-2 border-marble/30 px-5 text-xl text-marble/85">KEEP EMERGENCY ACTIVE</button>
          </div>
        </section>
      )}
    </header>
  );

  // ---- CREW ASSIGNMENTS: who is responsible for what ----
  if (view === 'crew') {
    const stateColor: Record<string, string> = { 'NOT STARTED': 'text-marble/60 border-marble/30', 'IN PROGRESS': 'text-[#f3c28d] border-[#e39b4b]/70', COMPLETED: 'text-[#7bd5b8] border-[#5cc8a8]/70' };
    const assigned = lines.filter((l) => l.state === 'ASSIGNED');
    const others = lines.filter((l) => l.state === 'AVAILABLE' || l.state === 'UNAVAILABLE');
    return (
      <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto bg-[#080b11]">
        {header}
        {speakNow}
        <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4 pb-16 md:p-6">
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(280px, 1fr))` }}>
            {assigned.map((l) => {
              const theirs = plan.tasks.filter((t) => l.roles.includes(t.step.role));
              const offline = links[l.member.id] && !links[l.member.id].connected;
              return (
                <section key={l.member.id} aria-label={l.member.name} className="border-2 border-marble/25 bg-[#101721]">
                  <header className="border-b-2 border-marble/20 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-3xl font-bold text-marble">{l.member.name.split(' ')[0]}</h2>
                      <span className={`border-2 px-2 py-0.5 text-base font-semibold ${stateColor[l.taskState!]}`}>{l.taskState}</span>
                    </div>
                    <div className="text-xl text-gold">{l.roleText}</div>
                    {offline && <div className="mt-1 text-lg text-[#f3c28d]">Band offline: tell them in person</div>}
                  </header>
                  <ol className="divide-y divide-marble/10">
                    {theirs.map((t, i) => {
                      const fin = t.status === 'done' || t.status === 'cannot';
                      const now = t === l.current && (t.status === 'ready' || t.status === 'blocked');
                      const canDo = now && t.status === 'ready';
                      const confirm = now && t.step.verify === 'clinical' && !c.verified.has(t.step.id);
                      const act = (outcome: 'done' | 'cannot' | 'yes' | 'no') => publish({ type: 'step', eid, by: l.member.id, stepId: t.step.id, outcome });
                      return (
                        <li key={t.step.id} className={`p-4 ${now ? 'bg-[#e45b5b]/10' : ''}`}>
                          <div className="flex gap-3">
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center border-2 text-lg font-bold ${fin ? 'border-[#5cc8a8] bg-[#5cc8a8]/20 text-[#7bd5b8]' : now ? 'border-[#e45b5b] text-[#ff8585]' : 'border-marble/30 text-marble/50'}`}>{fin ? <Check size={20} strokeWidth={3} /> : i + 1}</span>
                            <p className={`text-2xl leading-snug ${fin ? 'text-marble/45 line-through' : now ? 'font-semibold text-marble' : 'text-marble/75'}`}>{textOf(t)}</p>
                          </div>
                          {!fin && t.step.checks && (
                            <ul className="mt-2 space-y-1 pl-12 text-xl text-marble/85">{t.step.checks.map((x) => <li key={x}>☐ {x}</li>)}</ul>
                          )}
                          {!fin && (t.step.personal ?? []).filter((r) => r.match.some((w) => recordText.includes(w))).map((r) => (
                            <p key={r.note} className="mt-2 ml-12 border-l-4 border-[#8fb8ff] bg-[#8fb8ff]/10 px-3 py-2 text-xl text-[#d7e4ff]">For {plan.patient.name.split(' ')[0]}: {r.note}</p>
                          ))}
                          {now && t.step.source && <p className="mt-1 pl-12 text-sm text-marble/45">Follows: {t.step.source.label}</p>}
                          {t.status === 'cannot' && <p className="mt-1 pl-12 text-lg text-[#f3c28d]">Could not do this. Backup: {t.step.ifCannot}</p>}
                          {t.status === 'blocked' && <p className="mt-1 pl-12 text-lg text-[#ff9c9c]">Missing equipment: {t.blockedBy ?? 'ask the medical lead'}</p>}
                          {t.status === 'waiting' && t === l.current && <p className="mt-1 pl-12 text-lg text-marble/55">Waits for another step</p>}
                          {now && (
                            <div className="mt-3 grid gap-2 pl-12">
                              {t.status === 'blocked' ? (
                                <p className="text-lg text-[#ff9c9c]">This step is blocked by unavailable equipment. Do not substitute an unlisted item. Record that it cannot be done to reveal the procedure’s backup plan.</p>
                              ) : t.step.ask ? (
                                <div className="grid grid-cols-2 gap-2">
                                  <button onClick={() => act('yes')} className="min-h-16 border-2 border-marble/50 bg-marble/[0.06] text-2xl font-semibold text-marble">YES</button>
                                  <button onClick={() => act('no')} className="min-h-16 border-2 border-marble/50 bg-marble/[0.06] text-2xl font-semibold text-marble">NO</button>
                                </div>
                              ) : confirm ? (
                                l.roles.includes('lead')
                                  ? <button onClick={() => publish({ type: 'verify', eid, by: l.member.id, stepId: t.step.id })} className="flex min-h-16 items-center justify-center gap-2 border-2 border-[#5cc8a8] bg-[#5cc8a8]/10 text-xl font-semibold text-[#9be3cc]"><ShieldCheck size={22} /> CONFIRM</button>
                                  : <p className="text-lg text-[#f3c28d]">Waiting for the medical lead to confirm</p>
                              ) : (
                                <button onClick={() => act('done')} className="flex min-h-16 items-center justify-center gap-2 bg-[#e45b5b] text-2xl font-bold text-[#16090a]"><Check size={26} strokeWidth={3} /> DONE</button>
                              )}
                              {cannot === t.step.id ? (
                                <div className="border-2 border-[#e39b4b]/70 bg-[#e39b4b]/10 p-3">
                                  <p className="text-xl text-marble">{t.step.ifCannot}</p>
                                  <button onClick={() => { act('cannot'); setCannot(undefined); }} className="mt-2 min-h-14 w-full bg-[#e39b4b] text-lg font-semibold text-[#17100a]">RECORD AND SHOW BACKUP PLAN</button>
                                </div>
                              ) : (canDo || t.status === 'blocked') && <button onClick={() => setCannot(t.step.id)} className="min-h-12 border-2 border-marble/25 text-lg text-marble/75">CAN’T DO THIS</button>}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </section>
              );
            })}
            {assigned.length === 0 && <p className="text-2xl text-marble/80">No tasks: this demo library has no procedure for this event. Use the mission emergency card and activate the medical response.</p>}
          </div>

          <h2 className="pt-2 text-2xl font-semibold text-marble">NOT ASSIGNED</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {others.map((l) => (
              <li key={l.member.id} className="flex flex-wrap items-baseline justify-between gap-2 border-2 border-marble/15 p-4">
                <span className="text-2xl text-marble">{l.member.name}{l.member.id === account ? ' (you)' : ''}</span>
                <span className={`text-xl font-semibold ${l.state === 'AVAILABLE' ? 'text-[#7bd5b8]' : 'text-[#f3c28d]'}`}>{l.state}</span>
                {l.why && <span className="w-full text-lg text-marble/60">{l.why}</span>}
              </li>
            ))}
            {others.length === 0 && <li className="text-xl text-marble/60">Everyone has a task.</li>}
          </ul>

          {plan.procedure && (
            <p className="text-base text-marble/55">
              Demo library: {plan.procedure.title} v{plan.procedure.version}. Follow-up tasks appear from recorded answers. Published source material is in the onboard protocol: {[...new Map(plan.procedure.steps.filter((x) => x.source).map((x) => [x.source!.url, x.source!])).values()].map((src, i) => <span key={src.url}>{i > 0 && ', '}<button type="button" onClick={() => openProtocol(plan.procedure!.id)} className="text-gold underline underline-offset-2">{src.label}</button></span>)}. Demonstration only—not a flight-approved medical protocol. No mission medication formulary is loaded; CHIRON does not calculate doses.
            </p>
          )}
          <details className="border border-marble/15">
            <summary className="min-h-14 cursor-pointer px-4 py-3 text-xl text-marble/85">Change who does what</summary>
            <div className="border-t border-marble/10 p-4"><CrewRoles eid={eid} account={account} plan={plan} c={c} links={links} log={log} /></div>
          </details>
        </main>
      </div>
    );
  }

  // ---- MAIN: what is happening to the patient right now ----
  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto bg-[#080b11]">
      {header}
      {speakNow}
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4 pb-16 md:p-6">
        {c.assignments.lead?.crewId === account && !handoverSeen && <Handover c={c} plan={plan} states={states} onClose={() => setHandoverSeen(true)} />}

        <section aria-label="What is happening" aria-live="polite" className="border-4 border-[#e45b5b] bg-[#e45b5b]/10 p-4">
          <h2 className="text-xl font-bold tracking-wide text-[#ff8585]">WHAT IS HAPPENING TO {plan.patient.name.split(' ')[0].toUpperCase()}</h2>
          <ul className="mt-2 space-y-2">
            {happening.map((h, i) => (
              <li key={i} className={`flex flex-wrap items-baseline gap-x-3 border-l-8 pl-3 ${i === 0 ? 'text-3xl font-bold' : 'text-2xl font-semibold'} ${h.tone === 'red' ? 'border-[#e45b5b] text-marble' : h.tone === 'amber' ? 'border-[#e39b4b] text-[#ffd9a8]' : 'border-marble/40 text-marble'}`}>
                <span>{h.text}</span>{h.t && <span className="font-mono text-base font-normal text-marble/55">{hm(h.t).slice(0, 5)}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-lg text-marble/60">Confirmed findings and recorded readings update live on every device.</p>
        </section>

        <section aria-label="Live health measurements">
          <h2 className="text-xl font-bold tracking-wide text-marble/70">MEASUREMENTS</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {states.map((s) => (
              <li key={s.m.key} className={`border-2 p-3 ${s.value === undefined ? 'border-[#e39b4b]/70 bg-[#e39b4b]/[0.06]' : 'border-marble/20'}`}>
                <div className="text-lg text-marble/70">{s.m.label}</div>
                {s.value !== undefined ? (
                  <>
                    <div className="text-4xl font-bold text-marble">{s.value}</div>
                    <div className="text-base text-marble/60">{s.t ? hm(s.t) : ''} · {s.live ? 'Auto-synced from LINK band (simulated)' : s.source}</div>
                    {s.live && <button type="button" onClick={() => publish({ type: 'measure', eid, by: account, key: s.m.key, value: s.value!, source: 'link' })} className="mt-1 min-h-11 border border-gold/60 px-3 text-base text-gold">Save to the record</button>}
                  </>
                ) : null}
                {s.value === undefined && <div className="text-2xl font-bold text-[#f3c28d]">NOT RECORDED</div>}
                {s.m.source === 'manual' && (
                  <>
                  <div className="mt-1 flex gap-1">
                    <input type={numericRange(s.m.key) ? 'number' : 'text'} inputMode={numericRange(s.m.key) ? 'decimal' : 'text'} min={numericRange(s.m.key)?.min} max={numericRange(s.m.key)?.max} step={numericRange(s.m.key)?.integer ? 1 : 'any'}
                      value={draft[s.m.key] ?? ''} onChange={(e) => { const value = e.target.value; setDraft((d) => ({ ...d, [s.m.key]: value })); setMeasurementErrors((current) => ({ ...current, [s.m.key]: value.trim() ? measurementError(s.m.key, value) ?? '' : '' })); }} aria-label={s.m.label} aria-invalid={!!measurementErrors[s.m.key]} aria-describedby={measurementErrors[s.m.key] ? `${s.m.key}-error` : undefined} placeholder={s.m.key === 'bp' ? '120/80' : s.m.unit ?? 'value'}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveMeasurement(s.m.key); }}
                      className="min-h-12 w-full min-w-0 border-2 border-marble/30 bg-transparent px-2 text-xl text-marble" />
                    <button type="button" disabled={!(draft[s.m.key] ?? '').trim()} onClick={() => saveMeasurement(s.m.key)}
                      className="min-h-12 shrink-0 bg-gold px-3 text-lg font-semibold text-void disabled:opacity-40">{s.value === undefined ? 'SAVE' : 'UPDATE'}</button>
                  </div>
                  {s.m.key === 'bp' && <button type="button" onClick={syncDemoCuff} className="mt-2 min-h-11 border border-gold/60 px-3 text-sm text-gold">SYNC BLOOD-PRESSURE CUFF · SIMULATED</button>}
                  </>
                )}
                {measurementErrors[s.m.key] && <p id={`${s.m.key}-error`} role="alert" className="mt-1 text-sm text-[#ff9c9c]">{measurementErrors[s.m.key]}</p>}
              </li>
            ))}
            {states.length === 0 && <li className="text-xl text-marble/60">No measurements listed for this emergency.</li>}
          </ul>
          {links[c.patientId] && !links[c.patientId].connected && <p className="mt-2 text-xl text-[#f3c28d]">{plan.patient.name.split(' ')[0]}’s LINK band is offline: no live readings. Measure by hand.</p>}
        </section>

        <section aria-label="Live updates" className="border-2 border-marble/20 p-4">
          <h2 className="text-xl font-bold tracking-wide text-marble/70">LIVE UPDATES</h2>
          {(
            <div className="mt-2 flex flex-wrap gap-2">
              {['Awake and talking', 'Not responding', 'Breathing difficulty observed', 'No breathing difficulty observed', 'Visible swelling observed', 'No visible swelling observed', 'Rash observed', 'No rash observed', 'Faintness or collapse observed', 'No faintness or collapse observed', 'Breathing easier', 'Breathing harder'].map((o) => (
                <button key={o} type="button" onClick={() => publish({ type: 'vitals', eid, by: account, note: o })} className="min-h-12 border-2 border-marble/25 px-3 text-lg text-marble hover:border-gold">{o}</button>
              ))}
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Other observation…" aria-label="Other observation"
                onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) { publish({ type: 'vitals', eid, by: account, note: note.trim() }); setNote(''); } }}
                className="min-h-12 min-w-[180px] flex-1 border-2 border-marble/25 bg-transparent px-3 text-lg text-marble" />
            </div>
          )}
          <ol className="mt-3 space-y-1.5">
            {updates.slice(0, showAll ? 100 : 6).map((u, i) => (
              <li key={i} className={`flex gap-3 border-l-4 pl-3 text-xl ${u.tone === 'red' ? 'border-[#e45b5b] text-marble' : u.tone === 'amber' ? 'border-[#e39b4b] text-[#ffd9a8]' : 'border-marble/20 text-marble/85'}`}>
                <span className="w-20 shrink-0 font-mono text-base text-marble/55">{hm(u.t).slice(0, 5)}</span><span>{u.text}</span>
              </li>
            ))}
          </ol>
          {updates.length > 6 && <button type="button" onClick={() => setShowAll(!showAll)} className="mt-2 min-h-11 text-lg text-gold">{showAll ? 'Show fewer' : `Show all ${updates.length}`}</button>}
        </section>

        <div className="grid gap-2 sm:grid-cols-3">
          {isMedicalAccessAuthorized && !isPatient && <button type="button" onClick={() => setTab(tab === 'record' ? undefined : 'record')} className="min-h-14 border-2 border-marble/25 text-lg text-marble/85">MEDICAL RECORD</button>}
          <button type="button" onClick={() => setTab(tab === 'earth' ? undefined : 'earth')} className="min-h-14 border-2 border-marble/25 text-lg text-marble/85">REPORT TO EARTH</button>
          {!isPatient && <button type="button" onClick={() => setTab(tab === 'plan' ? undefined : 'plan')} className="min-h-14 border-2 border-marble/25 text-lg text-marble/85">HOW CHIRON PLANNED THIS</button>}
        </div>

        {tab === 'record' && (
          <section className="border border-[#e5c27b]/40 bg-[#e5c27b]/[0.04] p-4">
            <h2 className="text-xl font-semibold text-marble">{plan.patient.name}’s medical record</h2>
            {!medicalAccessed ? (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="min-w-[220px] flex-1 text-lg text-marble/70">Why do you need it?
                  <select value={accessReason} onChange={(event) => setAccessReason(event.target.value)} className="mt-1 min-h-14 w-full border border-marble/25 bg-[#080b11] px-3 text-lg text-marble">
                    <option>Emergency assessment</option>
                    <option>Check allergy or medication relevance</option>
                    <option>Review medical restriction or history</option>
                  </select>
                </label>
                <button type="button" onClick={openMedicalRecord} className="min-h-14 border-2 border-[#e5c27b]/70 px-5 text-lg font-semibold text-[#e5c27b]">OPEN (LOGGED)</button>
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {([['Allergies', relevantMedical.allergies], ['Medications', relevantMedical.medications], ['Restrictions', relevantMedical.restrictions], ['History', relevantMedical.history]] as const).map(([label, values]) => (
                  <div key={label} className="border border-marble/10 p-3">
                    <div className="text-base text-marble/50">{label.toUpperCase()}</div>
                    <div className="mt-1 text-2xl text-marble">{values.length ? values.join(', ') : 'None recorded'}</div>
                  </div>
                ))}
              </div>
            )}
            {medicalAccessEvents.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-marble/10 pt-2 text-base text-marble/60">
                {medicalAccessEvents.map((event) => event.type === 'medical-access' && <li key={event.id}>{hm(event.t)} · opened by {crew.find((member) => member.id === event.by)?.name ?? event.by} · {event.reason}</li>)}
              </ul>
            )}
          </section>
        )}

        {tab === 'earth' && (
          <section className="border border-[#8fb8ff]/40 bg-[#8fb8ff]/[0.06] p-4">
            <p className="text-xl text-marble">Earth is updated automatically: {lastReport ? `${lastReport.report!.n === 1 ? 'first report' : `update ${lastReport.report!.n}`} ${lastReport.arrivesAt <= now ? 'arrived' : lastReport.arrivesAt - now < 60_000 ? 'arrives in seconds' : `arrives in ${Math.round((lastReport.arrivesAt - now) / 60_000)} min`}` : 'writing the first report'}.</p>
            <button type="button" onClick={sendReport} className="mt-3 min-h-14 border-2 border-[#8fb8ff]/60 px-5 text-lg text-[#d7e4ff]">SEND AN UPDATE NOW</button>
            {lastReport && <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap border border-marble/10 bg-void/70 p-3 font-sans text-base leading-relaxed text-marble/85">{lastReport.body}</pre>}
          </section>
        )}

        {tab === 'plan' && (
          <section className="space-y-3 border border-marble/15 bg-[#101721] p-4">
            <PlannerOverview c={c} plan={plan} states={states} links={links} phase={phaseOf(missions[c.mission])} />
            <Reasoning title="HOW CHIRON BUILT THIS PLAN" steps={planReasoning(c, plan, states, links)} />
            <button type="button" onClick={() => setShowHandover(!showHandover)} className="min-h-14 w-full border-2 border-marble/25 px-4 text-lg text-marble/85">{showHandover ? 'HIDE THE HANDOVER SUMMARY' : 'HANDOVER SUMMARY'}</button>
            {showHandover && <Handover c={c} plan={plan} states={states} />}
          </section>
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
