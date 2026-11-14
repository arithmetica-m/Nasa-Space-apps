import type { DayRecord } from '../types';
import { indicatorById } from '../data/indicators';
import { outsideness } from '../data/simulate';

// BACK TO YOUR NORMAL: a recovery plan built for each astronaut from their own readings.
// When a reading stays outside the person's normal, CHIRON picks activities for it from the
// medical library (exercise, sleep, water...) and fits them into the day's schedule.
// SIMULATED: the activity list and schedule are demo content. The flight surgeon can change it.

export interface Activity { id: string; label: string; perWeek: number; when: string }

// The (simulated) daily schedule the activities are fitted into, in GMT.
export const DAY_SCHEDULE = [
  { time: '06:00', what: 'Wake up' },
  { time: '07:30', what: 'Exercise slot 1' },
  { time: '13:30', what: 'Exercise slot 2' },
  { time: '19:00', what: 'Evening meal and free time' },
  { time: '21:30', what: 'Sleep period' },
];

const A: Record<string, Activity> = {
  resistance: { id: 'resistance', label: 'Resistance exercise (legs and back)', perWeek: 6, when: '07:30 · exercise slot 1' },
  aerobic: { id: 'aerobic', label: 'Bike or treadmill', perWeek: 5, when: '13:30 · exercise slot 2' },
  water: { id: 'water', label: 'Extra glass of water with every meal', perWeek: 7, when: 'Every meal' },
  sleep: { id: 'sleep-period', label: 'Protect the full sleep period: no work after 21:00', perWeek: 7, when: '21:30 · sleep period' },
  light: { id: 'light', label: 'Bright light within an hour of waking', perWeek: 7, when: '06:00 · after waking' },
  screens: { id: 'screens', label: 'No screens in the last hour before sleep', perWeek: 7, when: '20:30' },
  call: { id: 'call', label: 'Private call or message home', perWeek: 2, when: '19:00 · free time' },
  meal: { id: 'meal', label: 'Eat the evening meal with the crew', perWeek: 7, when: '19:00 · evening meal' },
  balance: { id: 'balance', label: 'Balance practice, 10 minutes', perWeek: 5, when: '13:30 · after exercise' },
  eyes: { id: 'eyes', label: 'Eye chart check', perWeek: 1, when: 'Any morning' },
};
export const ACTIVITIES = Object.values(A);

// Which activities help bring each reading back to normal.
const HELPS: Record<string, Activity[]> = {
  endurance: [A.resistance, A.aerobic], emg: [A.resistance], activity: [A.resistance, A.aerobic],
  calcium: [A.resistance, A.water],
  sleep_h: [A.sleep, A.light, A.screens], wakeups: [A.sleep, A.screens], reaction: [A.sleep],
  mood: [A.call, A.meal, A.light],
  hr: [A.aerobic, A.water], hrv: [A.aerobic, A.sleep], bp_sys: [A.aerobic, A.water],
  balance: [A.balance], coordination: [A.balance], dizziness: [A.balance], spatial: [A.balance],
  vision: [A.eyes], glucose: [A.aerobic],
};

export interface RecoveryPlan {
  id: string;
  crewId: string;
  title: string;
  why: string;
  measure: string;           // indicator tracked
  goal: string;              // in plain words
  goalValue: number;
  higherIsBetter: boolean;
  startDay: number;          // days the reading has been outside normal
  activities: Activity[];
}

// One plan per reading that has stayed outside the person's normal for 3 or more readings.
export function plansFor(crewId: string, records: DayRecord[]): RecoveryPlan[] {
  const out: RecoveryPlan[] = [];
  for (const [measure, acts] of Object.entries(HELPS)) {
    const ind = indicatorById(measure);
    const vals = records.filter((r) => r.values[measure] !== undefined).map((r) => ({ day: r.day, v: r.values[measure]! }));
    let n = 0;
    for (let i = vals.length - 1; i >= 0 && outsideness(ind, vals[i].v) > 0; i--) n++;
    if (n < 3) continue;
    const low = vals[vals.length - 1].v < ind.baseline[0];
    const days = vals[vals.length - 1].day - vals[vals.length - n].day + 1;
    out.push({
      id: `${crewId}-${measure}`, crewId, measure, activities: acts, higherIsBetter: low,
      title: ind.name, why: `${low ? 'Lower' : 'Higher'} than your normal for ${days} days.`,
      goal: `Back to ${low ? 'at least' : 'at most'} ${low ? ind.baseline[0] : ind.baseline[1]} ${ind.unit}`,
      goalValue: low ? ind.baseline[0] : ind.baseline[1], startDay: Math.max(7, days),
    });
  }
  return out;
}

export interface Progress {
  points: { day: number; value: number }[];   // weekly averages since the plan started
  latest?: number;
  baseline: [number, number];
  reached: boolean;
  onTrack: boolean;
  reasons: string[];                         // how CHIRON decided "on track" or not
}

export function progressOf(plan: RecoveryPlan, records: DayRecord[]): Progress {
  const ind = indicatorById(plan.measure);
  const today = records.length - 1;
  const from = Math.max(0, today - plan.startDay - 14);
  const points: Progress['points'] = [];
  for (let end = from + 6; end <= today; end += 7) {
    const vals = records.slice(end - 6, end + 1).map((r) => r.values[plan.measure]).filter((v): v is number => v !== undefined);
    if (vals.length) points.push({ day: end, value: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) });
  }
  const latest = points[points.length - 1]?.value;
  const reached = latest !== undefined && (plan.higherIsBetter ? latest >= plan.goalValue : latest <= plan.goalValue);
  const lastThree = points.slice(-3).map((p) => p.value);
  const improving = lastThree.length >= 2 && (plan.higherIsBetter ? lastThree[lastThree.length - 1] > lastThree[0] : lastThree[lastThree.length - 1] < lastThree[0]);
  const onTrack = reached || improving;
  const reasons = [
    `Measure: ${ind.name}, weekly average from the simulated records.`,
    `Latest weekly average: ${latest ?? 'not available'} ${ind.unit}. Goal: ${plan.goalValue} ${ind.unit}. Personal normal: ${ind.baseline[0]}–${ind.baseline[1]} ${ind.unit}.`,
    lastThree.length >= 2 ? `Last ${lastThree.length} weeks: ${lastThree.join(' → ')} ${ind.unit} (${improving ? 'improving' : 'not improving'}).` : 'Not enough weeks of data to see a trend yet.',
    `Demo rule: "on track" means the goal is reached, or the last weeks are improving.`,
  ];
  return { points, latest, baseline: ind.baseline, reached, onTrack, reasons };
}

// Sessions done, saved on the device. Earlier weeks are SIMULATED so the demo has history.
const key = (crewId: string) => `chiron-rehab-v1-${crewId}`;
export interface SessionLog { activityId: string; day: string }
export function sessions(crewId: string): SessionLog[] {
  try { return JSON.parse(localStorage.getItem(key(crewId)) ?? '[]'); } catch { return []; }
}
export function unlogSession(crewId: string, activityId: string) {
  const day = new Date().toISOString().slice(0, 10);
  try { localStorage.setItem(key(crewId), JSON.stringify(sessions(crewId).filter((s) => !(s.activityId === activityId && s.day === day)))); } catch { /* storage unavailable */ }
}
export function logSession(crewId: string, activityId: string) {
  const day = new Date().toISOString().slice(0, 10);
  try { localStorage.setItem(key(crewId), JSON.stringify([...sessions(crewId), { activityId, day }])); } catch { /* storage unavailable */ }
}
