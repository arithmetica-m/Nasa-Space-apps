import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, RadioTower, Siren } from 'lucide-react';
import type { DayRecord, Mission } from '../../types';
import { indicatorById } from '../../data/indicators';
import { latestValue } from '../../lib/health';
import { ASTRONAUT } from '../watch/Today';

// DEMO emergency sequences, following the general order of first aid.
// Every sequence must be replaced with the approved mission protocol before real use.
type Step = { text: string; ask?: string };
interface Situation { id: string; label: string; protocol: string; steps: Step[] }

const SITUATIONS: Situation[] = [
  { id: 'unresponsive', label: 'Not responding', protocol: 'EM-01', steps: [
    { text: 'Raise the alarm. Every crew device has been alerted.' },
    { text: 'Make sure the area is safe: cabin air, power, loose objects.' },
    { text: 'Check if they respond to your voice and a firm tap.', ask: 'Are they responding?' },
    { text: 'Watch the chest for 10 seconds.', ask: 'Are they breathing normally?' },
    { text: 'If not breathing: start CPR using your approved CPR card. Send a crewmate for the defibrillator (command area, red panel).' },
    { text: 'Keep going until they recover or the card tells you to stop. Chiron keeps the time.' },
  ] },
  { id: 'chest', label: 'Chest pain', protocol: 'EM-02', steps: [
    { text: 'Help them stop, rest and secure themselves in place.' },
    { text: 'Ask where the pain is and whether it spreads.', ask: 'Is the pain spreading to the arm, jaw or back?' },
    { text: 'Record heart rate and blood pressure now.' },
    { text: 'Bring the defibrillator and ECG unit to the patient.' },
    { text: 'Follow the approved chest pain card. Give no medicine unless the card or a flight surgeon says so.' },
  ] },
  { id: 'breathing', label: 'Trouble breathing', protocol: 'EM-03', steps: [
    { text: 'Check the cabin air alarm. If the air may be unsafe, put on masks.' },
    { text: 'Listen to them speak.', ask: 'Can they speak in full sentences?' },
    { text: 'Measure blood oxygen with the finger sensor.' },
    { text: 'Follow the approved breathing card.' },
  ] },
  { id: 'bleeding', label: 'Serious bleeding', protocol: 'EM-04', steps: [
    { text: 'Put on gloves.' },
    { text: 'Press firmly on the wound with a clean dressing.' },
    { text: 'Keep pressing for a few minutes.', ask: 'Is the bleeding slowing?' },
    { text: 'Follow the approved wound card.' },
  ] },
  { id: 'air', label: 'Fire or toxic air', protocol: 'EM-05', steps: [
    { text: 'Masks on now, for everyone.' },
    { text: 'Move away from the affected module. Close the hatch if you are trained to.' },
    { text: 'Count the crew.', ask: 'Is anyone unwell or not responding?' },
    { text: 'Follow the approved fire or toxic air procedure.' },
  ] },
  { id: 'reading', label: 'Dangerous reading', protocol: 'EM-06', steps: [
    { text: 'Stop, sit still and repeat the measurement now.' },
    { text: 'Compare the new reading.', ask: 'Is it still outside the safe range?' },
    { text: 'Check for new symptoms.', ask: 'Any chest pain, fainting or trouble breathing?' },
    { text: 'Tell your crew medical officer.' },
    { text: 'Follow the approved card for this reading.' },
  ] },
  { id: 'other', label: 'Something else', protocol: 'EM-00', steps: [
    { text: 'Raise the alarm and make the area safe.' },
    { text: 'Describe what is happening in the report to Earth.' },
    { text: 'Record heart rate, blood pressure and blood oxygen.' },
    { text: 'Follow the approved card closest to this situation.' },
  ] },
];

const RED = '#e45b5b';
const clock = (d: Date) => d.toISOString().slice(11, 16);
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);
const DELAY_MIN: Record<string, number> = { iss: 0, moon: 0.02, 'mars-transit': 11, 'mars-surface': 18 };

export interface ActResult { situation: string; minutes: number; sent: boolean }

interface Props {
  mission: Mission;
  records: DayRecord[];
  reason?: string;
  onStandDown: (r: ActResult) => void;
}

// ACT: takes over the whole screen. One instruction at a time, answers recorded,
// and a report to Earth written as the crew works.
export function Act({ mission, records, reason, onStandDown }: Props) {
  const [started] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [situation, setSituation] = useState<Situation | undefined>(reason ? SITUATIONS.find((s) => s.id === 'reading') : undefined);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [note, setNote] = useState('');
  const [sentAt, setSentAt] = useState<Date>();

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const secs = Math.floor((now.getTime() - started.getTime()) / 1000);
  const elapsed = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  const delay = DELAY_MIN[mission.id] ?? 0;
  const hr = latestValue(records, 'hr');
  const hrInd = indicatorById('hr');
  const finished = situation && step >= situation.steps.length;
  const cur = situation?.steps[Math.min(step, (situation?.steps.length ?? 1) - 1)];

  const report = useMemo(() => [
    `CHIRON EMERGENCY REPORT · ${mission.name.toUpperCase()} · DAY ${mission.today}`,
    `Started ${clock(started)} GMT · elapsed ${elapsed}`,
    `Situation: ${situation?.label ?? 'not yet chosen'}${reason ? ` (${reason})` : ''}`,
    `Patient: ${ASTRONAUT} · resting heart rate normal ${hrInd.baseline[0]}–${hrInd.baseline[1]}, last ${hr ? `${hr.value} bpm (day ${hr.day})` : 'not logged'}`,
    ...(situation ? situation.steps.map((s, i) => (i < step ? `✓ ${s.ask ? `${s.ask} ${answers[i] === undefined ? '—' : answers[i] ? 'Yes' : 'No'}` : s.text}` : '')).filter(Boolean) : []),
    ...(note ? [`Crew note: ${note}`] : []),
  ], [mission, started, elapsed, situation, reason, hr, hrInd, step, answers, note]);

  const advance = (answer?: boolean) => {
    if (answer !== undefined) setAnswers((a) => ({ ...a, [step]: answer }));
    setStep((s) => s + 1);
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#070303]" style={{ animation: 'fade-in 0.35s ease-out' }}>
      {/* Alarm band */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b-2 px-6 py-3" style={{ borderColor: RED, background: `${RED}22` }}>
        <Siren className="animate-pulse" style={{ color: RED }} />
        <div className="mr-auto">
          <div className="font-mono text-[10px] tracking-[0.4em]" style={{ color: RED }}>⚷ CHIRON IS ACTING · EMERGENCY</div>
          <div className="font-serif text-xl tracking-[0.15em] text-marble">{situation ? situation.label.toUpperCase() : 'WHAT IS HAPPENING?'}</div>
        </div>
        <div className="font-mono text-3xl text-marble" aria-label="Time since emergency started">{elapsed}</div>
        <button onClick={() => onStandDown({ situation: situation?.label ?? 'Unspecified', minutes: Math.max(1, Math.round(secs / 60)), sent: !!sentAt })}
          className="border border-marble/30 px-4 py-2 font-mono text-[10px] tracking-[0.3em] text-marble/80 hover:border-marble">STAND DOWN</button>
      </header>

      <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <main className="flex flex-col">
          {!situation ? (
            <>
              <p className="text-marble/70">Pick the closest match. You can describe the details later.</p>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                {SITUATIONS.filter((s) => s.id !== 'reading').map((s) => (
                  <button key={s.id} onClick={() => setSituation(s)} className="border-2 border-marble/20 px-4 py-8 text-xl text-marble transition hover:border-[#e45b5b] hover:bg-[#e45b5b]/10">{s.label}</button>
                ))}
              </div>
            </>
          ) : finished ? (
            <div className="rise my-auto text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-marble text-marble"><Check size={26} /></div>
              <h2 className="mt-4 font-serif text-2xl tracking-[0.15em] text-marble">ALL STEPS DONE</h2>
              <p className="mt-2 text-marble/70">Keep watching the patient. {sentAt ? 'The report is on its way to Earth.' : 'Send the report to Earth if you have not yet.'}</p>
              <button onClick={() => setStep(Math.max(0, step - 1))} className="mt-6 font-mono text-[10px] tracking-[0.3em] text-marble/60 hover:text-marble">← BACK TO LAST STEP</button>
            </div>
          ) : (
            <>
              <div className="flex gap-1.5">
                {situation.steps.map((_, i) => <span key={i} className="h-2 flex-1" style={{ background: i < step ? '#e9e4da' : i === step ? RED : '#ffffff22' }} />)}
              </div>
              <div key={step} className="rise my-auto py-6">
                <div className="font-mono text-sm tracking-[0.3em]" style={{ color: RED }}>STEP {step + 1} OF {situation.steps.length}</div>
                <p className="mt-4 text-3xl font-medium leading-snug text-white md:text-5xl">{cur!.text}</p>
                {cur!.ask && <p className="mt-6 text-2xl text-marble/80">{cur!.ask}</p>}
                <p className="mt-6 font-mono text-[10px] tracking-[0.2em] text-mute">DEMO SEQUENCE · PROTOCOL {situation.protocol} · REPLACE WITH APPROVED MISSION PROTOCOL</p>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-3">
                <button onClick={() => (step === 0 && !reason ? setSituation(undefined) : setStep(step - 1))} disabled={step === 0 && !!reason}
                  className="flex min-h-16 items-center gap-2 border-2 border-marble/30 px-5 text-lg text-marble disabled:opacity-30"><ArrowLeft /> Back</button>
                {cur!.ask ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => advance(true)} className="min-h-16 border-2 border-marble/60 text-2xl font-semibold text-marble hover:bg-marble/10">Yes</button>
                    <button onClick={() => advance(false)} className="min-h-16 border-2 border-marble/60 text-2xl font-semibold text-marble hover:bg-marble/10">No</button>
                  </div>
                ) : (
                  <button onClick={() => advance()} className="flex min-h-16 items-center justify-center gap-2 text-2xl font-bold text-black" style={{ background: RED }}>
                    <Check /> Done, next
                  </button>
                )}
              </div>
            </>
          )}
        </main>

        {/* Report to Earth, written as the crew works */}
        <aside className="flex flex-col border border-marble/15 bg-black/40 p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-marble/70"><RadioTower size={14} /> REPORT TO EARTH</div>
          <pre className="mt-3 flex-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-marble/75">{report.join('\n')}</pre>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add what you see, in your own words"
            className="mt-3 w-full border border-marble/20 bg-transparent p-2 text-sm text-marble outline-none focus:border-marble/50" />
          {sentAt ? (
            <p className="mt-3 text-sm text-marble/80">
              Sent {clock(sentAt)} GMT. {delay < 0.1 ? 'Earth has it now.' : `Earth receives it about ${clock(addMin(sentAt, delay))}, earliest reply about ${clock(addMin(sentAt, delay * 2))} GMT.`}
              <span className="mt-1 block text-xs text-mute">Do not wait for the reply. Keep following the steps.</span>
            </p>
          ) : (
            <button onClick={() => setSentAt(new Date())} className="mt-3 flex items-center justify-center gap-2 bg-marble py-3 font-mono text-[11px] tracking-[0.3em] text-black hover:bg-white">
              <RadioTower size={14} /> SEND NOW · {delay < 0.1 ? 'ARRIVES NOW' : `${mission.delayLabel.toUpperCase()} TO EARTH`}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
