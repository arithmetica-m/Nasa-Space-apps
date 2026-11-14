// Procedures Chiron can teach, as step-by-step cards.
// DEMO content: these describe how to use measuring equipment in general terms.
// Real procedures must come from approved mission protocols.

export type StepIcon = 'cuff' | 'heart' | 'thermometer' | 'finger' | 'drop' | 'timer' | 'seat' | 'record' | 'check' | 'person';

export interface Procedure {
  id: string;
  title: string;
  purpose: string;
  source: { kind: 'approved' | 'uploaded'; label: string };
  steps: { text: string; icon: StepIcon }[];
}

export const procedures: Procedure[] = [
  {
    id: 'blood-pressure',
    title: 'Measure your blood pressure',
    purpose: 'Your blood pressure has been higher than your normal. A careful reading tells Chiron if the change is real.',
    source: { kind: 'approved', label: 'Demo protocol HP-03 · source to add' },
    steps: [
      { text: 'Sit still and secure yourself for 5 minutes before measuring.', icon: 'seat' },
      { text: 'Wrap the cuff around your bare upper arm, about two fingers above the elbow.', icon: 'cuff' },
      { text: 'Rest your arm at the level of your heart.', icon: 'heart' },
      { text: 'Press start and stay still and quiet until the cuff deflates.', icon: 'timer' },
      { text: 'Log both numbers in today\'s check-in.', icon: 'record' },
    ],
  },
  {
    id: 'resting-heart-rate',
    title: 'Take a resting heart rate',
    purpose: 'Your resting heart rate has been above your normal. Measuring it the same way each morning makes the trend reliable.',
    source: { kind: 'approved', label: 'Demo protocol HP-01 · source to add' },
    steps: [
      { text: 'Measure first thing after waking, before exercise or coffee.', icon: 'timer' },
      { text: 'Put on the chest strap, or place your finger in the sensor.', icon: 'finger' },
      { text: 'Breathe normally and stay still for one minute.', icon: 'person' },
      { text: 'Log the number shown in today\'s check-in.', icon: 'record' },
    ],
  },
  {
    id: 'temperature',
    title: 'Check your temperature',
    purpose: 'Body temperature runs a little higher in space, so Chiron compares it with your own normal.',
    source: { kind: 'approved', label: 'Demo protocol HP-05 · source to add' },
    steps: [
      { text: 'Wait 15 minutes after eating, drinking or exercise.', icon: 'timer' },
      { text: 'Place the thermometer as shown on its label.', icon: 'thermometer' },
      { text: 'Hold still until it beeps.', icon: 'check' },
      { text: 'Log the reading in today\'s check-in.', icon: 'record' },
    ],
  },
  {
    id: 'blood-sugar',
    title: 'Measure your blood sugar',
    purpose: 'A fasting reading before breakfast is the one Chiron compares with your normal.',
    source: { kind: 'approved', label: 'Demo protocol HP-04 · source to add' },
    steps: [
      { text: 'Measure before breakfast. Wash and dry your hands.', icon: 'drop' },
      { text: 'Insert a new test strip into the meter.', icon: 'check' },
      { text: 'Use the lancet on the side of a fingertip and touch the drop to the strip.', icon: 'finger' },
      { text: 'Log the reading in today\'s check-in.', icon: 'record' },
    ],
  },
];

// Picks a picture for an uploaded step from the words in it.
function iconFor(text: string): StepIcon {
  const t = text.toLowerCase();
  if (/cuff|arm|pressure/.test(t)) return 'cuff';
  if (/heart|pulse|chest/.test(t)) return 'heart';
  if (/temperature|thermometer|fever/.test(t)) return 'thermometer';
  if (/finger|strip|sensor|lancet/.test(t)) return 'finger';
  if (/water|drink|fluid|blood|drop/.test(t)) return 'drop';
  if (/wait|minute|second|timer|hold/.test(t)) return 'timer';
  if (/sit|rest|secure|lie/.test(t)) return 'seat';
  if (/log|record|write|report|note/.test(t)) return 'record';
  if (/patient|crew|person|breath/.test(t)) return 'person';
  return 'check';
}

// Turns an uploaded protocol (plain text or Markdown) into teaching cards:
// numbered or bulleted lines become steps; otherwise each sentence becomes a step.
export function parseProtocol(fileName: string, text: string): Procedure | undefined {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const title = (lines.find((l) => l.startsWith('#'))?.replace(/^#+\s*/, '') ?? fileName.replace(/\.[^.]+$/, '')).slice(0, 80);
  let steps = lines.filter((l) => /^(\d+[.)]|[-*•])\s+/.test(l)).map((l) => l.replace(/^(\d+[.)]|[-*•])\s+/, ''));
  if (steps.length < 2) {
    steps = lines.filter((l) => !l.startsWith('#')).join(' ').split(/(?<=[.!?])\s+/).filter((s) => s.length > 3);
  }
  if (!steps.length) return undefined;
  return {
    id: `upload-${Date.now()}`,
    title,
    purpose: 'Uploaded from your own document. Chiron has split it into steps but has not checked the content.',
    source: { kind: 'uploaded', label: `Uploaded by you · ${fileName} · not reviewed by a flight surgeon` },
    steps: steps.slice(0, 20).map((s) => ({ text: s.slice(0, 220), icon: iconFor(s) })),
  };
}
