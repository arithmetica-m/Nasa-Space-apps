import type { Mission } from '../types';
import { stagesOf } from './MissionTimeline';

// Gear teeth around a circle, after the bronze dials of the Antikythera mechanism.
function teeth(cx: number, cy: number, r: number, n: number, h: number) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const rr = i % 2 ? r : r + h;
    pts.push(`${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`);
  }
  return pts.join(' ');
}

const NODES: { id: string; label: string; sub: string; level: 1 | 2 | 3; angle: number }[] = [
  { id: 'link', label: 'LINK', sub: 'wearables', level: 2, angle: -90 },
  { id: 'prevent', label: 'PREVENT', sub: 'baselines, warnings', level: 1, angle: -38 },
  { id: 'train', label: 'TRAIN', sub: 'practice, gaps', level: 1, angle: 14 },
  { id: 'respond', label: 'RESPOND', sub: 'emergency plan', level: 1, angle: 66 },
  { id: 'recover', label: 'RECOVER', sub: 'back to normal', level: 1, angle: 114 },
  { id: 'network', label: 'NETWORK', sub: 'crew roles, tasks', level: 2, angle: 166 },
  { id: 'vision', label: 'VISION', sub: 'helmet display', level: 3, angle: 218 },
];
const LEVEL_COLOR = { 1: '#c8a96a', 2: '#8fb8ff', 3: '#8b8576' };

// THE SYSTEM: CHIRON CORE in the middle, every part connected to it, Earth behind a delay.
export function SystemMap() {
  const cx = 300, cy = 250, R = 175;
  return (
    <svg viewBox="0 0 600 520" className="mx-auto w-full max-w-[640px]" role="img" aria-label="CHIRON system map: CORE connected to LINK, PREVENT, TRAIN, RESPOND, RECOVER, NETWORK, and the future VISION, with Earth behind a communication delay">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#c8a96a" strokeOpacity={0.18} strokeDasharray="2 6" />
      {NODES.map((n) => {
        const a = (n.angle * Math.PI) / 180;
        const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
        const c = LEVEL_COLOR[n.level];
        return (
          <g key={n.id}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={c} strokeOpacity={0.5} strokeDasharray={n.level === 3 ? '4 5' : undefined} />
            <circle cx={x} cy={y} r={40} fill="#07090d" stroke={c} strokeDasharray={n.level === 3 ? '4 5' : undefined} />
            <text x={x} y={y - 2} textAnchor="middle" fontSize="13" fill="#e9e4da" fontFamily="Cinzel, serif" letterSpacing="1.5">{n.label}</text>
            <text x={x} y={y + 14} textAnchor="middle" fontSize="9" fill="#e9e4da" fillOpacity={0.6}>{n.sub}</text>
          </g>
        );
      })}
      {/* CORE: a gear, with the Response Planner at its centre */}
      <polygon points={teeth(cx, cy, 70, 36, 6)} fill="#0d0f14" stroke="#c8a96a" strokeOpacity={0.8} />
      <circle cx={cx} cy={cy} r={56} fill="none" stroke="#c8a96a" strokeOpacity={0.35} />
      <text x={cx} y={cy - 14} textAnchor="middle" fontSize="18" fill="#c8a96a" fontFamily="Cinzel, serif" letterSpacing="3">CORE</text>
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fill="#e9e4da" fillOpacity={0.85}>Response Planner</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="9" fill="#e9e4da" fillOpacity={0.55}>medical library · log</text>
      {/* Earth, behind the communication delay */}
      <line x1={cx + 70} y1={cy - 40} x2={548} y2={60} stroke="#8fb8ff" strokeOpacity={0.6} strokeDasharray="2 4" />
      <circle cx={548} cy={48} r={26} fill="#0b1626" stroke="#8fb8ff" />
      <text x={548} y={52} textAnchor="middle" fontSize="11" fill="#bcd3ff" fontFamily="Cinzel, serif">EARTH</text>
      <text x={505} y={98} textAnchor="middle" fontSize="9" fill="#bcd3ff" fillOpacity={0.8}>reports · delay up to 22 min</text>
      {/* Legend */}
      {([[1, 'Works in the prototype'], [2, 'Working simulation'], [3, 'Future concept']] as const).map(([l, t], i) => (
        <g key={l} transform={`translate(${30 + i * 190}, 500)`}>
          <circle r={6} fill="none" stroke={LEVEL_COLOR[l]} strokeDasharray={l === 3 ? '3 3' : undefined} />
          <text x={12} y={4} fontSize="11" fill="#e9e4da" fillOpacity={0.75}>{t}</text>
        </g>
      ))}
    </svg>
  );
}

// MISSION DIAL: the mission as a bronze dial. Each arc is a stage; the pointer is today.
export function MissionDial({ mission, size = 132 }: { mission: Mission; size?: number }) {
  const c = 70, r = 52;
  const stages = stagesOf(mission);
  const total = mission.totalDays;
  const ang = (d: number) => (d / total) * Math.PI * 2 - Math.PI / 2;
  const arc = (from: number, to: number) => {
    const a0 = ang(from), a1 = ang(Math.min(to, total) - 0.001);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)}`;
  };
  const t = ang(mission.today);
  return (
    <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label={`Mission day ${mission.today} of ${total}`}>
      <polygon points={teeth(c, c, 64, 48, 3)} fill="#0d0f14" stroke="#c8a96a" strokeOpacity={0.55} />
      {stages.map((s, i) => (
        <path key={s.title} d={arc(s.from, s.to)} fill="none" stroke={i % 2 ? '#c8a96a' : '#a07c43'} strokeOpacity={mission.today >= s.from ? 0.95 : 0.35} strokeWidth={7} />
      ))}
      <circle cx={c} cy={c} r={40} fill="none" stroke="#c8a96a" strokeOpacity={0.25} />
      <line x1={c} y1={c} x2={c + 58 * Math.cos(t)} y2={c + 58 * Math.sin(t)} stroke="#e9e4da" strokeWidth={2} />
      <circle cx={c} cy={c} r={4} fill="#e9e4da" />
      <text x={c} y={c + 20} textAnchor="middle" fontSize="11" fill="#e9e4da" fontFamily="Cinzel, serif">DAY {mission.today}</text>
      <text x={c} y={c + 31} textAnchor="middle" fontSize="7" fill="#e9e4da" fillOpacity={0.55}>OF {total}</text>
    </svg>
  );
}
