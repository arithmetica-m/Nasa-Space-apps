type Range = { min: number; max: number; integer?: boolean };

// Plausibility bounds are input-quality checks, not clinical thresholds.
const ranges: Record<string, Range> = {
  hr: { min: 20, max: 250, integer: true },
  hrv: { min: 1, max: 300 },
  bp_sys: { min: 40, max: 300, integer: true },
  spo2: { min: 50, max: 100, integer: true },
  resp: { min: 1, max: 80, integer: true },
  endurance: { min: 0, max: 200 },
  emg: { min: 0, max: 200 },
  activity: { min: 0, max: 1440, integer: true },
  calcium: { min: 0, max: 5000 },
  vision: { min: 0, max: 20 },
  balance: { min: 0, max: 100 },
  coordination: { min: 0, max: 100 },
  dizziness: { min: 0, max: 10 },
  nausea: { min: 0, max: 10 },
  mood: { min: 1, max: 5, integer: true },
  reaction: { min: 100, max: 2000, integer: true },
  spatial: { min: 0, max: 100 },
  sleep_h: { min: 0, max: 24 },
  wakeups: { min: 0, max: 50, integer: true },
  temp: { min: 25, max: 45 },
  glucose: { min: 20, max: 1000 },
  crp: { min: 0, max: 1000 },
  dose: { min: 0, max: 100 },
  skin: { min: 20, max: 50 },
  co2: { min: 0, max: 100 },
};

function parseNumber(value: string): number | undefined {
  const cleaned = value.trim().replace(/\s*(bpm|%|mmhg|°c|breaths\/min|\/min|mg\/dl|mg\/day|ms|h|mSv\/day)\s*$/i, '');
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return undefined;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : undefined;
}

export function measurementError(key: string, value: string): string | undefined {
  if (!value.trim()) return 'Enter a value before saving.';

  if (key === 'bp') {
    const match = value.trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
    if (!match) return 'Enter blood pressure as systolic/diastolic, for example 120/80.';
    const systolic = Number(match[1]);
    const diastolic = Number(match[2]);
    const pulsePressure = systolic - diastolic;
    if (systolic < 50 || systolic > 250 || diastolic < 30 || diastolic > 150 || pulsePressure < 10 || pulsePressure > 150) {
      return 'Check the blood pressure: the numbers are outside plausible recording bounds.';
    }
    return undefined;
  }

  const range = ranges[key];
  if (!range) return undefined;
  const number = parseNumber(value);
  if (number === undefined) return 'Enter a numeric reading.';
  if (number < range.min || number > range.max || (range.integer && !Number.isInteger(number))) {
    return `Check the reading: enter a value from ${range.min} to ${range.max}${range.integer ? ' (whole number)' : ''}. These are data-entry bounds, not clinical limits.`;
  }
  return undefined;
}

export function numericRange(key: string): Range | undefined {
  return ranges[key];
}
