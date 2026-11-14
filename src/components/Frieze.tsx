import { useId, useMemo, useRef, useState } from 'react';
import type { DayRecord, Mark, Milestone } from '../types';
import { markColor } from '../lib/theme';

export type FocusItem = { kind: 'milestone'; milestone: Milestone };

// The health trace: a smooth line across the mission's days. Two thin rules mark the
// astronaut's own normal range. Inside the band the line is gold; where readings drift
// outside it the line turns amber and the space below the band is shaded.

const W = 1000, H = 150, PAD = 28;
const TOP = 52, BOT = 92, MID = 72;
const GOLD = '#c8a96a', AMBER = '#e39b4b', MUTE = '#8b8576', MARBLE = '#e9e4da';

export interface Selection { from: number; to: number }

function smooth(values: number[], sigma: number) {
  const r = Math.ceil(sigma * 2.5);
  return values.map((_, i) => {
    let s = 0, w = 0;
    for (let k = -r; k <= r; k++) {
      const j = i + k;
      if (j < 0 || j >= values.length) continue;
      const g = Math.exp(-(k * k) / (2 * sigma * sigma));
      s += values[j] * g;
      w += g;
    }
    return s / w;
  });
}

// Drift 0 sits on the centre line, 0.3 (the attention threshold) on the lower rule.
const yOf = (d: number) => (d <= 0.3 ? MID + (d / 0.3) * (BOT - MID) : BOT + Math.min(1, (d - 0.3) / 0.7) * 44);

// Smooth curve through points (Catmull-Rom converted to cubic Bezier segments).
function curve(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export function MarkShape({ kind, x, y, scale = 1 }: { kind: Mark['kind']; x: number; y: number; scale?: number }) {
  const c = markColor[kind];
  const s = 4.5 * scale;
  if (kind === 'noticed') return <path d={`M${x} ${y - s * 1.1}L${x + s} ${y + s * 0.8}H${x - s}Z`} fill={c} stroke="#04070d" strokeWidth={1.5} />;
  if (kind === 'action') return <path d={`M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z`} fill="#04070d" stroke={c} strokeWidth={1.6} />;
  if (kind === 'earth') return <g><circle cx={x} cy={y} r={s} fill="#04070d" stroke={c} strokeWidth={1.5} /><circle cx={x} cy={y} r={s * 0.35} fill={c} /></g>;
  return <rect x={x - s * 0.75} y={y - s * 0.75} width={s * 1.5} height={s * 1.5} fill={c} stroke="#04070d" strokeWidth={1.5} />;
}

interface Props {
  records: DayRecord[];
  totalDays: number;
  marks: Mark[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  milestones?: Milestone[];
  onFocus?: (f: FocusItem) => void;
}

export function Frieze({ records, totalDays, marks, selection, onSelect }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number>();
  const [hoverMark, setHoverMark] = useState<Mark>();
  const drag = useRef<number | undefined>(undefined);
  const today = records.length - 1;
  const emergencyMarks = marks.filter((mark) => mark.title.toLowerCase().startsWith('emergency:'));
  const x = (day: number) => PAD + (day / totalDays) * (W - PAD * 2);

  const { line, area, stops, ys } = useMemo(() => {
    const drift = smooth(records.map((r) => r.drift), Math.max(2.5, totalDays / 70));
    const ys = drift.map(yOf);
    const step = Math.max(1, Math.round(totalDays / 120));
    const pts: { x: number; y: number }[] = [];
    for (let d = 0; d <= today; d += step) pts.push({ x: x(d), y: ys[d] });
    if (pts[pts.length - 1].x !== x(today)) pts.push({ x: x(today), y: ys[today] });
    const line = curve(pts);
    const area = `${line} L${x(today)},${BOT} L${x(0)},${BOT} Z`;
    // Colour stops along the line: gold inside the band, amber outside, grey where no log.
    const stops = pts.map((p) => {
      const day = Math.round(((p.x - PAD) / (W - PAD * 2)) * totalDays);
      const r = records[Math.min(today, day)];
      const color = !r.logged ? MUTE : drift[Math.min(today, day)] >= 0.3 ? AMBER : GOLD;
      return { offset: (p.x - PAD) / (x(today) - PAD || 1), color };
    });
    return { line, area, stops, ys };
  }, [records, totalDays, today]);

  const dayAt = (clientX: number) => {
    const r = svg.current!.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    return Math.max(0, Math.min(today, Math.round(((px - PAD) / (W - PAD * 2)) * totalDays)));
  };

  const tick = totalDays <= 40 ? 5 : totalDays <= 200 ? 30 : 60;
  const sel = selection.from === selection.to ? undefined : selection;

  return (
    <div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair select-none touch-none"
        role="img"
        aria-label={`Health trace from day 0 to day ${today}. Drag to select a range, click to select a day.`}
        onPointerDown={(e) => { drag.current = dayAt(e.clientX); }}
        onPointerMove={(e) => {
          const d = dayAt(e.clientX);
          setHover(d);
          if (drag.current !== undefined && e.buttons === 1 && d !== drag.current) onSelect({ from: Math.min(drag.current, d), to: Math.max(drag.current, d) });
        }}
        onPointerUp={(e) => {
          const d = dayAt(e.clientX);
          if (drag.current !== undefined && d === drag.current) onSelect({ from: d, to: d });
          drag.current = undefined;
        }}
        onPointerLeave={() => { setHover(undefined); drag.current = undefined; }}
      >
        <defs>
          <linearGradient id={`trace-${uid}`} gradientUnits="userSpaceOnUse" x1={x(0)} x2={x(today)} y1={0} y2={0}>
            {stops.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} />)}
          </linearGradient>
          <clipPath id={`below-${uid}`}><rect x={0} y={BOT} width={W} height={H} /></clipPath>
          <linearGradient id={`shade-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={AMBER} stopOpacity={0.35} />
            <stop offset="1" stopColor={AMBER} stopOpacity={0.02} />
          </linearGradient>
          <filter id={`glow-${uid}`} x="-5%" y="-50%" width="110%" height="200%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        {/* Demo baseline band */}
        <rect x={PAD} y={TOP} width={W - PAD * 2} height={BOT - TOP} fill={GOLD} opacity={0.04} />
        <line x1={PAD} x2={W - PAD} y1={TOP} y2={TOP} stroke={GOLD} strokeOpacity={0.4} />
        <line x1={PAD} x2={W - PAD} y1={BOT} y2={BOT} stroke={GOLD} strokeOpacity={0.4} />
        <text x={W - PAD} y={TOP - 6} textAnchor="end" fill={MUTE} fontSize="9" fontFamily="var(--font-mono)" letterSpacing="2">MEDICAL BASELINE · DEMO</text>

        {sel && <rect x={x(sel.from)} y={TOP - 30} width={Math.max(2, x(sel.to) - x(sel.from))} height={BOT - TOP + 80} fill={GOLD} opacity={0.08} />}

        {/* Days still to come */}
        <line x1={x(today)} x2={W - PAD} y1={MID} y2={MID} stroke={GOLD} strokeOpacity={0.25} strokeDasharray="1 5" />

        {/* Shading where the line drifts below the demo baseline */}
        <path d={area} fill={`url(#shade-${uid})`} clipPath={`url(#below-${uid})`} />
        {/* The line, with a soft glow underneath */}
        <path d={line} fill="none" stroke={`url(#trace-${uid})`} strokeWidth={5} opacity={0.35} filter={`url(#glow-${uid})`} />
        <path d={line} fill="none" stroke={`url(#trace-${uid})`} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Today */}
        <line x1={x(today)} x2={x(today)} y1={TOP - 24} y2={H - 18} stroke={MARBLE} strokeOpacity={0.35} />
        <text x={x(today)} y={TOP - 28} textAnchor="middle" fill={MARBLE} fontSize="9" fontFamily="var(--font-mono)" letterSpacing="2">TODAY</text>

        {/* Selected day */}
        {!sel && (
          <g pointerEvents="none">
            <line x1={x(selection.from)} x2={x(selection.from)} y1={TOP - 14} y2={H - 18} stroke={GOLD} strokeWidth={1.2} />
            <circle cx={x(selection.from)} cy={ys[selection.from]} r={5} fill="#04070d" stroke={GOLD} strokeWidth={2} />
          </g>
        )}

        {/* Events, placed on the line at their day */}
        {emergencyMarks.map((m) => (
          <g key={`${m.day}-${m.kind}`} className="cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={() => onSelect({ from: m.day, to: m.day })}
            onPointerEnter={() => setHoverMark(m)} onPointerLeave={() => setHoverMark(undefined)}>
            <circle cx={x(m.day)} cy={ys[m.day]} r={10} fill="transparent" />
            <MarkShape kind={m.kind} x={x(m.day)} y={ys[m.day]} scale={hoverMark === m ? 1.35 : 1} />
          </g>
        ))}

        {hover !== undefined && !hoverMark && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={TOP - 10} y2={H - 18} stroke={MARBLE} strokeOpacity={0.2} />
            <text x={x(hover)} y={12} textAnchor="middle" fill={MARBLE} fontSize="9" fontFamily="var(--font-mono)" letterSpacing="1.5">DAY {hover}</text>
          </g>
        )}
        {hoverMark && (
          <text x={Math.min(W - 150, Math.max(150, x(hoverMark.day)))} y={12} textAnchor="middle" fill={markColor[hoverMark.kind]} fontSize="9" fontFamily="var(--font-mono)" letterSpacing="1.2" pointerEvents="none">
            DAY {hoverMark.day} · MEDICAL EMERGENCY: {hoverMark.title.replace(/^emergency:\s*/i, '').toUpperCase()}
          </text>
        )}

        {/* Day scale */}
        {Array.from({ length: Math.floor(totalDays / tick) + 1 }, (_, i) => i * tick).map((d) => (
          <text key={d} x={x(d)} y={H - 4} textAnchor="middle" fill={MUTE} fontSize="9" fontFamily="var(--font-mono)">DAY {d}</text>
        ))}
      </svg>

      {/* Key */}
      <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 px-1 font-mono text-[10px] tracking-[0.12em] text-marble/60">
        <span className="flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><MarkShape kind="noticed" x={6} y={6.5} scale={1} /></svg>MEDICAL EMERGENCIES</span>
        <span className="flex items-center gap-1.5"><svg width="22" height="10" aria-hidden><rect x="0" y="1" width="22" height="8" fill={GOLD} opacity="0.12" /><line x1="0" x2="22" y1="1" y2="1" stroke={GOLD} strokeOpacity="0.6" /><line x1="0" x2="22" y1="9" y2="9" stroke={GOLD} strokeOpacity="0.6" /></svg>MEDICAL BASELINE · DEMO</span>
        <span className="flex items-center gap-1.5"><svg width="22" height="10" aria-hidden><line x1="0" x2="22" y1="5" y2="5" stroke={GOLD} strokeWidth="2" /></svg>HEALTH DATA LINE</span>
      </div>
    </div>
  );
}
