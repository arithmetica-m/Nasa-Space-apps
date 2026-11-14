// CHIRON VISION: a FUTURE CONCEPT, not built. What a helmet display could show a crew member
// whose hands are busy: the next approved step, the body area, and the equipment to fetch.
export function VisionConcept() {
  return (
    <svg viewBox="0 0 640 300" className="mx-auto w-full max-w-[640px]" role="img"
      aria-label="Concept sketch of CHIRON VISION: a helmet visor showing the next approved step, a highlighted body area and the equipment needed">
      {/* visor */}
      <path d="M40 150 C40 60 160 24 320 24 C480 24 600 60 600 150 C600 240 480 276 320 276 C160 276 40 240 40 150 Z" fill="#0b1626" fillOpacity="0.7" stroke="#8b8576" strokeDasharray="6 6" />
      <path d="M70 150 C70 78 175 48 320 48 C465 48 570 78 570 150" fill="none" stroke="#8fb8ff" strokeOpacity="0.25" />

      {/* next approved step */}
      <rect x="110" y="78" width="210" height="74" fill="#07090d" fillOpacity="0.8" stroke="#c8a96a" strokeOpacity="0.7" />
      <text x="122" y="97" fontSize="10" fill="#c8a96a" letterSpacing="2">NEXT APPROVED STEP · 3 OF 7</text>
      <text x="122" y="118" fontSize="14" fill="#e9e4da">Fit the oxygen mask.</text>
      <text x="122" y="138" fontSize="11" fill="#e9e4da" fillOpacity="0.6">Say “done” to continue</text>

      {/* body area */}
      <g transform="translate(400 150)">
        <circle cy="-58" r="14" fill="none" stroke="#8fb8ff" />
        <path d="M-26 -38 H26 L20 30 H-20 Z" fill="none" stroke="#8fb8ff" />
        <path d="M-20 30 L-16 86 M20 30 L16 86 M-26 -38 L-42 14 M26 -38 L42 14" stroke="#8fb8ff" fill="none" />
        <circle cy="-16" r="15" fill="#e39b4b" fillOpacity="0.35" stroke="#e39b4b" />
        <text x="54" y="-12" fontSize="11" fill="#f3c28d">Chest</text>
      </g>

      {/* equipment */}
      <rect x="110" y="170" width="210" height="52" fill="#07090d" fillOpacity="0.8" stroke="#5cc8a8" strokeOpacity="0.6" />
      <text x="122" y="189" fontSize="10" fill="#7bd5b8" letterSpacing="2">EQUIPMENT</text>
      <text x="122" y="209" fontSize="13" fill="#e9e4da">Oxygen mask · Medical bay, kit A</text>

      {/* link to CORE */}
      <text x="320" y="262" textAnchor="middle" fontSize="10" fill="#e9e4da" fillOpacity="0.55">steps and readings come from CHIRON CORE and LINK</text>
      <text x="320" y="16" textAnchor="middle" fontSize="11" fill="#8b8576" letterSpacing="3">FUTURE CONCEPT · NOT BUILT</text>
    </svg>
  );
}
