import { ExternalLink } from 'lucide-react';
import type { Insight } from '../lib/insights';
import type { StudyKind } from '../data/research';

const kindStyle: Record<StudyKind, string> = {
  Astronauts: 'border-gold/60 text-gold',
  'Human ground study': 'border-marble/40 text-marble/80',
  'Human cells or tissue': 'border-marble/20 text-marble/60',
  'Animal model': 'border-marble/20 text-marble/60',
};

// Level 3: the measurements, research and limits behind an insight.
export function Science({ science }: { science: Insight['science'] }) {
  return (
    <div className="mt-3 border-l border-gold/40 pl-3 text-xs">
      <div className="font-mono text-[9px] tracking-[0.3em] text-gold">THE SCIENCE BEHIND THIS</div>

      <dl className="mt-2 space-y-1">
        {science.facts.map((f) => (
          <div key={f.label} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-2">
            <dt className="text-marble/50">{f.label}</dt>
            <dd className="text-marble/85">{f.value}</dd>
          </div>
        ))}
      </dl>

      {science.studies.length > 0 && (
        <>
          <div className="mt-3 font-mono text-[9px] tracking-[0.3em] text-mute">NASA RESEARCH</div>
          <ul className="mt-1.5 space-y-2">
            {science.studies.map((s) => (
              <li key={s.accession}>
                <a href={s.url} target="_blank" rel="noreferrer" className="group block">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] text-gold">{s.accession}</span>
                    <span className={`border px-1.5 font-mono text-[9px] tracking-[0.1em] ${kindStyle[s.kind]}`}>{s.kind.toUpperCase()}</span>
                    {s.mission && <span className="font-mono text-[9px] text-mute">{s.mission}</span>}
                    <ExternalLink size={10} className="text-mute group-hover:text-gold" />
                  </span>
                  <span className="mt-0.5 block text-marble/80 group-hover:text-marble">{s.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-3 font-mono text-[9px] tracking-[0.3em] text-mute">LIMITS</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-marble/60">
        {science.limitations.map((l) => <li key={l}>{l}</li>)}
      </ul>

      {science.sources.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {science.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[9px] tracking-[0.1em] text-mute hover:text-gold">
              {s.label} <ExternalLink size={9} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
