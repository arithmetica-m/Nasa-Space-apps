import { useEffect, useRef, useState } from 'react';
import { Brain, Gauge, Mic, ShieldAlert, Siren, Wind } from 'lucide-react';
import type { Mission } from '../../types';
import type { Category, Procedure } from '../../emergency/types';
import { crew } from '../../emergency/data';
import { newId } from '../../emergency/events';
import { publish } from '../../emergency/sync';
import { DELAY_MIN } from '../../emergency/plan';
import { EMERGENCY_VOICE_EVENT, type EmergencyVoice } from '../../lib/voiceCommands';
import { Avatar } from '../Avatar';
import { speak } from '../VoiceControl';
import { Response } from './Response';
import { Behavioral } from './Behavioral';

const CATEGORIES: { id: Category; label: string; hint: string; say: string; icon: typeof Siren }[] = [
  { id: 'respiratory', label: 'Breathing problem', hint: 'Short of breath, low oxygen, or a cabin air alarm', say: 'breathing', icon: Wind },
  { id: 'anaphylaxis', label: 'Allergic reaction', hint: 'Swelling, rash, or trouble breathing after touching or eating something', say: 'allergy', icon: ShieldAlert },
  { id: 'dcs', label: 'Decompression sickness', hint: 'Joint pain, numbness or tingling after an EVA', say: 'decompression', icon: Gauge },
  { id: 'behavioral', label: 'Panic or distress', hint: 'Private support. Physical causes are checked first.', say: 'panic', icon: Brain },
];

interface Props {
  mission: Mission;
  reason?: string;
  kb: Procedure[];
  account: string;
  joinEid?: string;
  patient?: string;
  onLeave: () => void;
  listening?: boolean;
  voiceSupported?: boolean;
  onVoice?: () => void;
}

// EMERGENCY MODE: takes over the screen. Two taps start it: who, then what.
// Starting an emergency sends it to every crew device.
export function Act({ mission, reason, kb, account, joinEid, patient: initialPatient, onLeave, listening, voiceSupported, onVoice }: Props) {
  const [patient, setPatient] = useState(initialPatient ?? (account === 'shared-dashboard' ? '' : account));
  const [eid, setEid] = useState(joinEid);
  const [behavioral, setBehavioral] = useState(false);

  const start = (category: Category, who = patient) => {
    if (!crew.some((member) => member.id === who)) { speak('Who needs help?'); return; }
    if (category === 'behavioral') { setBehavioral(true); return; }
    const id = newId();
    const now = Date.now();
    const delay = DELAY_MIN[mission.id] * 60_000; // real signal travel time each way
    publish({ type: 'start', eid: id, by: account, category, patientId: who, mission: mission.id, reason });
    // Readings the spacecraft and the patient's band already have are recorded at once (simulated).
    // Everything that needs a person (symptoms, blood pressure, exposure) stays for the crew to record.
    const hhmm = (t: number) => `${new Date(t).toISOString().slice(11, 16)} GMT`;
    const auto: { key: string; value: string; source: 'link' | 'device'; device?: string }[] =
      category === 'respiratory' ? [
        { key: 'co2', value: '2.6 mmHg', source: 'device', device: 'cabin air sensor in this module' },
        { key: 'resp', value: '24 breaths/min', source: 'link' },
      ] : category === 'dcs' ? [
        { key: 'eva_end', value: hhmm(now - 35 * 60_000), source: 'device', device: 'EVA log' },
      ] : [];
    for (const a of auto) publish({ type: 'measure', eid: id, by: account, ...a });
    // The initial report to Earth is drafted and sent by the response screen (emergency/report.ts).
    publish({ type: 'message', eid: id, by: 'earth', message: {
      id: newId(), direction: 'in', authority: 'medical', title: 'Flight surgeon (SIMULATED for the demo)',
      body: 'Report received. Mission medical review is in progress. Continue the onboard emergency checklist and send observations every 5 minutes.', sentAt: now + delay + 60_000, arrivesAt: now + 2 * delay + 60_000 } });
    setEid(id);
  };

  // Voice on this screen: a name picks the person, a problem word starts the emergency.
  const voiceRef = useRef<(v: EmergencyVoice) => void>(() => undefined);
  voiceRef.current = (v) => {
    if (eid || behavioral) return;
    const who = v.patientId ?? patient;
    if (v.patientId) setPatient(v.patientId);
    if (v.category) start(v.category, who);
    else if (v.patientId) speak(`${crew.find((c) => c.id === who)?.name.split(' ')[0]}. What is happening?`);
    else speak('Who needs help?');
  };
  useEffect(() => {
    const on = (e: Event) => voiceRef.current((e as CustomEvent<EmergencyVoice>).detail ?? {});
    window.addEventListener(EMERGENCY_VOICE_EVENT, on);
    return () => window.removeEventListener(EMERGENCY_VOICE_EVENT, on);
  }, []);

  if (eid) return <Response eid={eid} kb={kb} account={account} onLeave={onLeave} listening={listening} voiceSupported={voiceSupported} onVoice={onVoice} />;
  if (behavioral) return <Behavioral mission={mission} account={account} onEnd={onLeave} onPhysical={() => setBehavioral(false)} />;

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto bg-[#070303]" style={{ animation: 'fade-in 0.35s ease-out' }}>
      <header className="flex flex-wrap items-center gap-3 border-b-2 border-[#e45b5b] bg-[#e45b5b]/15 px-4 py-3 md:px-8">
        <Siren className="shrink-0 animate-pulse text-[#e45b5b]" size={30} />
        <h1 className="mr-auto text-2xl font-semibold tracking-wide text-marble md:text-3xl">EMERGENCY</h1>
        {voiceSupported && (
          <button type="button" onClick={onVoice} aria-pressed={listening}
            className={`flex min-h-14 items-center gap-2 border-2 px-4 text-base ${listening ? 'border-[#5cc8a8] bg-[#5cc8a8]/15 text-[#7bd5b8]' : 'border-marble/30 text-marble/80'}`}>
            <Mic size={20} /> {listening ? 'LISTENING' : 'VOICE'}
          </button>
        )}
        <button onClick={onLeave} className="min-h-14 border-2 border-marble/30 px-5 text-base text-marble/85 hover:border-marble">CANCEL</button>
      </header>

      <div className="mx-auto w-full max-w-4xl space-y-6 p-4 pb-12 md:p-6">
        {reason && <p className="border-l-4 border-[#e45b5b] bg-[#e45b5b]/10 px-4 py-3 text-lg text-marble">{reason}.</p>}

        <section aria-labelledby="who-title">
          <h2 id="who-title" className="text-2xl font-semibold text-marble"><span className="mr-2 text-[#ff8585]">1</span>Who needs help?</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {crew.map((c) => (
              <button key={c.id} onClick={() => setPatient(c.id)} aria-pressed={patient === c.id}
                className={`flex min-h-28 flex-col items-center justify-center gap-2 border-2 p-3 ${patient === c.id ? 'border-[#e45b5b] bg-[#e45b5b]/15' : 'border-marble/20 hover:border-marble/50'}`}>
                <Avatar id={c.id} name={c.name} size={56} />
                <span className="text-xl font-semibold text-marble">{c.id === account ? 'Me' : c.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="what-title">
          <h2 id="what-title" className="text-2xl font-semibold text-marble"><span className="mr-2 text-[#ff8585]">2</span>What is happening?</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => start(c.id)}
                className={`flex min-h-32 items-center gap-4 border-2 p-5 text-left transition ${c.id === 'behavioral' ? 'border-[#8fb8ff]/50 hover:border-[#8fb8ff] hover:bg-[#8fb8ff]/10' : 'border-[#e45b5b]/50 hover:border-[#e45b5b] hover:bg-[#e45b5b]/15'}`}>
                <c.icon className={`shrink-0 ${c.id === 'behavioral' ? 'text-[#8fb8ff]' : 'text-[#e45b5b]'}`} size={44} />
                <span>
                  <span className="block text-2xl font-semibold text-marble md:text-3xl">{c.label}</span>
                  <span className="mt-1 block text-base text-marble/60">{c.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <p className="text-center text-lg text-marble/55">Voice: say a name, then “{CATEGORIES.map((c) => c.say).join('”, “')}”.</p>
        <p className="text-base text-marble/45">Something else (chest pain, someone not responding)? No procedure is loaded for it in this prototype: use the paper emergency card and tell Earth.</p>
      </div>
    </div>
  );
}
