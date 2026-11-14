import { useMemo } from 'react';
import { HeartHandshake, Siren } from 'lucide-react';
import type { MissionId } from '../../types';
import type { Procedure } from '../../emergency/types';
import { crew } from '../../emergency/data';
import { buildPlan, casesFrom, roleName, rolesOf } from '../../emergency/plan';
import { useLog } from '../../emergency/sync';

const label = { dcs: 'pressure or EVA problem', respiratory: 'breathing or cabin air', anaphylaxis: 'severe allergic reaction', behavioral: 'behavioral support' };
const nameOf = (id: string) => crew.find((c) => c.id === id)?.name ?? id;

// Shown on Watch on every device the moment an emergency starts anywhere on the mission,
// with this crew member's role in it and the patient's latest reading.
export function LiveBanner({ mission, account, kb, onJoin }: { mission: MissionId; account: string; kb: Procedure[]; onJoin: (eid: string) => void }) {
  const log = useLog();
  const cases = useMemo(() => casesFrom(log), [log]);
  const active = cases.filter((c) => !c.ended && c.mission === mission);
  // A private request for support, sent only to this crew member, in the last hour.
  const support = [...log].reverse().find((e) => e.type === 'support' && e.to === account && Date.now() - e.t < 3_600_000);

  if (!active.length && !support) return null;
  return (
    <div className="space-y-2 px-5 pt-3 md:px-8">
      {active.map((c) => {
        const plan = buildPlan(c, kb, log, cases);
        const mine = rolesOf(plan.roles, account);
        const v = [...c.vitals].reverse();
        const spo2 = v.find((x) => x.spo2 !== undefined)?.spo2;
        const done = plan.tasks.filter((t) => t.status === 'done').length;
        return (
          <div key={c.eid} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-2 border-[#e45b5b] bg-[#e45b5b]/15 px-4 py-3 backdrop-blur" style={{ animation: 'fade-in 0.3s ease-out' }}>
            <Siren className="animate-pulse text-[#e45b5b]" size={20} />
            <div className="mr-auto">
              <div className="font-mono text-[10px] tracking-[0.3em] text-[#e45b5b]">EMERGENCY · LIVE</div>
              <div className="text-marble">{nameOf(c.patientId)} · {label[c.category]}</div>
              <div className="text-xs text-marble/70">
                {c.patientId === account ? 'You are the patient.' : mine.length ? `Your role: ${mine.map((r) => roleName[r]).join(', ')}.` : 'You have no role yet. Stand by.'}
                {' '}{done} of {plan.tasks.length} tasks done{spo2 !== undefined ? ` · latest SpO2 ${spo2}%` : ''}{plan.alerts.length ? ` · ${plan.alerts[0]}` : ''}
              </div>
            </div>
            <button onClick={() => onJoin(c.eid)} className="bg-[#e45b5b] px-5 py-2.5 font-mono text-[11px] tracking-[0.3em] text-black">{mine.length || c.patientId === account ? 'OPEN MY TASKS' : 'VIEW'}</button>
          </div>
        );
      })}
      {support && support.type === 'support' && (
        <div className="flex items-center gap-3 border border-[#8fb8ff]/50 bg-[#8fb8ff]/10 px-4 py-3 text-sm text-marble">
          <HeartHandshake className="text-[#8fb8ff]" size={18} /> {nameOf(support.from)} has asked for you. Please find them privately. Nothing else was shared.
        </div>
      )}
    </div>
  );
}
