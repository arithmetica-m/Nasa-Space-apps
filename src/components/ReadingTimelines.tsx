import { useMemo, useState } from 'react';
import type { DayRecord, Indicator, Mission } from '../types';
import { indicators } from '../data/indicators';
import { outsideness } from '../data/simulate';
import { plansFor, progressOf } from '../recover/recovery';
import { Reasoning } from './Reasoning';

// The small timelines that make up the big health line. The big line is the average of how
// far every reading is from the person's normal, so each reading here "pulls" it by its share.
export function ReadingTimelines({ mission, records, crewId }: { mission: Mission; records: DayRecord[]; crewId: string }) {
  const [all, setAll] = useState(false);
  const plans = useMemo(() => plansFor(crewId, records), [crewId, records]);

  const rows = useMemo(() => {
    const recent = records.slice(-7);
    const score = (ind: Indicator) => {
      const vals = recent.map((r) => r.values[ind.id]).filter((v): v is number => v !== undefined);
      return vals.length ? vals.reduce((a, v) => a + Math.min(1, outsideness(ind, v)), 0) / vals.length : 0;
    };
    const scored = indicators.map((ind) => ({ ind, s: score(ind) }));
    const total = scored.reduce((a, x) => a + x.s, 0) || 1;
    return scored.map((x) => ({ ...x, share: Math.round((x.s / total) * 100) })).sort((a, b) => b.s - a.s);
  }, [records]);

  const pulling = rows.filter((r) => r.share > 0);
  const shown = all ? rows : pulling;

  return (
    <section aria-labelledby="parts-title" className="bg-void/80 px-5 pb-5 backdrop-blur-md md:px-8">
      {/* Connector from the big health line down to its parts */}
      <div className="mx-auto h-8 w-px bg-gold/60" />
      <h2 id="parts-title" className="text-center font-mono text-xs tracking-[0.22em] text-gold">↑ WHAT MAKES UP THE HEALTH LINE</h2>
      <p className="mt-1 text-center text-base text-marble/65">
        {pulling.length ? `${pulling.length} reading${pulling.length > 1 ? 's are' : ' is'} pulling it away from your normal this week.` : 'Every reading is within your normal this week.'}
      </p>

      <div className="relative ml-2 mt-4 space-y-3 border-l-2 border-gold/40 pl-6">
        {shown.map(({ ind, share }) => {
          const plan = plans.find((p) => p.measure === ind.id);
          const prog = plan ? progressOf(plan, records) : undefined;
          return (
            <div key={ind.id} className={`relative border p-3 ${share ? 'border-[#e39b4b]/40' : 'border-marble/10'}`}>
              <span className="absolute -left-6 top-1/2 h-0.5 w-6 bg-gold/40" aria-hidden="true" />
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="text-lg text-marble">{ind.name}</span>
                <span className={`text-base ${share ? 'text-[#f3c28d]' : 'text-marble/50'}`}>{share ? `${share}% of the change this week` : 'Within your normal'}</span>
              </div>
              {prog && <p className={`text-base ${prog.onTrack ? 'text-[#7bd5b8]' : 'text-[#f3c28d]'}`}>Back-to-normal plan: {prog.reached ? 'back to normal' : prog.onTrack ? 'getting better' : 'not improving yet'}</p>}
              <Spark ind={ind} records={records} total={mission.totalDays} />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => setAll(!all)} className="min-h-11 border border-marble/20 px-4 text-base text-marble/80 hover:border-gold/60">
          {all ? 'Show only the readings that pull the line' : `Show all ${rows.length} readings`}
        </button>
        <Reasoning steps={[
          { label: 'HOW THE BIG LINE IS MADE', lines: ['Every day, each reading gets a score: 0 inside your normal, up to 1 when far outside it.', 'The health line is the average of all scores, smoothed over 7 days.'] },
          { label: 'SHARE OF EACH READING', lines: pulling.length ? pulling.map((r) => `${r.ind.name}: ${r.share}% of this week’s total score.`) : ['All scores are 0 this week.'] },
          { label: 'SAME TIME SCALE', lines: ['Each small timeline covers the whole mission, like the big line, so changes line up above each other.'] },
        ]} />
      </div>
    </section>
  );
}

// One reading over the mission so far, against the person's normal band, on the mission's time scale.
function Spark({ ind, records, total }: { ind: Indicator; records: DayRecord[]; total: number }) {
  const pts = records.map((r) => ({ d: r.day, v: r.values[ind.id] })).filter((p): p is { d: number; v: number } => p.v !== undefined);
  if (pts.length < 2) return <p className="mt-1 text-sm text-marble/50">Not enough readings yet.</p>;
  const vs = [...pts.map((p) => p.v), ...ind.baseline];
  const lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const H = 60;
  const x = (d: number) => (d / Math.max(1, total)) * 1000;
  const y = (v: number) => H - 4 - ((v - lo) / span) * (H - 8);
  const today = records[records.length - 1].day;
  return (
    <svg viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" className="mt-2 h-14 w-full" role="img" aria-label={`${ind.name} over the mission, against your normal`}>
      <rect x={0} width={1000} y={y(ind.baseline[1])} height={Math.max(1, y(ind.baseline[0]) - y(ind.baseline[1]))} fill="#5cc8a8" opacity={0.12} />
      <polyline fill="none" stroke="#e9e4da" strokeWidth={1.5} vectorEffect="non-scaling-stroke" points={pts.map((p) => `${x(p.d)},${y(p.v)}`).join(' ')} />
      <line x1={x(today)} x2={x(today)} y1={0} y2={H} stroke="#c8a96a" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
