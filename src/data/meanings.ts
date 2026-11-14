import type { Indicator } from '../types';
import { indicatorById } from './indicators';
import { outsideness } from './simulate';
import { guidance } from './guidance';

// Plain-words explanations for every reading and symptom, so an astronaut who is not a
// doctor knows what a number is, what a change can mean and what to do next.
// DEMO WORDING: written from general spaceflight-health knowledge. It never diagnoses,
// and every "what to do" needs review by the mission medical team before real use.

interface Meaning {
  what: string;   // what the reading is
  high?: string;  // what a higher-than-normal value can mean
  low?: string;   // what a lower-than-normal value can mean
  doHigh?: string;
  doLow?: string;
}

const M: Record<string, Meaning> = {
  hr: {
    what: 'How many times your heart beats in one minute while you rest.',
    high: 'Your heart is working harder than usual. Poor sleep, stress, dehydration or the start of an illness can all do this.',
    low: 'Your heart is beating slower than usual. This can follow good fitness, but it is worth a recheck if you feel dizzy or tired.',
    doHigh: 'Rest for 5 minutes, drink water and measure again. Tell the medical officer if it stays high tomorrow.',
    doLow: 'Measure again tomorrow morning. Tell the medical officer if you feel dizzy or faint.',
  },
  hrv: {
    what: 'The small changes in time between heartbeats. More variation usually means your body is rested and recovering well.',
    low: 'Your body may be under strain or not recovering fully, often from poor sleep, stress or hard training.',
    doLow: 'Prioritise sleep tonight and keep exercise moderate today.',
  },
  bp_sys: {
    what: 'The upper blood pressure number: the pressure in your arteries when your heart beats.',
    high: 'The pressure in your blood vessels is higher than usual. Stress, pain, caffeine or fluid changes can raise it.',
    low: 'The pressure is lower than usual. In space, fluid shifts can lower it, which can make you light-headed when you move quickly.',
    doHigh: 'Sit quietly for 5 minutes and measure again. Tell the medical officer if it stays high.',
    doLow: 'Drink water and move slowly. Tell the medical officer if you feel faint.',
  },
  spo2: {
    what: 'How much oxygen your blood is carrying, as a percentage.',
    low: 'Your blood is carrying less oxygen than usual. This can come from a breathing problem or from the cabin air.',
    doLow: 'Measure again on another finger. If it stays low or you feel short of breath, tell the medical officer now.',
  },
  resp: {
    what: 'How many breaths you take in one minute while resting.',
    high: 'You are breathing faster than usual. Stress, fever, high cabin CO₂ or a breathing problem can do this.',
    doHigh: 'Rest and count again in 5 minutes. Tell the medical officer if you feel short of breath.',
  },
  endurance: {
    what: 'How long your muscles can keep working compared with before launch.',
    low: 'Your muscles are weaker than at launch. Without gravity, muscles carry no weight and shrink if they are not trained.',
    doLow: 'Keep every resistance exercise session this week and log them.',
  },
  emg: {
    what: 'The electrical signal your muscles make when they contract, measured with skin sensors.',
    low: 'Your muscles are producing less activity than at launch, a sign they may be weakening.',
    doLow: 'Keep every resistance exercise session this week.',
  },
  activity: {
    what: 'Minutes of exercise recorded by the exercise machines today.',
    low: 'You exercised less than your plan. Exercise is the main protection against bone and muscle loss in space.',
    doLow: 'Plan a full session tomorrow. Tell the crew if something stopped you exercising.',
  },
  calcium: {
    what: 'How much calcium leaves your body in your urine each day.',
    high: 'Your bones may be losing calcium. Without gravity, bones carry no load and release calcium, which also raises the risk of kidney stones.',
    doHigh: 'Keep every resistance exercise session and drink plenty of water.',
  },
  vision: {
    what: 'How many lines you read correctly on the on-screen eye chart.',
    low: 'Your sight is less sharp than usual. In space, fluid moving toward the head can change the shape of the eye.',
    doLow: 'Tell the medical officer. They may schedule an eye exam.',
  },
  balance: {
    what: 'A score from a short balance task on screen.',
    low: 'Your balance system is less steady than usual, often while the inner ear adapts to a change in gravity.',
    doLow: 'Take extra care moving between modules and repeat the test in two days.',
  },
  coordination: {
    what: 'A score from a tap-the-target task: how precisely your hands and eyes work together.',
    low: 'Your movements are less precise than usual. Fatigue and gravity changes can affect this.',
    doLow: 'Avoid fine, high-risk tasks if possible today, and repeat the test after sleep.',
  },
  dizziness: {
    what: 'How dizzy you feel, from 0 (none) to 10 (worst).',
    high: 'You feel dizzier than usual. This often happens while the inner ear adjusts to gravity changes, or with low blood pressure.',
    doHigh: 'Move slowly and hold on. Tell the medical officer if it lasts or gets worse.',
  },
  nausea: {
    what: 'How sick to your stomach you feel, from 0 (none) to 10 (worst).',
    high: 'You feel sicker than usual. Space motion sickness is common after gravity changes; illness is another cause.',
    doHigh: 'Keep your head still and drink small sips of water. Tell the medical officer if you vomit.',
  },
  mood: {
    what: 'How you rate your mood from 1 (very low) to 5 (very good).',
    low: 'Your mood is lower than usual. Isolation, confinement and poor sleep can all wear mood down over a long mission.',
    doLow: 'Spend time with a crewmate or open a message from home. A private call with the flight psychologist is always available.',
  },
  reaction: {
    what: 'How fast you tap when a target appears, in milliseconds. Lower is faster.',
    high: 'Your reactions are slower than usual, often a sign of tiredness before you notice it yourself.',
    doHigh: 'Prioritise sleep tonight and take extra care with critical tasks today.',
  },
  spatial: {
    what: 'A score from a short task about direction and distance.',
    low: 'Judging direction and distance is harder than usual. Without a clear up and down, the brain must adapt.',
    doLow: 'Double-check positions during precise work and repeat the task in a few days.',
  },
  sleep_h: {
    what: 'How many hours you slept, measured by your wrist tracker.',
    low: 'You slept less than usual. Short sleep affects mood, focus, reaction time and the immune system.',
    doLow: 'Bright light before 09:00, no screens an hour before bed, and check the airflow at your sleep station.',
  },
  wakeups: {
    what: 'How many times you woke up during the night.',
    high: 'Your sleep was more broken than usual, so it was less restful even if the hours looked fine. Noise, light, CO₂ and stress are common causes.',
    doHigh: 'Use earplugs and an eye mask, and check the airflow at your sleep station.',
  },
  temp: {
    what: 'Your body temperature.',
    high: 'You are warmer than usual. Body temperature runs a little higher in space, but a rise can also be the start of an infection.',
    low: 'You are cooler than usual. Check the reading was taken correctly.',
    doHigh: 'Measure again in an hour. Tell the medical officer if it stays high or you feel unwell.',
    doLow: 'Measure again following the guide.',
  },
  glucose: {
    what: 'The amount of sugar in your blood before breakfast.',
    high: 'Your blood sugar is higher than usual. Inactivity, stress and poor sleep can change how the body handles sugar.',
    low: 'Your blood sugar is lower than usual, which can make you shaky or weak.',
    doHigh: 'Repeat the reading tomorrow before breakfast and keep your exercise sessions.',
    doLow: 'Eat something now and measure again in 15 minutes. Tell the medical officer if you feel shaky.',
  },
  crp: {
    what: 'A blood marker that rises when there is inflammation in the body.',
    high: 'There may be inflammation somewhere in your body. This can be an early sign of infection or injury.',
    doHigh: 'Tell the medical officer and report any fever, pain or feeling unwell.',
  },
  dose: {
    what: 'How much radiation your personal dosimeter measured today.',
    high: 'You received more radiation than usual today. Radiation adds up across the mission.',
    doHigh: 'Review the dosimeter trend with the medical officer and follow shelter instructions if given.',
  },
};

// Symptoms from the daily check-in.
export const symptomMeaning: Record<string, { what: string; todo: string }> = {
  Headache: { what: 'Common in space. Fluid moving toward the head, high cabin CO₂ and poor sleep are frequent causes.', todo: 'Drink water and check the cabin CO₂ reading. Tell the medical officer if it is severe or lasts more than a day.' },
  Dizziness: { what: 'Often the inner ear adapting to gravity changes, or low blood pressure.', todo: 'Move slowly and hold on. Tell the medical officer if it gets worse.' },
  Nausea: { what: 'Space motion sickness is common after gravity changes. Illness is another cause.', todo: 'Keep your head still and sip water. Tell the medical officer if you vomit.' },
  'Back pain': { what: 'Without gravity the spine lengthens, which often causes lower back pain in the first weeks.', todo: 'Gentle stretching and knees-to-chest positions can help. Tell the medical officer if it is sharp or spreading.' },
  Congestion: { what: 'Fluid moving toward the head often gives a blocked, stuffy nose in space.', todo: 'Drink water. Tell the medical officer if you also have a fever.' },
  'Eye strain': { what: 'Screens and lighting can tire the eyes. In space, fluid shifts can also change vision.', todo: 'Rest your eyes. Tell the medical officer about any change in how well you see.' },
};

export type Direction = 'usual' | 'high' | 'low';

export interface Explanation {
  name: string;
  direction: Direction;
  what: string;
  means?: string;   // only when outside the usual range
  todo?: string;    // only when outside the usual range
  why?: string;     // why it matters in space
  topic?: { reading?: string; direction?: 'high' | 'low'; symptom?: string }; // used to look up library advice
  evidence?: { value: string; when: string; source: string; normal?: string };
}

export function explain(id: string, value?: number, ctx?: { when?: string; source?: string }): Explanation {
  const ind: Indicator = indicatorById(id);
  const m = M[id] ?? { what: ind.why };
  const out = value !== undefined && outsideness(ind, value) > 0.05;
  const direction: Direction = !out ? 'usual' : value! < ind.baseline[0] ? 'low' : 'high';
  const evidence = value === undefined ? undefined : {
    value: `${value} ${ind.unit}`, when: ctx?.when ?? 'latest reading', source: ctx?.source ?? `${ind.method} · SIMULATED`,
    normal: `${ind.baseline[0]}–${ind.baseline[1]} ${ind.unit} (personal normal, SIMULATED)`,
  };
  if (direction === 'usual') return { name: ind.name, direction, what: m.what, topic: { reading: id }, evidence };
  const g = guidance[ind.system];
  return {
    name: ind.name,
    direction,
    what: m.what,
    means: (direction === 'high' ? m.high : m.low) ?? `This is ${direction === 'high' ? 'higher' : 'lower'} than your usual range.`,
    todo: (direction === 'high' ? m.doHigh : m.doLow) ?? g.suggest,
    why: ind.why,
    topic: { reading: id, direction },
    evidence,
  };
}
