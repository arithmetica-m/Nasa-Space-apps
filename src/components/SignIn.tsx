import { useState } from 'react';
import type { Mission } from '../types';
import type { CrewMember } from '../emergency/types';

// ONE-TIME SETUP: who uses this device. Shown only the first time; CHIRON remembers it.
// The prototype only picks a name. A real system would use the mission's own sign-in.
export function SignIn({ crew, mission, onDone }: { crew: CrewMember[]; mission: Mission; onDone: (id: string) => void }) {
  const [picked, setPicked] = useState<string>();
  const person = crew.find((m) => m.id === picked);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#08111f] p-4" role="dialog" aria-modal="true" aria-labelledby="signin-title">
      <section className="w-full max-w-xl">
        <div className="font-mono text-[11px] tracking-[0.3em] text-[#9be7ef]">⚷ CHIRON · FIRST-TIME SETUP · {mission.name.toUpperCase()}</div>
        {!person ? (
          <>
            <h1 id="signin-title" className="mt-3 text-3xl font-semibold tracking-[0.06em] text-white">WHO USES THIS DEVICE?</h1>
            <p className="mt-2 text-sm text-white/60">You only do this once.</p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {crew.map((m) => (
                <button key={m.id} type="button" onClick={() => setPicked(m.id)}
                  className="min-h-16 border border-white/15 bg-[#0d1a2c] px-4 py-3 text-left hover:border-[#67c9d5]/70 hover:bg-[#10213a]">
                  <div className="text-base font-semibold tracking-[0.06em] text-white">{m.name.toUpperCase()}</div>
                  <div className="text-xs tracking-[0.12em] text-white/50">{m.position.split(' · ').pop()!.toUpperCase()}</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 id="signin-title" className="mt-3 text-3xl font-semibold tracking-[0.06em] text-white">{person.name.toUpperCase()}</h1>
            <ul className="mt-5 space-y-2 text-sm text-white/80">
              <li className="flex gap-3"><span className="text-[#5cc8a8]">✓</span> MISSION: {mission.name.toUpperCase()}</li>
              <li className="flex gap-3"><span className="text-[#5cc8a8]">✓</span> MEDICAL RECORD SAVED ON THIS DEVICE <span className="text-white/40">(SAMPLE DATA)</span></li>
              <li className="flex gap-3"><span className="text-[#5cc8a8]">✓</span> WORKS WITHOUT A LINK TO EARTH</li>
            </ul>
            <div className="mt-8 flex gap-3">
              <button type="button" onClick={() => setPicked(undefined)} className="min-h-12 border border-white/20 px-5 text-sm text-white/75 hover:text-white">Back</button>
              <button type="button" autoFocus onClick={() => onDone(person.id)} className="min-h-12 flex-1 bg-[#67c9d5] px-5 font-mono text-sm font-semibold tracking-[0.2em] text-[#08111f] hover:bg-[#9be7ef]">START</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
