import { useState } from 'react';
import { Mic, RefreshCw, X } from 'lucide-react';
import { listenOnce } from './VoiceControl';
import { parseSpokenNumber } from '../lib/voiceCommands';
import type { DayRecord } from '../types';
import { indicatorById } from '../data/indicators';
import { outsideness } from '../data/simulate';
import { stateColor } from '../lib/theme';
import { explain, symptomMeaning } from '../data/meanings';
import { Explained } from './Explained';
import { LikelyCauses, ReportSomething } from './ReportSomething';

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
  crewId?: string;
}

const measurementGuides: Record<string, string> = {
  hr: 'resting-heart-rate',
  bp_sys: 'blood-pressure',
  glucose: 'blood-sugar',
  temp: 'temperature',
};

export function CheckIn({ latest, onClose, onDone, onTeach, crewId }: Props) {
  const [i, setI] = useState(0);
  const [values, setValues] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [asking, setAsking] = useState<string>();
  // Today's record with the readings just entered, so causes use the newest data.
  const todayRecords = [{ ...latest, values: { ...latest.values, ...values } }];
  const [syncing, setSyncing] = useState<string>();
  const [hint, setHint] = useState('');
  const step = STEPS[i];

  const next = () => { setDraft(''); setHint(''); if (i + 1 < STEPS.length) setI(i + 1); else { setFinished(true); onDone(values, symptoms); } };
  const set = (id: string, v: number) => setValues((x) => ({ ...x, [id]: v }));

  // SIMULATED device link: no real device is connected in this prototype.
  // The reading is made close to the astronaut's recent value.
  const deviceValue = (id: string) => {
    const ind = indicatorById(id);
    const base = latest.values[id] ?? (ind.baseline[0] + ind.baseline[1]) / 2;
    return ind.baseline[1] - ind.baseline[0] >= 10 ? Math.round(base) : +base.toFixed(1);
  };
  const sync = (id: string) => {
    setSyncing(id);
    setHint('');
    setTimeout(() => { setDraft(String(deviceValue(id))); setSyncing(undefined); setHint('Read from device (simulated). Check it, then press NEXT.'); }, 900);
  };
  const syncAll = () => {
    setSyncing('all');
    setTimeout(() => {
      const all: Record<string, number> = {};
      for (const st of STEPS) if (st.kind === 'number') all[st.id] = deviceValue(st.id);
      setValues((x) => ({ ...x, ...all }));
      setSyncing(undefined);
      setDraft('');
      setI(STEPS.findIndex((st) => st.kind === 'mood'));
    }, 1400);
  };
  const sayIt = () => {
    setSyncing('voice');
    setHint('Listening… say the number, for example “seventy two”.');
    listenOnce((text) => {
      setSyncing(undefined);
      const n = parseSpokenNumber(text);
      if (n === undefined) setHint(`Heard “${text}”, but no number. Try again.`);
      else { setDraft(String(n)); setHint(`Heard “${text}”. Check it, then press NEXT.`); }
    }, (message) => { setSyncing(undefined); setHint(message); });
  };

  const draftNum = Number(draft);
  const draftValid = draft.trim() !== '' && !Number.isNaN(draftNum);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-void/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Daily check-in">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto border border-gold/40 bg-void/95 p-6">
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
            {(() => {
              const flagged = Object.entries(values).filter(([id, v]) => id !== 'mood' ? outsideness(indicatorById(id), v) > 0.05 : v <= 2);
              return (
                <p className="mt-4 text-base text-marble">
                  {flagged.length || symptoms.length ? 'Here is what your answers mean and what to do.' : 'Everything you entered is within your normal. Nothing to do.'}
                </p>
              );
            })()}
            <ul className="mt-3 space-y-2">
              {Object.entries(values).map(([id, v]) => {
                const ind = indicatorById(id);
                const e = explain(id, v, { when: 'today', source: 'entered by you in the daily check-in' });
                const out = e.direction !== 'usual';
                return (
                  <li key={id} className="border border-marble/10">
                    <details open={out}>
                      <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5">
                        <span className="text-[15px] text-marble">{ind.name}</span>
                        <span className="text-right text-sm" style={{ color: out ? stateColor.caution : stateColor.nominal }}>
                          {id === 'mood' ? MOODS[v - 1] : `${v} ${ind.unit}`} · {out ? (e.direction === 'high' ? 'higher than usual' : 'lower than usual') : 'usual'}
                        </span>
                      </summary>
                      <div className="border-t border-marble/10 px-3 py-3"><Explained e={e} crewId={crewId} /></div>
                    </details>
                  </li>
                );
              })}
              {symptoms.map((sym) => (
                <li key={sym} className="border border-marble/10 px-3 py-3">
                  <div className="text-[15px] text-[#e39b4b]">{sym}</div>
                  <div className="mt-2"><LikelyCauses symptom={sym} crewId={crewId ?? ''} records={todayRecords} onAsk={() => setAsking(sym)} /></div>
                  <div className="mt-2"><Explained crewId={crewId} e={{ name: sym, direction: 'high', what: '', means: symptomMeaning[sym].what, todo: symptomMeaning[sym].todo, topic: { symptom: sym } }} /></div>
                </li>
              ))}
            </ul>
            <button onClick={onClose} className="mt-6 w-full bg-gold py-2.5 font-mono text-xs tracking-[0.3em] text-void hover:bg-marble">DONE</button>
          </div>
        ) : step.kind === 'number' ? (
          <div className="mt-6">
            <div className="font-mono text-[10px] tracking-[0.25em] text-mute">QUESTION {i + 1} OF {STEPS.length}</div>
            <h3 className="mt-2 font-serif text-xl tracking-[0.1em] text-marble">{step.question}</h3>
            <p className="mt-1 text-sm text-marble/60">Your normal: {indicatorById(step.id).baseline[0]}–{indicatorById(step.id).baseline[1]} {indicatorById(step.id).unit} · {step.device}</p>
            {i === 0 && (
              <button type="button" onClick={syncAll} disabled={!!syncing}
                className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 border border-gold/60 font-mono text-xs tracking-[0.2em] text-gold hover:bg-gold/10 disabled:opacity-50">
                <RefreshCw size={15} className={syncing === 'all' ? 'animate-spin' : ''} /> {syncing === 'all' ? 'SYNCING ALL DEVICES…' : 'SYNC ALL READINGS FROM DEVICES'}
              </button>
            )}
            {measurementGuides[step.id] && <button type="button" onClick={() => onTeach(measurementGuides[step.id])} className="mt-3 text-sm text-gold underline underline-offset-4">Show me how to take this reading</button>}
            <div className="mt-4 flex gap-2">
              <input autoFocus inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && draftValid && (set(step.id, draftNum), next())}
              aria-label={step.question} placeholder="Enter reading"
                className="h-11 flex-1 border border-marble/20 bg-transparent px-3 font-mono text-lg text-marble outline-none focus:border-gold/70" />
              <span className="flex items-center font-mono text-sm text-mute">{indicatorById(step.id).unit}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => sync(step.id)} disabled={!!syncing}
                className="flex min-h-11 items-center justify-center gap-2 border border-marble/20 text-sm text-marble/80 hover:border-gold/60 hover:text-gold disabled:opacity-50">
                <RefreshCw size={15} className={syncing === step.id ? 'animate-spin' : ''} /> {syncing === step.id ? 'Syncing…' : `Sync from ${step.device.toLowerCase()}`}
              </button>
              <button type="button" onClick={sayIt} disabled={!!syncing}
                className={`flex min-h-11 items-center justify-center gap-2 border text-sm hover:border-gold/60 hover:text-gold disabled:opacity-50 ${syncing === 'voice' ? 'border-gold text-gold' : 'border-marble/20 text-marble/80'}`}>
                <Mic size={15} /> {syncing === 'voice' ? 'Listening…' : 'Say it'}
              </button>
            </div>
            {hint && <p role="status" className="mt-2 text-sm text-gold">{hint}</p>}
            <p className="mt-2 text-xs text-mute">Device sync is simulated in this prototype.</p>
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
            <div className="mt-4 flex flex-wrap gap-2">
              {SYMPTOMS.map((s) => {
                const on = symptoms.includes(s);
                return (
                  <button key={s} aria-pressed={on} onClick={() => setSymptoms(on ? symptoms.filter((x) => x !== s) : [...symptoms, s])}
                    className={`min-h-12 border px-4 text-base ${on ? 'border-gold bg-gold/10 text-gold' : 'border-marble/20 text-marble/85 hover:border-marble/40'}`}>{s}</button>
                );
              })}
            </div>
            {symptoms.length > 0 && (
              <div className="mt-4 space-y-3">
                {symptoms.map((sym) => (
                  <div key={sym}>
                    <div className="text-base text-[#e39b4b]">{sym}</div>
                    <LikelyCauses symptom={sym} crewId={crewId ?? ''} records={todayRecords} />
                  </div>
                ))}
              </div>
            )}
            <button onClick={next} className="mt-6 w-full bg-gold py-2.5 font-mono text-xs tracking-[0.3em] text-void hover:bg-marble">{symptoms.length ? 'FINISH' : 'NO SYMPTOMS, FINISH'}</button>
          </div>
        )}
      </div>
      {asking && <ReportSomething crewId={crewId ?? ""} records={todayRecords} startText={asking} onClose={() => setAsking(undefined)} onEmergency={onClose} />}
    </div>
  );
}
