/**
 * Sustituto ilustrado de una fotografía cinematográfica para el hero —
 * no tenemos una foto real con licencia, así que en vez de un gradiente
 * plano construimos una escena vectorial (cielo de amanecer, colina,
 * silueta de golfista) que apunta a la misma composición que la
 * referencia. Sustituir por `<Image src="/hero.jpg" .../>` en cuanto
 * haya una fotografía real.
 */
export function HeroIllustration() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 640"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 -z-10 size-full"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.1 0.02 155)" />
          <stop offset="45%" stopColor="oklch(0.16 0.03 150)" />
          <stop offset="72%" stopColor="oklch(0.32 0.06 110)" />
          <stop offset="100%" stopColor="oklch(0.58 0.11 80)" />
        </linearGradient>
        <linearGradient id="hillFar" gradientUnits="userSpaceOnUse" x1="0" y1="350" x2="0" y2="640">
          <stop offset="0%" stopColor="oklch(0.4 0.06 140)" />
          <stop offset="100%" stopColor="oklch(0.27 0.04 150)" />
        </linearGradient>
        <linearGradient id="hillMid" gradientUnits="userSpaceOnUse" x1="0" y1="420" x2="0" y2="640">
          <stop offset="0%" stopColor="oklch(0.2 0.03 150)" />
          <stop offset="100%" stopColor="oklch(0.09 0.015 155)" />
        </linearGradient>
        <radialGradient id="sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="oklch(0.8 0.1 85 / 0.65)" />
          <stop offset="100%" stopColor="oklch(0.8 0.1 85 / 0)" />
        </radialGradient>
        <linearGradient id="vignette" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.1 0.015 155 / 0.6)" />
          <stop offset="45%" stopColor="oklch(0.1 0.015 155 / 0.25)" />
          <stop offset="100%" stopColor="oklch(0.1 0.015 155 / 0)" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="1200" height="640" fill="url(#sky)" />
      <circle cx="600" cy="280" r="190" fill="url(#sun)" />

      {/* colinas */}
      <path
        d="M0,420 C180,370 320,410 480,380 C650,350 780,400 950,370 C1050,352 1130,365 1200,355 L1200,640 L0,640 Z"
        fill="url(#hillFar)"
      />
      <path
        d="M0,470 C160,440 300,480 470,455 C640,430 760,470 940,440 C1040,424 1120,438 1200,428 L1200,640 L0,640 Z"
        fill="url(#hillMid)"
      />

      {/* silueta de golfista */}
      <g transform="translate(340,340) scale(1.2)" fill="oklch(0.04 0.008 155)">
        <ellipse cx="0" cy="0" rx="16" ry="18" />
        <path d="M-14,14 C-20,50 -22,110 -18,170 L-4,170 L-2,90 L4,170 L18,170 C20,110 18,50 12,14 Z" />
        <rect x="14" y="-4" width="4" height="150" rx="2" transform="rotate(8 14 -4)" />
      </g>

      <rect x="0" y="0" width="1200" height="640" fill="url(#vignette)" />
    </svg>
  );
}
