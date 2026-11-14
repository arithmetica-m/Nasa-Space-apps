import { useState } from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import type { Mission } from '../types';
import { DELAY_MIN } from '../emergency/plan';

// MISSION OVERVIEW: where the spacecraft is and what each stage of the journey means.
// Mission information only. Health history lives elsewhere and is never drawn on this line.

interface Stage { from: number; to: number; title: string; endTitle: string; health?: string }

export function stagesOf(m: Mission): Stage[] {
  const points = [{ day: 0, title: m.startLabel, health: undefined as string | undefined },
    ...m.milestones.filter((x) => x.day > 0 && x.day < m.totalDays).map((x) => ({ day: x.day, title: x.title, health: x.health })),
    { day: m.totalDays, title: m.endLabel, health: m.milestones.find((x) => x.day === m.totalDays)?.health }];
  return points.slice(1).map((p, i) => ({ from: points[i].day, to: p.day, title: `${points[i].title} → ${p.title}`, endTitle: p.title, health: p.health }));
}

export function whereIs(m: Mission) {
  if (m.id === 'iss') return 'Low Earth orbit, about 400 km above Earth';
  if (m.id === 'moon') return m.today < 5 ? 'Travelling to the Moon' : 'On the lunar surface';
  if (m.id === 'mars-transit') return 'In deep space, between Earth and Mars';
  return 'On the surface of Mars';
}

export function phaseOf(m: Mission) {
  const s = stagesOf(m).find((x) => m.today >= x.from && m.today < x.to) ?? stagesOf(m).slice(-1)[0];
  return s.title;
}

export function MissionTimeline({ mission, compact = false }: { mission: Mission; compact?: boolean }) {
  const stages = stagesOf(mission);
  const [zoom, setZoom] = useState<number>();
  const stage = zoom !== undefined ? stages[zoom] : undefined;
  const from = stage?.from ?? 0;
  const to = stage?.to ?? mission.totalDays;
  const pos = (d: number) => `${((d - from) / (to - from)) * 100}%`;
  const here = mission.today >= from && mission.today <= to;
  const ticks = stage ? Array.from({ length: Math.floor((to - from) / 7) + 1 }, (_, i) => from + i * 7) : [];
  const delay = DELAY_MIN[mission.id];

  return (
    <section aria-label="Mission overview" className="border border-marble/10 bg-void/75 p-4 backdrop-blur-md md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-lg tracking-[0.15em] text-marble">MISSION · {mission.name.toUpperCase()}</h2>
          <p className="flex items-center gap-1.5 text-sm text-marble/70"><MapPin size={14} className="text-gold" /> {whereIs(mission)} · day {mission.today} of {mission.totalDays}</p>
        </div>
        {stage && <button type="button" onClick={() => setZoom(undefined)} className="flex min-h-10 items-center gap-1 border border-marble/20 px-3 text-sm text-marble/75 hover:text-marble"><ArrowLeft size={14} /> Whole mission</button>}
      </div>

      {/* The line: click a stage to zoom into it */}
      <div className="relative mt-6 h-14">
        <div className="absolute inset-x-0 top-5 h-px bg-marble/20" />
        {!stage && stages.map((s, i) => (
          <button key={i} type="button" onClick={() => setZoom(i)} title={`Open ${s.title}`}
            className={`absolute top-1 h-8 border-x border-marble/20 hover:bg-gold/10 ${mission.today >= s.from && mission.today < s.to ? 'bg-gold/[0.07]' : ''}`}
            style={{ left: pos(s.from), width: `calc(${pos(s.to)} - ${pos(s.from)})` }}
            aria-label={`Stage: ${s.title}, days ${s.from} to ${s.to}`} />
        ))}
        {ticks.map((d) => <span key={d} className="absolute top-3.5 h-3 w-px bg-marble/30" style={{ left: pos(d) }} />)}
        <div className="absolute top-5 h-px bg-gold/80" style={{ left: 0, width: here ? pos(mission.today) : mission.today > to ? '100%' : '0%' }} />
        {here && (
          <div className="absolute top-2 -translate-x-1/2 text-center" style={{ left: pos(mission.today) }}>
            <div className="mx-auto h-3 w-3 rotate-45 border border-gold bg-void" style={{ marginTop: 9 }} />
            <div className="mt-1 whitespace-nowrap font-mono text-[10px] tracking-[0.15em] text-gold">NOW · DAY {mission.today}</div>
          </div>
        )}
        <span className="absolute left-0 top-9 font-mono text-[10px] text-marble/60">DAY {from}</span>
        <span className="absolute right-0 top-9 font-mono text-[10px] text-marble/60">DAY {to}</span>
      </div>

      {!stage ? (
        <>
          <ul className={`mt-3 grid gap-2 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
            {stages.map((s, i) => {
              const now = mission.today >= s.from && mission.today < s.to;
              return (
                <li key={i}>
                  <button type="button" onClick={() => setZoom(i)} className={`min-h-14 w-full border px-3 py-2 text-left hover:border-gold/60 ${now ? 'border-gold/50' : 'border-marble/10'}`}>
                    <span className="block text-sm text-marble">{s.title}</span>
                    <span className="block text-xs text-marble/55">Days {s.from}–{s.to}{now ? ' · NOW' : mission.today >= s.to ? ' · done' : ` · in ${s.from - mission.today} days`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-mute">Tap a stage to zoom in. Mission conditions: {mission.gravity} gravity · Earth delay {mission.delayLabel} each way · about {mission.radiationPerDay} mSv/day (simulated).</p>
        </>
      ) : (
        <div className="mt-4 grid gap-3 text-[15px] md:grid-cols-2">
          <div>
            <div className="font-mono text-[11px] tracking-[0.2em] text-marble/50">THIS STAGE</div>
            <p className="text-marble">{stage.title}</p>
            <p className="text-sm text-marble/65">Days {stage.from}–{stage.to} ({stage.to - stage.from} days){mission.today < stage.from ? ` · starts in ${stage.from - mission.today} days` : mission.today < stage.to ? ` · ${stage.to - mission.today} days left` : ' · completed'}</p>
          </div>
          <div>
            <div className="font-mono text-[11px] tracking-[0.2em] text-marble/50">CONDITIONS</div>
            <p className="text-sm text-marble/85">Gravity {mission.gravity} · Earth delay {mission.delayLabel} each way{delay >= 5 ? ' (Earth cannot help in real time)' : ''} · radiation about {mission.radiationPerDay} mSv/day (simulated)</p>
          </div>
          {stage.health && (
            <div className="md:col-span-2">
              <div className="font-mono text-[11px] tracking-[0.2em] text-gold">MEDICAL NOTE FOR “{stage.endTitle.toUpperCase()}”</div>
              <p className="text-marble/90">{stage.health}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
