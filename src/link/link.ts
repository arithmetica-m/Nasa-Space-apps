import { useEffect, useState } from 'react';
import type { DayRecord } from '../types';
import { indicatorById } from '../data/indicators';
import { latestValue } from '../lib/health';
import { outsideness } from '../data/simulate';
import type { ChironEvent } from '../emergency/events';
import { crew } from '../emergency/data';

// CHIRON LINK: each astronaut's wearable, connected to CHIRON CORE.
// ALL LINK DATA IS SIMULATED in this prototype: there is no real wearable hardware.
// Rules followed: every reading has a time and a source; readings from a disconnected
// band are shown as LAST KNOWN, never as live; missing readings are shown as missing.

export interface LinkReading {
  key: 'hr' | 'spo2' | 'skin' | 'activity' | 'sleep';
  label: string;
  value?: number;
  unit: string;
  t?: number;          // when it was measured
  live: boolean;       // false = last known value from a disconnected band
  outside: boolean;    // outside the person's normal range
}

export interface LinkStatus {
  crewId: string;
  connected: boolean;
  battery: number;     // %
  lastSync: number;    // time of the last data from the band
  location: string;    // module, or last known module
  eva: boolean;
  activity: string;    // what they are doing now (simulated schedule)
  readings: LinkReading[];
  alerts: string[];
  warnings: LinkWarning[];   // readings that broke a warning rule
}

export interface LinkWarning { key: string; label: string; value: number; unit: string; rule: string; t: number }

// PROTOTYPE WARNING RULES for live wearable readings. Simple fixed limits chosen for the demo,
// not clinical criteria. A real mission would use limits set by the flight surgeon for each person.
export const WARNING_RULES: { key: LinkReading['key']; rule: string; test: (v: number) => boolean }[] = [
  { key: 'hr', rule: 'heart rate above 120 or below 40 bpm', test: (v) => v > 120 || v < 40 },
  { key: 'spo2', rule: 'blood oxygen below 94%', test: (v) => v < 94 },
  { key: 'skin', rule: 'skin temperature above 37.5 °C', test: (v) => v > 37.5 },
];

// Apply readings the band has sent to CORE (shared log), newest first, and check the warning rules.
export function withLinkEvents(s0: LinkStatus, log: ChironEvent[]): LinkStatus {
  // A band connected or disconnected during the session (simulated).
  const ev = [...log].reverse().find((e) => e.type === 'band' && e.crewId === s0.crewId);
  let s = s0;
  if (ev && ev.type === 'band' && ev.connected !== s0.connected) {
    s = ev.connected
      ? { ...s0, connected: true, lastSync: Math.max(ev.t, s0.lastSync), readings: s0.readings.map((r) => ({ ...r, live: r.key !== 'sleep', t: r.key === 'sleep' ? r.t : ev.t })), alerts: s0.alerts.filter((a) => !/disconnected/i.test(a)) }
      : { ...s0, connected: false, lastSync: ev.t, readings: s0.readings.map((r) => ({ ...r, live: false })), alerts: ['Band disconnected. No live data.', ...s0.alerts] };
  }
  if (!s.connected) return s;
  const mine = log.filter((e) => (e.type === 'link-reading' || e.type === 'link-clear') && e.crewId === s.crewId);
  const lastClear = Math.max(0, ...mine.filter((e) => e.type === 'link-clear').map((e) => e.t));
  const sent = mine.filter((e) => e.type === 'link-reading' && e.t > lastClear);
  if (!sent.length) return s;
  const warnings: LinkWarning[] = [];
  const readings = s.readings.map((r) => {
    const e = [...sent].reverse().find((x) => x.type === 'link-reading' && x.key === r.key);
    if (!e || e.type !== 'link-reading') return r;
    const rule = WARNING_RULES.find((w) => w.key === r.key && w.test(e.value));
    if (rule) warnings.push({ key: r.key, label: r.label, value: e.value, unit: r.unit, rule: rule.rule, t: e.t });
    // The band keeps measuring, so the reading's time is the band's latest sync, not when the value first appeared.
    return { ...r, value: e.value, t: s.lastSync, live: true, outside: !!rule || r.outside };
  });
  const alerts = [...warnings.map((w) => `WARNING: ${w.label.toLowerCase()} ${w.value}${w.unit === '%' ? '' : ' '}${w.unit} (rule: ${w.rule}).`), ...s.alerts];
  return { ...s, readings, alerts, warnings };
}


// Simulated setting for each band: where the astronaut is and what they are doing.
const BANDS: Record<string, { connected: boolean; battery: number; location: string; eva: boolean; activity: string; offlineHours?: number }> = {
  ana: { connected: true, battery: 82, location: 'Laboratory', eva: false, activity: 'Science experiment' },
  lena: { connected: true, battery: 64, location: 'Medical bay', eva: false, activity: 'Equipment check' },
  kai: { connected: true, battery: 18, location: 'Airlock', eva: false, activity: 'EVA preparation' },
  ravi: { connected: false, battery: 0, location: 'Crew quarters', eva: false, activity: 'Unknown', offlineHours: 5 },
};

export const MODULES = ['Laboratory', 'Medical bay', 'Airlock', 'Crew quarters', 'Galley'];

// Vibration patterns sent to the band. Illustrative: real patterns would need testing and a standard.
export const HAPTICS = [
  { pattern: '●', name: 'One vibration', meaning: 'Notification' },
  { pattern: '● ●', name: 'Two vibrations', meaning: 'New instruction or task for you' },
  { pattern: '● ● ● ● ●', name: 'Repeated vibration', meaning: 'Urgent alert: look at CHIRON now' },
];

// A clock that ticks, so "live" values and "x minutes ago" stay current.
export function useNow(everyMs = 10_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), everyMs); return () => clearInterval(t); }, [everyMs]);
  return now;
}

// Where a band is and whether it is connected, without health data (used for task ranking).
export function bandInfo(crewId: string, log?: ChironEvent[]): { location: string; connected: boolean; eva: boolean; activity: string } {
  const own = crew.find((c) => c.id === crewId)?.band;
  const b = BANDS[crewId] ?? (own ? { connected: true, location: own.location, eva: false, activity: own.activity } : { connected: false, location: 'Unknown', eva: false, activity: 'Unknown' });
  // A band connected or disconnected during the session overrides the simulated setting.
  const ev = log && [...log].reverse().find((e) => e.type === 'band' && e.crewId === crewId);
  const connected = ev && ev.type === 'band' ? ev.connected : b.connected;
  return { location: b.location, connected, eva: b.eva, activity: b.activity };
}

export function linkFor(crewId: string, records: DayRecord[], now: number): LinkStatus {
  const own = crew.find((c) => c.id === crewId)?.band;
  const band = BANDS[crewId] ?? (own ? { connected: true, battery: 90, location: own.location, eva: false, activity: own.activity, offlineHours: undefined } : undefined) ?? { connected: false, battery: 0, location: 'Unknown', eva: false, activity: 'Unknown', offlineHours: 24 };
  const lastSync = band.connected ? now - 40_000 : now - (band.offlineHours ?? 24) * 3_600_000;
  const t = lastSync;
  const wobble = Math.sin(now / 60_000 + crewId.length);
  const hrBase = latestValue(records, 'hr')?.value;
  const hr = hrBase === undefined ? undefined : Math.round(hrBase + wobble * 2);
  const sleep = latestValue(records, 'sleep_h')?.value;
  const activityMin = latestValue(records, 'activity')?.value;
  const out = (id: string, v?: number) => v !== undefined && outsideness(indicatorById(id), v) > 0.05;
  const morning = new Date(now); morning.setUTCHours(6, 30, 0, 0);

  const readings: LinkReading[] = [
    { key: 'hr', label: 'Heart rate', value: hr, unit: 'bpm', t, live: band.connected, outside: out('hr', hr) },
    { key: 'spo2', label: 'Blood oxygen', value: 97 + (wobble > 0 ? 1 : 0), unit: '%', t, live: band.connected, outside: false },
    { key: 'skin', label: 'Skin temperature', value: +(33.8 + wobble * 0.2).toFixed(1), unit: '°C', t, live: band.connected, outside: false },
    { key: 'activity', label: 'Exercise today', value: activityMin, unit: 'min', t, live: band.connected, outside: out('activity', activityMin) },
    { key: 'sleep', label: 'Sleep last night', value: sleep, unit: 'h', t: morning.getTime(), live: false, outside: out('sleep_h', sleep) },
  ];

  const alerts: string[] = [];
  if (!band.connected) alerts.push(`Band disconnected for ${band.offlineHours} h. No live data.`);
  if (band.connected && band.battery < 25) alerts.push(`Battery low (${band.battery}%). Charge the band.`);
  if (band.connected && readings.some((r) => r.outside && r.live)) alerts.push('A reading is outside this person’s normal range.');
  return { crewId, connected: band.connected, battery: band.battery, lastSync, location: band.location, eva: band.eva, activity: band.activity, readings, alerts, warnings: [] };
}

export const ago = (t: number, now: number) => {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
};
