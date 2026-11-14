import { useEffect, useState } from 'react';
import { CentaurConstellation } from './Brand';

const NAME = 'CHIRON';

// Opening title: the centaur constellation draws itself, the name rises in letter by letter,
// then everything lifts away and the camera pulls back to the mission choice.
export function Intro({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const a = setTimeout(() => setLeaving(true), 4600);
    const b = setTimeout(onDone, 5600);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [onDone]);

  const skip = () => { setLeaving(true); setTimeout(onDone, 700); };

  return (
    <div
      className="fade-out absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center"
      style={{ opacity: leaving ? 0 : 1, transform: leaving ? 'translateY(-24px)' : 'none' }}
      onClick={skip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') && skip()}
      aria-label="Skip intro"
    >
      {/* Black curtain that lifts to reveal Earth and the stars */}
      <div className="pointer-events-none absolute inset-0 bg-void" style={{ animation: 'fade-in 1.8s ease-out reverse forwards' }} />

      <div className="relative flex flex-col items-center">
        <CentaurConstellation draw className="h-32 w-44 md:h-40 md:w-56" />
        <div className="rise mt-2 font-serif text-4xl text-gold" style={{ animationDelay: '1.0s' }}>⚷</div>
        <h1 className="tighten mt-3 flex font-serif text-5xl font-medium text-marble md:text-7xl" aria-label={NAME}>
          {NAME.split('').map((ch, i) => (
            <span key={i} className="rise" style={{ animationDelay: `${1.3 + i * 0.12}s` }}>{ch}</span>
          ))}
        </h1>
        <p className="rise mt-5 font-mono text-xs tracking-[0.35em] text-mute md:text-sm" style={{ animationDelay: '2.7s' }}>
          CREW HEALTH SUPPORT
        </p>
      </div>
      <p className="fade-in absolute bottom-8 font-mono text-[10px] tracking-[0.3em] text-mute/70" style={{ animationDelay: '3.2s' }}>
        CLICK TO CONTINUE
      </p>
    </div>
  );
}
