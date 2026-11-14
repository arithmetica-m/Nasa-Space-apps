import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { MemoryItem } from '../lib/memory';

const time = (t: number) => new Date(t).toISOString().slice(5, 16).replace('T', ' ');

// MEDICAL LOG: everything medical that happened on this mission, in plain words.
// Folded by default. Each emergency is one line that opens to show what was done.
// Used by the medical officer, the next person taking over, and the flight surgeon on Earth.
export function MedicalLog({ items, title = 'MEDICAL LOG', showWho = false }: { items: MemoryItem[]; title?: string; showWho?: boolean }) {
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<string>();
  const top = items.filter((m) => !m.group || m.kind === 'Emergency');
  const shown = more ? top : top.slice(0, 6);

  return (
    <details className="border border-marble/10 bg-void/80 backdrop-blur-md">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-serif text-lg tracking-[0.12em] text-marble">{title}</span>
          <span className="block text-base text-marble/60">{items.length ? `${top.length} entries · latest: ${top[0].title}` : 'Nothing recorded yet'}</span>
        </span>
        <ChevronDown size={22} className="shrink-0 text-gold" />
      </summary>
      <div className="border-t border-marble/10 px-5 py-3">
        <p className="text-base text-marble/60">Everything medical on this mission, in order. The medical officer, whoever takes over, and the flight surgeon read this.</p>
        <ol className="mt-2 divide-y divide-marble/10">
          {shown.map((m, i) => {
            const kids = m.kind === 'Emergency' && m.group ? items.filter((x) => x.group === m.group && x.kind !== 'Emergency').sort((a, b) => a.t - b.t) : [];
            const isOpen = open === m.group;
            return (
              <li key={i} className="py-2">
                <button type="button" disabled={!kids.length} onClick={() => setOpen(isOpen ? undefined : m.group)}
                  className="flex w-full flex-wrap items-baseline gap-x-3 text-left disabled:cursor-default">
                  <span className="w-28 shrink-0 font-mono text-sm text-marble/50">{time(m.t)}</span>
                  <span className={`w-28 shrink-0 font-mono text-xs tracking-[0.12em] ${m.kind === 'Emergency' ? 'text-[#ff8585]' : 'text-gold'}`}>{m.kind.toUpperCase()}</span>
                  <span className="min-w-[200px] flex-1 text-base text-marble">{showWho && `${m.who}: `}{m.title}{m.detail && <span className="text-marble/55"> · {m.detail}</span>}</span>
                  {kids.length > 0 && <span className="font-mono text-xs tracking-[0.15em] text-gold">{isOpen ? 'HIDE' : `${kids.length} DETAILS`}</span>}
                </button>
                {isOpen && (
                  <ol className="mt-2 space-y-1 border-l-2 border-[#e45b5b]/40 pl-4">
                    {kids.map((k, j) => (
                      <li key={j} className="flex flex-wrap gap-x-3 text-base">
                        <span className="w-14 shrink-0 font-mono text-sm text-marble/50">{time(k.t).slice(6)}</span>
                        <span className="flex-1 text-marble/90">{k.title}{k.detail && <span className="text-marble/55"> · {k.detail}</span>}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
        {top.length > 6 && (
          <button type="button" onClick={() => setMore(!more)} className="mt-2 min-h-11 border border-marble/20 px-4 text-base text-marble/80">{more ? 'Show less' : `Show all ${top.length}`}</button>
        )}
      </div>
    </details>
  );
}
