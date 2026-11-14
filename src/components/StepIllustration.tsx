import type { StepIcon } from '../data/procedures';

// Simple line illustrations for teaching cards, drawn in the brand's gold.
const G = '#c8a96a';
const M = '#e9e4da';

export function StepIllustration({ icon, className = '' }: { icon: StepIcon; className?: string }) {
  const common = { fill: 'none', stroke: G, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const art: Record<StepIcon, JSX.Element> = {
    cuff: (<g {...common}><path d="M70 30 q-8 40 0 100" /><path d="M110 30 q8 40 0 100" /><rect x="64" y="62" width="52" height="34" rx="6" stroke={M} /><path d="M116 79 h20 a10 10 0 0 1 10 10 v20" /><circle cx="146" cy="118" r="9" /></g>),
    heart: (<g {...common}><path d="M90 128 C40 95 40 50 68 46 C80 44 88 52 90 60 C92 52 100 44 112 46 C140 50 140 95 90 128Z" /><path d="M40 92 h28 l8 -16 l10 30 l10 -22 l6 8 h38" stroke={M} /></g>),
    thermometer: (<g {...common}><rect x="80" y="26" width="20" height="82" rx="10" /><circle cx="90" cy="124" r="16" /><line x1="90" y1="56" x2="90" y2="120" stroke={M} /><path d="M108 46h10M108 62h10M108 78h10" /></g>),
    finger: (<g {...common}><path d="M70 140 v-60 a10 10 0 0 1 20 0 v20 M90 98 v-34 a10 10 0 0 1 20 0 v60 q0 20 -20 24" /><rect x="58" y="36" width="64" height="26" rx="5" stroke={M} /><circle cx="90" cy="49" r="5" stroke={M} /></g>),
    drop: (<g {...common}><path d="M90 30 C70 62 60 80 60 98 a30 30 0 0 0 60 0 C120 80 110 62 90 30Z" /><path d="M76 100 a14 14 0 0 0 14 14" stroke={M} /></g>),
    timer: (<g {...common}><circle cx="90" cy="88" r="44" /><path d="M90 88 V60 M90 88 l18 14" stroke={M} /><path d="M80 34 h20 M90 34 v10" /></g>),
    seat: (<g {...common}><circle cx="86" cy="40" r="11" /><path d="M86 52 v34 h30 v34 M86 70 l26 -6" /><path d="M60 92 h22 v40 M60 92 v40" stroke={M} /></g>),
    record: (<g {...common}><rect x="56" y="30" width="68" height="100" rx="6" /><path d="M70 56 h40 M70 74 h40 M70 92 h24" stroke={M} /><path d="M98 108 l8 8 l16 -18" /></g>),
    check: (<g {...common}><circle cx="90" cy="82" r="46" /><path d="M68 84 l16 16 l30 -34" stroke={M} /></g>),
    person: (<g {...common}><circle cx="90" cy="46" r="14" /><path d="M62 132 v-34 a28 28 0 0 1 56 0 v34" /><path d="M76 98 q14 10 28 0" stroke={M} /></g>),
  };
  return (
    <svg viewBox="0 0 180 160" className={className} aria-hidden>
      <circle cx="90" cy="82" r="72" fill={G} opacity={0.05} />
      {art[icon]}
    </svg>
  );
}
