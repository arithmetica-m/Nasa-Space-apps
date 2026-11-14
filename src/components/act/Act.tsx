import { useState } from 'react';
import { Brain, Siren, Wind, Gauge, ShieldAlert } from 'lucide-react';
import type { Mission } from '../../types';
import type { Category, Procedure } from '../../emergency/types';
import { crew } from '../../emergency/data';
import { newId } from '../../emergency/events';
import { publish } from '../../emergency/sync';
import { DELAY_MIN } from '../../emergency/plan';
import { Response } from './Response';
import { Behavioral } from './Behavioral';

const CATEGORIES: { id: Category; label: string; hint: string; icon: typeof Siren }[] = [
  { id: 'dcs', label: 'Decompression sickness after EVA', hint: 'Joint pain, numbness or tingling after an EVA', icon: Gauge },
  { id: 'respiratory', label: 'Breathing or cabin air problem', hint: 'Short of breath, low oxygen, or a cabin air alarm', icon: Wind },
  { id: 'anaphylaxis', label: 'Severe allergic reaction', hint: 'Swelling, rash, trouble breathing after exposure', icon: ShieldAlert },
  { id: 'behavioral', label: 'Acute psychological distress', hint: 'Panic, distress or confusion. Private support; physical causes are checked first.', icon: Brain },
];

interface Props {
  mission: Mission;
  reason?: string;
  kb: Procedure[];
  account: string;
  joinEid?: string;
  patient?: string;
  onLeave: () => void;
}

// ACT: takes over the screen. Starting an emergency publishes it to every crew device.
export function Act({ mission, reason, kb, account, joinEid, patient: initialPatient, onLeave }: Props) {
  const [patient, setPatient] = useState(initialPatient ?? account);
  const [eid, setEid] = useState(joinEid);
  const [behavioral, setBehavioral] = useState(false);

  if (eid) return <Response eid={eid} kb={kb} account={account} onLeave={onLeave} />;
  if (behavioral) return <Behavioral mission={mission} account={account} onEnd={onLeave} onPhysical={() => setBehavioral(false)} />;

  const start = (category: Category) => {
    if (category === 'behavioral') { setBehavioral(true); return; }
    const id = newId();
    const now = Date.now();
    const delay = DELAY_MIN[mission.id] * 60_000; // real signal travel time each way
    publish({ type: 'start', eid: id, by: account, category, patientId: patient, mission: mission.id, reason });
    // The initial report to Earth is drafted and sent by the response screen (emergency/report.ts).
    publish({ type: 'message', eid: id, by: 'earth', message: {
      id: newId(), direction: 'in', authority: 'medical', title: 'Flight surgeon (SIMULATED for the demo)',
      body: 'Report received. Continue the approved onboard procedure and send observations every 5 minutes.', sentAt: now + delay + 60_000, arrivesAt: now + 2 * delay + 60_000 } });
    setEid(id);
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto bg-[#070303]" style={{ animation: 'fade-in 0.35s ease-out' }}>
      <header className="flex items-center gap-4 border-b-2 border-[#e45b5b] bg-[#e45b5b]/15 px-6 py-3">
        <Siren className="animate-pulse text-[#e45b5b]" />
        <div className="mr-auto">
          <div className="font-mono text-[10px] tracking-[0.4em] text-[#e45b5b]">⚷ CHIRON IS ACTING · EMERGENCY</div>
          <div className="font-serif text-xl tracking-[0.15em] text-marble">WHO NEEDS HELP, AND WHAT IS HAPPENING?</div>
        </div>
        <button onClick={onLeave} className="border border-marble/30 px-4 py-2 font-mono text-[10px] tracking-[0.3em] text-marble/80 hover:border-marble">CANCEL</button>
      </header>

      <div className="mx-auto w-full max-w-4xl p-6">
        {reason && <p className="mb-4 border border-[#e45b5b]/50 bg-[#e45b5b]/10 p-3 text-sm text-marble">Reason: {reason}.</p>}
        <div className="font-mono text-[10px] tracking-[0.3em] text-marble/60">AFFECTED CREW MEMBER</div>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          {crew.map((c) => (
            <button key={c.id} onClick={() => setPatient(c.id)} aria-pressed={patient === c.id}
              className={`border-2 px-3 py-3 text-left ${patient === c.id ? 'border-[#e45b5b] bg-[#e45b5b]/10' : 'border-marble/15 hover:border-marble/40'}`}>
              <div className="text-base text-marble">{c.name}{c.id === account && ' (you)'}</div>
              <div className="text-[11px] text-marble/50">{c.position}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 font-mono text-[10px] tracking-[0.3em] text-marble/60">WHAT IS HAPPENING</div>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => start(c.id)}
              className={`flex items-start gap-4 border-2 p-5 text-left transition ${c.id === 'behavioral' ? 'border-[#8fb8ff]/40 hover:border-[#8fb8ff]' : 'border-marble/20 hover:border-[#e45b5b] hover:bg-[#e45b5b]/10'}`}>
              <c.icon className={c.id === 'behavioral' ? 'text-[#8fb8ff]' : 'text-[#e45b5b]'} size={28} />
              <span>
                <span className="block text-xl text-marble">{c.label}</span>
                <span className="mt-1 block text-sm text-marble/55">{c.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-6 text-xs text-mute">
          Other emergencies (for example chest pain or someone not responding) have no procedure loaded in this prototype. Use the approved paper card and contact Earth.
        </p>
      </div>
    </div>
  );
}
