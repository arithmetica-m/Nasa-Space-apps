import type { DayRecord, Indicator, State, SystemId } from '../types';
import { indicators } from '../data/indicators';
import { outsideness } from '../data/simulate';

// Most recent reading of an indicator, looking back through the history.
export function latestValue(records: DayRecord[], id: string): { value: number; day: number } | undefined {
  for (let i = records.length - 1; i >= 0; i--) {
    const v = records[i].values[id];
    if (v !== undefined) return { value: v, day: records[i].day };
  }
  return undefined;
}

export function indicatorState(records: DayRecord[], ind: Indicator): State {
  const l = latestValue(records, ind.id);
  if (!l) return 'nominal';
  return outsideness(ind, l.value) > 0.05 ? 'caution' : 'nominal';
}

export function systemScore(records: DayRecord[], system: SystemId) {
  const own = indicators.filter((i) => i.system === system);
  const scores = own.map((i) => {
    const l = latestValue(records, i.id);
    return l ? outsideness(i, l.value) : 0;
  });
  return Math.max(0, ...scores);
}

export function systemState(records: DayRecord[], system: SystemId): State {
  return systemScore(records, system) > 0.05 ? 'caution' : 'nominal';
}
