import { Siren } from 'lucide-react';
import type { Mission } from '../../types';
import type { Procedure } from '../../emergency/types';
import { casesFrom, inventoryNow } from '../../emergency/plan';
import { checkResources } from '../../emergency/engine';
import { categoryText } from '../../emergency/report';
import { crew } from '../../emergency/data';
import { useLog } from '../../emergency/sync';
import type { MemoryItem } from '../../lib/memory';
import { Reasoning } from '../Reasoning';
import { PageShell, Panel } from './ui';
import { MedicalLog } from '../MedicalLog';

interface Props {
  mission: Mission;
  kb: Procedure[];
  memory: MemoryItem[];
  onStart: () => void;
  onJoin: (eid: string) => void;
}

// RESPOND: everything for emergencies, before, during and after.
export function RespondPage({ mission, kb, memory, onStart, onJoin }: Props) {
  const log = useLog();
  const active = casesFrom(log).filter((c) => !c.ended && c.mission === mission.id);
  const stock = inventoryNow(log, mission.id);
  const protocols = kb.filter((p) => p.status === 'approved' && p.missions.includes(mission.id));
  const missionEnd = new Date(Date.now() + (mission.totalDays - mission.today) * 86_400_000).toISOString().slice(0, 10);

  // Resource planning: which approved protocols need each item, and what could run short.
  const plan = stock.map((item) => {
    const needs = protocols.flatMap((p) => p.equipment.filter((e) => e.itemId === item.id).map((e) => ({ p, qty: e.quantity, alts: e.alternatives ?? [] })));
    const maxQty = Math.max(0, ...needs.map((n) => n.qty));
    const problems: string[] = [];
    if (needs.length && item.status !== 'available') problems.push(`Status is ${item.status}.`);
    if (needs.length && item.quantity < maxQty) problems.push(`Only ${item.quantity} on board; a protocol needs ${maxQty}.`);
    if (needs.length && item.quantity === maxQty && item.status === 'available') problems.push('Enough for one use only.');
    if (item.expires && item.expires < missionEnd) problems.push(`Expires ${item.expires}, before the mission ends (${missionEnd}).`);
    const alts = needs.flatMap((n) => n.alts).map((id) => stock.find((s) => s.id === id)?.name).filter(Boolean);
    return { item, needs, problems, alts };
  });
  const short = plan.filter((x) => x.problems.length && x.needs.length);

  return (
    <PageShell title="RESPOND">
      <button type="button" onClick={onStart} className="flex min-h-20 w-full items-center justify-center gap-3 border-2 border-[#e45b5b] bg-[#e45b5b]/15 font-mono text-lg tracking-[0.25em] text-[#ff8585] hover:bg-[#e45b5b]/25">
        <Siren size={26} /> START EMERGENCY RESPONSE
      </button>

      {active.length > 0 && (
        <Panel title="ACTIVE NOW" tone="alert">
          <ul className="space-y-2">
            {active.map((c) => (
              <li key={c.eid} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-base text-marble">{crew.find((m) => m.id === c.patientId)?.name} · {categoryText[c.category]} · since {new Date(c.startedAt).toISOString().slice(11, 16)} GMT</span>
                <button type="button" onClick={() => onJoin(c.eid)} className="min-h-11 bg-[#e45b5b] px-4 font-mono text-xs tracking-[0.15em] text-[#130709]">OPEN</button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="APPROVED EMERGENCY PROCEDURES ON BOARD">
        <div className="grid gap-3 md:grid-cols-2">
          {protocols.map((p) => {
            const checks = checkResources(p, stock);
            const bad = checks.filter((c) => !c.ok);
            return (
              <section key={p.id + p.version} className={`border p-3 ${bad.some((b) => !b.alternative) ? 'border-[#e39b4b]/50' : 'border-marble/10'}`}>
                <h3 className="text-base text-marble">{p.title}</h3>
                <p className="text-xs text-marble/50">{p.id} v{p.version} · {p.source.name}</p>
                {p.measurements && <p className="mt-2 text-sm text-marble/75"><span className="text-marble/50">Measure:</span> {p.measurements.map((m) => m.label.split(' (')[0]).join(' · ')}</p>}
                <p className="mt-1 text-sm text-marble/75"><span className="text-marble/50">Equipment:</span> {checks.map((c) => c.name).join(' · ') || 'none listed'}</p>
                <p className={`mt-1 text-sm ${bad.length ? 'text-[#f3c28d]' : 'text-[#7bd5b8]'}`}>
                  {bad.length ? bad.map((b) => `${b.name}: ${b.status}${b.alternative ? ` (approved alternative: ${b.alternative.name})` : ''}`).join(' · ') : 'All equipment available.'}
                </p>
              </section>
            );
          })}
        </div>
      </Panel>

      <Panel title="MEDICAL STOCK PLANNING" tag="SIMULATION (LEVEL 2)">
        <p className="text-base text-marble">{short.length ? `${short.length} item${short.length > 1 ? 's' : ''} could limit an emergency response.` : 'No shortages found for the approved procedures.'}</p>
        <ul className="mt-2 divide-y divide-marble/10">
          {plan.filter((x) => x.needs.length).map(({ item, needs, problems, alts }) => (
            <li key={item.id} className="py-2">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-base text-marble">{item.name}</span>
                <span className={`font-mono text-xs tracking-[0.15em] ${problems.length ? 'text-[#f3c28d]' : 'text-[#7bd5b8]'}`}>{problems.length ? 'CHECK' : 'OK'}</span>
              </div>
              <p className="text-sm text-marble/55">{item.quantity} on board · {item.location} · needed for: {[...new Set(needs.map((n) => n.p.title))].join(', ')}</p>
              {problems.map((pr) => <p key={pr} className="text-sm text-[#f3c28d]">• {pr}</p>)}
              {problems.length > 0 && alts.length > 0 && <p className="text-sm text-marble/60">Approved alternative listed in the procedure: {alts.join(', ')}.</p>}
            </li>
          ))}
        </ul>
        <div className="mt-2"><Reasoning steps={[
          { label: 'DATA USED', lines: ['Simulated medical stock manifest for this mission, with any changes the crew logged.', `Approved procedures for ${mission.name}: ${protocols.map((p) => p.id).join(', ')}.`, `Mission ends around ${missionEnd}.`] },
          { label: 'RULES', lines: ['Flag an item if a procedure needs it and it is not available, there is less than one use, only one use is left, or it expires before the mission ends.', 'Only alternatives written into an approved procedure are shown. CHIRON never suggests its own substitutes.'] },
        ]} /></div>
      </Panel>

      <MedicalLog items={memory} title="CREW MEDICAL LOG" showWho />
    </PageShell>
  );
}
