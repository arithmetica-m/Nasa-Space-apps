import type { DayRecord, Mission } from '../types';
import { indicators } from '../data/indicators';
import { outsideness, simulate, type HealthStory } from '../data/simulate';
import { latestValue } from './health';

// Crew status for the home page.
// IMPORTANT: these are DEMO RULES on SIMULATED data. They are not approved medical criteria.
// A real system would load its rules from the mission's approved medical documents.

export type CrewStatus = 'stable' | 'review' | 'attention' | 'nodata';

export const statusLabel: Record<CrewStatus, string> = {
  stable: 'STABLE',
  review: 'NEEDS REVIEW',
  attention: 'MEDICAL ATTENTION',
  nodata: 'NO RECENT DATA',
};

export const statusColor: Record<CrewStatus, string> = {
  stable: '#5cc8a8',
  review: '#e39b4b',
  attention: '#e45b5b',
  nodata: '#a39d8f',
};

// Each crew member's simulated history. Different on purpose, so the demo shows every status.
const STORIES: Record<string, HealthStory> = {
  ana: { seed: 0, strain: 1, slow: 0, gap: true },             // sleep and mood drifting
  lena: { seed: 11, strain: 0.15, slow: 0, gap: false },       // steady
  kai: { seed: 23, strain: 0.2, slow: 2.2, gap: false },       // muscle recovery slower
  ravi: { seed: 37, strain: 0.3, slow: 0, gap: false, stoppedLogging: 3 }, // stopped checking in
};

export function storyFor(crewId: string): HealthStory {
  return STORIES[crewId] ?? { seed: crewId.length * 13, strain: 0.3, slow: 0, gap: false };
}

export function recordsFor(mission: Mission, crewId: string): DayRecord[] {
  return simulate(mission, storyFor(crewId));
}

// Short plain words for the most important indicators.
const SHORT: Record<string, string> = {
  sleep_h: 'SLEEP', wakeups: 'SLEEP INTERRUPTIONS', hr: 'RESTING HEART RATE', hrv: 'HEART RATE VARIABILITY',
  mood: 'MOOD', reaction: 'REACTION TIME', endurance: 'MUSCLE ENDURANCE', emg: 'MUSCLE ACTIVITY',
  calcium: 'URINARY CALCIUM', temp: 'BODY TEMPERATURE', spo2: 'BLOOD OXYGEN', bp_sys: 'BLOOD PRESSURE',
};

export interface CrewHealth {
  status: CrewStatus;
  comment: string;
  lastLogDay?: number;     // last day with a daily check-in
  daysSinceLog?: number;
  reasons: string[];       // how the status was decided, step by step
}

const STALE_AFTER_DAYS = 2; // demo rule

export function crewHealth(records: DayRecord[], emergency: boolean): CrewHealth {
  const today = records.length - 1;
  let lastLogDay: number | undefined;
  for (let i = today; i >= 0; i--) if (records[i].logged) { lastLogDay = records[i].day; break; }
  const daysSinceLog = lastLogDay === undefined ? undefined : today - lastLogDay;
  const reasons: string[] = [];
  const done = (status: CrewStatus, comment: string): CrewHealth => ({ status, comment, lastLogDay, daysSinceLog, reasons });

  reasons.push(`1. Active emergency for this person? ${emergency ? 'YES → MEDICAL ATTENTION.' : 'No.'}`);
  if (emergency) return done('attention', 'EMERGENCY RESPONSE ACTIVE');

  reasons.push(`2. Last daily check-in: ${lastLogDay === undefined ? 'never' : daysSinceLog === 0 ? 'today' : `${daysSinceLog} days ago`}. Rule: more than ${STALE_AFTER_DAYS} days → NO RECENT DATA (never shown green without data).`);
  if (daysSinceLog === undefined || daysSinceLog > STALE_AFTER_DAYS) {
    return done('nodata', lastLogDay === undefined ? 'NO CHECK-INS YET' : `NO CHECK-IN FOR ${daysSinceLog} DAYS`);
  }

  // The reading furthest outside this person's own normal range.
  let worst: { id: string; score: number; low: boolean } | undefined;
  const outside: string[] = [];
  for (const ind of indicators) {
    if (!SHORT[ind.id]) continue;
    const l = latestValue(records, ind.id);
    if (!l) continue;
    const score = outsideness(ind, l.value);
    if (score > 0.05) outside.push(`${ind.name.toLowerCase()} ${l.value} ${ind.unit} (normal ${ind.baseline[0]}–${ind.baseline[1]})`);
    if (score > 0.05 && (!worst || score > worst.score)) worst = { id: ind.id, score, low: l.value < ind.baseline[0] };
  }
  reasons.push(`3. Readings outside this person's normal range: ${outside.length ? outside.join('; ') : 'none'}.`);
  const drift = records[today].drift;
  // Demo rule: review when the overall drift is high, or one key reading is far outside its normal range.
  const review = drift >= 0.3 || (worst?.score ?? 0) >= 0.5;
  reasons.push(`4. Overall change score (7-day average): ${drift.toFixed(2)}. Rule: 0.30 or more, or one reading far outside normal → NEEDS REVIEW. Result: ${review ? 'NEEDS REVIEW' : 'STABLE'}.`);
  reasons.push('These are demo rules on simulated data, not approved medical criteria. Only the medical officer can confirm a finding.');

  if (!review) return done('stable', worst ? `${SHORT[worst.id]} SLIGHTLY ${worst.low ? 'LOW' : 'HIGH'}` : 'NO MAJOR CHANGES');
  if (worst?.id === 'endurance' || worst?.id === 'emg') return done('review', 'RECOVERY SLOWER THAN USUAL');
  return done('review', worst ? `${SHORT[worst.id]} ${worst.low ? 'BELOW' : 'ABOVE'} NORMAL` : 'SEVERAL READINGS OUTSIDE NORMAL');
}

// One short sentence for the whole crew.
export function crewSummary(statuses: CrewStatus[]) {
  const n = (s: CrewStatus) => statuses.filter((x) => x === s).length;
  const word = (k: number) => ['NO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'][k] ?? String(k);
  const parts: string[] = [];
  const who = (k: number) => `${word(k)} CREW ${k > 1 ? 'MEMBERS' : 'MEMBER'}`;
  if (n('attention')) parts.push(`${who(n('attention'))} ${n('attention') > 1 ? 'NEED' : 'NEEDS'} MEDICAL ATTENTION`);
  if (n('review')) parts.push(`${who(n('review'))} ${n('review') > 1 ? 'NEED' : 'NEEDS'} REVIEW`);
  if (n('nodata')) parts.push(`${who(n('nodata'))} ${n('nodata') > 1 ? 'HAVE' : 'HAS'} NO RECENT DATA`);
  if (!parts.length) return 'ALL CREW MEMBERS STABLE.';
  return `${parts.join(' · ')}.`;
}
