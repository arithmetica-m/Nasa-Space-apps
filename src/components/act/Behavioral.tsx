import { useEffect, useState } from 'react';
import { ArrowLeft, Lock, RadioTower, UserRound } from 'lucide-react';
import type { Mission } from '../../types';
import { crew } from '../../emergency/data';
import { publish } from '../../emergency/sync';

type Screen = 'safety' | 'choose' | 'breathe' | 'ground' | 'people' | 'sent';

// GROUNDING exercise steps: a widely used 5-4-3-2-1 senses exercise.
// DEMO: the mission's approved behavioral health exercises should replace these.
const GROUND = [
  'Name five things you can see around you.',
  'Name four things you can touch. Notice how they feel.',
  'Name three things you can hear.',
  'Name two things you can smell, or two smells you like.',
  'Name one thing you can taste, or take a sip of water.',
];

// Private, calm support. Nothing here is shared with the crew unless the astronaut chooses.
export function Behavioral({ mission, account, onEnd, onPhysical }: { mission: Mission; account: string; onEnd: () => void; onPhysical: () => void }) {
  const [screen, setScreen] = useState<Screen>('safety');
  const [g, setG] = useState(0);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [sentTo, setSentTo] = useState<string>();

  useEffect(() => {
    if (screen !== 'breathe') return;
    let t: ReturnType<typeof setTimeout>;
    const loop = (p: 'in' | 'out') => { setPhase(p); t = setTimeout(() => loop(p === 'in' ? 'out' : 'in'), p === 'in' ? 4000 : 6000); };
    loop('in');
    return () => clearTimeout(t);
  }, [screen]);

  const btn = 'w-full border border-[#8fb8ff]/30 px-5 py-4 text-left text-lg text-marble transition hover:border-[#8fb8ff]/80 hover:bg-[#8fb8ff]/5';

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center overflow-y-auto bg-[#060b16] px-6 py-8" style={{ animation: 'fade-in 0.6s ease-out' }}>
      <div className="flex w-full max-w-xl items-center justify-between">
        <button onClick={onEnd} className="flex items-center gap-1 font-mono text-[10px] tracking-[0.25em] text-marble/50 hover:text-marble"><ArrowLeft size={12} /> CLOSE</button>
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] text-[#8fb8ff]/80"><Lock size={11} /> PRIVATE · ONLY YOU SEE THIS</span>
      </div>

      <div className="my-auto w-full max-w-xl py-10">
        {screen === 'safety' && (
          <div className="rise">
            <p className="font-serif text-2xl tracking-[0.06em] text-marble">First, a quick check.</p>
            <p className="mt-2 text-marble/70">Do you have chest pain, trouble breathing, or feel like you might faint?</p>
            <div className="mt-6 space-y-2">
              <button className={btn} onClick={onPhysical}>Yes: get physical help</button>
              <button className={btn} onClick={() => setScreen('choose')}>No</button>
            </div>
            <p className="mt-4 text-xs text-marble/40">Panic and some physical problems can feel the same. CHIRON checks this first and never assumes it is panic.</p>
          </div>
        )}

        {screen === 'choose' && (
          <div className="rise">
            <p className="font-serif text-2xl tracking-[0.06em] text-marble">What would help right now?</p>
            <div className="mt-6 space-y-2">
              <button className={btn} onClick={() => setScreen('breathe')}>Slow my breathing</button>
              <button className={btn} onClick={() => { setG(0); setScreen('ground'); }}>Ground myself</button>
              <button className={btn} onClick={() => setScreen('people')}>Talk to someone</button>
            </div>
            <p className="mt-4 text-xs text-marble/40">Exercises here are demo versions. The mission's approved behavioral health exercises should replace them.</p>
          </div>
        )}

        {screen === 'breathe' && (
          <div className="rise text-center">
            <div className="mx-auto flex h-56 w-56 items-center justify-center">
              <div className="rounded-full border border-[#8fb8ff]/60 bg-[#8fb8ff]/10"
                style={{ width: phase === 'in' ? 220 : 90, height: phase === 'in' ? 220 : 90, transition: `all ${phase === 'in' ? 4 : 6}s ease-in-out` }} />
            </div>
            <p className="mt-4 font-serif text-2xl tracking-[0.1em] text-marble">{phase === 'in' ? 'Breathe in' : 'Breathe out, slowly'}</p>
            <button onClick={() => setScreen('choose')} className="mt-8 font-mono text-[10px] tracking-[0.25em] text-marble/50 hover:text-marble">I FEEL A LITTLE STEADIER</button>
          </div>
        )}

        {screen === 'ground' && (
          <div className="rise" key={g}>
            <p className="font-mono text-[10px] tracking-[0.3em] text-[#8fb8ff]/70">{g + 1} OF {GROUND.length}</p>
            <p className="mt-3 font-serif text-2xl leading-snug text-marble">{GROUND[g]}</p>
            <button onClick={() => (g + 1 < GROUND.length ? setG(g + 1) : setScreen('choose'))} className={`${btn} mt-8 text-center`}>
              {g + 1 < GROUND.length ? 'Next' : 'Done'}
            </button>
          </div>
        )}

        {screen === 'people' && (
          <div className="rise">
            <p className="font-serif text-2xl tracking-[0.06em] text-marble">Who would you like?</p>
            <p className="mt-2 text-sm text-marble/60">They only see that you asked for them. Nothing else from this screen is shared.</p>
            <div className="mt-6 space-y-2">
              {crew.filter((c) => c.id !== account).map((c) => (
                <button key={c.id} className={`${btn} flex items-center gap-3`} onClick={() => { publish({ type: 'support', to: c.id, from: account, by: account }); setSentTo(c.name); setScreen('sent'); }}>
                  <UserRound size={18} className="text-[#8fb8ff]" /> {c.name}
                </button>
              ))}
              <button className={`${btn} flex items-center gap-3`} onClick={() => { setSentTo(`the flight psychologist (private channel, ${mission.delayLabel} each way)`); setScreen('sent'); }}>
                <RadioTower size={18} className="text-[#8fb8ff]" /> Flight psychologist on Earth, privately
              </button>
            </div>
          </div>
        )}

        {screen === 'sent' && (
          <div className="rise text-center">
            <p className="font-serif text-2xl tracking-[0.06em] text-marble">Your request is on its way</p>
            <p className="mt-2 text-marble/70">To {sentTo}.</p>
            <button onClick={() => setScreen('choose')} className={`${btn} mt-8 text-center`}>Keep going here while you wait</button>
          </div>
        )}
      </div>

      <p className="max-w-xl text-center text-[11px] text-marble/35">
        If you have any thought of harming yourself, or feel confused or unsafe, CHIRON will connect you to the flight psychologist straight away under the mission's approved procedure.
      </p>
    </div>
  );
}
