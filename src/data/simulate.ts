import type { DayRecord, Indicator, Mark, Mission, State } from '../types';
import { indicators } from './indicators';

// SIMULATED health history for one demo astronaut. Deterministic, so the demo
// looks the same every time. Not real data.

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// How strongly each indicator moves in its "worse" direction as strain builds,
// in units of its baseline width. Indicators not listed stay steady.
const strainEffect: Record<string, number> = {
  sleep_h: 1.3, wakeups: 1.4, mood: 1.1, reaction: 1.0, hr: 0.9, hrv: 0.8, temp: 0.3,
};
// Slow effects that build over the whole mission (bone and muscle loss).
const missionEffect: Record<string, number> = { calcium: 0.9, endurance: 0.6, emg: 0.5 };

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

function sign(ind: Indicator) {
  return ind.worseWhen === 'low' ? -1 : 1;
}

// How far outside the personal baseline a value sits, in baseline widths (0 = inside).
export function outsideness(ind: Indicator, v: number) {
  const [lo, hi] = ind.baseline;
  const span = hi - lo || 1;
  const below = v < lo ? (lo - v) / span : 0;
  const above = v > hi ? (v - hi) / span : 0;
  if (ind.worseWhen === 'low') return below;
  if (ind.worseWhen === 'high') return above;
  return below + above;
}

// Each crew member gets their own SIMULATED story, so the crew page shows different statuses.
export interface HealthStory {
  seed: number;
  strain: number;        // how strongly the recent drift builds (0 = none)
  slow: number;          // extra slow loss of muscle endurance over the mission
  stoppedLogging?: number; // daily check-ins stopped this many days ago
  gap: boolean;          // the 4-day missed-log gap in the middle of the history
}

export const DEFAULT_STORY: HealthStory = { seed: 0, strain: 1, slow: 0, gap: true };

export function simulate(mission: Mission, story: HealthStory = DEFAULT_STORY): DayRecord[] {
  const rand = rng(mission.id.length * 7919 + mission.totalDays + story.seed);
  const T = mission.today;
  // The demo story: an earlier dip that recovers after a course correction,
  // then a new drift building over the last ~45 days up to "today".
  const dipStart = Math.round(T * 0.38), dipPeak = Math.round(T * 0.48), dipEnd = Math.round(T * 0.6);
  const strainStart = Math.max(dipEnd + 5, T - 45);
  const gapStart = Math.max(5, T - 30);
  const out: DayRecord[] = [];

  for (let day = 0; day <= T; day++) {
    const logged = !(story.gap && day >= gapStart && day < gapStart + 4) && !(story.stoppedLogging !== undefined && day > T - story.stoppedLogging);
    const dip = day < dipPeak ? smooth((day - dipStart) / (dipPeak - dipStart || 1)) : 1 - smooth((day - dipPeak) / (dipEnd - dipPeak || 1));
    const strain = story.strain * Math.max(dip * 0.75, smooth((day - strainStart) / (T - strainStart || 1)) * 1.05);
    const progress = day / mission.totalDays;
    const values: Record<string, number | undefined> = {};

    for (const ind of indicators) {
      const due = ind.cadence === 'automatic' || (ind.cadence === 'daily' && logged) || (ind.cadence === 'weekly' && day % 7 === 0);
      if (!due) continue;
      const [lo, hi] = ind.baseline;
      const span = hi - lo;
      if (ind.id === 'dose') {
        values[ind.id] = +(mission.radiationPerDay * (0.85 + rand() * 0.3)).toFixed(2);
        continue;
      }
      const noise = (rand() - 0.5) * span * 0.45;
      const drift = sign(ind) * span * ((strainEffect[ind.id] ?? 0) * strain + ((missionEffect[ind.id] ?? 0) + (ind.id === 'endurance' ? story.slow : 0)) * progress);
      const base = ind.worseWhen === 'high' ? lo + span * 0.4 : ind.worseWhen === 'low' ? lo + span * 0.6 : (lo + hi) / 2;
      const v = base + noise + drift;
      values[ind.id] = span >= 10 ? Math.round(v) : +v.toFixed(1);
    }

    const scores = indicators
      .filter((i) => values[i.id] !== undefined)
      .map((i) => Math.min(1, outsideness(i, values[i.id]!)));
    const raw = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) * 4.5 : 0;
    // A small everyday wobble, so a healthy path is close to the plan but not identical.
    const wobble = 0.05 + 0.04 * Math.sin(day / 7);
    out.push({ day, logged, values, drift: Math.min(1, raw + wobble) });
  }

  // 7-day rolling average so the line moves smoothly.
  return out.map((r, i) => {
    const win = out.slice(Math.max(0, i - 6), i + 1);
    return { ...r, drift: win.reduce((a, b) => a + b.drift, 0) / win.length };
  });
}

export const stateFor = (drift: number): State => (drift < 0.3 ? 'nominal' : 'caution');

// Points of interest on the path, derived from the simulated history.
export function buildMarks(records: DayRecord[]): Mark[] {
  const marks: Mark[] = [
    { day: 0, kind: 'logged', title: 'Launch-day baseline set', detail: 'Pre-flight measurements fixed your personal normal range for every indicator.' },
  ];
  // Find each stretch where the path moved into Caution.
  const starts: number[] = [];
  const ends: number[] = [];
  records.forEach((r, i) => {
    const prev = records[i - 1];
    if (prev && prev.drift < 0.3 && r.drift >= 0.3) starts.push(r.day);
    if (prev && prev.drift >= 0.3 && r.drift < 0.3) ends.push(r.day);
  });
  if (starts[0] !== undefined) {
    const d = starts[0];
    marks.push(
      { day: d, kind: 'noticed', title: 'Sleep and mood below demo baseline', detail: 'In this simulated series, sleep was shorter and more broken for over a week, and mood scores dropped.' },
      { day: d + 7, kind: 'action', title: 'Course correction: sleep plan', detail: 'Bright light before 09:00, no screens an hour before sleep, check airflow near the sleep station.' },
      { day: d + 16, kind: 'earth', title: 'Flight surgeon reviewed the report', detail: 'The flight surgeon on Earth agreed with the sleep plan and asked for a check-in in 7 days.' },
    );
  }
  if (ends[0] !== undefined) {
    marks.push({ day: ends[0], kind: 'logged', title: 'Back within demo baseline range', detail: 'In this simulated series, sleep and mood returned to the generated launch-day range.' });
  }
  if (starts[1] !== undefined) {
    marks.push({ day: starts[1], kind: 'noticed', title: 'Drifting again: sleep, mood, heart rate', detail: 'In this simulated series, sleep is shorter, resting heart rate is higher and reaction time is slower than the generated demo baseline.' });
  }
  const gap = records.find((r) => !r.logged);
  if (gap) marks.push({ day: gap.day, kind: 'noticed', title: 'No daily log for 4 days', detail: 'Chiron could not see you here. Missing logs are shown as a dashed line; they do not count as worse health.' });
  return marks.filter((m) => m.day <= records.length - 1).sort((a, b) => a.day - b.day);
}
