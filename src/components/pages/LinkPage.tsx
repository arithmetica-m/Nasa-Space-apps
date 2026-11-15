import { useMemo } from 'react';
import { BatteryLow, Lock, MapPin, Siren, Watch } from 'lucide-react';
import type { MissionId } from '../../types';
import type { CrewMember, Procedure } from '../../emergency/types';
import { buildPlan, casesFrom } from '../../emergency/plan';
import { crewLines } from '../../emergency/board';
import { categoryText } from '../../emergency/report';
import { publish, useLog } from '../../emergency/sync';
import { HAPTICS, ago, type LinkStatus } from '../../link/link';
import { PageShell, Panel } from './ui';
import { LinkFlow } from './LinkFlow';
import { CapsulePanel } from '../CapsulePanel';

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

type Screen = { eid?: string; head: string; lines: string[]; tone: 'red' | 'gold' | 'plain' | 'calm' };

const availability = (l: LinkStatus) => !l.connected ? { text: 'Unknown', tone: 'text-[#f3c28d]' }
  : l.eva ? { text: 'Busy · EVA', tone: 'text-[#f3c28d]' }
    : /EVA/.test(l.activity) ? { text: 'Busy · EVA prep', tone: 'text-[#f3c28d]' }
      : { text: 'Free to help', tone: 'text-[#7bd5b8]' };

// CHIRON LINK: the band each astronaut wears. Pick a band to see what is on it and to try what happens offline.
export function LinkPage({ mission, crew, links, kb, now, onProfile, account, onJoin }: Props) {
  const log = useLog();

  // What each band's screen shows: the same assignment the emergency screen shows.
  const screens = useMemo(() => {
    const out: Record<string, Screen[]> = {};
    const cases = casesFrom(log);
    for (const c of cases.filter((x) => !x.ended && x.mission === mission)) {
      const plan = buildPlan(c, kb, log, cases);
      for (const l of crewLines(c, plan, log, links)) {
        const what = categoryText[c.category];
        const entry: Screen = l.state === 'PATIENT'
          ? { eid: c.eid, head: 'MEDICAL EMERGENCY', tone: 'red', lines: [what, 'Stay still. Your crew is helping.'] }
          : l.state === 'ASSIGNED'
            ? { eid: c.eid, head: 'TASK ASSIGNED', tone: 'gold', lines: [`${plan.patient.name.split(' ')[0]} · ${what}`, `Role: ${l.roleText}`, plan.confirmed ? 'Confirmed by the lead' : 'Proposed · lead to confirm'] }
            : { eid: c.eid, head: 'NO TASK ASSIGNED', tone: 'plain', lines: [`${plan.patient.name.split(' ')[0]} · ${what}`, 'Stay available.'] };
        (out[l.member.id] ??= []).push(entry);
      }
    }
    return out;
  }, [log, kb, links, mission]);

  const screenOf = (id: string): Screen => {
    const l = links[id];
    const s = screens[id]?.[0];
    if (s) return s;
    if (l.warnings.length) return { head: 'HEALTH WARNING', tone: 'gold', lines: ['Open your profile.'] };
    return { head: 'ALL CLEAR', tone: 'calm', lines: [l.activity] };
  };

  const pressButton = (l: LinkStatus) => {
    const hr = l.readings.find((r) => r.key === 'hr');
    const spo2 = l.readings.find((r) => r.key === 'spo2');
    publish({
      type: 'sos', by: l.crewId, crewId: l.crewId, location: l.location, comms: l.connected,
      readings: l.connected ? `HR ${hr?.value ?? '—'} bpm, SpO₂ ${spo2?.value ?? '—'}% (LINK, simulated, just now)` : `No live readings: band disconnected ${ago(l.lastSync, now)}`,
    });
  };

  const bands = crew.map((c) => links[c.id]);
  // Only your own band: sign in to see it.
  const member = crew.find((c) => c.id === account);
  if (!member) {
    return (
      <PageShell title="CHIRON LINK" intro="Every astronaut wears a LINK band. It measures, sends readings to CHIRON, and shows alerts and tasks.">
        <Panel>
          <p className="flex items-center gap-2 text-lg text-marble"><Lock size={18} className="text-gold" /> Your band is private. Sign in to see it.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {crew.map((c) => (
              <button key={c.id} type="button" onClick={() => onProfile(c.id)} className="min-h-12 border border-marble/25 px-4 text-base text-marble hover:border-gold">
                I am {c.name.split(' ')[0]}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-marble/55">{bands.filter((b) => b.connected).length} of {bands.length} crew bands are connected.</p>
        </Panel>
      </PageShell>
    );
  }
  const l = links[member.id];
  const first = member.name.split(' ')[0];
  const live = screens[member.id] ?? [];

  return (
    <PageShell title="CHIRON LINK" intro="Your LINK band measures, sends your readings to CHIRON, and shows you alerts and tasks.">
      {/* How it works, in three steps */}
      <ol className="grid gap-2 sm:grid-cols-3">
        {[['1', 'MEASURES', 'Your heart rate, blood oxygen, skin temperature, sleep and where you are.'], ['2', 'SENDS TO CHIRON', 'Over the crew network. Offline? It keeps a copy and catches up later.'], ['3', 'SHOWS YOU', 'Alerts, tasks and emergencies, with a vibration.']].map(([n, t, d]) => (
          <li key={n} className="flex gap-3 border border-marble/10 bg-void/70 p-3">
            <span className="font-serif text-2xl text-gold">{n}</span>
            <div><div className="font-mono text-[11px] tracking-[0.2em] text-gold">{t}</div><p className="mt-1 text-sm text-marble/75">{d}</p></div>
          </li>
        ))}
      </ol>


      {/* Your band */}
      <Panel title={`YOUR BAND · ${first.toUpperCase()}`} tag="SIMULATED" tone={l.connected ? undefined : 'warn'}>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-base text-marble/80">
          <span><Watch size={15} className="mr-1 inline text-gold" />{l.connected ? 'Connected' : `Offline since ${ago(l.lastSync, now)}`}</span>
          <span>{l.battery < 25 && <BatteryLow size={15} className="mr-1 inline text-[#e39b4b]" />}Battery {l.battery}%</span>
          <span><MapPin size={15} className="mr-1 inline" />{l.connected ? 'In' : 'Last seen in'} {l.location}</span>
          <span>Doing: {l.activity}</span>
          <span className={availability(l).tone}>{availability(l).text}</span>
        </div>
        <button type="button" onClick={() => onProfile(member.id)} className="mt-2 text-sm text-gold underline underline-offset-4">Your readings are on your profile →</button>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="space-y-4">
            <div>
              <div className="font-mono text-[11px] tracking-[0.2em] text-marble/50">ON THE BAND’S SCREEN NOW</div>
              <div className="mt-2 max-w-sm"><WatchFace screen={screenOf(member.id)} offline={!l.connected} /></div>
              {live.map((m) => m.eid && (
                <div key={m.eid} className="mt-2 max-w-sm">
                  <button type="button" onClick={() => onJoin(m.eid!)} className="min-h-12 w-full border border-marble/30 text-base font-semibold text-marble hover:border-gold">{m.tone === 'gold' ? 'VIEW INSTRUCTIONS' : 'OPEN THE EMERGENCY'}</button>
                  <div className={`mt-1 text-sm ${l.connected ? 'text-[#7bd5b8]' : 'text-[#f3c28d]'}`}>{l.connected ? '✓ Delivered to the band' : 'Not delivered: band offline. Tell them in person.'}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="font-mono text-[11px] tracking-[0.2em] text-marble/50">EMERGENCY BUTTON ON THE BAND</div>
              <p className="mt-1 text-sm text-marble/65">One press alerts every CHIRON screen: who, where, and their latest readings.</p>
              {l.connected ? (
                <button type="button" onClick={() => pressButton(l)} className="mt-2 flex min-h-12 items-center gap-2 border border-[#e45b5b]/60 px-4 font-mono text-xs tracking-[0.15em] text-[#ff8585] hover:bg-[#e45b5b]/10">
                  <Siren size={15} /> PRESS IT (SIMULATED)
                </button>
              ) : (
                <p className="mt-2 text-sm text-[#f3c28d]">Offline: the button cannot reach CHIRON. Check on {first} in person.</p>
              )}
            </div>
          </div>

          <CapsulePanel key={member.id} member={member} link={l} crew={crew} now={now} />
        </div>

        {l.connected && <div className="mt-4"><LinkFlow link={l} name={member.name} now={now} onProfile={() => onProfile(member.id)} /></div>}
      </Panel>

      <Panel title="WHAT THE VIBRATIONS MEAN">
        <ul className="grid gap-2 sm:grid-cols-3">
          {HAPTICS.map((h) => <li key={h.name} className="border border-marble/10 p-3"><div className="font-mono text-lg tracking-[0.3em] text-gold">{h.pattern}</div><div className="text-base text-marble">{h.meaning}</div></li>)}
        </ul>
        <p className="mt-2 text-xs text-mute">Example patterns. Vibration only adds to the screen; it never replaces it.</p>
      </Panel>
    </PageShell>
  );
}

// A simple band screen: what the astronaut sees on their wrist.
function WatchFace({ screen, offline, small }: { screen: Screen; offline: boolean; small?: boolean }) {
  const color = screen.tone === 'red' ? 'text-[#ff8585]' : screen.tone === 'gold' ? 'text-gold' : screen.tone === 'calm' ? 'text-[#7bd5b8]' : 'text-marble/85';
  const ring = screen.tone === 'red' ? 'border-[#e45b5b]/70' : screen.tone === 'gold' ? 'border-gold/60' : 'border-marble/20';
  return (
    <div className={`mt-2 rounded-[22px] border-2 ${ring} bg-[#05070c] ${small ? 'px-3 py-2.5' : 'px-4 py-4'} ${offline ? 'opacity-55' : ''}`}>
      <div className={`font-mono ${small ? 'text-[11px]' : 'text-sm'} font-semibold tracking-[0.15em] ${color}`}>{offline ? 'NO SIGNAL' : screen.head}</div>
      {!offline && screen.lines.slice(0, small ? 1 : 3).map((x) => <div key={x} className={`${small ? 'truncate text-xs' : 'text-base'} text-marble/80`}>{x}</div>)}
      {offline && <div className={`${small ? 'text-xs' : 'text-base'} text-marble/70`}>Working from its offline copy</div>}
    </div>
  );
}
