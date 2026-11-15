import { MapPin } from 'lucide-react';
import type { Mission } from '../../types';
import type { CrewMember } from '../../emergency/types';
import { ago, type LinkStatus } from '../../link/link';
import { Avatar } from '../Avatar';
import { roleOf } from '../MissionDashboard';
import { MissionTimeline, phaseOf, whereIs } from '../MissionTimeline';
import { MissionDial } from '../SystemMap';
import { PageShell, Panel, Tag } from './ui';

// Each crew member's standing responsibilities on this mission (simulated roster).
export const DUTIES: Record<string, string[]> = {
  ana: ['Crew medical officer: leads medical care', 'Weekly check of the medical kit', 'Life-support maintenance'],
  lena: ['Backup medical officer', 'Science experiments in the laboratory', 'Exercise equipment upkeep'],
  kai: ['Commander: crew safety and mission decisions', 'EVA lead', 'Daily call with Mission Control'],
  ravi: ['Communications and Earth link', 'Crew peer support', 'Stowage and inventory'],
};

// THE MISSION: one mission shared by the whole crew. Nothing medical or private here.
export function MissionPage({ mission, crew, links, now }: { mission: Mission; crew: CrewMember[]; links: Record<string, LinkStatus>; now: number }) {
  const next = mission.milestones.find((m) => m.day > mission.today);
  return (
    <PageShell title={`MISSION · ${mission.name.toUpperCase()}`}>
      <section className="flex flex-wrap items-center gap-5 border border-marble/10 bg-void/80 p-4 backdrop-blur-md md:p-5">
        <MissionDial mission={mission} size={150} />
        <dl className="grid min-w-[260px] flex-1 gap-2 text-lg sm:grid-cols-2">
          <div className="border border-marble/10 p-3"><dt className="text-sm text-marble/50">WHERE</dt><dd className="text-marble"><MapPin size={16} className="mr-1 inline text-gold" />{whereIs(mission)}</dd></div>
          <div className="border border-marble/10 p-3"><dt className="text-sm text-marble/50">PHASE</dt><dd className="text-marble">{phaseOf(mission)}</dd></div>
          <div className="border border-marble/10 p-3"><dt className="text-sm text-marble/50">NEXT EVENT</dt><dd className="text-marble">{next ? `${next.title} in ${next.day - mission.today} days` : 'Mission end'}</dd></div>
          <div className="border border-marble/10 p-3"><dt className="text-sm text-marble/50">EARTH DELAY</dt><dd className="text-marble">{mission.delayLabel} each way</dd></div>
          <div className="border border-marble/10 p-3"><dt className="text-sm text-marble/50">GRAVITY</dt><dd className="text-marble">{mission.gravity}</dd></div>
          <div className="border border-marble/10 p-3"><dt className="text-sm text-marble/50">RADIATION</dt><dd className="text-marble">about {mission.radiationPerDay} mSv a day <span className="text-sm text-marble/50">(simulated)</span></dd></div>
        </dl>
      </section>

      <MissionTimeline mission={mission} />

      <Panel title="WHO IS WHERE" tag="SIMULATED">
        <ul className="grid gap-2 md:grid-cols-2">
          {crew.map((m) => {
            const l = links[m.id];
            return (
              <li key={m.id} className="flex items-center gap-3 border border-marble/10 p-3">
                <Avatar id={m.id} name={m.name} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="text-lg text-marble">{m.name} <span className="text-sm text-marble/50">· {roleOf(m)}</span></div>
                  <div className={`text-base ${l.connected ? 'text-marble/75' : 'text-[#f3c28d]'}`}>{l.connected ? `${l.location} · ${l.activity}` : `Last seen in ${l.location}, ${ago(l.lastSync, now)}`}</div>
                  <div className="text-sm text-marble/50">{(DUTIES[m.id] ?? m.duties)?.[0]}</div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-2"><Tag kind="SIMULATED" /> <span className="text-sm text-marble/55">Location and activity come from each person’s CHIRON LINK band.</span></div>
      </Panel>
    </PageShell>
  );
}
