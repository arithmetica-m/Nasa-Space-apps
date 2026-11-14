import { useMemo, useState } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import type { DayRecord, Mission } from '../../types';
import { indicatorById } from '../../data/indicators';
import { latestValue } from '../../lib/health';
import { buildInsights, evidenceLabel } from '../../lib/insights';
import { stateColor } from '../../lib/theme';
import { HoldButton } from '../HoldButton';
import { Science } from '../Science';

export const ASTRONAUT = 'Ana';

const MOOD = ['', 'Very low', 'Low', 'Okay', 'Good', 'Very good'];

function Indicator({ records, id, label }: { records: DayRecord[]; id: string; label: string }) {
  const ind = indicatorById(id);
  const l = latestValue(records, id);
  const [lo, hi] = ind.baseline;
  const v = l?.value;
  const low = v !== undefined && v < lo;
  const high = v !== undefined && v > hi;
  const usual = v !== undefined && !low && !high;
  const word = v === undefined ? 'Not logged' : usual ? 'As usual' : low ? 'Lower than usual' : 'Higher than usual';
  const color = v === undefined ? '#8b8576' : usual ? stateColor.nominal : stateColor.caution;
  return (
    <div className="flex-1 border border-marble/10 bg-void/50 px-3 py-2">
      <div className="font-mono text-[9px] tracking-[0.3em] text-mute">{label.toUpperCase()}</div>
      <div className="mt-1 font-serif text-2xl text-marble">
        {v === undefined ? '—' : id === 'mood' ? MOOD[Math.round(v)] : v}
        {v !== undefined && id !== 'mood' && <span className="ml-1 font-sans text-xs text-marble/50">{ind.unit}</span>}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px]" style={{ color }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{word}
      </div>
    </div>
  );
}

interface Props {
  mission: Mission;
  records: DayRecord[];
  checkedIn: boolean;
  onCheckIn: () => void;
  onTeach: (procedureId?: string) => void;
  onEmergency: () => void;
}

// WATCH: the everyday view. Only what matters today, in plain words.
export function Today({ mission, records, checkedIn, onCheckIn, onTeach, onEmergency }: Props) {
  const [open, setOpen] = useState<string>();
  const [science, setScience] = useState(false);
  const today = records.length - 1;
  const hour = new Date().getUTCHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  let since = today;
  while (since > 0 && records[since - 1].drift >= 0.3) since--;
  const attention = records[today].drift >= 0.3;
  const insights = useMemo(() => buildInsights(mission, records), [mission, records]);

  return (
    <div className="rise w-full max-w-[34rem] border border-marble/10 bg-void/70 p-4 backdrop-blur-md">
      <div className="font-mono text-[10px] tracking-[0.35em] text-gold">⚷ CHIRON IS WATCHING</div>
      <h2 className="mt-2 font-serif text-2xl tracking-[0.08em] text-marble">{greeting}, {ASTRONAUT}</h2>
      <p className="mt-1 text-sm text-marble/70">
        {attention ? `Since day ${since}, a few readings have been different from your normal. Not an emergency.` : 'Everything is within your normal. Nothing needs your attention.'}
      </p>

      <div className="mt-3 flex gap-2">
        <Indicator records={records} id="sleep_h" label="Sleep" />
        <Indicator records={records} id="hr" label="Resting heart" />
        <Indicator records={records} id="mood" label="Mood" />
      </div>

      <ul className="mt-3 divide-y divide-marble/10 border-y border-marble/10">
        {!checkedIn && (
          <li className="flex items-center justify-between gap-3 py-2">
            <div>
              <div className="text-sm text-marble">Daily check-in</div>
              <div className="text-xs text-marble/55">About a minute. Six quick questions.</div>
            </div>
            <button onClick={onCheckIn} className="shrink-0 bg-gold px-4 py-2 font-mono text-[10px] tracking-[0.25em] text-void hover:bg-marble">START</button>
          </li>
        )}
        {insights.map((ins) => {
          const isOpen = open === ins.id;
          return (
            <li key={ins.id} className="py-2">
              <button onClick={() => { setOpen(isOpen ? undefined : ins.id); setScience(false); }} className="flex w-full items-start justify-between gap-3 text-left" aria-expanded={isOpen}>
                <div>
                  <div className="text-sm text-marble">{ins.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {ins.evidence.map((e) => (
                      <span key={e} className="font-mono text-[8px] tracking-[0.15em] text-mute">{evidenceLabel[e].toUpperCase()}</span>
                    )).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, <span key={`s${i}`} className="text-[8px] text-mute">·</span>, el] : [el]), [])}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-[10px] tracking-[0.2em] text-gold">{isOpen ? 'HIDE' : 'WHY?'}</span>
              </button>
              {isOpen && (
                <div className="rise mt-2 text-xs">
                  <p className="text-marble/75">{ins.why}</p>
                  {ins.suggestion && <p className="mt-1.5 text-marble"><span className="font-mono text-[9px] tracking-[0.2em] text-gold">TRY: </span>{ins.suggestion} <span className="text-mute">(demo suggestion, not yet approved)</span></p>}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {ins.procedure && (
                      <button onClick={() => onTeach(ins.procedure)} className="flex items-center gap-1 font-mono text-[10px] tracking-[0.2em] text-gold hover:text-marble">SHOW ME HOW <ChevronRight size={12} /></button>
                    )}
                    <button onClick={() => setScience(!science)} className="font-mono text-[10px] tracking-[0.2em] text-marble/60 hover:text-gold">{science ? 'HIDE THE SCIENCE' : 'THE SCIENCE BEHIND THIS'}</button>
                  </div>
                  {science && <Science science={ins.science} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button onClick={() => onTeach()} className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-marble/70 hover:text-gold">
          <BookOpen size={14} /> PROCEDURES
        </button>
        <HoldButton onConfirm={onEmergency} label="HOLD FOR EMERGENCY" />
      </div>
    </div>
  );
}
