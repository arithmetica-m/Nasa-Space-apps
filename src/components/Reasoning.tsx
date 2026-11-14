import { useState } from 'react';
import { Route } from 'lucide-react';

// "HOW CHIRON GOT HERE": the same optional button under every recommendation.
// It lists, in order, the information CHIRON used, the protocol or rule it applied,
// the resources it checked, and the logic that led to what is on screen.
// Hidden by default so the screen stays simple; useful for checking and for training.

export interface ReasonStep {
  label: string;                          // e.g. DATA USED, RULE, PROTOCOL, RESOURCES, RESULT
  lines: (string | { text: string; href: string })[];
}

export function Reasoning({ steps, title = 'HOW CHIRON GOT HERE' }: { steps: ReasonStep[]; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex min-h-10 items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-[#8fb8ff] hover:text-marble">
        <Route size={14} /> {open ? 'HIDE THE REASONING' : title}
      </button>
      {open && (
        <ol className="mt-2 space-y-3 border-l-2 border-[#8fb8ff]/50 bg-[#8fb8ff]/[0.05] py-3 pl-4 pr-3 text-sm">
          {steps.map((s, i) => (
            <li key={s.label + i}>
              <div className="font-mono text-[10px] tracking-[0.2em] text-[#8fb8ff]">{i + 1}. {s.label}</div>
              <ul className="mt-1 space-y-0.5 text-marble/85">
                {s.lines.map((l, j) => (
                  <li key={j}>{typeof l === 'string' ? l : <a href={l.href} target="_blank" rel="noreferrer" className="text-gold underline underline-offset-2">{l.text}</a>}</li>
                ))}
              </ul>
            </li>
          ))}
          <li className="text-xs text-mute">Everything above comes from approved library entries and protocols. Decide together with the crew and, when reachable, the flight surgeon.</li>
        </ol>
      )}
    </div>
  );
}
