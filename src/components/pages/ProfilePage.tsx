import { useState } from 'react';
import { MessageSquareWarning, Plus, Watch } from 'lucide-react';
import type { DayRecord, Mark, Mission } from '../../types';
import type { CrewMember } from '../../emergency/types';
import type { CrewHealth } from '../../lib/crewHealth';
import { statusColor, statusLabel } from '../../lib/crewHealth';
import { ago, type LinkStatus } from '../../link/link';
import type { MemoryItem } from '../../lib/memory';
import { BackToNormal } from '../BackToNormal';
import { BaselinePanel } from '../BaselinePanel';
import { ReadingTimelines } from '../ReadingTimelines';
import { MedicalLog } from '../MedicalLog';
import { ReportSomething } from '../ReportSomething';
import type { BodyPart } from '../../triage/symptomCheck';
import { Today } from '../watch/Today';
import { HealthSupport } from '../HealthSupport';
import { HealthRecord } from '../HealthRecord';
import { MissionTimeline } from '../MissionTimeline';
import type { Selection } from '../Frieze';
import { Reasoning } from '../Reasoning';
import { roleOf } from '../MissionDashboard';
import { Panel, Tag } from './ui';
import { DUTIES } from './MissionPage';
import { useLog } from '../../emergency/sync';
import { buildPlan, casesFrom, rolesOf } from '../../emergency/plan';
import { procedures } from '../../emergency/data';
import { skillStatus } from '../../train/training';

type Tab = 'overview' | 'history' | 'mission';

interface Props {
  mission: Mission;
  member: CrewMember;
  account: string;
  canProposeBaseline?: boolean;
  proposer?: string;
  health: CrewHealth;
  link: LinkStatus;
  now: number;
  records: DayRecord[];
  marks: Mark[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  checkedIn: boolean;
  symptoms: string[];
  memory: MemoryItem[];
  onCheckIn: () => void;
  onTeach: (id?: string) => void;
  onEmergency: () => void;
  onReading: (values: Record<string, number>) => void;
}

// THE ASTRONAUT'S MEDICAL DASHBOARD. Health and mission information are kept on separate tabs.
export function ProfilePage(p: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [reporting, setReporting] = useState<{ part?: BodyPart }>();
  const isSelf = p.member.id === p.account;
  const log = useLog();
  // What this person is asked to do right now: emergency steps first, then routine items.
  const tasks: string[] = [];
  const cases = casesFrom(log);
  for (const c of cases.filter((x) => !x.ended && x.mission === p.mission.id)) {
    if (c.patientId === p.member.id) { tasks.push('Emergency: you are the patient. Your crew is helping.'); continue; }
    const plan = buildPlan(c, procedures, log, cases);
    const task = plan.tasks.find((t) => rolesOf(plan.roles, p.member.id).includes(t.step.role) && t.status === 'ready');
    if (task) tasks.push(`Emergency step: ${task.step.ask?.question ?? task.step.text}`);
  }
  if (isSelf && !p.checkedIn) tasks.push('Daily check-in');
  const due = skillStatus(p.member.id, p.mission.id).filter((x) => x.due);
  if (due.length) tasks.push(`Refresher training: ${due.map((d) => d.skill.name).slice(0, 2).join(', ')}`);

  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-4 px-4 pb-24 pt-2 md:px-8">
      <section className="flex flex-wrap items-start gap-4 border border-marble/10 bg-void/80 p-4 backdrop-blur-md md:p-5" style={{ borderTop: `4px solid ${statusColor[p.health.status]}` }}>
        <div className="min-w-[200px] flex-1">
          <h1 className="font-serif text-2xl tracking-[0.15em] text-marble">{p.member.name.toUpperCase()}{isSelf && <span className="ml-2 font-mono text-xs tracking-[0.2em] text-gold">YOU</span>}</h1>
          <p className="text-sm tracking-[0.1em] text-marble/55">{roleOf(p.member)}</p>
          <div className="mt-2 font-serif text-2xl font-bold tracking-[0.1em]" style={{ color: statusColor[p.health.status] }}>{statusLabel[p.health.status]}</div>
          <p className="text-sm tracking-[0.06em] text-marble/80">{p.health.comment}</p>
          <div className="mt-2"><Reasoning title="WHY THIS STATUS?" steps={[{ label: 'STATUS RULES, IN ORDER', lines: p.health.reasons }]} /></div>
        </div>
        {isSelf && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setReporting({})} className="flex min-h-14 items-center gap-2 border border-gold/70 px-6 font-mono text-sm tracking-[0.2em] text-gold hover:bg-gold/10">
              <MessageSquareWarning size={18} /> REPORT SOMETHING
            </button>
            <button type="button" onClick={p.onCheckIn} className="flex min-h-14 items-center gap-2 bg-gold px-6 font-mono text-sm tracking-[0.2em] text-void hover:bg-marble">
              <Plus size={18} /> DAILY CHECK-IN
            </button>
          </div>
        )}
      </section>

      <div role="tablist" aria-label="Dashboard sections" className="flex gap-1 border-b border-marble/10">
        {([['overview', 'HEALTH OVERVIEW'], ['history', 'HEALTH HISTORY'], ['mission', 'MISSION INFORMATION']] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)}
            className={`min-h-12 px-4 font-mono text-xs tracking-[0.18em] ${tab === id ? 'border-b-2 border-gold text-gold' : 'text-marble/60 hover:text-marble'}`}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <LinkStrip link={p.link} now={p.now} />
          <Today mission={p.mission} records={p.records} checkedIn={p.checkedIn || !isSelf}
            name={p.member.name.split(' ')[0]} crewId={p.member.id}
            onCheckIn={() => isSelf && p.onCheckIn()} onTeach={p.onTeach} onEmergency={p.onEmergency} />
          <BackToNormal crewId={p.member.id} name={p.member.name.split(' ')[0]} records={p.records} isSelf={isSelf} eva={p.link.eva} activity={p.link.activity} onHistory={() => setTab('history')}
            checkedIn={p.checkedIn} onCheckIn={p.onCheckIn} />
          <HealthSupport key={p.member.id} astronautId={p.member.id} astronautName={p.member.name}
            records={p.records} symptoms={p.symptoms} isSelf={isSelf} onAddReadings={p.onCheckIn}
            onReading={p.onReading} onReport={(part) => setReporting({ part })} linkWarnings={p.link.warnings} />
        </>
      )}

      {tab === 'history' && (
        <>
          <div>
            <HealthRecord mission={p.mission} records={p.records} marks={p.marks} selection={p.selection} onSelect={p.onSelect} />
            <div className="mt-4"><BaselinePanel member={p.member} canPropose={!!p.canProposeBaseline} proposer={p.proposer ?? p.member.id} /></div>
            <ReadingTimelines mission={p.mission} records={p.records} crewId={p.member.id} />
          </div>
          <MedicalLog items={p.memory} />
        </>
      )}

      {tab === 'mission' && (
        <>
          <Panel title="RESPONSIBILITIES AND TASKS" tag="SIMULATED">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="font-mono text-xs tracking-[0.2em] text-gold">ON THIS MISSION</h3>
                <ul className="mt-2 space-y-1 text-lg text-marble">{(DUTIES[p.member.id] ?? p.member.duties ?? []).map((d) => <li key={d}>• {d}</li>)}</ul>
              </div>
              <div>
                <h3 className="font-mono text-xs tracking-[0.2em] text-gold">TO DO NOW</h3>
                <ul className="mt-2 space-y-1 text-lg text-marble">
                  {tasks.map((t) => <li key={t} className={t.startsWith('Emergency') ? 'text-[#ff9c9c]' : ''}>• {t}</li>)}
                  {tasks.length === 0 && <li className="text-[#7bd5b8]">Nothing waiting.</li>}
                </ul>
              </div>
            </div>
          </Panel>
          <MissionTimeline mission={p.mission} />
          <Panel title="WHERE AND WHAT, RIGHT NOW">
            <p className="text-base text-marble">{p.link.connected ? '' : 'Last known: '}{p.link.location} · {p.link.eva ? 'on EVA' : 'inside the spacecraft'} · {p.link.activity}</p>
            <p className="text-sm text-marble/55">From CHIRON LINK, {ago(p.link.lastSync, p.now)} · SIMULATED</p>
          </Panel>
        </>
      )}

      {reporting && (
        <ReportSomething crewId={p.member.id} records={p.records} startPart={reporting.part}
          onClose={() => setReporting(undefined)} onEmergency={() => { setReporting(undefined); p.onEmergency(); }} />
      )}
    </main>
  );
}

// Live wearable readings, each with its time. A disconnected band shows LAST KNOWN values only.
export function LinkStrip({ link, now }: { link: LinkStatus; now: number }) {
  return (
    <section className="border border-marble/10 bg-void/80 p-4 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-gold"><Watch size={16} /> CHIRON LINK</span>
        <Tag kind={link.connected ? 'LIVE' : 'LAST KNOWN'} />
        <span className="text-sm text-marble/70">{link.connected ? `Connected · battery ${link.battery}% · ${link.location}` : `Disconnected ${ago(link.lastSync, now)} · last seen in ${link.location}`}</span>
        <Tag kind="SIMULATED" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {link.readings.map((r) => (
          <div key={r.key} className="border border-marble/10 px-3 py-2">
            <div className="font-mono text-[10px] tracking-[0.2em] text-marble/50">{r.label.toUpperCase()}</div>
            <div className={`text-xl ${r.outside ? 'text-[#f3c28d]' : 'text-marble'}`}>{r.value ?? '—'} <span className="text-xs text-marble/50">{r.value !== undefined ? r.unit : 'not available'}</span></div>
            <div className="text-[11px] text-marble/50">{r.t ? (r.key === 'sleep' ? 'this morning' : ago(r.t, now)) : 'no data'}{!r.live && r.key !== 'sleep' && ' · not live'}</div>
          </div>
        ))}
      </div>
      {link.alerts.length > 0 && <ul className="mt-2 space-y-0.5 text-sm text-[#f3c28d]">{link.alerts.map((a) => <li key={a}>• {a}</li>)}</ul>}
    </section>
  );
}
