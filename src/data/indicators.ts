import type { Indicator, SystemId } from '../types';

// Indicators from the challenge brief plus our team's research notes.
// Baselines are SIMULATED personal ranges for one demo astronaut, not clinical limits.

export const systems: { id: SystemId; name: string }[] = [
  { id: 'cardiovascular', name: 'Heart and circulation' },
  { id: 'musculoskeletal', name: 'Muscles and bones' },
  { id: 'sensorimotor', name: 'Balance and vision' },
  { id: 'mind', name: 'Mood and focus' },
  { id: 'sleep', name: 'Sleep' },
  { id: 'metabolic', name: 'Temperature and blood sugar' },
  { id: 'immune', name: 'Immune system' },
  { id: 'radiation', name: 'Radiation' },
];

export const indicators: Indicator[] = [
  // Heart and circulation: microgravity shifts fluid toward the head.
  { id: 'hr', name: 'Resting heart rate', system: 'cardiovascular', unit: 'bpm', baseline: [54, 66], method: 'Chest strap or finger sensor, at rest', cadence: 'daily', source: 'measured', why: 'Shows how hard the heart works as fluids shift in microgravity.', hazards: ['gravity'], worseWhen: 'both' },
  { id: 'hrv', name: 'Heart rate variability', system: 'cardiovascular', unit: 'ms', baseline: [45, 75], method: 'Chest strap, 5 minutes at rest', cadence: 'daily', source: 'measured', why: 'Changes in the regular beat pattern can show stress or poor recovery.', hazards: ['gravity', 'isolation'], worseWhen: 'low' },
  { id: 'bp_sys', name: 'Blood pressure (systolic)', system: 'cardiovascular', unit: 'mmHg', baseline: [108, 124], method: 'Automatic arm cuff', cadence: 'daily', source: 'measured', why: 'Shows how the body regulates blood flow without gravity.', hazards: ['gravity'], worseWhen: 'both' },
  { id: 'spo2', name: 'Blood oxygen', system: 'cardiovascular', unit: '%', baseline: [96, 99], method: 'Finger sensor (pulse oximeter)', cadence: 'daily', source: 'measured', why: 'How much oxygen the blood carries to the muscles and brain.', hazards: ['environment'], worseWhen: 'low' },
  { id: 'resp', name: 'Breathing rate', system: 'cardiovascular', unit: '/min', baseline: [12, 16], method: 'Chest strap', cadence: 'daily', source: 'measured', why: 'Rises with heart strain, illness or high cabin CO2.', hazards: ['environment'], worseWhen: 'high' },

  // Muscles and bones: no load means muscle and bone loss.
  { id: 'endurance', name: 'Muscle endurance', system: 'musculoskeletal', unit: '% of launch', baseline: [92, 105], method: 'Weekly exercise test on the resistance machine', cadence: 'weekly', source: 'measured', why: 'Muscles weaken without gravity; crews need strength for landing.', hazards: ['gravity'], worseWhen: 'low' },
  { id: 'emg', name: 'Muscle activity (EMG)', system: 'musculoskeletal', unit: '% of launch', baseline: [90, 110], method: 'Skin sensors during the weekly test', cadence: 'weekly', source: 'measured', why: 'Electrical activity during contraction shows how muscles are adapting.', hazards: ['gravity'], worseWhen: 'low' },
  { id: 'activity', name: 'Exercise completed', system: 'musculoskeletal', unit: 'min', baseline: [100, 150], method: 'Logged automatically by exercise machines', cadence: 'automatic', source: 'measured', why: 'Exercise is the main protection against bone and muscle loss.', hazards: ['gravity'], worseWhen: 'low' },
  { id: 'calcium', name: 'Urinary calcium', system: 'musculoskeletal', unit: 'mg/day', baseline: [100, 250], method: 'Urine test strip', cadence: 'weekly', source: 'measured', why: 'Calcium leaving the body is a sign of bone loss, and raises kidney stone risk.', hazards: ['gravity'], worseWhen: 'high' },

  // Balance and vision: the inner ear and eyes adapt to weightlessness.
  { id: 'vision', name: 'Visual acuity', system: 'sensorimotor', unit: 'lines', baseline: [9, 11], method: 'Eye chart on screen, lines read correctly', cadence: 'weekly', source: 'measured', why: 'Fluid pressure can change the shape of the eye in space.', hazards: ['gravity'], worseWhen: 'low' },
  { id: 'balance', name: 'Balance', system: 'sensorimotor', unit: 'score', baseline: [80, 100], method: 'Short balance task on screen', cadence: 'weekly', source: 'measured', why: 'The inner ear adapts to weightlessness and must readapt after landing.', hazards: ['gravity'], worseWhen: 'low' },
  { id: 'coordination', name: 'Coordination', system: 'sensorimotor', unit: 'score', baseline: [80, 100], method: 'Tap-the-target task on screen', cadence: 'weekly', source: 'measured', why: 'Needed for precise work such as repairs and medical procedures.', hazards: ['gravity'], worseWhen: 'low' },
  { id: 'dizziness', name: 'Dizziness', system: 'sensorimotor', unit: '/10', baseline: [0, 1], method: 'Self-report, 0 to 10', cadence: 'daily', source: 'self-reported', why: 'A sign the balance system is struggling to adapt.', hazards: ['gravity'], worseWhen: 'high' },
  { id: 'nausea', name: 'Nausea', system: 'sensorimotor', unit: '/10', baseline: [0, 1], method: 'Self-report, 0 to 10', cadence: 'daily', source: 'self-reported', why: 'Space motion sickness, or a sign of illness.', hazards: ['gravity'], worseWhen: 'high' },

  // Mind: isolation, confinement and workload.
  { id: 'mood', name: 'Mood', system: 'mind', unit: '/5', baseline: [3, 5], method: 'Three taps each morning', cadence: 'daily', source: 'self-reported', why: 'Long isolation and confinement affect mood and teamwork.', hazards: ['isolation'], worseWhen: 'low' },
  { id: 'reaction', name: 'Reaction time', system: 'mind', unit: 'ms', baseline: [230, 290], method: '1-minute tap test on screen', cadence: 'daily', source: 'measured', why: 'Slower reactions can show fatigue before the astronaut notices it.', hazards: ['isolation', 'environment'], worseWhen: 'high' },
  { id: 'spatial', name: 'Spatial thinking', system: 'mind', unit: 'score', baseline: [80, 100], method: 'Short direction and distance task', cadence: 'weekly', source: 'measured', why: 'Judging distance and direction changes without a clear up and down.', hazards: ['gravity'], worseWhen: 'low' },

  // Sleep: no normal day and night, noise, stress.
  { id: 'sleep_h', name: 'Sleep duration', system: 'sleep', unit: 'h', baseline: [6.5, 8], method: 'Wrist tracker, automatic', cadence: 'automatic', source: 'measured', why: 'Poor sleep affects mood, focus and immunity.', hazards: ['isolation', 'environment'], worseWhen: 'low' },
  { id: 'wakeups', name: 'Sleep interruptions', system: 'sleep', unit: '/night', baseline: [0, 2], method: 'Wrist tracker, automatic', cadence: 'automatic', source: 'measured', why: 'Broken sleep is less restful even when the hours look fine.', hazards: ['environment'], worseWhen: 'high' },

  // Temperature and blood sugar: from the challenge brief.
  { id: 'temp', name: 'Body temperature', system: 'metabolic', unit: '°C', baseline: [36.6, 37.5], method: 'Forehead or ear thermometer', cadence: 'daily', source: 'measured', why: 'Body temperature runs slightly higher in space; a rise can mean infection.', hazards: ['environment'], worseWhen: 'high' },
  { id: 'glucose', name: 'Blood sugar', system: 'metabolic', unit: 'mg/dL', baseline: [72, 99], method: 'Finger-prick meter, fasting', cadence: 'daily', source: 'measured', why: 'Inactivity and stress can change how the body handles sugar.', hazards: ['gravity'], worseWhen: 'both' },

  // Immune system.
  { id: 'crp', name: 'Inflammation marker (CRP)', system: 'immune', unit: 'mg/L', baseline: [0, 3], method: 'Small blood test, weekly', cadence: 'weekly', source: 'measured', why: 'The immune system changes in space; inflammation can signal infection.', hazards: ['radiation', 'environment'], worseWhen: 'high' },

  // Radiation.
  { id: 'dose', name: 'Radiation dose rate', system: 'radiation', unit: 'mSv/day', baseline: [0, 2], method: 'Personal dosimeter, automatic', cadence: 'automatic', source: 'measured', why: 'Deep space has little shielding; dose adds up over the mission.', hazards: ['radiation'], worseWhen: 'high' },
];

export const indicatorById = (id: string) => indicators.find((i) => i.id === id)!;
