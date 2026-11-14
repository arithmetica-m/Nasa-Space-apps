import type { Mission } from '../types';

// Where you are in the journey. Kept separate from health on purpose,
// so it is never mistaken for a navigation display.
export function MissionProgress({ mission }: { mission: Mission }) {
  const pct = (mission.today / mission.totalDays) * 100;
  const left = mission.totalDays - mission.today;
  return (
    <div className="w-full max-w-xl" aria-label={`Mission progress: day ${mission.today} of ${mission.totalDays}`}>
      <div className="mb-2 text-center font-mono text-[10px] tracking-[0.35em] text-mute">MISSION PROGRESS</div>
      <div className="flex items-center gap-3">
        <span className="whitespace-nowrap font-mono text-[10px] tracking-[0.2em] text-marble/70">{mission.startLabel.toUpperCase()}</span>
        <div className="relative h-4 flex-1">
          <div className="absolute inset-x-0 top-1/2 h-px bg-marble/20" />
          <div className="absolute left-0 top-1/2 h-px bg-gold/80" style={{ width: `${pct}%` }} />
          {[0, 25, 50, 75, 100].map((t) => (
            <div key={t} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-marble/30" style={{ left: `${t}%` }} />
          ))}
          <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-gold bg-void" style={{ left: `${pct}%` }} />
        </div>
        <span className="whitespace-nowrap font-mono text-[10px] tracking-[0.2em] text-marble/70">{mission.endLabel.toUpperCase()}</span>
      </div>
      <div className="mt-1.5 text-center font-mono text-[10px] tracking-[0.2em] text-marble/80">
        DAY {mission.today} OF {mission.totalDays} · {left} DAYS TO GO
      </div>
    </div>
  );
}
