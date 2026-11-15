import { ChevronDown } from 'lucide-react';
import type { Explanation } from '../data/meanings';
import { useLibrary } from '../library/store';
import { adviceFor, adviceForEntry } from '../library/advice';
import type { LibraryEntry } from '../library/entries';
import { Reasoning, type ReasonStep } from './Reasoning';

export const OPEN_LIBRARY_EVENT = 'chiron-open-library';
export type LibraryOpenTarget = { entryId?: string; protocolId?: string };
export const openLibrary = (entryId?: string) => window.dispatchEvent(new CustomEvent(OPEN_LIBRARY_EVENT, { detail: { entryId } satisfies LibraryOpenTarget }));
export const openProtocol = (protocolId: string) => window.dispatchEvent(new CustomEvent(OPEN_LIBRARY_EVENT, { detail: { protocolId } satisfies LibraryOpenTarget }));

// The same layout everywhere a reading or symptom is explained: short sections that each
// open on tap, in large text. The advice comes from the mission medical library, fitted to
// this person's medical record.
export function Explained({ e, crewId, why, todo, entry, hideReasoning }: { e: Explanation; crewId?: string; why?: string; todo?: string; entry?: LibraryEntry; hideReasoning?: boolean }) {
  const { entries } = useLibrary();
  const advice = entry ? adviceForEntry(entry, crewId) : e.topic && e.direction !== 'usual' ? adviceFor(entries, e.topic, crewId) : undefined;
  const reason = why ?? e.why;

  return (
    <div className="space-y-2">
      {e.what && <Fold label="WHAT IT IS"><p>{e.what}</p></Fold>}
      {e.means && <Fold label="WHAT IT MAY MEAN"><p>{e.means}</p></Fold>}

      {advice ? (
        <>
          {advice.forYou.length > 0 && <Fold label="FOR YOU" tone="blue" hint="from your medical record"><ul className="space-y-2">{advice.forYou.map((x) => <li key={x}>{x}</li>)}</ul></Fold>}
          <Fold label="WHAT TO DO NOW" tone="gold"><ol className="list-decimal space-y-2 pl-6">{advice.entry.doNow.map((x) => <li key={x}>{x}</li>)}</ol></Fold>
          <Fold label="GET HELP NOW IF" tone="red">
            <ul className="list-disc space-y-1 pl-6">{advice.entry.getHelpNow.map((x) => <li key={x}>{x}</li>)}</ul>
            <p className="mt-2 text-marble/70">Then press EMERGENCY.</p>
          </Fold>
          <Fold label="WHO CAN HELP">
            <p>Tell {advice.whoToHelp}.</p>
            <p className="mt-3 font-mono text-xs tracking-[0.2em] text-gold">IF NOBODY CAN HELP RIGHT NOW</p>
            <ol className="mt-1 list-decimal space-y-1 pl-6">{advice.ifNobody.map((x) => <li key={x}>{x}</li>)}</ol>
          </Fold>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
            <button type="button" onClick={() => openLibrary(advice.entry.id)} className="min-h-10 font-mono text-[11px] tracking-[0.18em] text-gold hover:text-marble">OPEN IN LIBRARY</button>
            {!hideReasoning && <Reasoning steps={reasonSteps(e, advice)} />}
          </div>
        </>
      ) : (todo ?? e.todo) && <Fold label="WHAT TO DO" tone="gold"><p>{todo ?? e.todo}</p></Fold>}

      {reason && !advice && <Fold label="WHY IT MATTERS IN SPACE"><p>{reason}</p></Fold>}
    </div>
  );
}

const TONES = {
  plain: 'border-marble/15 text-marble',
  gold: 'border-gold/50 text-gold',
  red: 'border-[#e45b5b]/60 text-[#ff8585]',
  blue: 'border-[#8fb8ff]/50 text-[#bcd3ff]',
};

// One section: a big label you tap to open its text.
export function Fold({ label, hint, tone = 'plain', children }: { label: string; hint?: string; tone?: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <details className={`group border-l-4 bg-void/60 ${TONES[tone]}`}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="text-base font-semibold tracking-[0.14em]">{label}{hint && <span className="ml-2 text-sm font-normal tracking-normal text-marble/50">{hint}</span>}</span>
        <ChevronDown size={22} className="shrink-0 transition group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 text-lg leading-relaxed text-marble">{children}</div>
    </details>
  );
}

function reasonSteps(e: Explanation, a: NonNullable<ReturnType<typeof adviceFor>>): ReasonStep[] {
  const trig = e.topic?.symptom ? `the symptom “${e.topic.symptom}”` : `${e.name.toLowerCase()} that is ${e.direction === 'high' ? 'higher' : 'lower'} than normal`;
  return [
    { label: 'DATA USED', lines: e.evidence
      ? [`${e.name}: ${e.evidence.value}, ${e.evidence.when}.`, `Source: ${e.evidence.source}.`, `Your normal range: ${e.evidence.normal}.`]
      : [`Symptom reported: ${e.name}.`, 'Source: your own report (daily check-in or body map).'] },
    { label: 'RULE', lines: e.evidence
      ? ['A reading outside your own normal range is flagged for attention.', 'Flagged means “look at this”, not a diagnosis.']
      : ['Every reported symptom is looked up in the medical library.'] },
    { label: 'PROTOCOL USED', lines: [
      `Library entry ${a.entry.id} “${a.entry.title}”, version ${a.entry.version} (${a.entry.updated}), released by ${a.entry.approvedBy}.`,
      `Chosen because it covers ${trig}.`,
    ] },
    { label: 'YOUR MEDICAL RECORD', lines: a.matched.length ? a.matched : ['Nothing in your record changes this advice.'] },
    { label: 'WHO CAN HELP', lines: [`Medical support for you: ${a.whoToHelp}.`, 'If they cannot help, the library steps and the emergency procedure still apply.'] },
    { label: 'WHY THESE STEPS', lines: [a.entry.reasoning, ...a.entry.basis.map((b) => ({ text: `${b.claim} (${b.source.label})`, href: b.source.url }))] },
  ];
}

export function WhyBlock({ reasoning, basis }: { reasoning: string; basis: { claim: string; source: { label: string; url: string } }[] }) {
  return (
    <div className="space-y-2 bg-void/60 p-3 text-sm">
      <p className="text-marble/85">{reasoning}</p>
      <ul className="space-y-1.5">
        {basis.map((b) => (
          <li key={b.claim} className="text-marble/70">
            {b.claim}{' '}
            <a href={b.source.url} target="_blank" rel="noreferrer" className="text-gold underline underline-offset-2">{b.source.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
