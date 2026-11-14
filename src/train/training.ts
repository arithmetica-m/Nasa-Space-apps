import type { MissionId } from '../types';
import type { CrewMember, Procedure } from '../emergency/types';
import { crew } from '../emergency/data';
import { procedures as guides } from '../data/procedures';

// CHIRON TRAIN: what each astronaut has practised, what is due, and practice scenarios.
// Training history before launch is SIMULATED. Practice done in CHIRON is real and saved on the device.
// The "due" rules below are DEMO RULES, not an approved NASA training standard.

export interface Skill { id: string; name: string; kind: 'emergency' | 'measurement'; clinical: boolean; protocolId?: string }

export const SKILLS: Skill[] = [
  { id: 'dcs', name: 'Decompression sickness after EVA', kind: 'emergency', clinical: true, protocolId: 'TRAINING-DCS-01' },
  { id: 'respiratory', name: 'Breathing or cabin air problem', kind: 'emergency', clinical: true, protocolId: 'TRAINING-RESP-02' },
  { id: 'anaphylaxis', name: 'Severe allergic reaction', kind: 'emergency', clinical: true, protocolId: 'TRAINING-ALLERGY-03' },
  { id: 'behavioral', name: 'Acute psychological distress', kind: 'emergency', clinical: false },
  ...guides.map((g) => ({ id: g.id, name: g.title, kind: 'measurement' as const, clinical: false })),
];

// Days since each skill was last practised before launch (SIMULATED).
const PRE_FLIGHT: Record<string, Record<string, number>> = {
  ana: { dcs: 40, respiratory: 130, anaphylaxis: 70, behavioral: 90, 'blood-pressure': 20, 'resting-heart-rate': 20, temperature: 60, 'blood-sugar': 60 },
  lena: { dcs: 150, respiratory: 45, anaphylaxis: 160, behavioral: 120, 'blood-pressure': 30, 'resting-heart-rate': 30, temperature: 30, 'blood-sugar': 100 },
  kai: { dcs: 25, respiratory: 200, anaphylaxis: 210, behavioral: 80, 'blood-pressure': 140, 'resting-heart-rate': 50, temperature: 140, 'blood-sugar': 180 },
  ravi: { dcs: 300, respiratory: 90, anaphylaxis: 190, behavioral: 35, 'blood-pressure': 70, 'resting-heart-rate': 70, temperature: 70, 'blood-sugar': 200 },
};

export interface PracticeRecord { crewId: string; skillId: string; score: number; total: number; t: number }
const KEY = 'chiron-training-v1';
export function practiceRecords(): PracticeRecord[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
export function savePractice(r: PracticeRecord) {
  try { localStorage.setItem(KEY, JSON.stringify([...practiceRecords(), r])); } catch { /* storage unavailable */ }
}

const EVA_MISSIONS: MissionId[] = ['iss', 'moon', 'mars-surface'];
const isMedical = (m: CrewMember) => m.qualifications.includes('cmo') || m.qualifications.includes('cmo-backup');

export interface SkillStatus { skill: Skill; daysSince: number; due: boolean; priority: number; reasons: string[]; lastScore?: string }

// Demo rule: medical crew refresh clinical skills every 60 days, everyone else every 120 days.
// Skills linked to this mission's main risks come first.
export function skillStatus(crewId: string, mission: MissionId, now = Date.now()): SkillStatus[] {
  const member = crew.find((c) => c.id === crewId)!;
  const records = practiceRecords().filter((r) => r.crewId === crewId);
  return SKILLS.map((skill) => {
    const mine = records.filter((r) => r.skillId === skill.id).sort((a, b) => b.t - a.t)[0];
    const daysSince = mine ? Math.floor((now - mine.t) / 86_400_000) : PRE_FLIGHT[crewId]?.[skill.id] ?? 365;
    const limit = skill.clinical && isMedical(member) ? 60 : 120;
    const reasons: string[] = [`Last practised ${daysSince === 0 ? 'today' : `${daysSince} days ago`}${mine ? ' (in CHIRON)' : ' (before launch, simulated)'}.`];
    let priority = daysSince / limit;
    if (skill.clinical && isMedical(member)) reasons.push(`You are ${member.qualifications.includes('cmo') ? 'the medical officer' : 'the backup medical officer'}: refresh every ${limit} days.`);
    else reasons.push(`Refresh every ${limit} days for your role.`);
    if (skill.id === 'dcs' && EVA_MISSIONS.includes(mission)) { reasons.push('This mission has EVAs, so this risk is higher.'); priority += 0.5; }
    if (skill.id === 'dcs' && member.qualifications.includes('eva')) { reasons.push('You are EVA trained and may be the one helping in the airlock.'); priority += 0.2; }
    if (skill.id === 'behavioral' && mission !== 'iss') { reasons.push('Long, isolated missions raise the chance of crew distress.'); priority += 0.3; }
    return { skill, daysSince, due: daysSince > limit, priority, reasons, lastScore: mine ? `${mine.score}/${mine.total}` : undefined };
  }).sort((a, b) => b.priority - a.priority);
}

// Practice scenarios: the situation is SIMULATED, the steps are the approved protocol's own steps.
export const SCENARIOS: Record<string, string> = {
  dcs: 'Kai came back from a 6-hour EVA 40 minutes ago. He says his right elbow aches and his fingers tingle.',
  respiratory: 'Ravi says he is short of breath in the laboratory. Two other crew members say the air feels stuffy.',
  anaphylaxis: 'Lena ate a new food packet. Ten minutes later her lips are swelling and she has a rash on her neck.',
};

export interface Question { stepId: string; prompt: string; options: string[]; answer: string; why: string }

// "What do you do next?" for every step, with two wrong options taken from other protocols.
export function buildQuiz(p: Procedure, all: Procedure[]): Question[] {
  const others = all.filter((x) => x.category !== p.category).flatMap((x) => x.steps.map((s) => s.text));
  return p.steps.filter((s) => !s.ask).map((s, i) => {
    const wrong = [others[(i * 3) % others.length], others[(i * 3 + 5) % others.length]].filter((x) => x !== s.text);
    const options = [s.text, ...wrong];
    const rot = i % options.length;
    return { stepId: s.id, prompt: i === 0 ? 'What do you do first?' : 'What do you do next?', options: [...options.slice(rot), ...options.slice(0, rot)], answer: s.text, why: s.why };
  });
}
