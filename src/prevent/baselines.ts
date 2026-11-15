import type { ChironEvent } from '../emergency/events';
import { indicators } from '../data/indicators';

// PERSONAL BASELINES WITH APPROVAL.
// Version 1 of every baseline comes from the pre-mission assessment (simulated) and is approved
// by the flight surgeon. A medical officer on board can propose a change; Mission Control
// approves it as a new version. Older versions are kept, never overwritten.

export interface BaselineVersion { version: number; low: number; high: number; approvedBy: string; at?: number; reason: string }
export interface Proposal { id: string; t: number; by: string; crewId: string; indicator: string; low: number; high: number; reason: string }

export function baselineHistory(crewId: string, indicator: string, log: ChironEvent[]): BaselineVersion[] {
  const ind = indicators.find((i) => i.id === indicator)!;
  const out: BaselineVersion[] = [{ version: 1, low: ind.baseline[0], high: ind.baseline[1], approvedBy: 'Flight surgeon (simulated)', reason: 'Pre-mission assessment' }];
  for (const e of log) {
    if (e.type === 'baseline' && e.by === 'earth' && e.crewId === crewId && e.indicator === indicator) {
      out.push({ version: e.version, low: e.low, high: e.high, approvedBy: 'Mission Control flight surgeon', at: e.t, reason: e.reason });
    }
  }
  return out;
}

export function pendingProposals(log: ChironEvent[], crewId?: string): Proposal[] {
  const done = new Set(log.filter((e) => e.type === 'baseline' && e.proposalId).map((e) => e.type === 'baseline' ? e.proposalId : ''));
  return log.flatMap((e) => (e.type === 'baseline-proposal' && !done.has(e.id) && (!crewId || e.crewId === crewId)
    ? [{ id: e.id, t: e.t, by: e.by, crewId: e.crewId, indicator: e.indicator, low: e.low, high: e.high, reason: e.reason }] : []));
}
