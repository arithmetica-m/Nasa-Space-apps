// Illustrated crew portraits in the style of Greek coin profiles: abstract busts, not real people.
// Each crew member has their own hair shape and suit collar, so cards are recognisable at a glance.

const LOOKS: Record<string, { hair: string; tone: string; collar: string }> = {
  // hair: SVG path drawn over the head circle (centre 32,26, radius 11)
  ana: { hair: 'M20 27 C19 14 30 11 37 14 C44 16 45 24 43 29 C42 23 38 20 33 20 C27 20 23 23 22 31 Z', tone: '#d9b98a', collar: '#c8a96a' },
  lena: { hair: 'M20 25 C20 13 44 13 44 25 C44 33 46 38 44 42 L40 42 C42 34 41 26 38 22 C33 19 26 20 23 24 Z', tone: '#ead9bd', collar: '#8fb8ff' },
  kai: { hair: 'M21 23 C21 14 43 14 43 23 C40 19 36 17.5 32 17.5 C28 17.5 24 19 21 23 Z', tone: '#a9794f', collar: '#c8a96a' },
  ravi: { hair: 'M20.5 24 C20 12 44 12 43.5 24 C41 19 37 18 32 19 C27 18 23 19 20.5 24 Z M26 33 C28 39 36 39 38 33 C36 36 28 36 26 33 Z', tone: '#b98a5e', collar: '#7bd5b8' },
};

export function Avatar({ id, name, size = 48 }: { id: string; name: string; size?: number }) {
  const look = LOOKS[id];
  const initials = name.split(/\s+/).map((x) => x[0]).slice(0, 2).join('');
  if (!look) {
    return <span className="flex shrink-0 items-center justify-center rounded-full border border-gold/40 bg-void/60 font-mono text-base text-gold" style={{ width: size, height: size }}>{initials}</span>;
  }
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="shrink-0" role="img" aria-label={`Illustrated portrait of ${name}`}>
      <defs><clipPath id={`clip-${id}`}><circle cx="32" cy="32" r="30" /></clipPath></defs>
      <circle cx="32" cy="32" r="31" fill="#0d0f14" stroke="#c8a96a" strokeOpacity="0.6" />
      <g clipPath={`url(#clip-${id})`}>
        {/* suit shoulders and collar ring */}
        <path d="M8 66 C8 48 20 42 32 42 C44 42 56 48 56 66 Z" fill="#e9e4da" fillOpacity="0.9" />
        <path d="M24 43 C26 48 38 48 40 43" fill="none" stroke={look.collar} strokeWidth="3" />
        {/* neck and head */}
        <rect x="28" y="33" width="8" height="10" rx="3" fill={look.tone} />
        <circle cx="32" cy="26" r="11" fill={look.tone} />
        <path d={look.hair} fill="#1a1612" />
      </g>
    </svg>
  );
}
