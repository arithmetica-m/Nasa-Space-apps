import type { DayRecord, Indicator } from '../types';

// The six kinds of reference for a health reading. They are kept apart on purpose:
// a personal baseline is not a population range, and neither is an approved mission limit.
export interface ReferenceCard {
  current?: { value: number; day: number; source: Indicator['source'] };
  personal: { low: number; high: number; note: string };
  population: { text: string; sourced: false };
  mission: { text: string; approved: false };
  trend?: { recent: number; before: number; direction: 'up' | 'down' | 'flat' };
  uncertainty: string[];
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function referenceCard(ind: Indicator, records: DayRecord[]): ReferenceCard {
  const today = records.length - 1;
  let current: ReferenceCard['current'];
  for (let i = today; i >= 0; i--) {
    const v = records[i].values[ind.id];
    if (v !== undefined) { current = { value: v, day: i, source: ind.source }; break; }
  }
  const window = (from: number, to: number) =>
    records.slice(Math.max(0, from), Math.max(0, to)).map((r) => r.values[ind.id]).filter((v): v is number => v !== undefined);
  const recent = window(today - 6, today + 1);
  const before = window(today - 13, today - 6);
  let trend: ReferenceCard['trend'];
  if (recent.length >= 2 && before.length >= 2) {
    const r = avg(recent), b = avg(before);
    const span = ind.baseline[1] - ind.baseline[0] || 1;
    trend = { recent: +r.toFixed(1), before: +b.toFixed(1), direction: Math.abs(r - b) < span * 0.1 ? 'flat' : r > b ? 'up' : 'down' };
  }
  const missing = 14 - window(today - 13, today + 1).length;
  const expected = ind.cadence === 'weekly' ? 2 : 14;
  const uncertainty = [
    'All values are simulated for this demonstration.',
    ind.source === 'self-reported' ? 'Self-reported: depends on how you felt, not a device.' : `Measured with: ${ind.method.toLowerCase()}.`,
  ];
  if (ind.cadence !== 'weekly' && missing > 0) uncertainty.push(`${missing} of the last 14 days have no reading.`);
  if (ind.cadence === 'weekly') uncertainty.push(`Measured weekly, so about ${expected} readings in two weeks.`);

  return {
    current,
    personal: { low: ind.baseline[0], high: ind.baseline[1], note: 'Shared demo baseline; not individual measurements' },
    population: { text: 'Not added. Needs a value from published research.', sourced: false },
    mission: { text: 'No mission-specific medical limits are configured.', approved: false },
    trend,
    uncertainty,
  };
}
