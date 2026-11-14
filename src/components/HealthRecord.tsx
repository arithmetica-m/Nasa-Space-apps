import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import type { DayRecord, Mark, Mission } from '../types';
import { indicators, indicatorById } from '../data/indicators';
import { outsideness, stateFor } from '../data/simulate';
import { markColor, markLabel, stateColor, stateLabel } from '../lib/theme';
import { Frieze, type FocusItem, type Selection } from './Frieze';
import { GreekKey } from './Brand';

function FocusCard({ item, mission }: { item: FocusItem; mission: Mission }) {
  const m = item.milestone;
  const days = m.day - mission.today;
  return (
    <div className="rise mt-2 border border-marble/20 bg-void/60 p-3 text-sm">
      <div className="font-mono text-[10px] tracking-[0.25em] text-marble/70">MISSION MILESTONE · DAY {m.day} · {days > 0 ? `IN ${days} DAYS` : days === 0 ? 'TODAY' : `${-days} DAYS AGO`}</div>
      <div className="mt-1 font-serif tracking-[0.08em] text-marble">{m.title}</div>
      <p className="mt-1 text-xs text-marble/70">{m.health}</p>
    </div>
  );
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MOOD = ['', 'Very low', 'Low', 'Okay', 'Good', 'Very good'];

// Calendar date of a mission day, counting back from today.
function dateOf(mission: Mission, day: number) {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (mission.today - day));
  return d;
}
const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

const KEY = [
  { id: 'hr', label: 'Heart rate' },
  { id: 'sleep_h', label: 'Sleep' },
  { id: 'mood', label: 'Mood' },
];

function show(id: string, v: number | undefined) {
  if (v === undefined) return 'Not logged';
  if (id === 'mood') return MOOD[Math.round(v)] ?? String(v);
  return `${v} ${indicatorById(id).unit}`;
}

function KeyCard({ id, label, value }: { id: string; label: string; value?: number }) {
  const ind = indicatorById(id);
  const out = value !== undefined && outsideness(ind, value) > 0.05;
  return (
    <div className="border border-marble/10 bg-void/40 px-3 py-2.5">
      <div className="font-mono text-[9px] tracking-[0.25em] text-mute">{label.toUpperCase()}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-serif text-xl text-marble">{show(id, value)}</span>
      </div>
      <div className="mt-0.5 text-[11px]" style={{ color: value === undefined ? '#8b8576' : out ? stateColor.caution : stateColor.nominal }}>
        {value === undefined ? '—' : out ? 'Outside your normal' : 'Within your normal'}
      </div>
    </div>
  );
}

interface Props {
  mission: Mission;
  records: DayRecord[];
  marks: Mark[];
  selection: Selection;
  onSelect: (s: Selection) => void;
}

// The baseline line, always visible. Day details stay folded away until the
// astronaut picks a day or opens them, so the everyday view stays simple.
export function HealthRecord({ mission, records, marks, selection, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<FocusItem>();
  const today = records.length - 1;
  const single = selection.from === selection.to;
  const day = selection.to;
  const rec = records[day];
  const pick = (s: Selection) => { onSelect(s); setOpen(true); };
  const go = (d: number) => pick({ from: Math.max(0, Math.min(today, d)), to: Math.max(0, Math.min(today, d)) });

  // Monday-to-Sunday week around the selected day.
  const selDate = dateOf(mission, day);
  const monOffset = (selDate.getUTCDay() + 6) % 7;
  const week = Array.from({ length: 7 }, (_, i) => day - monOffset + i);

  const inRange = (d: number) => d >= selection.from && d <= selection.to;
  const events = marks.filter((m) => inRange(m.day));
  const rangeRecs = records.slice(selection.from, selection.to + 1);
  const avg = (id: string) => {
    const vals = rangeRecs.map((r) => r.values[id]).filter((v): v is number => v !== undefined);
    return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(id === 'sleep_h' || id === 'mood' ? 1 : 0) : undefined;
  };
  const outside = single
    ? indicators.filter((i) => rec.values[i.id] !== undefined && outsideness(i, rec.values[i.id]!) > 0.05)
    : [];
  const daysOutside = rangeRecs.filter((r) => r.drift >= 0.3).length;
  const state = stateFor(rec.drift);

  return (
    <section className="border-t border-gold/25 bg-void/80 backdrop-blur-md">
      <div className="-mt-px"><GreekKey width={180} className="opacity-70" /></div>
      <div className="px-5 pb-4 pt-2 md:px-8">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <h2 className="font-serif text-lg tracking-[0.25em] text-marble">YOUR HEALTH SINCE LAUNCH</h2>
          {open && (
            <span className="font-mono text-[10px] tracking-[0.3em] text-mute">
              {single ? `MISSION DAY ${day} · ${fmtDate(selDate).toUpperCase()}` : `DAYS ${selection.from} TO ${selection.to} · ${rangeRecs.length} DAYS`}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {open && (
              <>
                <button onClick={() => go(day - 1)} disabled={day <= 0} aria-label="Previous day" className="flex h-8 w-8 items-center justify-center border border-marble/15 text-marble/70 hover:border-gold/60 hover:text-gold disabled:opacity-30"><ChevronLeft size={16} /></button>
                <button onClick={() => go(day + 1)} disabled={day >= today} aria-label="Next day" className="flex h-8 w-8 items-center justify-center border border-marble/15 text-marble/70 hover:border-gold/60 hover:text-gold disabled:opacity-30"><ChevronRight size={16} /></button>
                <button onClick={() => go(today)} className="h-8 border border-marble/15 px-3 font-mono text-[10px] tracking-[0.25em] text-marble/70 hover:border-gold/60 hover:text-gold">TODAY</button>
              </>
            )}
            <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex h-8 items-center gap-1.5 border border-marble/15 px-3 font-mono text-[10px] tracking-[0.25em] text-marble/70 hover:border-gold/60 hover:text-gold">
              {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />} {open ? 'HIDE DETAILS' : 'DAY DETAILS'}
            </button>
          </div>
        </div>

        <div className="mt-2">
          <Frieze records={records} totalDays={mission.totalDays} marks={marks} selection={selection} onSelect={pick}
            milestones={mission.milestones} onFocus={setFocus} />
          <div className="mt-1 px-1 text-[10px] text-mute">
            Health readings are simulated for this demonstration, not clinical measurements.
          </div>
          {focus && <FocusCard item={focus} mission={mission} />}
        </div>

        {open && <div className="rise mt-3 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Week strip */}
          <div>
            <div className="grid grid-cols-7 gap-1">
              {week.map((d, i) => {
                const valid = d >= 0 && d <= today;
                const s = valid ? stateFor(records[d].drift) : undefined;
                const active = valid && inRange(d);
                return (
                  <button key={i} disabled={!valid} onClick={() => go(d)}
                    className={`flex flex-col items-center gap-1 border py-1.5 transition ${active ? 'border-gold/80 bg-gold/10' : 'border-marble/10 hover:border-marble/30'} disabled:opacity-25`}>
                    <span className="font-mono text-[9px] text-mute">{WEEKDAYS[i]}</span>
                    <span className={`font-mono text-xs ${d === today ? 'text-gold' : 'text-marble'}`}>{valid ? d : '·'}</span>
                    <span className="h-1 w-1 rounded-full" style={{ background: s ? stateColor[s] : 'transparent' }} />
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-mute">Click a day, or drag across the trace to compare a range.</p>
          </div>

          {/* Summary for the selected day or range */}
          <div>
            {single ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em]" style={{ color: stateColor[state] }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: stateColor[state] }} />{stateLabel[state].toUpperCase()}
                  </span>
                  {!rec.logged && <span className="font-mono text-[10px] tracking-[0.2em] text-mute">NO DAILY CHECK-IN THIS DAY</span>}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {KEY.map((k) => <KeyCard key={k.id} id={k.id} label={k.label} value={rec.values[k.id]} />)}
                </div>
                {outside.length > 0 && (
                  <p className="mt-2 text-xs text-marble/70">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-gold">CHIRON: </span>
                    Outside your normal: {outside.map((i) => `${i.name.toLowerCase()} ${show(i.id, rec.values[i.id])}`).join(', ')}.
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {KEY.map((k) => <KeyCard key={k.id} id={k.id} label={`Average ${k.label.toLowerCase()}`} value={avg(k.id)} />)}
                </div>
                <p className="mt-2 text-xs text-marble/70">
                  <span className="font-mono text-[10px] tracking-[0.2em] text-gold">CHIRON: </span>
                  {daysOutside === 0 ? 'Every day in this range was within your normal.' : `${daysOutside} of ${rangeRecs.length} days were outside your normal.`}
                </p>
              </>
            )}
            {events.length > 0 && (
              <ul className="mt-2 space-y-1">
                {events.map((m) => (
                  <li key={`${m.day}-${m.kind}`} className="text-xs text-marble/80">
                    <span className="mr-2 font-mono text-[10px] tracking-[0.2em]" style={{ color: markColor[m.kind] }}>DAY {m.day} · {markLabel[m.kind].toUpperCase()}</span>
                    <span className="font-medium">{m.title}.</span> <span className="text-marble/60">{m.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>}
      </div>
    </section>
  );
}
