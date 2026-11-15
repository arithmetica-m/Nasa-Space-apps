import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { DayRecord, Mission } from '../../types';
import { indicators } from '../../data/indicators';
import { outsideness } from '../../data/simulate';
import { latestValue } from '../../lib/health';
import { readiness } from '../../prevent/readiness';
import { WARNING_RULES } from '../../link/link';
import { useLog } from '../../emergency/sync';
import type { CrewMember, Procedure } from '../../emergency/types';
import { procedures as guides } from '../../data/procedures';
import { buildQuiz, SCENARIOS, SKILLS, savePractice, skillStatus } from '../../train/training';
import { Reasoning } from '../Reasoning';
import { PageShell, Panel } from './ui';

// Which body systems matter for each kind of mission event, and what to do to get ready.
const EVENT_PREP: { match: RegExp; systems: string[]; todo: string[] }[] = [
  { match: /arrival|landing|return/i, systems: ['musculoskeletal', 'sensorimotor', 'cardiovascular'],
    todo: ['Do every resistance exercise session: you need strong legs when gravity returns.', 'Practise balance for 10 minutes a day.', 'Drink extra water in the last days before: it helps blood pressure on landing.'] },
  { match: /halfway/i, systems: ['mind', 'sleep'],
    todo: ['Protect your sleep period.', 'Plan a private call home.', 'Eat at least one meal a day with the crew.'] },
];

interface Props {
  mission: Mission;
  crew: CrewMember[];
  account: string;
  records: DayRecord[];          // the signed-in astronaut's own records only
  kb: Procedure[];
  onGuide: (id: string) => void;
  onStock: () => void;
  focus: 'prevent' | 'train';
}

// PREVENT and TRAIN: get ready before something goes wrong. Gaps found in the readiness simulation
// become practice and actions; personal advice is shown only to the signed-in astronaut.
export function TrainPage({ mission, crew, account, records, kb, onGuide, onStock, focus }: Props) {
  const [practice, setPractice] = useState<string>();   // skill id being practised
  const [version, setVersion] = useState(0);            // refresh after a practice is saved
  const me = crew.find((c) => c.id === account);
  const mine = useMemo(() => account ? skillStatus(account, mission.id) : [], [account, mission.id, version]);
  const log = useLog();
  const sim = useMemo(() => readiness(kb, mission.id, log), [kb, mission.id, version, log]);
  // Any approved protocol can be practised, even one not needed on this mission.
  const approved = (cat: string) => kb.find((p) => p.category === cat && p.status === 'approved' && p.steps.length);
  const next = mission.milestones.find((m) => m.day > mission.today);
  const prep = next && EVENT_PREP.find((e) => e.match.test(next.title));
  const myConcerns = prep ? indicators.filter((i) => prep.systems.includes(i.system)).filter((ind) => { const l = latestValue(records, ind.id); return l && outsideness(ind, l.value) > 0.05; }) : [];

  if (practice) {
    const p = approved(practice)!;
    return <Practice protocol={p} all={kb.filter((x) => x.status === 'approved' && x.steps.length)} scenario={SCENARIOS[practice]}
      onDone={(score, total) => { if (account) savePractice({ crewId: account, skillId: practice, score, total, t: Date.now() }); setVersion((v) => v + 1); }}
      onClose={() => setPractice(undefined)} />;
  }

  return (
    <PageShell title={focus === 'prevent' ? 'PREVENT' : 'TRAIN'}>
      {focus === 'prevent' && <>
      <p className="max-w-3xl text-base text-marble/70">PREVENT watches each astronaut’s readings against their own normal and gets the crew ready before the next mission event, so problems are caught early.</p>

      {/* Your readings against your own normal: private, so only for the signed-in astronaut. */}
      <Panel title={me ? `YOUR READINGS, ${me.name.split(' ')[0].toUpperCase()}` : 'YOUR READINGS'} tag="SIMULATED">
        {!me ? <p className="text-lg text-marble/80">Your readings are private. Choose your profile on the dashboard and enter your PIN to see them here.</p> : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {indicators
              .map((ind) => { const l = latestValue(records, ind.id); return { ind, l, out: l ? outsideness(ind, l.value) > 0.05 : false }; })
              // The six main readings, plus anything outside normal. Problems first.
              .filter((x) => x.out || ['hr', 'bp_sys', 'glucose', 'temp', 'sleep_h', 'mood'].includes(x.ind.id))
              .sort((a, b) => Number(b.out) - Number(a.out))
              .map(({ ind, l, out }) => {
              const dir = l && out ? (l.value > ind.baseline[1] ? 'Higher than your normal' : 'Lower than your normal') : 'Within your normal';
              return (
                <li key={ind.id} className={`border p-3 ${!l ? 'border-marble/10' : out ? 'border-[#e39b4b]/60 bg-[#e39b4b]/[0.05]' : 'border-[#5cc8a8]/30'}`}>
                  <div className="text-base text-marble">{ind.name}</div>
                  <div className="font-mono text-xl text-marble">{l ? `${l.value} ${ind.unit}` : '—'}</div>
                  <div className={`text-sm ${!l ? 'text-marble/50' : out ? 'text-[#f3c28d]' : 'text-[#7bd5b8]'}`}>{l ? dir : 'No reading yet'}</div>
                  <div className="text-xs text-marble/45">Your normal: {ind.baseline[0]}–{ind.baseline[1]} {ind.unit}</div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="WHAT TRIGGERS A WARNING" tag="SIMULATED">
        <ul className="space-y-2">
          <li className="border-l-2 border-gold pl-3 text-lg text-marble">A reading outside the astronaut’s own normal, approved by the flight surgeon.</li>
          {WARNING_RULES.map((w) => <li key={w.key} className="border-l-2 border-gold pl-3 text-lg text-marble">LINK band: {w.rule}.</li>)}
          <li className="border-l-2 border-gold pl-3 text-lg text-marble">Any symptom the astronaut reports, even when the sensors look normal.</li>
          <li className="border-l-2 border-gold pl-3 text-lg text-marble">No check-in or no band data for too long: shown as missing, never guessed.</li>
        </ul>
        <p className="mt-2 text-sm text-marble/55">Demo rules for this prototype, not approved medical limits.</p>
      </Panel>

      {next && !prep && (
        <Panel title={`NEXT: ${next.title.toUpperCase()} IN ${next.day - mission.today} DAYS`}>
          <p className="text-lg text-marble">{next.health}</p>
        </Panel>
      )}
      {next && prep && (
        <Panel title={`${next.title.toUpperCase()} IN ${next.day - mission.today} DAYS`}>
          <h3 className="font-mono text-xs tracking-[0.2em] text-gold">WHAT TO DO TO BE READY</h3>
          <ul className="mt-2 space-y-2">
            {prep.todo.map((t) => <li key={t} className="border-l-2 border-gold pl-3 text-lg text-marble">{t}</li>)}
            {me && myConcerns.length > 0 && <li className="border-l-2 border-[#e39b4b] pl-3 text-lg text-[#f3c28d]">{me.name.split(' ')[0]}: CHIRON has personal advice for you. Open your profile.</li>}
          </ul>
          <div className="mt-2"><Reasoning steps={[
            { label: 'MISSION INFORMATION', lines: [`Next event: ${next.title}, mission day ${next.day} (today is day ${mission.today}).`, next.health] },
            { label: 'RULE', lines: [`For this event CHIRON checks: ${prep.systems.join(', ')}.`, 'Only your own readings are used here. Other crew members see their own advice.'] },
            { label: 'RESULT', lines: [!me ? 'Sign in for checks against your personal readings.' : myConcerns.length ? `${myConcerns.length} of your readings outside normal.` : 'All your related readings are within normal.'] },
          ]} /></div>
        </Panel>
      )}


      </>}

      {focus === 'train' && <>
      <Panel title="PREPARE · IS THE CREW READY FOR AN EMERGENCY?" tag="SIMULATION (LEVEL 2)">
        <div className="grid gap-3 md:grid-cols-2">
          {sim.map((s) => {
            const canPractise = !!approved(s.category);
            return (
              <section key={s.category} className={`border p-4 ${s.ready ? 'border-[#5cc8a8]/30' : 'border-[#e39b4b]/50'}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-lg text-marble">{s.name}</h3>
                  <span className={`font-mono text-xs tracking-[0.15em] ${s.ready ? 'text-[#7bd5b8]' : 'text-[#f3c28d]'}`}>{s.ready ? 'READY' : 'NEEDS WORK'}</span>
                </div>
                <ul className="mt-3 space-y-3">
                  {s.gaps.map((g) => (
                    <li key={g.text}>
                      <p className="text-base text-marble/65">{g.text}</p>
                      <p className="text-lg text-marble">→ {g.fix}</p>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canPractise && s.gaps.some((g) => g.action === 'practice') && (
                    <button type="button" onClick={() => setPractice(s.category)} className="min-h-12 bg-gold px-5 font-mono text-xs tracking-[0.2em] text-void">PRACTISE NOW</button>
                  )}
                  {s.gaps.some((g) => g.action === 'stock') && (
                    <button type="button" onClick={onStock} className="min-h-12 border border-gold/60 px-5 font-mono text-xs tracking-[0.2em] text-gold">CHECK STOCK</button>
                  )}
                </div>
                <div className="mt-2"><Reasoning steps={[{ label: 'WHAT IS IN PLACE', lines: s.ok }, { label: 'HOW THE SIMULATION RAN', lines: s.logic }]} /></div>
              </section>
            );
          })}
        </div>
      </Panel>
      <p className="text-sm text-marble/55">Practice keeps skills current. It does not authorise anyone to do a procedure: authorisation comes from the mission medical team.</p>
      {me && <Panel title={`YOUR REFRESHERS, ${me.name.split(' ')[0].toUpperCase()}`}>
        <ul className="space-y-2">
          {mine.filter((s) => s.due).slice(0, 3).map((s) => (
            <li key={s.skill.id} className="flex flex-wrap items-center justify-between gap-2 border border-[#e39b4b]/40 p-3">
              <span>
                <span className="block text-lg text-marble">{s.skill.name}</span>
                <span className="block text-sm text-marble/60">Last practised {s.daysSince} days ago</span>
              </span>
              {approved(s.skill.id)
                ? <button type="button" onClick={() => setPractice(s.skill.id)} className="min-h-12 bg-gold px-5 font-mono text-xs tracking-[0.2em] text-void">PRACTISE NOW</button>
                : s.skill.kind === 'measurement'
                  ? <button type="button" onClick={() => onGuide(s.skill.id)} className="min-h-12 border border-gold/60 px-5 font-mono text-xs tracking-[0.2em] text-gold">OPEN GUIDE</button>
                  : <span className="text-sm text-marble/60">Practise with the medical officer</span>}
              <div className="w-full"><Reasoning title="WHY THIS?" steps={[{ label: 'TRAINING RECORD AND RULES', lines: s.reasons }]} /></div>
            </li>
          ))}
          {!mine.some((s) => s.due) && <li className="text-lg text-[#7bd5b8]">All your skills are up to date.</li>}
        </ul>
      </Panel>}

      {!account && <p className="text-base text-marble/70">Practice is available without signing in. Sign in to see your refreshers and save practice to your training record.</p>}

      <Panel title="PRACTISE AN EMERGENCY">
        <div className="grid gap-2 md:grid-cols-2">
          {Object.keys(SCENARIOS).map((cat) => {
            const p = approved(cat);
            return (
              <button key={cat} type="button" disabled={!p} onClick={() => setPractice(cat)}
                className="flex min-h-16 items-center justify-between border border-marble/10 px-4 text-left hover:border-gold/60 disabled:opacity-40">
                <span className="text-lg text-marble">{SKILLS.find((s) => s.id === cat)?.name}</span>
                <span className="font-mono text-xs tracking-[0.2em] text-gold">{p ? 'START' : 'NO PROTOCOL'}</span>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="HOW TO TAKE A MEASUREMENT">
        <div className="grid gap-2 md:grid-cols-2">
          {guides.map((g) => (
            <button key={g.id} type="button" onClick={() => onGuide(g.id)} className="flex min-h-14 items-center justify-between border border-marble/10 px-4 text-left hover:border-gold/60">
              <span className="text-lg text-marble">{g.title}</span><span className="font-mono text-xs tracking-[0.2em] text-gold">OPEN</span>
            </button>
          ))}
        </div>
      </Panel>

      {me && <details className="border border-marble/10 bg-void/80 backdrop-blur-md">
        <summary className="min-h-14 cursor-pointer px-5 py-4 font-serif text-lg tracking-[0.12em] text-marble">CREW TRAINING</summary>
        <div className="overflow-x-auto border-t border-marble/10 p-4">
          <table className="w-full min-w-[560px] text-base">
            <thead><tr className="text-left font-mono text-[11px] tracking-[0.15em] text-marble/50"><th className="py-2 pr-3">CREW</th>{SKILLS.filter((s) => s.kind === 'emergency').map((s) => <th key={s.id} className="py-2 pr-3">{s.name.toUpperCase()}</th>)}</tr></thead>
            <tbody>
              {crew.map((c) => {
                const st = skillStatus(c.id, mission.id);
                return (
                  <tr key={c.id} className="border-t border-marble/10">
                    <td className="py-2 pr-3 text-marble">{c.name}</td>
                    {SKILLS.filter((s) => s.kind === 'emergency').map((s) => {
                      const x = st.find((y) => y.skill.id === s.id)!;
                      return <td key={s.id} className={`py-2 pr-3 ${x.due ? 'text-[#f3c28d]' : 'text-marble/70'}`}>{x.daysSince} days{x.due ? ' · due' : ''}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-sm text-marble/55">Days since last practice. Demo rule: medical crew every 60 days, others every 120.</p>
        </div>
      </details>}
      </>}
    </PageShell>
  );
}

// One practice run: "what do you do next?" for each step of the approved protocol.
function Practice({ protocol, all, scenario, onDone, onClose }: { protocol: Procedure; all: Procedure[]; scenario?: string; onDone: (score: number, total: number) => void; onClose: () => void }) {
  const quiz = useMemo(() => buildQuiz(protocol, all), [protocol, all]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string>();
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const q = quiz[i];

  const pick = (o: string) => { if (picked) return; setPicked(o); if (o === q.answer) setScore((s) => s + 1); };
  const next = () => {
    if (i + 1 < quiz.length) { setI(i + 1); setPicked(undefined); return; }
    setFinished(true);
    onDone(score, quiz.length);
  };

  return (
    <PageShell title={`PRACTICE · ${protocol.title.toUpperCase()}`}>
      <Panel tag="SIMULATED">
        {scenario && <p className="border-l-2 border-gold pl-3 text-lg text-marble">{scenario}</p>}
        {!finished ? (
          <div className="mt-4">
            <div className="font-mono text-xs tracking-[0.2em] text-marble/50">QUESTION {i + 1} OF {quiz.length}</div>
            <h2 className="mt-1 text-2xl text-marble">{q.prompt}</h2>
            <ul className="mt-3 space-y-2">
              {q.options.map((o) => {
                const right = picked && o === q.answer;
                const wrong = picked === o && o !== q.answer;
                return (
                  <li key={o}>
                    <button type="button" onClick={() => pick(o)} disabled={!!picked}
                      className={`flex min-h-14 w-full items-center gap-3 border px-4 py-2 text-left text-base ${right ? 'border-[#5cc8a8] bg-[#5cc8a8]/10 text-marble' : wrong ? 'border-[#e45b5b] bg-[#e45b5b]/10 text-marble' : 'border-marble/15 text-marble/85 hover:border-gold/60'}`}>
                      {right ? <Check size={18} className="shrink-0 text-[#5cc8a8]" /> : wrong ? <X size={18} className="shrink-0 text-[#e45b5b]" /> : <span className="w-[18px]" />}{o}
                    </button>
                  </li>
                );
              })}
            </ul>
            {picked && (
              <div className="mt-3 border-l-2 border-gold bg-gold/[0.06] px-3 py-2 text-base">
                <p className="text-marble">{picked === q.answer ? 'Correct.' : 'Not quite. The protocol says the highlighted step comes next.'}</p>
                <p className="text-marble/75">Why: {q.why}</p>
                <button type="button" onClick={next} className="mt-2 min-h-11 bg-gold px-5 font-mono text-xs tracking-[0.2em] text-void">{i + 1 < quiz.length ? 'NEXT QUESTION' : 'FINISH'}</button>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <h2 className="text-2xl text-marble">Score: {score} of {quiz.length}</h2>
            <p className="mt-1 text-base text-marble/70">{score === quiz.length ? 'All steps in the right order.' : 'Review the steps you missed in the library, then try again.'} Saved.</p>
            <button type="button" onClick={onClose} className="mt-4 min-h-12 bg-gold px-6 font-mono text-xs tracking-[0.2em] text-void">BACK</button>
          </div>
        )}
      </Panel>
      {!finished && <button type="button" onClick={onClose} className="min-h-11 border border-marble/20 px-4 text-sm text-marble/70">Stop practice</button>}
    </PageShell>
  );
}

