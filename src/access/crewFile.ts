import type { CrewMember, Qualification } from '../emergency/types';

// ADDING A CREW MEMBER FROM A FILE.
// A new astronaut joins the crew by loading one JSON file in the format below. CHIRON checks
// every required field, then builds their profile, medical record, LINK band and training
// record automatically. Health history is simulated, like the rest of the crew's.
// Stored on this device (localStorage). A real system would receive the file from Mission Control.

export const CREW_FILE_FORMAT = 'chiron-crew-file';
const KEY = 'chiron-extra-crew-v1';
const QUALS: Qualification[] = ['cmo', 'cmo-backup', 'life-support', 'eva', 'comms', 'peer-support'];

// The template offered for download: every field CHIRON needs.
export const CREW_FILE_TEMPLATE = {
  format: CREW_FILE_FORMAT,
  version: 1,
  id: 'mei',
  name: 'Mei Tanaka',
  position: 'Payload specialist',
  qualifications: ['life-support', 'comms'],
  pin: '5555',
  medical: {
    allergies: ['None known'],
    medications: [],
    history: ['Appendix removed, 2015'],
    restrictions: [],
    notes: 'Baseline from pre-flight exam.',
  },
  duties: ['Payload operations', 'Laboratory experiments'],
  link: { location: 'Laboratory', activity: 'Science experiment' },
};

export const CREW_FILE_FIELDS: [string, string][] = [
  ['format', `must be "${CREW_FILE_FORMAT}"`],
  ['version', 'must be 1'],
  ['id', 'short unique name: 2 to 12 lowercase letters'],
  ['name', 'full name'],
  ['position', 'role on the mission'],
  ['qualifications', `list from: ${QUALS.join(', ')}`],
  ['pin', 'exactly 4 digits'],
  ['medical.allergies', 'list (may be empty)'],
  ['medical.medications', 'list (may be empty)'],
  ['medical.history', 'list (may be empty)'],
  ['medical.restrictions', 'list (may be empty)'],
  ['medical.notes', 'text'],
  ['duties', 'list with at least one responsibility'],
  ['link.location', 'where they usually work'],
  ['link.activity', 'what they are doing now'],
];

const isList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

// Check a file. Returns the new crew member, or the list of everything that is wrong.
export function parseCrewFile(raw: string, existing: CrewMember[]): { member?: CrewMember; errors: string[] } {
  let f: Record<string, unknown>;
  try { f = JSON.parse(raw); } catch { return { errors: ['The file is not valid JSON.'] }; }
  if (typeof f !== 'object' || f === null || Array.isArray(f)) return { errors: ['The file must contain one crew member.'] };
  const errors: string[] = [];
  const med = (f.medical ?? {}) as Record<string, unknown>;
  const link = (f.link ?? {}) as Record<string, unknown>;
  if (f.format !== CREW_FILE_FORMAT) errors.push(`"format" must be "${CREW_FILE_FORMAT}".`);
  if (f.version !== 1) errors.push('"version" must be 1.');
  if (typeof f.id !== 'string' || !/^[a-z]{2,12}$/.test(f.id)) errors.push('"id" must be 2 to 12 lowercase letters.');
  else if (existing.some((m) => m.id === f.id)) errors.push(`A crew member with id "${f.id}" already exists.`);
  if (!text(f.name)) errors.push('"name" is missing.');
  if (!text(f.position)) errors.push('"position" is missing.');
  if (!isList(f.qualifications) || f.qualifications.some((q) => !QUALS.includes(q as Qualification))) errors.push(`"qualifications" must be a list from: ${QUALS.join(', ')}.`);
  if (typeof f.pin !== 'string' || !/^\d{4}$/.test(f.pin)) errors.push('"pin" must be exactly 4 digits, in quotes.');
  if (typeof f.medical !== 'object' || f.medical === null) errors.push('"medical" is missing.');
  for (const k of ['allergies', 'medications', 'history', 'restrictions']) if (!isList(med[k])) errors.push(`"medical.${k}" must be a list (it may be empty).`);
  if (typeof med.notes !== 'string') errors.push('"medical.notes" must be text.');
  if (!isList(f.duties) || f.duties.length === 0) errors.push('"duties" must list at least one responsibility.');
  if (!text(link.location)) errors.push('"link.location" is missing.');
  if (!text(link.activity)) errors.push('"link.activity" is missing.');
  if (errors.length) return { errors };
  return {
    errors: [],
    member: {
      id: f.id as string, name: (f.name as string).trim(), position: (f.position as string).trim(),
      qualifications: f.qualifications as Qualification[], available: true, pin: f.pin as string, added: true,
      duties: f.duties as string[], band: { location: (link.location as string).trim(), activity: (link.activity as string).trim() },
      medical: {
        allergies: med.allergies as string[], medications: med.medications as string[], history: med.history as string[],
        restrictions: med.restrictions as string[], conditions: [], notes: med.notes as string,
      },
    },
  };
}

export function loadExtraCrew(): CrewMember[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function saveExtraCrew(list: CrewMember[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
}
