// Shared data model. Every screen reads these same structures.

export type MissionId = 'iss' | 'moon' | 'mars-transit' | 'mars-surface';

export type State = 'nominal' | 'caution' | 'warning';

// NASA's five hazards of human spaceflight (RIDGE).
export type Hazard = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'environment';

export type SystemId =
  | 'cardiovascular'
  | 'musculoskeletal'
  | 'sensorimotor'
  | 'mind'
  | 'sleep'
  | 'metabolic'
  | 'immune'
  | 'radiation';

export interface Indicator {
  id: string;
  name: string;
  system: SystemId;
  unit: string;
  // The astronaut's personal normal range, set from pre-flight measurements.
  baseline: [number, number];
  // How it is measured on board, in plain words.
  method: string;
  cadence: 'daily' | 'weekly' | 'automatic';
  source: 'measured' | 'self-reported';
  why: string;
  hazards: Hazard[];
  // Simulated readings: higher is worse, lower is worse, or either way.
  worseWhen: 'high' | 'low' | 'both';
}

export interface Mission {
  id: MissionId;
  name: string;
  totalDays: number;
  today: number;
  delayLabel: string;
  gravity: string;
  radiationPerDay: number;
  startLabel: string;
  endLabel: string;
  milestones: Milestone[];
}

// A mission event with a health meaning, shown on the health line.
export interface Milestone {
  day: number;
  title: string;
  health: string;
}

export type MarkKind = 'logged' | 'noticed' | 'action' | 'earth';

export interface Mark {
  day: number;
  kind: MarkKind;
  title: string;
  detail: string;
}

export interface DayRecord {
  day: number;
  logged: boolean;
  values: Record<string, number | undefined>;
  // 0 = within personal baseline, 1 = far outside it.
  drift: number;
}
