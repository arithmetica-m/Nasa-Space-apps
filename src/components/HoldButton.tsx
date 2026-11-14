import { useEffect, useRef, useState } from 'react';
import { Siren } from 'lucide-react';

// Press and hold for one second, so an emergency can't be started by accident.
export function HoldButton({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const [p, setP] = useState(0);
  const raf = useRef(0);
  const start = useRef(0);

  const stop = () => { cancelAnimationFrame(raf.current); setP(0); };
  const begin = () => {
    start.current = performance.now();
    const tick = (t: number) => {
      const v = Math.min(1, (t - start.current) / 1000);
      setP(v);
      if (v >= 1) { stop(); onConfirm(); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <button
      onPointerDown={begin} onPointerUp={stop} onPointerLeave={stop}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) begin(); }}
      onKeyUp={stop}
      className="relative flex items-center gap-2 overflow-hidden border border-[#e45b5b]/60 px-3 py-2 font-mono text-[10px] tracking-[0.25em] text-[#e45b5b] select-none"
      aria-label="Press and hold for one second to start emergency mode"
    >
      <span className="absolute inset-y-0 left-0 bg-[#e45b5b]/25" style={{ width: `${p * 100}%` }} />
      <Siren size={13} className="relative" />
      <span className="relative">{label}</span>
    </button>
  );
}
