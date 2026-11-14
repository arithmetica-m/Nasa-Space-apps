import { palette } from '../lib/theme';

// A stylised centaur drawn as a constellation, in the spirit of Centaurus.
// Decorative: the star positions are not astronomically exact.
const STARS: [number, number][] = [
  [24, 82], [46, 74], [86, 70], [124, 72], [138, 50], [142, 22], [148, 12],
  [164, 40], [182, 28], [44, 104], [36, 132], [70, 106], [64, 132],
  [112, 100], [106, 132], [128, 98], [134, 130],
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [4, 7], [7, 8],
  [1, 9], [9, 10], [2, 11], [11, 12], [3, 13], [13, 14], [3, 15], [15, 16],
];

export function CentaurConstellation({ draw = false, className = '' }: { draw?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 200 140" className={className} aria-hidden>
      {EDGES.map(([a, b], i) => (
        <line key={i} x1={STARS[a][0]} y1={STARS[a][1]} x2={STARS[b][0]} y2={STARS[b][1]}
          stroke={palette.gold} strokeOpacity={0.55} strokeWidth={0.8} pathLength={1}
          className={draw ? 'draw-line' : undefined} style={draw ? { animationDelay: `${0.15 + i * 0.07}s` } : undefined} />
      ))}
      {STARS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 6 ? 2.2 : 1.5} fill={palette.marble}
          className={draw ? 'fade-in' : undefined} style={draw ? { animationDelay: `${i * 0.05}s` } : undefined} />
      ))}
    </svg>
  );
}

export function ChironSymbol({ className = '' }: { className?: string }) {
  return <span className={`font-serif leading-none ${className}`} style={{ color: palette.gold }} aria-hidden>⚷</span>;
}

// A thin Greek key (meander) border. Decorative only.
export function GreekKey({ className = '' }: { className?: string }) {
  return (
    <svg className={className} aria-hidden preserveAspectRatio="none">
      <defs>
        <pattern id="meander" width="16" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 7.5 H12 V1 H4 V5 H8 V3" fill="none" stroke={palette.gold} strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="100%" height="8" fill="url(#meander)" />
    </svg>
  );
}
