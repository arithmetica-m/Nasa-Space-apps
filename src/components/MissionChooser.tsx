import type { MissionId } from '../types';
import { missionOrder, missions } from '../data/missions';

interface Props {
  hovered?: MissionId;
  onHover: (id?: MissionId) => void;
  onPick: (id: MissionId) => void;
}

// Keep choices in document layout so projected planet positions cannot overlap them.
export function MissionChooser({ hovered, onHover, onPick }: Props) {
  return (
    <section aria-labelledby="mission-choice-title" className="absolute inset-0 z-10 flex flex-col overflow-y-auto px-4 pb-10 pt-8 sm:px-8 sm:pt-10">
      <div className="shrink-0 text-center">
        <div className="rise font-mono text-[10px] tracking-[0.4em] text-mute">⚷ CHIRON</div>
        <h2 id="mission-choice-title" className="rise mt-3 font-serif text-2xl tracking-[0.18em] text-marble sm:text-3xl md:text-4xl" style={{ animationDelay: '0.15s' }}>CHOOSE YOUR MISSION</h2>
        <p className="rise mx-auto mt-4 max-w-md text-sm text-marble/60" style={{ animationDelay: '0.5s' }}>
          Each mission changes the gravity, the delay to Earth and the care available on board.
        </p>
      </div>
      <div className="min-h-12 flex-1" aria-hidden="true" />
      <nav aria-label="Mission options" className="mx-auto grid w-full max-w-6xl shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {missionOrder.map((id) => {
          const mission = missions[id];
          const lit = hovered === id;
          return (
            <button key={id} type="button"
              onMouseEnter={() => onHover(id)} onMouseLeave={() => onHover(undefined)}
              onFocus={() => onHover(id)} onBlur={() => onHover(undefined)} onClick={() => onPick(id)}
              className={`min-h-24 min-w-0 border px-4 py-4 text-left backdrop-blur-md transition duration-300 ${lit ? 'border-gold/80 bg-void/90' : 'border-marble/25 bg-void/80 hover:border-gold/60'}`}>
              <span className={`block break-words font-serif text-sm tracking-[0.15em] ${lit ? 'text-gold' : 'text-marble'}`}>{mission.name.toUpperCase()}</span>
              <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] leading-relaxed tracking-[0.1em] text-mute">
                <span>{mission.totalDays} DAYS</span>
                <span>EARTH {mission.delayLabel.toUpperCase()}</span>
                <span>{mission.gravity.toUpperCase()}</span>
              </span>
            </button>
          );
        })}
      </nav>
    </section>
  );
}
