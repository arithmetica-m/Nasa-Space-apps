import { useMemo, useState } from 'react';
import { ArrowLeft, Check, CircleDashed, Siren, ShieldCheck } from 'lucide-react';
import type { Procedure, RoleId } from '../../emergency/types';
import { DELAY_MIN, buildPlan, casesFrom, crewNow, inventoryNow, roleName, rolesOf } from '../../emergency/plan';
import { publish, useLog, useSyncStatus } from '../../emergency/sync';
import { newId } from '../../emergency/events';
import { missions } from '../../data/missions';

const categoryLabel = {
  dcs: 'Pressure or EVA concern',
  respiratory: 'Breathing difficulty',
  anaphylaxis: 'Allergic reaction',
  behavioral: 'Crew support',
};

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

  const mission = missions[c.mission];
  const me = crewNow(log).find((member) => member.id === account);
  const myRoles = rolesOf(plan.roles, account);
  const isPatient = c.patientId === account;
  const isLead = myRoles.includes('lead');
  const mine = plan.tasks.filter((task) => myRoles.includes(task.step.role));
  const inventory = inventoryNow(log, c.mission);
  const latest = [...c.vitals].reverse()[0];

  const complete = (stepId: string, outcome: 'done' | 'cannot' | 'yes' | 'no') => {
    publish({ type: 'step', eid, by: account, stepId, outcome });
    setCannot(undefined);
  };
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

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto bg-[#080b11]" style={{ animation: 'fade-in 0.3s ease-out' }}>
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-[#e45b5b]/50 bg-[#100c10]/95 px-4 py-4 backdrop-blur md:px-8">
        <Siren className="shrink-0 animate-pulse text-[#ff8585]" size={20} />
        <div className="mr-auto min-w-0">
          <div className="font-mono text-[10px] tracking-[0.2em] text-[#ff8585]">ACT · CREW RESPONSE</div>
          <h1 className="mt-1 truncate text-lg font-semibold text-marble md:text-xl">{categoryLabel[c.category]} · {plan.patient.name}</h1>
          <div className="mt-1 text-xs text-marble/60">{mission.name} · {mission.delayLabel} to Earth · {sync === 'relay' ? 'Crew devices connected' : 'Local crew log'}</div>
        </div>
        <button onClick={onLeave} className="flex min-h-11 items-center gap-2 border border-marble/25 px-3 text-xs text-marble/75 hover:border-marble/50"><ArrowLeft size={14} /> OVERVIEW</button>
        {isLead && <button onClick={() => publish({ type: 'end', eid, by: account })} className="min-h-11 border border-marble/40 px-4 text-xs text-marble hover:border-marble">CLOSE RESPONSE</button>}
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 p-4 pb-10 md:p-8">
        <section className="mb-5 border border-marble/10 bg-marble/[0.03] p-4 md:p-5">
          <div className="font-mono text-[10px] tracking-[0.17em] text-gold">SCENARIO PROCEDURE</div>
          <h2 className="mt-1 text-base font-semibold text-marble">{plan.procedure?.title ?? 'No matching scenario procedure loaded'}</h2>
          <p className="mt-2 text-sm leading-relaxed text-marble/60">
            Hypothetical training workflow informed by spaceflight health research. This is not a NASA-approved medical procedure or clinical guidance; follow mission-authorized instructions.
          </p>
        </section>

        {plan.missing && (
          <div className="mb-5 border border-[#e39b4b]/60 bg-[#e39b4b]/[0.07] p-4 text-sm text-marble">
            No scenario is loaded for this event. Do not improvise from CHIRON; use mission-authorized instructions and contact the medical lead.
          </div>
        )}
        {plan.warnings.length > 0 && (
          <div className="mb-5 border border-[#e39b4b]/50 p-3 text-sm text-[#f3c28d]">{plan.warnings.join(' ')}</div>
        )}
        {plan.alerts.length > 0 && (
          <div className="mb-5 border border-[#e39b4b]/50 bg-[#e39b4b]/[0.05] p-3 text-sm text-[#f3c28d]">
            {plan.alerts.join(' ')}
          </div>
        )}

        {isPatient ? (
          <section className="border border-[#e45b5b]/40 bg-[#e45b5b]/[0.06] p-5 text-center md:p-8">
            <h2 className="text-xl font-semibold text-marble">Your crew is responding</h2>
            <p className="mt-2 text-sm text-marble/70">Tell your crew if your condition changes. They will coordinate your support.</p>
            {latest && <p className="mt-3 text-xs text-marble/50">Your latest update was recorded by a crew member.</p>}
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button onClick={() => publish({ type: 'vitals', eid, by: account, note: 'Patient reports feeling worse' })} className="min-h-12 border-2 border-[#e45b5b]/70 px-5 text-sm text-[#ff9999]">I feel worse</button>
              <button onClick={() => publish({ type: 'vitals', eid, by: account, note: 'Patient reports feeling better' })} className="min-h-12 border border-marble/35 px-5 text-sm text-marble/80">I feel better</button>
            </div>
          </section>
        ) : mine.length ? (
          <section aria-labelledby="assigned-steps-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="font-mono text-[10px] tracking-[0.17em] text-[#ff8585]">ASSIGNED TO {me?.name.toUpperCase()}</div>
                <h2 id="assigned-steps-heading" className="mt-1 text-xl font-semibold text-marble">Your steps</h2>
              </div>
              <div className="text-xs text-marble/55">{myRoles.map((role) => roleName[role]).join(' · ')}</div>
            </div>
            <ol className="space-y-3">
              {mine.map((task, index) => {
                const blocked = task.status === 'blocked';
                const waiting = task.status === 'waiting';
                const done = task.status === 'done';
                const step = task.step;
                const equipment = (step.equipment ?? []).map((id) => inventory.find((item) => item.id === id)).filter((item) => item !== undefined);
                const verified = c.verified.has(step.id);
                const needsVerify = step.verify === 'clinical' && !verified;
                return (
                  <li key={step.id} className={`border p-4 md:p-5 ${done ? 'border-[#63c9a8]/30 bg-[#63c9a8]/[0.03]' : waiting ? 'border-marble/10 bg-marble/[0.02]' : blocked ? 'border-[#e39b4b]/60 bg-[#e39b4b]/[0.04]' : 'border-marble/20 bg-[#101721]'}`}>
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs ${done ? 'border-[#63c9a8] text-[#63c9a8]' : 'border-marble/25 text-marble/70'}`}>
                        {done ? <Check size={15} /> : index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[9px] tracking-[0.14em] text-marble/45">{roleName[step.role].toUpperCase()}</span>
                          <span className={`font-mono text-[9px] tracking-[0.12em] ${done ? 'text-[#63c9a8]' : blocked ? 'text-[#f3c28d]' : waiting ? 'text-marble/45' : 'text-[#ff8585]'}`}>
                            {done ? 'COMPLETE' : blocked ? 'BLOCKED' : waiting ? 'WAITING' : 'YOUR ACTION'}
                          </span>
                        </div>
                        <p className={`mt-2 text-base leading-relaxed md:text-lg ${done ? 'text-marble/60' : 'text-marble'}`}>{step.text}</p>
                        {waiting && task.waitingFor.length > 0 && <p className="mt-2 text-xs text-marble/50">Waiting for another assigned step to finish.</p>}
                        {task.blockedBy && <p className="mt-2 text-sm text-[#f3c28d]">Equipment unavailable: {task.blockedBy}. Notify the medical lead.</p>}
                        {equipment.length > 0 && !done && (
                          <ul className="mt-3 space-y-1">
                            {equipment.map((item) => (
                              <li key={item.id} className="text-sm text-marble/75">
                                <span className="font-medium text-marble">{item.name}</span> · {item.location} · {item.status}
                              </li>
                            ))}
                          </ul>
                        )}
                        {step.ask && task.status === 'ready' && (
                          <div className="mt-4">
                            <p className="text-sm text-marble/80">{step.ask.question}</p>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <button onClick={() => complete(step.id, 'yes')} className="min-h-11 border border-marble/35 text-marble hover:bg-marble/5">Yes</button>
                              <button onClick={() => complete(step.id, 'no')} className="min-h-11 border border-marble/35 text-marble hover:bg-marble/5">No</button>
                            </div>
                          </div>
                        )}
                        {step.verify === 'clinical' && (
                          isLead
                            ? <label className="mt-3 flex items-center gap-2 text-sm text-marble/80">
                              <input type="checkbox" checked={verified} disabled={verified || waiting || blocked} onChange={() => publish({ type: 'verify', eid, by: account, stepId: step.id })} />
                              <ShieldCheck size={15} className="text-[#63c9a8]" /> Confirm the mission-authorized instruction was followed
                            </label>
                            : <p className="mt-3 text-xs text-marble/50">Requires confirmation from the medical lead.</p>
                        )}
                        {cannot === step.id && (
                          <div className="mt-4 border border-[#e39b4b]/50 p-3">
                            <div className="font-mono text-[9px] tracking-[0.15em] text-[#f3c28d]">IF THIS STEP CANNOT BE COMPLETED</div>
                            <p className="mt-1 text-sm text-marble">{step.ifCannot}</p>
                            <button onClick={() => complete(step.id, 'cannot')} className="mt-3 min-h-10 bg-[#e39b4b] px-4 text-xs font-semibold text-[#17100a]">RECORD AND CONTINUE</button>
                          </div>
                        )}
                        {!done && !waiting && !step.ask && (
                          <div className="mt-4 flex gap-2">
                            <button onClick={() => setCannot(cannot === step.id ? undefined : step.id)} className="min-h-11 border border-marble/25 px-4 text-sm text-marble/75">Can't do this</button>
                            <button onClick={() => complete(step.id, 'done')} disabled={needsVerify || blocked}
                              className="flex min-h-11 flex-1 items-center justify-center gap-2 bg-[#e45b5b] px-4 text-sm font-semibold text-[#16090a] hover:bg-[#ff8585] disabled:cursor-not-allowed disabled:opacity-40">
                              <Check size={16} /> Mark complete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : (
          <section className="border border-marble/10 p-6 text-center">
            <CircleDashed className="mx-auto text-marble/35" size={30} />
            <h2 className="mt-3 text-lg font-semibold text-marble">Stand by</h2>
            <p className="mt-1 text-sm text-marble/60">You have no assigned procedure steps right now. Remain available for the response lead.</p>
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
