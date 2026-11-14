import { Siren } from 'lucide-react';
import { crew } from '../emergency/data';
import { publish, useLog } from '../emergency/sync';

// Someone pressed the emergency button on their CHIRON LINK band. Every device shows who,
// where, their latest readings and whether the band can still communicate.
export function SosAlerts({ hidden, account, onRespond }: { hidden: boolean; account: string; onRespond: (crewId: string) => void }) {
  const log = useLog();
  const open = log.filter((e) => e.type === 'sos').filter((s) =>
    !log.some((e) => (e.type === 'sos-clear' && e.sosId === s.id) || (e.type === 'start' && s.type === 'sos' && e.patientId === s.crewId && e.t > s.t)));
  const s = open[open.length - 1];
  if (hidden || !s || s.type !== 'sos') return null;
  const who = crew.find((c) => c.id === s.crewId)?.name ?? s.crewId;

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-[#020408]/85 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="sos-title">
      <section className="w-full max-w-xl border-2 border-[#e45b5b] bg-[#100c10] p-6">
        <div className="flex items-center gap-3 font-mono text-xs tracking-[0.2em] text-[#ff8585]"><Siren className="animate-pulse" /> LINK EMERGENCY BUTTON PRESSED</div>
        <h2 id="sos-title" className="mt-2 text-3xl font-semibold text-marble">{who}</h2>
        <dl className="mt-4 space-y-2 text-base">
          <div className="flex gap-3"><dt className="w-40 shrink-0 text-marble/55">Location</dt><dd className="text-marble">{s.comms ? '' : 'Last known: '}{s.location}</dd></div>
          <div className="flex gap-3"><dt className="w-40 shrink-0 text-marble/55">Latest readings</dt><dd className="text-marble">{s.readings}</dd></div>
          <div className="flex gap-3"><dt className="w-40 shrink-0 text-marble/55">Band connection</dt><dd className={s.comms ? 'text-[#7bd5b8]' : 'text-[#f3c28d]'}>{s.comms ? 'Still connected' : 'Lost: go to them in person'}</dd></div>
          <div className="flex gap-3"><dt className="w-40 shrink-0 text-marble/55">Pressed at</dt><dd className="text-marble">{new Date(s.t).toISOString().slice(11, 19)} GMT</dd></div>
        </dl>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => publish({ type: 'sos-clear', by: account, sosId: s.id })} className="min-h-12 border border-marble/25 px-4 text-sm text-marble/80">False alarm</button>
          <button type="button" onClick={() => onRespond(s.crewId)} className="min-h-12 bg-[#e45b5b] px-5 font-mono text-sm font-semibold tracking-[0.15em] text-[#130709]">START RESPONSE FOR {who.split(' ')[0].toUpperCase()}</button>
        </div>
        <p className="mt-3 text-right text-xs text-mute">Simulated LINK alert.</p>
      </section>
    </div>
  );
}
