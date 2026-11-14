import type { SystemId } from '../types';
import osdr from './snapshots/osdr.json';

// NASA OSDR study metadata, stored locally for offline health education.

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
