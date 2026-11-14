import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, CircleDashed, Lock, Mic, ShieldCheck, Siren, X } from 'lucide-react';
import type { Procedure, RoleId } from '../../emergency/types';
import { missionContext, telemetryFor } from '../../emergency/data';
import { environmentFlags } from '../../emergency/engine';
import { DELAY_MIN, buildPlan, casesFrom, crewNow, inventoryNow, linkLost, roleName, rolesOf, timelineFor, type Task } from '../../emergency/plan';
import { publish, useLog, useSyncStatus } from '../../emergency/sync';
import { clock } from '../../emergency/store';
import { newId } from '../../emergency/events';
import { missions } from '../../data/missions';
import { CameraAssist } from './CameraAssist';
import { EarthLink, authorityStyle } from './EarthLink';

const RED = '#e45b5b';
const categoryLabel = { dcs: 'Pressure or EVA problem', respiratory: 'Breathing or cabin air', anaphylaxis: 'Severe allergic reaction', behavioral: 'Behavioral support' };

interface Props {
  eid: string;
  kb: Procedure[];
  account: string;
  onLeave: () => void;
}

// One crew member's view of a live emergency: only their own tasks in full,
// everyone else as live status, all rebuilt from the shared event log.
export function Response({ eid, kb, account, onLeave }: Props) {
  const log = useLog();
  const sync = useSyncStatus();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const cases = useMemo(() => casesFrom(log), [log]);
  const c = cases.find((x) => x.eid === eid);
  // `now` is a dependency so time-based adaptations (observations due) refresh.
  const plan = useMemo(() => (c ? buildPlan(c, kb, log, cases) : undefined), [c, kb, log, cases, Math.floor(now / 15000)]);
  const [cannot, setCannot] = useState<string>();
  const [cmd, setCmd] = useState('');
  const [reply, setReply] = useState<string>();
  const [listening, setListening] = useState(false);

  if (!c || !plan) return null;
  if (c.ended) {
    return (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#070303] text-center">
        <div className="font-serif text-2xl tracking-[0.15em] text-marble">EMERGENCY STOOD DOWN</div>
        <p className="text-marble/70">The medical lead ended emergency mode. Follow-up continues in Watch.</p>
        <button onClick={onLeave} className="bg-marble px-5 py-2.5 font-mono text-[11px] tracking-[0.3em] text-black">BACK TO WATCH</button>
      </div>
    );
  }
  const mission = missions[c.mission];
  const me = crewNow(log).find((m) => m.id === account)!;
  const myRoles = rolesOf(plan.roles, account);
  const isPatient = c.patientId === account;
  const isLead = myRoles.includes('lead');
  const mine = plan.tasks.filter((t) => myRoles.includes(t.step.role));
  const ready = mine.filter((t) => t.status === 'ready' || t.status === 'blocked');
  const current = ready[0];
  const inventory = inventoryNow(log, c.mission);
  const lost = linkLost(log);
  const delay = DELAY_MIN[c.mission];
  const secs = Math.floor((now - c.startedAt) / 1000);
  const elapsed = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  const lastVitals = [...c.vitals].reverse();
  const timeline = timelineFor(c, log, plan);
  const env = environmentFlags(telemetryFor(c.mission));
  const canSeeMedical = isLead || myRoles.includes('monitor') || isPatient;

  const say = (text: string) => {
    setReply(text);
    try { const u = new SpeechSynthesisUtterance(text); speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { /* no speech */ }
  };
  const step = (t: Task, outcome: 'done' | 'cannot' | 'yes' | 'no') => { publish({ type: 'step', eid, by: account, stepId: t.step.id, outcome }); setCannot(undefined); };
  const markItem = (itemId: string, status: 'in-use' | 'unverified', note: string) => publish({ type: 'item', mission: c.mission, itemId, status, note, by: account });

  // Natural questions, typed or spoken. The emergency context is already known.
  const handle = (text: string) => {
    const q = text.toLowerCase();
    if (!current) return say('You have no task right now. Stand by; CHIRON will tell you when you are needed.');
    const item = inventory.find((i) => (current.step.equipment ?? []).includes(i.id));
    if (/where/.test(q)) return say(item ? `${item.name}: ${item.location}. Status: ${item.status}.` : 'This task needs no equipment.');
    if (/task|what do i|my job/.test(q)) return say(current.step.text);
    if (/mean|why|explain/.test(q)) return say(current.step.why);
    if (/unavailable|missing|not there|can't find/.test(q) && item) { markItem(item.id, 'unverified', `${item.name} reported missing`); return say(`Recorded: ${item.name} missing. CHIRON is updating the plan.`); }
    if (/worse|changed|deteriorat/.test(q)) { publish({ type: 'vitals', eid, by: account, note: `Situation changed: ${text}` }); return say('Recorded. The medical lead and Earth will see it, and the plan is updating.'); }
    if (/can'?t|cannot|unable/.test(q)) { step(current, 'cannot'); return say(current.step.ifCannot); }
    if (/^(done|next|finished|complete)/.test(q) && !current.step.ask && current.step.verify !== 'clinical' && current.status !== 'blocked') { step(current, 'done'); return say('Marked done.'); }
    return say('Try: where is it, what is my task, what does this mean, it is missing, it changed, I cannot do this, or done.');
  };
  const listen = () => {
    const W = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const Rec = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Rec) return say('Voice input is not available in this browser. Type instead.');
    const r = new Rec();
    r.lang = 'en-US';
    r.onresult = (e: any) => { const t = e.results[0][0].transcript as string; setCmd(t); handle(t); };
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  };

  const sendUpdate = () => {
    const done = plan.tasks.filter((t) => t.status === 'done').length;
    const v = lastVitals[0];
    publish({ type: 'message', eid, by: account, message: {
      id: newId(), direction: 'out', authority: 'chiron', title: `Status update (${elapsed} in)`,
      body: `${done} of ${plan.tasks.length} tasks done. ${v ? `Latest: ${[v.spo2 && `SpO2 ${v.spo2}%`, v.hr && `HR ${v.hr}`, v.note].filter(Boolean).join(', ')}.` : 'No observations yet.'} ${plan.alerts.join(' ')}`,
      sentAt: Date.now(), arrivesAt: Date.now() + delay * 60_000 / 60 }, });
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#070303]" style={{ animation: 'fade-in 0.35s ease-out' }}>
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b-2 px-5 py-2.5" style={{ borderColor: RED, background: `${RED}22` }}>
        <Siren className="animate-pulse" style={{ color: RED }} />
        <div className="mr-auto">
          <div className="font-mono text-[10px] tracking-[0.35em]" style={{ color: RED }}>⚷ CHIRON IS ACTING · {plan.patient.name.toUpperCase()}</div>
          <div className="font-serif text-lg tracking-[0.12em] text-marble">{categoryLabel[c.category].toUpperCase()}</div>
        </div>
        <div className="text-right font-mono text-[10px] tracking-[0.15em] text-marble/70">
          <div>{plan.procedure ? `${plan.procedure.id} v${plan.procedure.version} · ${plan.procedure.status.toUpperCase()}` : 'NO APPROVED PROCEDURE'}</div>
          <div>YOU: {me.name.toUpperCase()} · {isPatient ? 'PATIENT' : myRoles.length ? myRoles.map((r) => roleName[r]).join(', ').toUpperCase() : 'STAND BY'} · {sync === 'relay' ? 'LIVE ACROSS DEVICES' : 'LIVE ON THIS DEVICE'}</div>
        </div>
        <div className="font-mono text-3xl text-marble" aria-label="Time since emergency started">{elapsed}</div>
        <button onClick={onLeave} className="flex items-center gap-1 border border-marble/25 px-3 py-2 font-mono text-[10px] tracking-[0.25em] text-marble/70 hover:border-marble"><ArrowLeft size={12} /> WATCH</button>
        {isLead && <button onClick={() => publish({ type: 'end', eid, by: account })} className="border border-marble/40 px-3 py-2 font-mono text-[10px] tracking-[0.25em] text-marble hover:border-marble">STAND DOWN</button>}
      </header>

      {plan.alerts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-2 text-sm" style={{ borderColor: '#e39b4b66', background: '#e39b4b18', color: '#f3c28d' }}>
          <AlertTriangle size={16} /> {plan.alerts.join(' · ')}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* LEFT: overview */}
        <aside className="space-y-3 text-xs">
          <section className="border border-marble/15 p-3">
            <div className="font-mono text-[9px] tracking-[0.25em] text-mute">PATIENT · LIVE</div>
            <div className="mt-1 text-base text-marble">{plan.patient.name}</div>
            {lastVitals[0] ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div><div className="text-mute">SpO2</div><div className="font-mono text-xl text-marble">{lastVitals.find((v) => v.spo2 !== undefined)?.spo2 ?? '—'}<span className="text-xs">%</span></div></div>
                <div><div className="text-mute">Heart rate</div><div className="font-mono text-xl text-marble">{lastVitals.find((v) => v.hr !== undefined)?.hr ?? '—'}</div></div>
              </div>
            ) : <p className="mt-1 text-mute">No observations recorded yet.</p>}
            {lastVitals[0] && <p className="mt-1 text-[10px] text-mute">Updated {clock(lastVitals[0].t)} by {crewNow(log).find((m) => m.id === lastVitals[0].by)?.name}</p>}
            {canSeeMedical ? (
              <p className="mt-2 text-marble/70">Allergies: {plan.patient.medical.allergies.join(', ') || 'none recorded'}</p>
            ) : <p className="mt-2 flex items-center gap-1 text-mute"><Lock size={11} /> Medical details shown to the medical lead and monitor only.</p>}
            {(isLead || myRoles.includes('monitor')) && <VitalsForm onSave={(v) => publish({ type: 'vitals', eid, by: account, ...v })} />}
          </section>

          <section className="border border-marble/15 p-3">
            <div className="font-mono text-[9px] tracking-[0.25em] text-mute">MISSION CONTEXT</div>
            <ul className="mt-1 space-y-0.5 text-marble/75">
              <li>{mission.name} · day {mission.today}</li>
              <li>Earth: {mission.delayLabel} each way{lost ? ' · link lost' : ''}</li>
              <li>{missionContext[c.mission].evacuation}</li>
              <li>{missionContext[c.mission].eva}</li>
            </ul>
            {env.map((f) => <p key={f} className="mt-1 text-[#f3c28d]">{f}</p>)}
            <p className="mt-1 text-[10px] text-mute">Crew, inventory and cabin readings are simulated.</p>
          </section>

          <section className="border border-marble/15 p-3">
            <div className="font-mono text-[9px] tracking-[0.25em] text-mute">TIMELINE · SHARED</div>
            <ul className="mt-1 max-h-72 space-y-1 overflow-y-auto">
              {timeline.map((e, i) => (
                <li key={i} className={e.kind === 'warning' ? 'text-[#f3c28d]' : 'text-marble/75'}>
                  <span className="font-mono text-[10px] text-mute">{clock(e.time).slice(0, 5)}</span> <span className="text-mute">{e.who}:</span> {e.text}
                </li>
              ))}
            </ul>
          </section>
        </aside>

        {/* CENTRE: my tasks only */}
        <main className="flex min-w-0 flex-col gap-3">
          {plan.missing && (
            <div className="border-2 border-[#e39b4b] p-4 text-marble">
              <div className="font-mono text-[10px] tracking-[0.25em] text-[#e39b4b]">PROCEDURE UNAVAILABLE</div>
              <p className="mt-1 text-lg">{plan.missing}</p>
              <p className="mt-1 text-sm text-marble/70">CHIRON will not make one up. Use the paper card if one exists, and contact Earth now.</p>
            </div>
          )}
          {plan.warnings.map((w) => <p key={w} className="border border-[#e39b4b]/50 p-2 text-sm text-[#f3c28d]">{w}</p>)}

          {isPatient ? (
            <div className="my-auto text-center">
              <div className="font-serif text-2xl tracking-[0.1em] text-marble">YOUR CREW IS WITH YOU</div>
              <p className="mt-2 text-marble/70">Stay as still as you can. Tell CHIRON if anything changes.</p>
              <div className="mt-5 flex justify-center gap-3">
                <button onClick={() => publish({ type: 'vitals', eid, by: account, note: 'Patient reports feeling worse' })} className="border-2 border-[#e45b5b] px-6 py-4 text-lg text-marble">I feel worse</button>
                <button onClick={() => publish({ type: 'vitals', eid, by: account, note: 'Patient reports feeling better' })} className="border-2 border-marble/40 px-6 py-4 text-lg text-marble">I feel better</button>
              </div>
            </div>
          ) : !current ? (
            <div className="my-auto text-center">
              <CircleDashed className="mx-auto text-marble/40" size={36} />
              <div className="mt-3 font-serif text-xl tracking-[0.1em] text-marble">{myRoles.length ? 'NO TASK FOR YOU RIGHT NOW' : 'STAND BY'}</div>
              <p className="mt-1 text-marble/60">{myRoles.length ? 'CHIRON will show your next task as soon as it can start.' : 'You have no role in this emergency. Stay available; CHIRON will call you if roles change.'}</p>
              {mine.filter((t) => t.status === 'waiting').map((t) => <p key={t.step.id} className="mt-2 text-sm text-marble/50">Next: {t.step.text} <span className="text-mute">(waiting for another task)</span></p>)}
            </div>
          ) : (
            <TaskCard key={current.step.id} t={current} isLead={isLead} verified={c.verified.has(current.step.id)} inventory={inventory}
              showCannot={cannot === current.step.id}
              onVerify={() => publish({ type: 'verify', eid, by: account, stepId: current.step.id })}
              onAnswer={(a) => step(current, a)} onDone={() => step(current, 'done')}
              onCannot={() => setCannot(current.step.id)} onConfirmCannot={() => step(current, 'cannot')}
              onItem={markItem} />
          )}
          {!isPatient && ready.length > 1 && <p className="text-xs text-marble/60">Also ready for you: {ready.slice(1).map((t) => t.step.text).join(' · ')}</p>}

          {!isPatient && (
            <div className="mt-auto flex gap-2">
              <input value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && cmd.trim()) { handle(cmd); setCmd(''); } }}
                placeholder="Ask CHIRON: where is it? what does this mean? it's missing…" aria-label="Ask CHIRON"
                className="h-11 flex-1 border border-marble/25 bg-transparent px-3 text-sm text-marble outline-none focus:border-marble/60" />
              <button onClick={listen} aria-label="Speak to CHIRON" className={`h-11 border px-3 ${listening ? 'border-[#e45b5b] text-[#e45b5b]' : 'border-marble/25 text-marble/80'}`}><Mic size={16} /></button>
            </div>
          )}
          {reply && <p className="text-sm text-marble/80"><span className="font-mono text-[10px] tracking-[0.2em] text-gold">CHIRON: </span>{reply}</p>}
        </main>

        {/* RIGHT: crew, equipment, Earth */}
        <aside className="space-y-3 text-xs">
          <section className="border border-marble/15 p-3">
            <div className="font-mono text-[9px] tracking-[0.25em] text-mute">CREW · LIVE</div>
            <ul className="mt-2 space-y-2">
              {crewNow(log).map((m) => {
                const r = rolesOf(plan.roles, m.id);
                const doing = plan.tasks.find((t) => r.includes(t.step.role) && (t.status === 'ready' || t.status === 'blocked'));
                const doneN = plan.tasks.filter((t) => r.includes(t.step.role) && t.status === 'done').length;
                return (
                  <li key={m.id} className={m.id === account ? 'border-l-2 border-gold pl-2' : 'pl-2.5'}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-marble">{m.name}{m.id === account && ' (you)'}</span>
                      {m.id !== c.patientId && (
                        <button onClick={() => publish({ type: 'crew', crewId: m.id, available: !m.available, by: account })} className="font-mono text-[9px] text-mute hover:text-marble">
                          {m.available ? 'MARK UNAVAILABLE' : 'MARK AVAILABLE'}
                        </button>
                      )}
                    </div>
                    <div className="text-mute">{m.id === c.patientId ? 'Patient' : !m.available ? 'Unavailable' : r.length ? r.map((x: RoleId) => roleName[x]).join(', ') : 'Stand by'}</div>
                    {m.id !== c.patientId && m.available && r.length > 0 && (
                      <div className="text-marble/70">{doing ? `Now: ${doing.step.text.split('.')[0]}` : 'Waiting'} · {doneN} done</div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 text-[10px] text-mute">{Object.entries(plan.roles).map(([r, a]) => a.note && `${roleName[r as RoleId]}: ${a.note}`).filter(Boolean).join(' · ')}</div>
          </section>

          <section className="border border-marble/15 p-3">
            <div className="font-mono text-[9px] tracking-[0.25em] text-mute">EQUIPMENT · CHECKED BEFORE GUIDANCE</div>
            <ul className="mt-1 space-y-1">
              {plan.checks.map((ch) => (
                <li key={ch.itemId}>
                  <span className={ch.ok ? 'text-[#5cc8a8]' : 'text-[#f3c28d]'}>{ch.ok ? '✓' : '!'}</span> <span className="text-marble/85">{ch.name}</span>
                  <span className="block pl-3 text-mute">{ch.ok ? ch.location : `${ch.status}${ch.alternative ? ` · approved alternative: ${ch.alternative.name} (${ch.alternative.location})` : ' · no approved alternative'}`}</span>
                </li>
              ))}
            </ul>
          </section>

          <EarthLink messages={c.messages} now={now} delayLabel={mission.delayLabel} linkLost={lost}
            onToggleLink={() => publish({ type: 'link', lost: !lost, by: account })} onSendUpdate={sendUpdate} />
          <p className="text-[10px] text-mute">Message types: <span className={authorityStyle.procedure.cls}>approved procedure</span> · <span className={authorityStyle.medical.cls}>authorized medical personnel</span> · <span className={authorityStyle.chiron.cls}>CHIRON summary</span></p>
        </aside>
      </div>
    </div>
  );
}

function VitalsForm({ onSave }: { onSave: (v: { spo2?: number; hr?: number; note?: string }) => void }) {
  const [spo2, setSpo2] = useState('');
  const [hr, setHr] = useState('');
  const save = () => {
    const v = { spo2: spo2 ? Number(spo2) : undefined, hr: hr ? Number(hr) : undefined };
    if (v.spo2 === undefined && v.hr === undefined) return;
    onSave(v); setSpo2(''); setHr('');
  };
  return (
    <div className="mt-2 flex gap-1.5">
      <input value={spo2} onChange={(e) => setSpo2(e.target.value)} inputMode="numeric" placeholder="SpO2 %" aria-label="Blood oxygen" className="h-8 w-16 border border-marble/25 bg-transparent px-2 text-marble" />
      <input value={hr} onChange={(e) => setHr(e.target.value)} inputMode="numeric" placeholder="HR" aria-label="Heart rate" className="h-8 w-14 border border-marble/25 bg-transparent px-2 text-marble" />
      <button onClick={save} className="h-8 flex-1 bg-marble font-mono text-[10px] tracking-[0.2em] text-black">RECORD</button>
    </div>
  );
}

interface CardProps {
  t: Task; isLead: boolean; verified: boolean; showCannot: boolean;
  inventory: ReturnType<typeof inventoryNow>;
  onVerify: () => void; onAnswer: (a: 'yes' | 'no') => void; onDone: () => void; onCannot: () => void; onConfirmCannot: () => void;
  onItem: (itemId: string, status: 'in-use' | 'unverified', note: string) => void;
}

// One instruction: what, why, equipment and where, who, the confirmation needed, and the fallback.
function TaskCard({ t, isLead, verified, showCannot, inventory, onVerify, onAnswer, onDone, onCannot, onConfirmCannot, onItem }: CardProps) {
  const s = t.step;
  const items = (s.equipment ?? []).map((id) => inventory.find((i) => i.id === id)).filter(Boolean) as ReturnType<typeof inventoryNow>;
  const needsVerify = s.verify === 'clinical' && !verified;
  return (
    <div className="rise border-2 p-5" style={{ borderColor: t.status === 'blocked' ? '#e39b4b' : RED }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-xs tracking-[0.3em]" style={{ color: RED }}>YOUR TASK · {roleName[s.role].toUpperCase()}</div>
        {t.added ? <span className="font-mono text-[10px] tracking-[0.15em] text-mute">{t.added.toUpperCase()} · COORDINATION, NOT CLINICAL</span>
          : <span className={`border-l-2 pl-2 font-mono text-[10px] tracking-[0.15em] ${authorityStyle.procedure.cls}`}>FROM THE APPROVED PROCEDURE</span>}
      </div>
      <p className="mt-3 text-2xl font-medium leading-snug text-white md:text-3xl">{s.text}</p>
      {s.ask && <p className="mt-3 text-xl text-marble/85">{s.ask.question}</p>}
      <p className="mt-3 text-sm text-marble/65"><span className="font-mono text-[10px] tracking-[0.2em] text-mute">WHY: </span>{s.why}</p>

      {items.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {items.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 border border-marble/15 px-3 py-2 text-sm">
              <span className="text-marble">{i.name} <span className="text-marble/50">· {i.location} · {i.status}</span></span>
              <span className="flex gap-1.5">
                <button onClick={() => onItem(i.id, 'in-use', `${i.name} retrieved`)} className="border border-marble/30 px-2 py-1 font-mono text-[10px] tracking-[0.15em] text-marble/80 hover:border-marble">GOT IT</button>
                <button onClick={() => onItem(i.id, 'unverified', `${i.name} reported missing`)} className="border border-[#e39b4b]/50 px-2 py-1 font-mono text-[10px] tracking-[0.15em] text-[#f3c28d]">MISSING</button>
              </span>
            </div>
          ))}
          <CameraAssist target={items[0].name} location={items[0].location} onFound={() => onItem(items[0].id, 'in-use', `${items[0].name} retrieved (camera assist, confirmed by hand)`)} />
        </div>
      )}
      {t.blockedBy && <p className="mt-2 text-sm text-[#f3c28d]">Blocked: {t.blockedBy}. CHIRON has asked Earth for approved options.</p>}

      {s.verify === 'clinical' && (
        isLead ? (
          <label className="mt-3 flex items-center gap-2 text-sm text-marble">
            <input type="checkbox" checked={verified} disabled={verified} onChange={onVerify} />
            <ShieldCheck size={15} className="text-[#5cc8a8]" /> I followed the approved card for this step (medical lead verification)
          </label>
        ) : <p className="mt-3 text-sm text-mute">Needs verification by the medical lead.</p>
      )}

      {showCannot ? (
        <div className="mt-4 border border-[#e39b4b] p-3 text-marble">
          <div className="font-mono text-[10px] tracking-[0.2em] text-[#e39b4b]">IF YOU CAN'T</div>
          <p className="mt-1 text-lg">{s.ifCannot}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={onConfirmCannot} className="bg-[#e39b4b] px-4 py-2 font-mono text-[10px] tracking-[0.2em] text-black">RECORD AND CONTINUE</button>
            <button onClick={onCannot} className="px-2 text-mute" aria-label="Close"><X size={16} /></button>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-[auto_1fr] gap-3">
          <button onClick={onCannot} className="min-h-14 border-2 border-marble/25 px-4 text-sm text-marble/80">I can't</button>
          {s.ask ? (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => onAnswer('yes')} className="min-h-14 border-2 border-marble/60 text-xl font-semibold text-marble hover:bg-marble/10">Yes</button>
              <button onClick={() => onAnswer('no')} className="min-h-14 border-2 border-marble/60 text-xl font-semibold text-marble hover:bg-marble/10">No</button>
            </div>
          ) : (
            <button onClick={onDone} disabled={needsVerify || t.status === 'blocked'} className="flex min-h-14 items-center justify-center gap-2 text-xl font-bold text-black disabled:opacity-30" style={{ background: RED }}>
              <Check /> Done
            </button>
          )}
        </div>
      )}
    </div>
  );
}
