import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import type { DayRecord } from '../types';
import { indicatorById } from '../data/indicators';
import { outsideness } from '../data/simulate';
import { stateColor } from '../lib/theme';

type Step =
  | { kind: 'number'; id: string; question: string; device: string }
  | { kind: 'mood' }
  | { kind: 'symptoms' };

// The brief's six indicators, one question per screen.
const STEPS: Step[] = [
  { kind: 'number', id: 'hr', question: 'Resting heart rate', device: 'Chest strap' },
  { kind: 'number', id: 'bp_sys', question: 'Blood pressure (upper number)', device: 'Arm cuff' },
  { kind: 'number', id: 'glucose', question: 'Blood sugar, before breakfast', device: 'Glucose meter' },
  { kind: 'number', id: 'temp', question: 'Body temperature', device: 'Thermometer' },
  { kind: 'number', id: 'sleep_h', question: 'Sleep last night', device: 'Wrist tracker' },
  { kind: 'mood' },
  { kind: 'symptoms' },
];

const MOODS = ['Very low', 'Low', 'Okay', 'Good', 'Very good'];
const SYMPTOMS = ['Headache', 'Dizziness', 'Nausea', 'Back pain', 'Congestion', 'Eye strain'];

interface Props {
  latest: DayRecord;
  onClose: () => void;
  onDone: (values: Record<string, number>, symptoms: string[]) => void;
  onTeach: (procedureId: string) => void;
}

const measurementGuides: Record<string, string> = {
  hr: 'resting-heart-rate',
  bp_sys: 'blood-pressure',
  glucose: 'blood-sugar',
  temp: 'temperature',
};

export function CheckIn({ latest, onClose, onDone, onTeach }: Props) {
  const [i, setI] = useState(0);
  const [values, setValues] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [symptomHelp, setSymptomHelp] = useState(false);
  const step = STEPS[i];

  const next = () => { setDraft(''); if (i + 1 < STEPS.length) setI(i + 1); else { setFinished(true); onDone(values, symptoms); } };
  const set = (id: string, v: number) => setValues((x) => ({ ...x, [id]: v }));

  // Simulated device reading: close to the astronaut's recent value.
  const sync = (id: string) => {
    const ind = indicatorById(id);
    const base = latest.values[id] ?? (ind.baseline[0] + ind.baseline[1]) / 2;
    const v = ind.baseline[1] - ind.baseline[0] >= 10 ? Math.round(base) : +base.toFixed(1);
    setDraft(String(v));
  };

  const draftNum = Number(draft);
  const draftValid = draft.trim() !== '' && !Number.isNaN(draftNum);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-void/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Daily check-in">
      <div className="w-full max-w-md border border-gold/40 bg-void/95 p-6">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] tracking-[0.35em] text-gold">⚷ DAILY CHECK-IN</div>
          <button onClick={onClose} aria-label="Close" className="text-mute hover:text-marble"><X size={16} /></button>
        </div>
        {/* Progress, one small square per question */}
        <div className="mt-3 flex gap-1.5">
          {STEPS.map((_, k) => <span key={k} className={`h-1.5 flex-1 ${k < i || finished ? 'bg-gold' : k === i ? 'bg-gold/50' : 'bg-marble/10'}`} />)}
        </div>

        {finished ? (
          <div className="mt-6">
            <h3 className="font-serif text-xl tracking-[0.15em] text-marble">LOGGED</h3>
            <p className="mt-2 text-sm text-marble/70">Saved to today on your health record and added to today's report to Earth.</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              {Object.entries(values).map(([id, v]) => {
                const ind = indicatorById(id);
                const out = outsideness(ind, v) > 0.05;
                return (
                  <li key={id} className="flex justify-between gap-3">
                    <span className="text-marble/70">{ind.name}</span>
                    <span className="font-mono" style={{ color: out ? stateColor.caution : stateColor.nominal }}>
                      {id === 'mood' ? MOODS[v - 1] : `${v} ${ind.unit}`}{out ? ' · outside demo baseline' : ''}
                    </span>
                  </li>
                );
              })}
              {symptoms.length > 0 && <li className="flex justify-between gap-3"><span className="text-marble/70">Symptoms</span><span className="font-mono text-marble">{symptoms.join(', ')}</span></li>}
            </ul>
            <button onClick={onClose} className="mt-6 w-full bg-gold py-2.5 font-mono text-xs tracking-[0.3em] text-void hover:bg-marble">DONE</button>
          </div>
        ) : step.kind === 'number' ? (
          <div className="mt-6">
            <div className="font-mono text-[10px] tracking-[0.25em] text-mute">QUESTION {i + 1} OF {STEPS.length}</div>
            <h3 className="mt-2 font-serif text-xl tracking-[0.1em] text-marble">{step.question}</h3>
            <p className="mt-1 text-xs text-marble/60">Simulated demo baseline: {indicatorById(step.id).baseline[0]} to {indicatorById(step.id).baseline[1]} {indicatorById(step.id).unit}. Use: {step.device}. {indicatorById(step.id).method}. Device integration is unavailable; enter a device reading manually.</p>
            {measurementGuides[step.id] && <button type="button" onClick={() => onTeach(measurementGuides[step.id])} className="mt-3 text-sm text-gold underline underline-offset-4">Show me how to take this reading</button>}
            <div className="mt-4 flex gap-2">
              <input autoFocus inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && draftValid && (set(step.id, draftNum), next())}
              aria-label={step.question} placeholder="Enter reading"
                className="h-11 flex-1 border border-marble/20 bg-transparent px-3 font-mono text-lg text-marble outline-none focus:border-gold/70" />
              <span className="flex items-center font-mono text-sm text-mute">{indicatorById(step.id).unit}</span>
            </div>
            <button onClick={() => sync(step.id)} className="mt-2 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-gold hover:text-marble">
              <RefreshCw size={12} /> USE SIMULATED DEMO VALUE
            </button>
            <div className="mt-6 flex gap-2">
              <button onClick={next} className="flex-1 border border-marble/20 py-2.5 font-mono text-xs tracking-[0.3em] text-marble/70 hover:border-marble/40">SKIP</button>
              <button disabled={!draftValid} onClick={() => { set(step.id, draftNum); next(); }} className="flex-1 bg-gold py-2.5 font-mono text-xs tracking-[0.3em] text-void hover:bg-marble disabled:opacity-30">NEXT</button>
            </div>
          </div>
        ) : step.kind === 'mood' ? (
          <div className="mt-6">
            <div className="font-mono text-[10px] tracking-[0.25em] text-mute">QUESTION {i + 1} OF {STEPS.length}</div>
            <h3 className="mt-2 font-serif text-xl tracking-[0.1em] text-marble">How is your mood today?</h3>
            <div className="mt-4 grid grid-cols-5 gap-1.5">
              {MOODS.map((m, k) => (
                <button key={m} onClick={() => { set('mood', k + 1); next(); }} className="border border-marble/15 px-1 py-3 text-xs text-marble/80 hover:border-gold/70 hover:text-gold">{m}</button>
              ))}
            </div>
            <button onClick={next} className="mt-6 w-full border border-marble/20 py-2.5 font-mono text-xs tracking-[0.3em] text-marble/70 hover:border-marble/40">SKIP</button>
          </div>
        ) : (
          <div className="mt-6">
            <div className="font-mono text-[10px] tracking-[0.25em] text-mute">QUESTION {i + 1} OF {STEPS.length}</div>
            <h3 className="mt-2 font-serif text-xl tracking-[0.1em] text-marble">Any symptoms?</h3>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {SYMPTOMS.map((s) => {
                const on = symptoms.includes(s);
                return (
                  <button key={s} aria-pressed={on} onClick={() => setSymptoms(on ? symptoms.filter((x) => x !== s) : [...symptoms, s])}
                    className={`border px-3 py-2 text-xs ${on ? 'border-gold text-gold' : 'border-marble/15 text-marble/80 hover:border-marble/40'}`}>{s}</button>
                );
              })}
            </div>
            <button type="button" onClick={() => setSymptomHelp((visible) => !visible)} aria-expanded={symptomHelp} className="mt-4 text-sm text-gold underline underline-offset-4">
              {symptomHelp ? 'Hide symptom help' : 'What might these symptoms mean?'}
            </button>
            {symptomHelp && <p className="mt-2 text-sm text-marble/70">A symptom can have many causes. Tell the medical crew what you feel; this tool cannot tell you the cause.</p>}
            <button onClick={next} className="mt-6 w-full bg-gold py-2.5 font-mono text-xs tracking-[0.3em] text-void hover:bg-marble">{symptoms.length ? 'FINISH' : 'NO SYMPTOMS, FINISH'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
