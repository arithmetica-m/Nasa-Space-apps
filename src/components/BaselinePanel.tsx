import { useState } from 'react';
import type { CrewMember } from '../emergency/types';
import { indicators } from '../data/indicators';
import { publish, useLog } from '../emergency/sync';
import { baselineHistory, pendingProposals } from '../prevent/baselines';
import { Panel } from './pages/ui';

const date = (t?: number) => (t ? new Date(t).toISOString().slice(0, 10) : 'pre-flight');

// The person's approved baselines, every version kept. A medical officer can propose a change;
// only Mission Control approves it (in the ?earth console).
export function BaselinePanel({ member, canPropose, proposer }: { member: CrewMember; canPropose: boolean; proposer: string }) {
  const log = useLog();
  const [open, setOpen] = useState<string>();
  const [draft, setDraft] = useState({ low: '', high: '', reason: '' });
  const pending = pendingProposals(log, member.id);
  const shown = indicators.filter((i) => ['hr', 'bp_sys', 'spo2', 'sleep_h', 'endurance', 'calcium', 'temp', 'mood'].includes(i.id));

  return (
    <Panel title="PERSONAL BASELINES" tag="SIMULATED">
      <p className="text-base text-marble/70">What is normal for {member.name.split(' ')[0]}. Approved by the flight surgeon; every change is a new version.</p>
      <ul className="mt-2 divide-y divide-marble/10">
        {shown.map((ind) => {
          const hist = baselineHistory(member.id, ind.id, log);
          const cur = hist[hist.length - 1];
          const waiting = pending.filter((p) => p.indicator === ind.id);
          const valid = draft.low !== '' && draft.high !== '' && Number(draft.low) < Number(draft.high) && draft.reason.trim().length > 3;
          return (
            <li key={ind.id} className="py-2">
              <button type="button" onClick={() => { setOpen(open === ind.id ? undefined : ind.id); setDraft({ low: '', high: '', reason: '' }); }} aria-expanded={open === ind.id}
                className="flex min-h-12 w-full flex-wrap items-baseline justify-between gap-2 text-left">
                <span className="text-lg text-marble">{ind.name}</span>
                <span className="text-base text-marble/80">{cur.low}–{cur.high} {ind.unit} <span className="text-sm text-marble/50">· v{cur.version} · {date(cur.at)}</span>{waiting.length > 0 && <span className="ml-2 text-sm text-[#f3c28d]">change waiting for approval</span>}</span>
              </button>
              {open === ind.id && (
                <div className="mt-2 space-y-2 pl-2">
                  <ol className="space-y-1 text-base text-marble/75">
                    {hist.map((v) => <li key={v.version}>v{v.version}: {v.low}–{v.high} {ind.unit} · {v.reason} · approved by {v.approvedBy}, {date(v.at)}</li>)}
                    {waiting.map((p) => <li key={p.id} className="text-[#f3c28d]">Proposed: {p.low}–{p.high} {ind.unit} · {p.reason} · waiting for Mission Control</li>)}
                  </ol>
                  {canPropose && waiting.length === 0 && (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="text-sm text-marble/70">From<input type="number" step="any" value={draft.low} onChange={(e) => setDraft({ ...draft, low: e.target.value })} className="mt-1 block min-h-12 w-24 border border-marble/25 bg-transparent px-2 text-lg text-marble" /></label>
                      <label className="text-sm text-marble/70">To<input type="number" step="any" value={draft.high} onChange={(e) => setDraft({ ...draft, high: e.target.value })} className="mt-1 block min-h-12 w-24 border border-marble/25 bg-transparent px-2 text-lg text-marble" /></label>
                      <label className="min-w-[200px] flex-1 text-sm text-marble/70">Why<input value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} placeholder="For example: 3 weeks of stable in-flight readings" className="mt-1 block min-h-12 w-full border border-marble/25 bg-transparent px-2 text-lg text-marble" /></label>
                      <button type="button" disabled={!valid} onClick={() => { publish({ type: 'baseline-proposal', by: proposer, crewId: member.id, indicator: ind.id, low: Number(draft.low), high: Number(draft.high), reason: draft.reason.trim() }); setDraft({ low: '', high: '', reason: '' }); }}
                        className="min-h-12 bg-gold px-4 font-mono text-xs tracking-[0.18em] text-void disabled:opacity-40">PROPOSE TO EARTH</button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-sm text-marble/50">In this prototype, approved versions are recorded here; health flags still use the pre-flight baseline.</p>
    </Panel>
  );
}

// Mission Control's side: approve proposed baselines as new versions.
export function BaselineApprovals({ crew }: { crew: CrewMember[] }) {
  const log = useLog();
  const pending = pendingProposals(log);
  if (!pending.length) return <p className="text-base text-white/60">No baseline changes waiting.</p>;
  return (
    <ul className="space-y-2">
      {pending.map((p) => {
        const ind = indicators.find((i) => i.id === p.indicator)!;
        const next = baselineHistory(p.crewId, p.indicator, log).length + 1;
        return (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border border-white/15 p-3">
            <span className="text-base text-white">{crew.find((c) => c.id === p.crewId)?.name}: {ind.name} {p.low}–{p.high} {ind.unit} <span className="text-white/60">· {p.reason}</span></span>
            <button type="button" onClick={() => publish({ type: 'baseline', by: 'earth', crewId: p.crewId, indicator: p.indicator, low: p.low, high: p.high, version: next, reason: p.reason, proposalId: p.id })}
              className="min-h-11 bg-[#67c9d5] px-4 font-mono text-xs tracking-[0.15em] text-[#08111f]">APPROVE AS v{next}</button>
          </li>
        );
      })}
    </ul>
  );
}
