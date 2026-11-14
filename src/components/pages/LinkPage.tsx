import { useMemo } from 'react';
import { ArrowDownUp, BatteryLow, Siren, Watch } from 'lucide-react';
import type { MissionId } from '../../types';
import type { CrewMember, Procedure } from '../../emergency/types';
import { buildPlan, casesFrom, rolesOf } from '../../emergency/plan';
import { publish, useLog } from '../../emergency/sync';
import { HAPTICS, ago, type LinkStatus } from '../../link/link';
import { LinkStrip } from './ProfilePage';
import { PageShell, Panel, Tag } from './ui';
import { LinkFlow } from './LinkFlow';
import { roleOf } from '../MissionDashboard';

interface Props {
  mission: MissionId;
  crew: CrewMember[];
  links: Record<string, LinkStatus>;
  kb: Procedure[];
  now: number;
  onProfile: (id: string) => void;
}

// CHIRON LINK: every astronaut's wearable, and what travels between it and CHIRON CORE.
export function LinkPage({ mission, crew, links, kb, now, onProfile }: Props) {
  const log = useLog();
  // What CORE has sent to each band: the person's current emergency task, if any.
  const sent = useMemo(() => {
    const out: Record<string, string[]> = {};
    const cases = casesFrom(log);
    for (const c of cases.filter((x) => !x.ended && x.mission === mission)) {
      const plan = buildPlan(c, kb, log, cases);
      for (const m of crew) {
        if (m.id === c.patientId) { (out[m.id] ??= []).push('Emergency alert: you are the patient. Your crew is coming.'); continue; }
        const task = plan.tasks.find((t) => rolesOf(plan.roles, m.id).includes(t.step.role) && t.status === 'ready');
        (out[m.id] ??= []).push(task ? `New task: ${task.step.text}` : `Emergency alert: ${plan.patient.name} needs help.`);
      }
    }
    return out;
  }, [log, kb, crew, mission]);

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
        const msgs = sent[c.id] ?? [];
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
            <div className="mt-3"><LinkStrip link={l} now={now} /></div>
            {l.connected && <div className="mt-3"><LinkFlow link={l} name={c.name} now={now} onProfile={() => onProfile(c.id)} /></div>}
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-marble/50"><ArrowDownUp size={14} /> SENT FROM CORE TO THIS BAND</div>
                {msgs.length === 0 ? <p className="mt-1 text-sm text-marble/60">Nothing right now.</p> : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {msgs.map((m) => (
                      <li key={m} className="text-marble">
                        {m}<br />
                        <span className={l.connected ? 'text-[#7bd5b8]' : 'text-[#f3c28d]'}>
                          {l.connected ? `Delivered · vibrated ${m.startsWith('New task') ? '● ●' : '● ● ● ● ●'} · receipt confirmed` : 'NOT DELIVERED: band offline. Tell them in person.'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
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
