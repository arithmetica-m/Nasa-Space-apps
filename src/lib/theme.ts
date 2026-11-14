import type { MarkKind, State } from '../types';

// Brand palette: dark space, with marble, bronze and muted gold as the classical accents.
export const palette = {
  void: '#070b12',
  marble: '#e9e4da',
  gold: '#c8a96a',
  bronze: '#9c7448',
  mute: '#8b8576',
};

// Health states keep their own colours, separate from the gold brand accents.
export const stateColor: Record<State, string> = {
  nominal: '#5cc8a8',
  caution: '#e39b4b',
  warning: '#e45b5b',
};

// Plain words for each state. "Caution" sounded like danger, so it is not used on screen.
export const stateLabel: Record<State, string> = {
  nominal: 'Within demo baseline',
  caution: 'Needs attention',
  warning: 'Emergency',
};

export const markColor: Record<MarkKind, string> = {
  logged: '#e9e4da',
  noticed: '#e39b4b',
  action: '#c8a96a',
  earth: '#8fb8ff',
};

export const markLabel: Record<MarkKind, string> = {
  logged: 'You logged',
  noticed: 'Chiron noticed',
  action: 'Action taken',
  earth: 'Earth replied',
};
