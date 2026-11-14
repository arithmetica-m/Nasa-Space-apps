import { useMemo, useState } from 'react';
import { Siren, X } from 'lucide-react';
import type { DayRecord } from '../types';
import { useLibrary } from '../library/store';
import { categoriesFor, nextQuestion, QUICK, score, urgentOf, type BodyPart } from '../triage/symptomCheck';
import { Explained } from './Explained';
import { Reasoning } from './Reasoning';

export const BODY_REPORT_EVENT = 'chiron-body-report';

const PARTS: [BodyPart, string][] = [
  ['brain', 'Head'], ['eyes', 'Eyes'], ['ears', 'Ears · balance'], ['throat', 'Nose · throat'], ['heart', 'Heart'], ['lungs', 'Lungs'],
  ['stomach', 'Stomach'], ['kidneys', 'Kidneys'], ['back', 'Back'], ['bones', 'Bones · hips'], ['arms', 'Arms · hands'], ['legs', 'Legs'], ['skin', 'Skin'], ['whole', 'Whole body'],
];

interface Props {
  crewId: string;
  records: DayRecord[];
  startPart?: BodyPart;
  onClose: () => void;
  onEmergency: () => void;
}

// REPORT SOMETHING: describe it in your own words, or point at the body. CHIRON asks
// follow-up questions only when they help tell the possible causes apart.
export function ReportSomething({ crewId, records, startPart, onClose, onEmergency }: Props) {
  const { entries } = useLibrary();
  const [text, setText] = useState('');
  const [parts, setParts] = useState<BodyPart[]>(startPart ? [startPart] : []);
  const [step, setStep] = useState<'describe' | 'ask' | 'result'>('describe');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const cats = useMemo(() => categoriesFor(text, parts), [text, parts]);
  const ranked = useMemo(() => score(cats, answers, crewId, records), [cats, answers, crewId, records]);
  const next = step === 'ask' ? nextQuestion(cats, answers, ranked) : undefined;
  const urgent = urgentOf(cats, answers);
  const emergency = urgent.find((u) => u.level === 'emergency');
  const top = ranked.slice(0, 3);
  const entry = entries.find((e) => e.id === top[0]?.cat.library);
  const said = [text.trim(), parts.length ? `(${parts.map((p) => PARTS.find((x) => x[0] === p)![1]).join(', ')})` : ''].filter(Boolean).join(' ');

  const toggleQuick = (q: string) => setText((t) => (t.includes(q) ? t.replace(q, '').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '') : t ? `${t}, ${q}` : q));
  const togglePart = (p: BodyPart) => setParts((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]));

  const finish = () => {
    setStep('result');
    // Save it on the body map, on the part it most likely belongs to.
    const region = parts[0] ?? top[0]?.cat.parts[0] ?? 'whole';
    try {
      const key = `chiron-body-reports-v1-${crewId}`;
      const list = JSON.parse(localStorage.getItem(key) ?? '[]');
      localStorage.setItem(key, JSON.stringify([...list, { region, note: text.trim() || 'Reported problem', at: new Date().toISOString() }]));
      window.dispatchEvent(new Event(BODY_REPORT_EVENT));
    } catch { /* storage unavailable */ }
  };
  const answer = (key: string, label: string) => {
    const a = { ...answers, [key]: label };
    setAnswers(a);
    if (!nextQuestion(cats, a, score(cats, a, crewId, records))) finish();
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#020408]/90 p-3 backdrop-blur-sm md:p-8" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <section className="mx-auto w-full max-w-3xl border border-gold/30 bg-[#07090d] p-5 md:p-7">
        <div className="flex items-start justify-between gap-3">
          <h2 id="report-title" className="font-serif text-2xl tracking-[0.15em] text-marble">REPORT SOMETHING</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-12 w-12 items-center justify-center border border-marble/20 text-marble/70 hover:text-marble"><X /></button>
        </div>

        {step === 'describe' && (
          <div className="mt-4 space-y-5">
            <div>
              <label htmlFor="report-text" className="text-lg text-marble">What is wrong? Say it in your own words.</label>
              <textarea id="report-text" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="For example: pain in my side that comes and goes"
                className="mt-2 w-full border border-marble/25 bg-transparent p-3 text-lg text-marble" />
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK.map((q) => (
                  <button key={q} type="button" onClick={() => toggleQuick(q)} aria-pressed={text.includes(q)}
                    className={`min-h-11 border px-3 text-base ${text.includes(q) ? 'border-gold bg-gold/15 text-marble' : 'border-marble/20 text-marble/80 hover:border-gold/60'}`}>{q}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-lg text-marble">Where? Pick one or more, or skip if you are not sure.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PARTS.map(([p, label]) => (
                  <button key={p} type="button" onClick={() => togglePart(p)} aria-pressed={parts.includes(p)}
                    className={`min-h-11 border px-3 text-base ${parts.includes(p) ? 'border-gold bg-gold/15 text-marble' : 'border-marble/20 text-marble/80 hover:border-gold/60'}`}>{label}</button>
                ))}
              </div>
            </div>
            {(text.trim() || parts.length > 0) && cats.length === 0 && (
              <p className="text-base text-[#f3c28d]">CHIRON could not match this yet. Pick the body part, or tap one of the common problems.</p>
            )}
            <button type="button" disabled={cats.length === 0} onClick={() => (nextQuestion(cats, answers, ranked) ? setStep('ask') : finish())}
              className="min-h-14 w-full bg-gold font-mono text-sm tracking-[0.2em] text-void disabled:opacity-40">CONTINUE</button>
          </div>
        )}

        {step === 'ask' && next && (
          <div className="mt-4">
            <p className="font-mono text-xs tracking-[0.2em] text-gold">{next.cat.name.toUpperCase()} · QUESTION {Object.keys(answers).length + 1}</p>
            <h3 className="mt-2 text-2xl leading-snug text-marble">{next.q.text}</h3>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {next.q.answers.map((a) => (
                <button key={a.label} type="button" onClick={() => answer(`${next.cat.id}:${next.q.id}`, a.label)}
                  className="min-h-16 border border-marble/25 px-4 text-xl text-marble hover:border-gold hover:bg-gold/10">{a.label}</button>
              ))}
            </div>
            <p className="mt-3 text-base text-marble/55">CHIRON asks only while the possible causes are still close.</p>
          </div>
        )}

        {step === 'result' && (
          <div className="mt-4 space-y-4">
            {emergency && (
              <div className="border-2 border-[#e45b5b] bg-[#e45b5b]/10 p-4">
                <p className="text-xl text-marble">{emergency.text}</p>
                <button type="button" onClick={onEmergency} className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 bg-[#e45b5b] font-mono text-sm font-semibold tracking-[0.2em] text-[#130709]"><Siren size={18} /> START EMERGENCY</button>
              </div>
            )}
            {urgent.filter((u) => u.level === 'today').map((u) => <p key={u.text} className="border-l-4 border-[#e39b4b] bg-[#e39b4b]/10 px-4 py-3 text-lg text-[#f3c28d]">{u.text}</p>)}

            <div>
              <p className="text-base text-marble/60">You reported: {said}</p>
              <h3 className="mt-3 font-mono text-xs tracking-[0.2em] text-gold">WHAT IT COULD BE</h3>
              <ul className="mt-2 space-y-2">
                {top.map((r, i) => {
                  const pct = Math.round((r.score / Math.max(0.1, top[0].score)) * 100);
                  return (
                    <li key={r.cat.id + r.cause.id} className="border border-marble/10 p-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-lg text-marble">{r.cause.name}</span>
                        <span className={`shrink-0 font-mono text-xs tracking-[0.15em] ${i === 0 ? 'text-gold' : 'text-marble/55'}`}>{i === 0 ? 'MOST LIKELY' : pct >= 60 ? 'ALSO POSSIBLE' : 'LESS LIKELY'}</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-marble/10"><div className="h-full bg-gold/70" style={{ width: `${pct}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-base text-marble/55">Possible causes, not a diagnosis. The medical officer confirms.</p>
            </div>

            <Explained e={{ name: text.trim() || top[0]?.cat.name || 'Reported problem', direction: 'high', what: '', todo: 'Tell the medical officer today. If it gets worse fast, press EMERGENCY.' }} entry={entry} crewId={crewId} hideReasoning />

            <Reasoning title="HOW CHIRON GOT HERE" steps={[
              { label: 'WHAT YOU REPORTED', lines: [said || 'Nothing typed'] },
              { label: 'CATEGORIES MATCHED', lines: cats.map((c) => `${c.name}: ${c.words.test(text) ? 'matched your words' : 'matched the body part you picked'}.`) },
              { label: 'YOUR ANSWERS', lines: Object.keys(answers).length ? Object.entries(answers).map(([k, v]) => { const [c, q] = k.split(':'); return `${cats.find((x) => x.id === c)?.questions.find((x) => x.id === q)?.text} → ${v}`; }) : ['No follow-up questions were needed.'] },
              { label: 'HOW EACH CAUSE WAS SCORED', lines: top.flatMap((r) => [`${r.cause.name}: ${r.score}`, ...r.why.map((w) => `   ${w}`)]) },
              { label: 'RULE', lines: ['Safety questions are always asked first. Any danger answer stops the questions and shows EMERGENCY.', 'More questions are asked only while the top two causes are less than 3 points apart (at most 6).'] },
              { label: 'ADVICE USED', lines: [entry ? `Library entry ${entry.id} “${entry.title}” v${entry.version}.` : 'No library entry for this category yet: general advice shown.'] },
            ]} />
            <p className="text-sm text-marble/50">Saved to your body map. Demo rules, not a validated clinical tool.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onClose} className="min-h-12 bg-gold px-6 font-mono text-sm tracking-[0.2em] text-void">DONE</button>
              <button type="button" onClick={() => { setStep('describe'); setAnswers({}); }} className="min-h-12 border border-marble/25 px-5 text-base text-marble/80">Report something else</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
