import { crew } from '../emergency/data';
import type { DemoMedicalProfile } from '../emergency/types';
import type { Direction, LibraryEntry } from './entries';

// Finds the library entry for a reading or symptom and fits it to the person:
// their medical history, allergies and medications, and who can help them right now.

export interface Topic { reading?: string; direction?: Direction; symptom?: string }

export function findEntry(entries: LibraryEntry[], topic: Topic) {
  return entries.find((e) =>
    (topic.reading && e.triggers.readings?.some((r) => r.id === topic.reading && (!topic.direction || r.direction === topic.direction)))
    || (topic.symptom && e.triggers.symptoms?.includes(topic.symptom)));
}

export interface MedicalFacts { allergies: string[]; medications: string[]; restrictions: string[]; history: string[] }

// The person's record: the version edited on this device if there is one, otherwise the sample record.
export function medicalOf(crewId: string): MedicalFacts {
  try {
    const raw = localStorage.getItem(`chiron-medical-profile-v1-${crewId}`);
    if (raw) {
      const p = JSON.parse(raw) as DemoMedicalProfile;
      // Only a record someone actually edited replaces the sample record.
      if (Array.isArray(p.allergies) && p.status !== 'sample') return { allergies: p.allergies, medications: p.medications ?? [], restrictions: p.restrictions ?? [], history: p.history ?? [] };
    }
  } catch { /* fall back to the sample record */ }
  const m = crew.find((c) => c.id === crewId)?.medical;
  return { allergies: m?.allergies ?? [], medications: m?.medications ?? [], restrictions: m?.restrictions ?? [], history: m?.history ?? m?.conditions ?? [] };
}

export interface Advice {
  entry: LibraryEntry;
  forYou: string[];      // notes that apply to this person's record
  matched: string[];     // which record items made those notes apply
  whoToHelp: string;     // the medical officer for this person
  ifNobody: string[];    // what to do if that person cannot help
}

export function adviceFor(entries: LibraryEntry[], topic: Topic, crewId?: string): Advice | undefined {
  const entry = findEntry(entries, topic);
  return entry ? adviceForEntry(entry, crewId) : undefined;
}

// Advice from one library entry, fitted to this person's medical record.
export function adviceForEntry(entry: LibraryEntry, crewId?: string): Advice {
  const facts = crewId ? medicalOf(crewId) : undefined;
  const text = facts ? [...facts.history, ...facts.allergies, ...facts.medications, ...facts.restrictions].join(' ').toLowerCase() : '';
  const rules = (entry.personal ?? []).filter((r) => r.match.some((w) => text.includes(w)));
  const forYou = rules.map((r) => r.note);
  const matched = rules.map((r) => `Record mentions “${r.match.find((w) => text.includes(w))}” → extra advice applied.`);
  if (facts?.allergies.length) matched.push(`Allergies on record (${facts.allergies.join(', ')}) → allergy check added.`);
  if (facts?.allergies.length) forYou.push(`Allergies on your record: ${facts.allergies.join(', ')}. Check every medicine and glove against them.`);

  const cmo = crew.find((c) => c.qualifications.includes('cmo'));
  const backup = crew.find((c) => c.qualifications.includes('cmo-backup'));
  const helper = crewId === cmo?.id ? backup : cmo;
  return {
    entry,
    forYou,
    matched,
    whoToHelp: helper ? `${helper.name} (${crewId === cmo?.id ? 'backup medical officer, because you are the medical officer' : 'medical officer'})` : 'the medical officer',
    ifNobody: [
      'Do the steps above yourself and record them in CHIRON. A report goes to Earth automatically.',
      crewId === cmo?.id || !backup ? 'Ask any crewmate to stay with you and check on you.' : `Ask ${backup.name}, the backup medical officer.`,
      'If any warning sign appears, start an emergency. CHIRON will guide every step.',
    ],
  };
}
