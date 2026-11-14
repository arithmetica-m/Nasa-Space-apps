import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { DayRecord } from '../types';
import { indicatorById } from '../data/indicators';
import { medicalOf } from '../library/advice';
import { DAY_SCHEDULE, logSession, plansFor, progressOf, sessions, unlogSession, type RecoveryPlan } from '../recover/recovery';
import { Reasoning } from './Reasoning';

// BACK TO YOUR NORMAL: the person's own recovery plan, built from their readings and fitted
// into the day. Lives in the astronaut's profile, next to their baseline.
export function BackToNormal({ crewId, name, records, isSelf, eva, activity, onHistory, checkedIn, onCheckIn }: { crewId: string; name: string; records: DayRecord[]; isSelf: boolean; eva: boolean; activity: string; onHistory: () => void; checkedIn: boolean; onCheckIn: () => void }) {
  const [, setTick] = useState(0);
  const [asked, setAsked] = useState(() => { try { return localStorage.getItem(`chiron-plan-request-v1-${crewId}`) ?? ''; } catch { return ''; } });
  const plans = useMemo(() => plansFor(crewId, records), [crewId, records]);
  const progress = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, progressOf(p, records)])), [plans, records]);
  const today = new Date().toISOString().slice(0, 10);
  const done = sessions(crewId);
  const med = medicalOf(crewId);

  // One list of today's activities, in schedule order, each saying which readings it helps.
  const todo = useMemo(() => {
    const map = new Map<string, { a: RecoveryPlan['activities'][number]; helps: string[] }>();
    for (const p of plans) for (const a of p.activities) {
      const x = map.get(a.id) ?? { a, helps: [] };
      x.helps.push(p.title.toLowerCase());
      map.set(a.id, x);
    }
    return [...map.values()].sort((x, y) => x.a.when.localeCompare(y.a.when));
  }, [plans]);

  const ask = () => {
    const t = new Date().toISOString().slice(11, 16);
    setAsked(t);
    try { localStorage.setItem(`chiron-plan-request-v1-${crewId}`, t); } catch { /* ignore */ }
  };
  const toggle = (id: string, isDone: boolean) => { if (isDone) unlogSession(crewId, id); else logSession(crewId, id); setTick((t) => t + 1); };

  const rows = [
    ...(isSelf ? [{ id: 'checkin', when: '06:30', label: 'Daily check-in', helps: 'everything CHIRON knows about you', isDone: checkedIn, onClick: () => { if (!checkedIn) onCheckIn(); } }] : []),
    ...todo.map(({ a, helps }) => {
      const isDone = done.some((d) => d.activityId === a.id && d.day === today);
      return { id: a.id, when: /^\d/.test(a.when) ? a.when.slice(0, 5) : 'Meals', label: a.label, helps: helps.join(', '), isDone, onClick: () => toggle(a.id, isDone) };
    }),
  ].sort((x, y) => x.when.localeCompare(y.when));
  const count = rows.filter((r) => r.isDone).length;

  return (
    <section className="border border-marble/10 bg-void/80 p-4 backdrop-blur-md md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-lg tracking-[0.12em] text-marble">{isSelf ? 'TODAY’S CHECKLIST' : `${name.toUpperCase()}’S CHECKLIST TODAY`}</h2>
        <span className={`font-mono text-sm ${count === rows.length && rows.length ? 'text-[#7bd5b8]' : 'text-gold'}`}>{count} of {rows.length} done</span>
      </div>
      {eva && <p className="mt-1 text-base text-[#f3c28d]">On EVA today: do these after the EVA.</p>}
      {rows.length === 0 && <p className="mt-2 text-lg text-[#7bd5b8]">Everything is within normal. Nothing extra to do.</p>}

      <ul className="mt-2 divide-y divide-marble/10">
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" disabled={!isSelf} onClick={r.onClick} aria-pressed={r.isDone}
              className="flex min-h-14 w-full items-center gap-3 py-1.5 text-left disabled:cursor-default">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center border-2 ${r.isDone ? 'border-[#5cc8a8] bg-[#5cc8a8]/20 text-[#7bd5b8]' : 'border-gold/60 text-transparent'}`}><Check size={20} strokeWidth={3} /></span>
              <span className="w-14 shrink-0 font-mono text-sm text-gold">{r.when}</span>
              <span className="min-w-0 flex-1">
                <span className={`text-lg ${r.isDone ? 'text-marble/45 line-through' : 'text-marble'}`}>{r.label}</span>
                <span className="ml-2 hidden text-sm text-marble/45 md:inline">for {r.helps}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {plans.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-marble/10 pt-3 text-base">
          {plans.map((p) => {
            const pr = progress[p.id];
            return <span key={p.id} className="text-marble/80">{p.title}: <span className={pr.reached || pr.onTrack ? 'text-[#7bd5b8]' : 'text-[#f3c28d]'}>{pr.reached ? 'back to normal' : pr.onTrack ? 'getting better' : 'not improving yet'}</span></span>;
          })}
          <button type="button" onClick={onHistory} className="min-h-10 font-mono text-xs tracking-[0.15em] text-gold hover:text-marble">TIMELINES →</button>
        </div>
      )}

      {plans.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-x-4">
          <Reasoning title="HOW CHIRON MADE THIS LIST" steps={[
            { label: 'DATA USED', lines: plans.map((p) => `${p.title}: ${p.why} Latest weekly average ${progress[p.id].latest ?? '—'} ${indicatorById(p.measure).unit}, normal ${indicatorById(p.measure).baseline.join('–')}.`) },
            { label: 'RULE', lines: ['A reading outside your own normal 3 times in a row gets activities that help bring it back.', 'Each reading has a fixed list of activities (exercise, sleep, water, light, contact with home).'] },
            { label: 'YOUR SCHEDULE', lines: [...DAY_SCHEDULE.map((s) => `${s.time} ${s.what}`), `Right now: ${activity}${eva ? ' (on EVA)' : ''}.`] },
            { label: 'YOUR MEDICAL RECORD', lines: [...med.restrictions, ...med.history].length ? [...med.restrictions, ...med.history].map((x) => `Checked: ${x}`) : ['Nothing in your record changes this list.'] },
            { label: 'PROGRESS', lines: plans.flatMap((p) => progress[p.id].reasons.slice(2)) },
          ]} />
          <button type="button" disabled={!!asked} onClick={ask} className="min-h-10 text-sm text-[#bcd3ff] underline-offset-2 hover:underline disabled:no-underline disabled:opacity-60">
            {asked ? `Sent to the flight surgeon at ${asked} GMT` : 'Ask the flight surgeon to change this'}
          </button>
        </div>
      )}
    </section>
  );
}
