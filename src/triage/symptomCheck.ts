import type { DayRecord } from '../types';
import { indicatorById } from '../data/indicators';
import { outsideness } from '../data/simulate';
import { latestValue } from '../lib/health';
import { medicalOf } from '../library/advice';

// REPORT SOMETHING: the astronaut says what is wrong in their own words.
// CHIRON sorts it into categories, lists possible causes, and asks follow-up questions only
// while the causes are still close. Every score change has a written reason, so the result
// can be checked ("How CHIRON got here") and used for training.
// DEMO CONTENT: causes, questions and weights are written for this prototype from general
// spaceflight-medicine knowledge. They are not a validated clinical algorithm.

export type BodyPart = 'brain' | 'eyes' | 'ears' | 'throat' | 'heart' | 'lungs' | 'stomach' | 'kidneys' | 'back' | 'bones' | 'arms' | 'skin' | 'legs' | 'whole';

interface Cause {
  id: string;
  name: string;
  base: number;
  readings?: { id: string; dir: 'high' | 'low'; add: number }[];
  history?: { match: RegExp; add: number };
}
interface Answer { label: string; add?: Record<string, number>; urgent?: Urgent }
export interface Question { id: string; text: string; answers: Answer[] }
export interface Urgent { level: 'emergency' | 'today'; text: string }

interface Category {
  id: string;
  name: string;
  words: RegExp;
  parts: BodyPart[];
  library?: string;
  causes: Cause[];
  questions: Question[];
}

const yes = (add?: Record<string, number>, urgent?: Urgent): Answer => ({ label: 'Yes', add, urgent });
const no = (add?: Record<string, number>): Answer => ({ label: 'No', add });
const unsure: Answer = { label: 'Not sure' };

export const CATEGORIES: Category[] = [
  {
    id: 'head', name: 'Head and headache', words: /head|migraine/i, parts: ['brain'], library: 'LIB-HEADACHE',
    causes: [
      { id: 'fluid', name: 'Fluid moving toward the head (common in space)', base: 2 },
      { id: 'co2', name: 'Too much CO₂ in the cabin air', base: 1.5 },
      { id: 'sleep', name: 'Not enough sleep', base: 1, readings: [{ id: 'sleep_h', dir: 'low', add: 2 }] },
      { id: 'migraine', name: 'Migraine', base: 0.5, history: { match: /migraine/i, add: 3 } },
      { id: 'water', name: 'Not drinking enough', base: 1 },
    ],
    questions: [
      { id: 'sudden', text: 'Did it start suddenly, like a hit to the head, and is it the worst you have ever had?', answers: [yes(undefined, { level: 'emergency', text: 'A sudden, worst-ever headache needs help now.' }), no(), unsure] },
      { id: 'others', text: 'Does anyone else in the cabin have a headache too?', answers: [yes({ co2: 3 }), no({ co2: -1 }), unsure] },
      { id: 'aura', text: 'Do you see flashing lights or zigzag lines?', answers: [yes({ migraine: 3 }), no({ migraine: -0.5 }), unsure] },
      { id: 'drink', text: 'Have you drunk less water than usual today?', answers: [yes({ water: 2 }), no({ water: -1 }), unsure] },
    ],
  },
  {
    id: 'motion', name: 'Dizziness, nausea or balance', words: /dizz|spin|nause|vomit|throw|sick|balance|light-?headed/i, parts: ['ears', 'stomach'], library: 'LIB-MOTION',
    causes: [
      { id: 'motion', name: 'Space motion sickness (the inner ear adapting)', base: 2, history: { match: /motion sickness/i, add: 2 } },
      { id: 'lowbp', name: 'Low blood pressure', base: 1, readings: [{ id: 'bp_sys', dir: 'low', add: 2 }] },
      { id: 'bug', name: 'A stomach bug or other infection', base: 1, readings: [{ id: 'temp', dir: 'high', add: 2 }] },
      { id: 'water', name: 'Not drinking enough', base: 0.5 },
    ],
    questions: [
      { id: 'gravity', text: 'Did it start after a gravity change, or after moving your head a lot?', answers: [yes({ motion: 3 }), no({ motion: -1 }), unsure] },
      { id: 'fever', text: 'Do you feel hot or have a fever?', answers: [yes({ bug: 3 }), no({ bug: -1 }), unsure] },
      { id: 'stand', text: 'Is it worse when you stand up or move quickly?', answers: [yes({ lowbp: 2.5 }), no(), unsure] },
      { id: 'vomit', text: 'Have you vomited more than twice?', answers: [yes({ water: 2 }, { level: 'today', text: 'Repeated vomiting can dry you out. Tell the medical officer today.' }), no(), unsure] },
    ],
  },
  {
    id: 'breath', name: 'Breathing or chest', words: /breath|chest|cough|wheez|tight|suffoc|air/i, parts: ['lungs', 'heart'], library: 'LIB-BREATH',
    causes: [
      { id: 'air', name: 'A cabin air problem', base: 1.5 },
      { id: 'asthma', name: 'Asthma', base: 0.5, history: { match: /asthma/i, add: 3 } },
      { id: 'chest-infection', name: 'A chest infection', base: 1, readings: [{ id: 'temp', dir: 'high', add: 2 }] },
      { id: 'stress', name: 'Stress or panic', base: 1, readings: [{ id: 'mood', dir: 'low', add: 1 }] },
    ],
    questions: [
      { id: 'speak', text: 'Is it hard to finish a sentence?', answers: [yes(undefined, { level: 'emergency', text: 'Too breathless to speak: get help now.' }), no(), unsure] },
      { id: 'others', text: 'Is anyone else short of breath, or is there a smell or an air alarm?', answers: [yes({ air: 4 }, { level: 'emergency', text: 'Possible cabin air problem: put on a mask and alert the crew.' }), no({ air: -1 }), unsure] },
      { id: 'spread', text: 'Does chest pain spread to your arm, jaw or back?', answers: [yes(undefined, { level: 'emergency', text: 'Chest pain that spreads needs help now.' }), no(), unsure] },
      { id: 'wheeze', text: 'Do you hear a whistle (wheeze) when you breathe out?', answers: [yes({ asthma: 3 }), no({ asthma: -1 }), unsure] },
      { id: 'cough', text: 'Do you have a cough or a fever?', answers: [yes({ 'chest-infection': 3 }), no({ 'chest-infection': -1 }), unsure] },
    ],
  },
  {
    id: 'heart', name: 'Heart', words: /heart|racing|palpit|pound|faint|flutter/i, parts: ['heart'], library: 'LIB-HEART',
    causes: [
      { id: 'fluid', name: 'The heart adapting to weightlessness', base: 1.5, readings: [{ id: 'hr', dir: 'high', add: 1.5 }] },
      { id: 'water', name: 'Not drinking enough', base: 1 },
      { id: 'stress', name: 'Stress, caffeine or poor sleep', base: 1, readings: [{ id: 'sleep_h', dir: 'low', add: 1 }] },
      { id: 'rhythm', name: 'An irregular heartbeat', base: 0.5 },
    ],
    questions: [
      { id: 'faint', text: 'Did you faint or nearly faint?', answers: [yes(undefined, { level: 'emergency', text: 'Fainting with heart symptoms needs help now.' }), no(), unsure] },
      { id: 'move', text: 'Does it happen when you move after resting?', answers: [yes({ fluid: 2 }), no(), unsure] },
      { id: 'coffee', text: 'Have you had coffee, felt stressed, or slept badly?', answers: [yes({ stress: 2.5 }), no({ stress: -1 }), unsure] },
      { id: 'irregular', text: 'Does the beat feel irregular, skipping or chaotic?', answers: [yes({ rhythm: 3 }, { level: 'today', text: 'An irregular heartbeat needs an ECG. Tell the medical officer today.' }), no({ rhythm: -0.5 }), unsure] },
    ],
  },
  {
    id: 'urine', name: 'Kidneys and urine', words: /kidney|urin|pee|bladder|side pain|flank|loin/i, parts: ['kidneys', 'back'], library: 'LIB-BONE',
    causes: [
      { id: 'stone', name: 'A kidney stone', base: 1, readings: [{ id: 'calcium', dir: 'high', add: 2.5 }], history: { match: /kidney stone/i, add: 3 } },
      { id: 'uti', name: 'A urinary infection', base: 1 },
      { id: 'water', name: 'Not drinking enough', base: 1 },
    ],
    questions: [
      { id: 'waves', text: 'Does the pain come in waves, in your side or lower back?', answers: [yes({ stone: 3 }), no({ stone: -1 }), unsure] },
      { id: 'burn', text: 'Does it burn when you pass urine?', answers: [yes({ uti: 3 }), no({ uti: -1 }), unsure] },
      { id: 'fever', text: 'Do you also have a fever or chills?', answers: [yes({ uti: 1 }, { level: 'emergency', text: 'Side pain with fever can be a serious kidney infection.' }), no(), unsure] },
      { id: 'dark', text: 'Is your urine dark?', answers: [yes({ water: 2.5 }), no({ water: -0.5 }), unsure] },
    ],
  },
  {
    id: 'msk', name: 'Muscles, bones and back', words: /back|spine|neck|muscle|cramp|weak|joint|knee|hip|shoulder|sprain|ankle|leg|arm|wrist|bone/i, parts: ['back', 'bones', 'legs', 'arms'], library: 'LIB-MUSCLE',
    causes: [
      { id: 'spine', name: 'The spine stretching without gravity', base: 1, history: undefined },
      { id: 'loss', name: 'Muscle loss in space', base: 1, readings: [{ id: 'endurance', dir: 'low', add: 2.5 }] },
      { id: 'strain', name: 'A strain from exercise or work', base: 1.5 },
      { id: 'bone', name: 'Bone loss', base: 0.5, readings: [{ id: 'calcium', dir: 'high', add: 1.5 }] },
    ],
    questions: [
      { id: 'nerve', text: 'Is there numbness, tingling, or pain shooting down a leg or arm?', answers: [yes(undefined, { level: 'today', text: 'Nerve signs need checking today by the medical officer.' }), no(), unsure] },
      { id: 'lift', text: 'Did it start after exercise, lifting or a knock?', answers: [yes({ strain: 3 }), no({ strain: -1 }), unsure] },
      { id: 'slow', text: 'Is it a weakness that crept up over weeks?', answers: [yes({ loss: 3 }), no({ loss: -1 }), unsure] },
      { id: 'lowback', text: 'Is it a dull ache in the lower back?', answers: [yes({ spine: 3 }), no({ spine: -1 }), unsure] },
    ],
  },
  {
    id: 'eyes', name: 'Eyes and vision', words: /eye|vision|blur|see|sight/i, parts: ['eyes'], library: 'LIB-EYES',
    causes: [
      { id: 'strain', name: 'Tired eyes from screens or light', base: 1.5 },
      { id: 'sans', name: 'Fluid pressure changing the eye (seen in long missions)', base: 1, readings: [{ id: 'vision', dir: 'low', add: 2.5 }] },
      { id: 'object', name: 'Something in the eye (floating dust)', base: 1 },
    ],
    questions: [
      { id: 'sudden', text: 'Did your sight change suddenly, or do you see a dark curtain?', answers: [yes(undefined, { level: 'emergency', text: 'A sudden loss of sight needs help now.' }), no(), unsure] },
      { id: 'object', text: 'Does it feel like something is in your eye?', answers: [yes({ object: 4 }), no({ object: -1 }), unsure] },
      { id: 'weeks', text: 'Has close-up reading got slowly worse over weeks?', answers: [yes({ sans: 3 }), no(), unsure] },
      { id: 'screens', text: 'Is it worse after long screen work?', answers: [yes({ strain: 2.5 }), no({ strain: -1 }), unsure] },
    ],
  },
  {
    id: 'skin', name: 'Skin', words: /rash|itch|skin|cut|graze|blister|swell|hive/i, parts: ['skin', 'arms'], library: 'LIB-SKIN',
    causes: [
      { id: 'dry', name: 'Dry cabin air irritating the skin', base: 1.5 },
      { id: 'allergy', name: 'An allergy', base: 1 },
      { id: 'wound', name: 'A small wound', base: 1 },
    ],
    questions: [
      { id: 'swell', text: 'Are your lips, face or throat swelling, or is breathing hard?', answers: [yes(undefined, { level: 'emergency', text: 'Swelling with breathing problems can be a severe allergic reaction.' }), no(), unsure] },
      { id: 'new', text: 'Did you touch or eat something new (gloves, wipes, food)?', answers: [yes({ allergy: 3 }), no({ allergy: -0.5 }), unsure] },
      { id: 'cut', text: 'Is there a cut or graze?', answers: [yes({ wound: 4 }), no({ wound: -1 }), unsure] },
    ],
  },
  {
    id: 'mind', name: 'Sleep, mood and focus', words: /sleep|tired|fatigue|mood|sad|down|feeling low|anxi|stress|focus|lonely|panic|worr/i, parts: ['brain'], library: 'LIB-MOOD',
    causes: [
      { id: 'sleep', name: 'Disturbed sleep', base: 1, readings: [{ id: 'sleep_h', dir: 'low', add: 2 }, { id: 'wakeups', dir: 'high', add: 1 }] },
      { id: 'isolation', name: 'Stress from isolation and confinement', base: 1, readings: [{ id: 'mood', dir: 'low', add: 2 }] },
      { id: 'workload', name: 'Too much work', base: 1 },
    ],
    questions: [
      { id: 'harm', text: 'Have you had thoughts of harming yourself?', answers: [yes(undefined, { level: 'emergency', text: 'You do not have to deal with this alone. Get support from the crew now.' }), no(), { label: 'I’d rather not say', urgent: { level: 'today', text: 'Talk to the medical officer or a crewmate you trust today.' } }] },
      { id: 'nights', text: 'Have you slept badly most nights this week?', answers: [yes({ sleep: 2.5 }), no({ sleep: -1 }), unsure] },
      { id: 'home', text: 'Do you feel cut off from home or the crew?', answers: [yes({ isolation: 2.5 }), no({ isolation: -1 }), unsure] },
      { id: 'work', text: 'Has your workload been heavier than usual?', answers: [yes({ workload: 2.5 }), no({ workload: -1 }), unsure] },
    ],
  },
  {
    id: 'fever', name: 'Fever, cold or infection', words: /fever|hot|chill|cold|sore throat|congest|stuffy|runny|nose|flu|shiver|sweat/i, parts: ['whole', 'throat'], library: 'LIB-INFECTION',
    causes: [
      { id: 'virus', name: 'A viral infection (a dormant virus can wake up in space)', base: 1.5, readings: [{ id: 'temp', dir: 'high', add: 2 }, { id: 'crp', dir: 'high', add: 1.5 }] },
      { id: 'fluid', name: 'A stuffy head from fluid shift (not an infection)', base: 1.5 },
    ],
    questions: [
      { id: 'temp', text: 'Is your temperature above 38 °C?', answers: [yes({ virus: 3 }, { level: 'today', text: 'Fever in space: tell the medical officer today and keep away from food areas.' }), no({ virus: -1 }), { label: 'Not measured' }] },
      { id: 'aches', text: 'Do you have body aches or a sore throat?', answers: [yes({ virus: 2 }), no({ fluid: 1 }), unsure] },
      { id: 'always', text: 'Has your nose felt stuffy since the start of the mission?', answers: [yes({ fluid: 3 }), no(), unsure] },
    ],
  },
];

// Body parts → categories, for when the astronaut points at the body instead of describing.
export function categoriesFor(text: string, parts: BodyPart[]): Category[] {
  const byWords = CATEGORIES.filter((c) => c.words.test(text));
  const byParts = CATEGORIES.filter((c) => parts.some((p) => c.parts.includes(p)));
  return [...new Set([...byWords, ...byParts])].slice(0, 3);
}

export interface ScoredCause { cat: Category; cause: Cause; score: number; why: string[] }

// Score every cause from: how common it is, the person's readings, their medical record and the answers.
export function score(cats: Category[], answers: Record<string, string>, crewId: string, records: DayRecord[]): ScoredCause[] {
  const med = medicalOf(crewId);
  const record = [...med.history, ...med.allergies, ...med.medications].join(' ');
  const out: ScoredCause[] = [];
  for (const cat of cats) for (const cause of cat.causes) {
    let s = cause.base;
    const why: string[] = [`Starting weight ${cause.base} (how common it is in space).`];
    for (const r of cause.readings ?? []) {
      const l = latestValue(records, r.id);
      const ind = indicatorById(r.id);
      if (!l) continue;
      const off = outsideness(ind, l.value) > 0 && (r.dir === 'low' ? l.value < ind.baseline[0] : l.value > ind.baseline[1]);
      if (off) { s += r.add; why.push(`+${r.add}: your ${ind.name.toLowerCase()} is ${r.dir} (${l.value} ${ind.unit}, day ${l.day}).`); }
    }
    if (cause.history && cause.history.match.test(record)) { s += cause.history.add; why.push(`+${cause.history.add}: your medical record mentions it before.`); }
    for (const q of cat.questions) {
      const a = q.answers.find((x) => x.label === answers[`${cat.id}:${q.id}`]);
      const d = a?.add?.[cause.id];
      if (d) { s += d; why.push(`${d > 0 ? '+' : ''}${d}: you answered “${a!.label}” to “${q.text}”`); }
    }
    out.push({ cat, cause, score: Math.max(0, +s.toFixed(1)), why });
  }
  return out.sort((a, b) => b.score - a.score);
}

// Ask the next question only while the top two causes are still close (less than 3 apart).
export function nextQuestion(cats: Category[], answers: Record<string, string>, ranked: ScoredCause[]): { cat: Category; q: Question } | undefined {
  if (urgentOf(cats, answers).some((u) => u.level === 'emergency')) return undefined;
  // Safety questions (the first of each category) are always asked.
  for (const cat of cats) { const q = cat.questions[0]; if (!(`${cat.id}:${q.id}` in answers)) return { cat, q }; }
  const asked = Object.keys(answers).length;
  if (asked >= 6) return undefined;
  if (ranked.length > 1 && ranked[0].score - ranked[1].score >= 3) return undefined;
  for (const cat of cats) for (const q of cat.questions) if (!(`${cat.id}:${q.id}` in answers)) return { cat, q };
  return undefined;
}

export function urgentOf(cats: Category[], answers: Record<string, string>): Urgent[] {
  const out: Urgent[] = [];
  for (const cat of cats) for (const q of cat.questions) {
    const a = q.answers.find((x) => x.label === answers[`${cat.id}:${q.id}`]);
    if (a?.urgent) out.push(a.urgent);
  }
  return out;
}

// Common things to tap instead of typing.
export const QUICK = ['Headache', 'Dizzy', 'Feel sick', 'Short of breath', 'Chest pain', 'Racing heart', 'Back pain', 'Side pain', 'Rash', 'Blurry vision', 'Can’t sleep', 'Feeling low', 'Fever', 'Stuffy nose'];
