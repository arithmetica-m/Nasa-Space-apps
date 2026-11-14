import type { DayRecord, Indicator, Mission, SystemId } from '../types';
import { indicators, systems } from '../data/indicators';
import { guidance } from '../data/guidance';
import { outsideness } from '../data/simulate';
import { studiesFor, type Study } from '../data/research';
import { referenceCard } from './references';

// What kind of knowledge an insight rests on. Shown on every insight so the
// astronaut can tell a measurement from a trend, research, a risk or mission context.
export type Evidence = 'measurement' | 'trend' | 'research' | 'risk' | 'mission';
export const evidenceLabel: Record<Evidence, string> = {
  measurement: 'Observed measurement',
  trend: 'Personal trend',
  research: 'Research-based',
  risk: 'Potential risk',
  mission: 'Mission context',
};

export interface Insight {
  id: string;
  evidence: Evidence[];
  // Level 1: what matters
  title: string;
  // Level 2: why it matters
  why: string;
  suggestion?: string;
  procedure?: string;
  // Level 3: the science behind it
  science: {
    facts: { label: string; value: string }[];
    studies: Study[];
    limitations: string[];
    sources: { label: string; url: string }[];
  };
}

const procedureFor: Partial<Record<SystemId, string>> = { cardiovascular: 'resting-heart-rate', metabolic: 'temperature' };
const fmt = (ind: Indicator, v: number) => (ind.unit.startsWith('/') ? `${v}${ind.unit}` : `${v} ${ind.unit}`);
// Days in a row, counting back from the latest reading, that this indicator was outside the normal range.
function streak(ind: Indicator, records: DayRecord[]) {
  let n = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    const v = records[i].values[ind.id];
    if (v === undefined) continue;
    if (outsideness(ind, v) > 0.05) n++; else break;
  }
  return n;
}

function trendInsight(system: SystemId, records: DayRecord[]): Insight | undefined {
  const own = indicators.filter((i) => i.system === system && i.id !== 'dose');
  const scored = own
    .map((ind) => ({ ind, ref: referenceCard(ind, records) }))
    .filter((x) => x.ref.current && outsideness(x.ind, x.ref.current.value) > 0.05)
    .sort((a, b) => outsideness(b.ind, b.ref.current!.value) - outsideness(a.ind, a.ref.current!.value));
  if (!scored.length) return undefined;
  const { ind, ref } = scored[0];
  const days = streak(ind, records);
  const below = ref.current!.value < ind.baseline[0];
  const studies = studiesFor(system);
  const name = systems.find((s) => s.id === system)!.name;
  return {
    id: `trend-${system}`,
    evidence: studies.length ? ['trend', 'research'] : ['trend'],
    title: `${ind.name} ${below ? 'below' : 'above'} your normal${days > 1 ? ` for ${days} days` : ''}`,
    why: guidance[system].why,
    suggestion: guidance[system].suggest,
    procedure: procedureFor[system],
    science: {
      facts: [
        { label: 'Latest reading', value: `${fmt(ind, ref.current!.value)} · day ${ref.current!.day} · ${ref.current!.source}` },
        ...(ref.trend ? [{ label: 'Last 7 days vs the 7 before', value: `${ref.trend.recent} vs ${ref.trend.before} ${ind.unit}` }] : []),
        { label: 'Your personal baseline', value: `${ind.baseline[0]} to ${ind.baseline[1]} ${ind.unit} · ${ref.personal.note.toLowerCase()}` },
        { label: 'Population reference', value: ref.population.text },
        { label: 'Mission limit', value: ref.mission.text },
        ...(scored.length > 1 ? [{ label: `Also outside your normal (${name.toLowerCase()})`, value: scored.slice(1).map((x) => x.ind.name.toLowerCase()).join(', ') }] : []),
      ],
      studies,
      limitations: [
        ...ref.uncertainty,
        'A change happening at the same time as another does not show that one caused the other.',
        studies.length ? 'Studies explain how spaceflight can affect this system. They are not a diagnosis of you.' : 'No closely matching study in our NASA OSDR snapshot yet.',
        'The suggestion is demo wording. It is not yet an approved mission instruction.',
      ],
      sources: studies.map((s) => ({ label: `NASA OSDR ${s.accession}`, url: s.url })),
    },
  };
}

function milestoneInsight(mission: Mission): Insight | undefined {
  const next = mission.milestones.find((m) => m.day >= mission.today && m.day - mission.today <= 45);
  if (!next) return undefined;
  const days = next.day - mission.today;
  return {
    id: `milestone-${next.day}`,
    evidence: ['mission'],
    title: days === 0 ? `${next.title} is today` : `${days} days until ${next.title.toLowerCase()}`,
    why: next.health,
    science: {
      facts: [{ label: 'Mission day', value: `${next.day} of ${mission.totalDays}` }],
      studies: next.title.toLowerCase().includes('halfway') ? studiesFor('mind') : studiesFor('musculoskeletal'),
      limitations: ['Mission timeline is simulated for this demonstration.'],
      sources: [],
    },
  };
}

// All insights for today, most useful first. Kept short on purpose.
export function buildInsights(mission: Mission, records: DayRecord[]): Insight[] {
  const ranked = systems
    .filter((s) => s.id !== 'radiation')
    .map((s) => trendInsight(s.id, records))
    .filter((x): x is Insight => !!x);
  return [
    ...ranked.slice(0, 2),
    milestoneInsight(mission),
  ].filter((x): x is Insight => !!x);
}
