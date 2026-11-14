import type { Mission, SystemId } from '../types';
import donki from './snapshots/donki.json';
import osdr from './snapshots/osdr.json';

// Real NASA data, fetched by scripts/fetch-nasa.mjs and stored as snapshots so the
// app works offline. Nothing in this file is simulated.

export const DONKI_SOURCE = { label: donki.source, fetchedAt: donki.fetchedAt, coverage: donki.coverage };
export const OSDR_SOURCE = { label: osdr.source, fetchedAt: osdr.fetchedAt };

// ---------- Space weather (DONKI) ----------

export interface EnvEvent {
  id: string;
  type: 'SEP' | 'GST' | 'FLR';
  date: string; // YYYY-MM-DD, UTC
  observed: boolean; // false when only model predictions were reported for that day
  records: number;
  instruments: string[];
  kp?: number;
  link: string;
}

// DONKI often lists one event several times (one record per instrument or model run),
// so records are grouped by type and day.
export const envEvents: EnvEvent[] = (() => {
  const groups = new Map<string, EnvEvent>();
  for (const e of donki.events as { type: EnvEvent['type']; id: string; time: string; detail: string; kp?: number; link: string }[]) {
    const date = e.time.slice(0, 10);
    const key = `${e.type}-${date}`;
    const model = e.detail.startsWith('MODEL');
    const g = groups.get(key) ?? { id: key, type: e.type, date, observed: false, records: 0, instruments: [], kp: e.kp, link: e.link };
    g.records++;
    if (!model) g.observed = true;
    const inst = e.detail.replace(/^MODEL:\s*/, '');
    if (inst && !g.instruments.includes(inst)) g.instruments.push(inst);
    if (e.kp !== undefined) g.kp = Math.max(g.kp ?? 0, e.kp);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
})();

// Mission day on which a real calendar date fell, counting back from today.
export function missionDayOf(mission: Mission, date: string) {
  const todayUtc = Date.parse(new Date().toISOString().slice(0, 10));
  return mission.today - Math.round((todayUtc - Date.parse(date)) / 864e5);
}

export function eventsForMission(mission: Mission) {
  return envEvents
    .map((e) => ({ ...e, day: missionDayOf(mission, e.date) }))
    .filter((e) => e.day >= 0 && e.day <= mission.today);
}

const deepSpace = (m: Mission) => m.id !== 'iss';

// What a space-weather event means for this astronaut on this mission, in plain words.
// Written from general, well-established space-weather knowledge; never a dose estimate.
export function envRelevance(e: EnvEvent, mission: Mission) {
  const limits = ['This is a space-weather report, not a measurement of your radiation dose.'];
  if (e.type === 'SEP') {
    if (deepSpace(mission)) limits.push('It was detected by instruments near Earth. A spacecraft far from Earth may experience it differently, or not at all.');
    if (!e.observed) limits.push('Only model predictions were reported for this day, not observations.');
    return {
      title: 'Solar particle event reported',
      why: mission.id === 'iss'
        ? "Energetic particles from the Sun. The Station is partly protected by Earth's magnetic field, but strong events can raise radiation levels on parts of its orbit."
        : mission.id === 'mars-surface'
          ? 'Energetic particles from the Sun. Mars has a thin atmosphere and no global magnetic field, so crews rely on habitat shielding and the mission shelter plan.'
          : 'Energetic particles from the Sun. Far from Earth there is no magnetic field to deflect them, so crews follow the mission shelter plan when an event is reported.',
      relevance: deepSpace(mission) ? 'high' as const : 'medium' as const,
      limits,
    };
  }
  if (e.type === 'GST') {
    return {
      title: `Geomagnetic storm (Kp ${e.kp ?? '?'})`,
      why: mission.id === 'iss'
        ? "A disturbance of Earth's magnetic field. It mainly matters for satellites, and can change radiation levels on some Station orbits."
        : "A disturbance of Earth's magnetic field. Far from Earth it has little direct relevance to your health; it is shown for completeness.",
      relevance: mission.id === 'iss' ? 'medium' as const : 'low' as const,
      limits,
    };
  }
  return {
    title: `Solar flare (class ${e.instruments[0] ?? ''})`,
    why: 'A burst of light and X-rays from the Sun. Strong flares can come before solar particle events.',
    relevance: 'low' as const,
    limits,
  };
}

// ---------- Research (OSDR) ----------

export type StudyKind = 'Astronauts' | 'Human ground study' | 'Human cells or tissue' | 'Animal model';

export interface Study {
  accession: string;
  title: string;
  organism: string;
  kind: StudyKind;
  mission?: string;
  summary: string;
  url: string;
}

// OSDR lists astronaut data, Earth-based human studies and lab-grown human cells all as
// "Homo sapiens", so each study is classified from its title and organism.
function kindOf(organism: string, title: string): StudyKind {
  if (!/homo sapiens/i.test(organism)) return 'Animal model';
  if (/astronaut/i.test(title)) return 'Astronauts';
  if (/bed ?rest|suspension|inactivity|healthy men|volunteers/i.test(title)) return 'Human ground study';
  return 'Human cells or tissue';
}

type RawStudy = { accession: string; title: string; organism: string; mission?: string; summary: string; url: string };
const pool = new Map<string, Study>();
for (const list of Object.values(osdr.bySystem as Record<string, RawStudy[]>)) {
  for (const s of list) pool.set(s.accession, { ...s, kind: kindOf(s.organism, s.title) });
}

// Hand-picked from the snapshot so each body system only cites studies that actually match it.
// Sleep has no closely matching study in the snapshot, so it cites none rather than a poor match.
const CURATED: Record<SystemId, string[]> = {
  cardiovascular: ['OSD-484', 'OSD-635'],
  musculoskeletal: ['OSD-540', 'OSD-195', 'OSD-342'],
  sensorimotor: ['OSD-816', 'OSD-715'],
  mind: ['OSD-941', 'OSD-698'],
  sleep: [],
  metabolic: ['OSD-370'],
  immune: ['OSD-943', 'OSD-54'],
  radiation: ['OSD-317', 'OSD-1014'],
};

export function studiesFor(system: SystemId): Study[] {
  return CURATED[system].map((a) => pool.get(a)).filter((s): s is Study => !!s);
}
