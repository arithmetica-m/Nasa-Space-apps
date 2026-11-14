import type { Mission, MissionId } from '../types';

// SIMULATED mission profiles for the demo. Delays and gravity are rounded public figures.
// Where each mission sits in 3D space is defined in src/three/space.ts.

const halfway = (day: number) => ({
  day,
  title: 'Halfway point',
  health: 'Some studies of isolated crews report harder weeks after the middle of a mission. Mood and sleep deserve extra attention.',
});

export const missions: Record<MissionId, Mission> = {
  iss: {
    id: 'iss', name: 'Space Station', totalDays: 180, today: 97, delayLabel: 'Under 1 s', gravity: '0 g', radiationPerDay: 0.5,
    startLabel: 'Launch', endLabel: 'Return to Earth',
    milestones: [
      halfway(90),
      { day: 180, title: 'Return to Earth', health: 'After months in 0 g, standing up can make you dizzy at first, and bones and muscles need time to recover. Exercise now makes the return easier.' },
    ],
  },
  moon: {
    id: 'moon', name: 'Moon Mission', totalDays: 30, today: 12, delayLabel: '1.3 s', gravity: '0.16 g', radiationPerDay: 1.2,
    startLabel: 'Launch', endLabel: 'Return to Earth',
    milestones: [
      { day: 5, title: 'Lunar landing', health: 'Moving from 0 g to 1/6 g affects balance for the first hours. Lunar dust can irritate eyes and lungs.' },
      { day: 30, title: 'Return to Earth', health: 'Your body readjusts to full gravity. Expect some dizziness when standing at first.' },
    ],
  },
  'mars-transit': {
    id: 'mars-transit', name: 'Mars Transit', totalDays: 240, today: 214, delayLabel: '11 min', gravity: '0 g', radiationPerDay: 1.8,
    startLabel: 'Earth departure', endLabel: 'Mars arrival',
    milestones: [
      halfway(120),
      { day: 240, title: 'Mars arrival', health: 'You will land in 0.38 g after months in 0 g, with no ground crew to help. Balance and blood pressure need time to readjust, and strong muscles make the first days safer.' },
    ],
  },
  'mars-surface': {
    id: 'mars-surface', name: 'Mars Surface', totalDays: 500, today: 38, delayLabel: '18 min', gravity: '0.38 g', radiationPerDay: 0.7,
    startLabel: 'Mars landing', endLabel: 'Mars departure',
    milestones: [
      halfway(250),
      { day: 500, title: 'Departure from Mars', health: 'The journey home means months back in 0 g. Bone and muscle strength built on Mars helps.' },
    ],
  },
};

export const missionOrder: MissionId[] = ['iss', 'moon', 'mars-transit', 'mars-surface'];
