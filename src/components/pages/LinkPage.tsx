import { useMemo } from 'react';
import { ArrowDownUp, BatteryLow, Lock, Siren, Watch } from 'lucide-react';
import type { MissionId } from '../../types';
import type { CrewMember, Procedure } from '../../emergency/types';
import { buildPlan, casesFrom } from '../../emergency/plan';
import { crewLines } from '../../emergency/board';
import { categoryText } from '../../emergency/report';
import { publish, useLog } from '../../emergency/sync';
import { HAPTICS, ago, type LinkStatus } from '../../link/link';
import { PageShell, Panel, Tag } from './ui';
import { LinkFlow } from './LinkFlow';
import { CapsulePanel } from '../CapsulePanel';
import { roleOf } from '../MissionDashboard';

interface Props {
  mission: MissionId;
  crew: CrewMember[];
  links: Record<string, LinkStatus>;
  kb: Procedure[];
  now: number;
  onProfile: (id: string) => void;
  account: string;
  onJoin: (eid: string) => void;
}

// CHIRON LINK: every astronaut's wearable, and what travels between it and CHIRON CORE.
export function LinkPage({ mission, crew, links, kb, now, onProfile, account, onJoin }: Props) {
  const log = useLog();
  // What each band shows during an emergency: the same assignment the emergency screen shows.
  const band = useMemo(() => {
    const out: Record<string, { eid: string; head: string; lines: string[]; tone: 'red' | 'gold' | 'plain' }[]> = {};
    const cases = casesFrom(log);
    for (const c of cases.filter((x) => !x.ended && x.mission === mission)) {
      const plan = buildPlan(c, kb, log, cases);
      for (const l of crewLines(c, plan, log, links)) {
        const what = categoryText[c.category];
        const entry = l.state === 'PATIENT'
          ? { eid: c.eid, head: 'MEDICAL EMERGENCY ACTIVE', tone: 'red' as const, lines: [`${l.member.name} · ${what}`, plan.roles.lead.person ? `${plan.roles.lead.person.name.split(' ')[0]} is leading. Stay still: your crew is helping.` : 'Stay still: your crew is helping.', `Crew progress: ${plan.tasks.filter((t) => t.status === 'done' || t.status === 'cannot').length} of ${plan.tasks.length} steps`] }
          : l.state === 'ASSIGNED'
            ? { eid: c.eid, head: 'EMERGENCY — TASK ASSIGNED', tone: 'gold' as const, lines: [`${plan.patient.name.split(' ')[0]} · ${what}`, `Your role: ${l.roleText}`, `Now: ${l.responsibility}`, `Status: ${l.taskState} · step ${Math.min(l.done + 1, l.total)} of ${l.total}`, plan.confirmed ? 'Assignment CONFIRMED by the response lead' : 'Assignment PROPOSED: waiting for the response lead to confirm'] }
            : { eid: c.eid, head: 'EMERGENCY — NO TASK ASSIGNED', tone: 'plain' as const, lines: [`${plan.patient.name.split(' ')[0]} · ${what}`, 'Remain available. Follow updates from CHIRON.', `Your status: ${l.state}${l.why ? ` (${l.why})` : ''}`] };
        (out[l.member.id] ??= []).push(entry);
      }
    }
    return out;
  }, [log, kb, links, mission]);

  const pressButton = (l: LinkStatus) => {
    const hr = l.readings.find((r) => r.key === 'hr');
    const spo2 = l.readings.find((r) => r.key === 'spo2');
    publish({
      type: 'sos', by: l.crewId, crewId: l.crewId, location: l.location, comms: l.connected,
      readings: l.connected ? `HR ${hr?.value ?? '—'} bpm, SpO₂ ${spo2?.value ?? '—'}% (LINK, simulated, just now)` : `No live readings: band disconnected ${ago(l.lastSync, now)}`,
    });
  };

  const bands = crew.map((c) => links[c.id]);
  return (
    <PageShell title="CHIRON LINK · CREW NETWORK">
      <div className="flex flex-wrap gap-4 text-base">
        <span className="text-marble">{bands.filter((b) => b.connected).length} of {bands.length} connected</span>
        <span className="text-[#f3c28d]">{bands.filter((b) => !b.connected).length} disconnected</span>
        <span className="text-[#f3c28d]">{bands.reduce((n, b) => n + b.alerts.length, 0)} alerts</span>
        <Tag kind="SIMULATED" />
      </div>

      {crew.map((c) => {
        const l = links[c.id];
        const msgs = band[c.id] ?? [];
        return (
          <Panel key={c.id} title={c.name.toUpperCase()} tone={l.connected ? undefined : 'warn'}>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-marble/75">
              <span><Watch size={14} className="mr-1 inline text-gold" />{l.connected ? 'Connected' : `Disconnected ${ago(l.lastSync, now)}`}</span>
              <span>{l.battery < 25 && <BatteryLow size={14} className="mr-1 inline text-[#e39b4b]" />}Battery {l.battery}%</span>
              <span>{l.connected ? 'Location' : 'Last known location'}: {l.location}</span>
              <span>{l.eva ? 'On EVA' : 'Inside the spacecraft'}</span>
              <span>Doing: {l.activity}</span>
              <span className="text-gold">{roleOf(c)}</span>
              <span className={!l.connected ? 'text-[#f3c28d]' : l.eva || /EVA/.test(l.activity) ? 'text-[#f3c28d]' : 'text-[#7bd5b8]'}>{!l.connected ? 'Availability unknown' : l.eva ? 'Busy: on EVA' : /EVA/.test(l.activity) ? 'Busy: EVA preparation' : 'Available to help'}</span>
            </div>
            {<p className="mt-3 flex items-center gap-2 text-base text-marble/55"><Lock size={16} /> Readings are private: open {c.name.split(' ')[0]}’s profile to see them.{l.warnings.length > 0 && <span className="text-[#ff9c9c]"> A health warning is active.</span>}</p>}
            <div className="mt-3"><CapsulePanel key={c.id} member={c} link={l} crew={crew} now={now} /></div>
            {l.connected && account === c.id && <div className="mt-3"><LinkFlow link={l} name={c.name} now={now} onProfile={() => onProfile(c.id)} /></div>}
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-marble/50"><ArrowDownUp size={14} /> ON THIS BAND NOW</div>
                {msgs.length === 0 ? <p className="mt-1 text-base text-marble/60">No emergency. Nothing to show.</p> : msgs.map((m) => (
                  <div key={m.eid} className={`mt-2 rounded-2xl border-2 p-3 ${m.tone === 'red' ? 'border-[#e45b5b] bg-[#e45b5b]/10' : m.tone === 'gold' ? 'border-gold/70 bg-gold/[0.06]' : 'border-marble/25'}`}>
                    <div className={`text-base font-bold ${m.tone === 'red' ? 'text-[#ff8585]' : m.tone === 'gold' ? 'text-gold' : 'text-marble/80'}`}>{m.head}</div>
                    {m.lines.map((x) => <div key={x} className="text-base text-marble">{x}</div>)}
                    <button type="button" onClick={() => onJoin(m.eid)} className="mt-2 min-h-12 w-full border border-marble/30 text-base font-semibold text-marble hover:border-gold">{m.tone === 'gold' ? 'VIEW INSTRUCTIONS' : 'OPEN THE EMERGENCY SCREEN'}</button>
                    <div className={`mt-1 text-sm ${l.connected ? 'text-[#7bd5b8]' : 'text-[#f3c28d]'}`}>{l.connected ? 'Delivered to the band · alert received' : 'NOT DELIVERED: band offline. Tell them in person.'}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="font-mono text-[11px] tracking-[0.2em] text-marble/50">PHYSICAL EMERGENCY BUTTON</div>
                <p className="mt-1 text-sm text-marble/65">Pressing it alerts every CHIRON device with who, where, their latest readings and whether the band still has a connection.</p>
                {l.connected ? (
                  <button type="button" onClick={() => pressButton(l)} className="mt-2 flex min-h-11 items-center gap-2 border border-[#e45b5b]/60 px-4 font-mono text-xs tracking-[0.15em] text-[#ff8585] hover:bg-[#e45b5b]/10">
                    <Siren size={14} /> SIMULATE A BUTTON PRESS
                  </button>
                ) : (
                  <p className="mt-2 text-sm text-[#f3c28d]">Band offline: its button cannot reach CORE. Check on {c.name.split(' ')[0]} in person.</p>
                )}
              </div>
            </div>
          </Panel>
        );
      })}

      <Panel title="VIBRATION PATTERNS">
        <ul className="grid gap-2 sm:grid-cols-3">
          {HAPTICS.map((h) => <li key={h.name} className="border border-marble/10 p-3"><div className="font-mono text-lg tracking-[0.3em] text-gold">{h.pattern}</div><div className="text-base text-marble">{h.meaning}</div><div className="text-sm text-marble/55">{h.name}</div></li>)}
        </ul>
        <p className="mt-2 text-xs text-mute">Illustrative patterns. Real patterns would need testing and a standard. Vibration only adds to what is on screen; it never replaces it.</p>
      </Panel>
    </PageShell>
  );
}
