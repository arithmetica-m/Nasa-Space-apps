import type { SystemId } from '../types';

// What Chiron says when a body system leaves the astronaut's normal range.
// DEMO wording: every suggestion needs a published source before submission.
export const guidance: Record<SystemId, { why: string; suggest: string }> = {
  sleep: {
    why: 'Without a natural day and night, with noise and work pressure, sleep often gets shorter and more broken in space.',
    suggest: 'Bright light before 09:00, no screens for an hour before sleep, and check the airflow near your sleep station.',
  },
  mind: {
    why: 'Months of isolation and a confined space can lower mood and slow reactions, often after the middle of a mission.',
    suggest: 'Spend time with a crewmate, open a message from home, and consider a private call with the flight psychologist.',
  },
  cardiovascular: {
    why: 'In weightlessness fluid shifts toward the head, and stress or poor sleep can raise resting heart rate.',
    suggest: 'Recheck resting heart rate tomorrow morning at rest, and keep drinking enough water.',
  },
  musculoskeletal: {
    why: 'Without gravity, muscles and bones carry no load and slowly weaken.',
    suggest: 'Keep every resistance exercise session this week.',
  },
  sensorimotor: {
    why: 'The inner ear and eyes adapt to weightlessness, which can affect balance and vision.',
    suggest: 'Repeat the balance test in two days and note any dizziness.',
  },
  metabolic: {
    why: 'Inactivity and stress can change body temperature and how the body handles sugar.',
    suggest: 'Repeat the reading tomorrow before breakfast.',
  },
  immune: {
    why: 'The immune system changes in space, and inflammation can be an early sign of infection.',
    suggest: 'Repeat the inflammation test this week and report any fever.',
  },
  radiation: {
    why: 'Deep space has little shielding, so radiation dose adds up across the mission.',
    suggest: 'Review your personal dosimeter trend with the mission medical officer.',
  },
};
