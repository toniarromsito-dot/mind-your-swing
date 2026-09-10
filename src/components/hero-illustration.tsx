/**
 * Sustituto ilustrado de una fotografía cinematográfica para el hero — no
 * tenemos una foto real con licencia, así que en vez de un gradiente plano
 * construimos una escena vectorial (cielo de amanecer vivo, colinas,
 * silueta de golfista) que apunta a la misma composición que la
 * referencia: cielo cálido ocupando la mayor parte del encuadre, fairway
 * en primer plano, golfista en silueta a la izquierda del centro.
 * Sustituir por `<Image src="/hero.jpg" .../>` en cuanto haya una
 * fotografía real con licencia.
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
        <linearGradient id="sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="520">
          <stop offset="0%" stopColor="oklch(0.22 0.06 275)" />
          <stop offset="35%" stopColor="oklch(0.32 0.09 300)" />
          <stop offset="62%" stopColor="oklch(0.48 0.13 30)" />
          <stop offset="82%" stopColor="oklch(0.64 0.15 55)" />
          <stop offset="100%" stopColor="oklch(0.78 0.13 80)" />
        </linearGradient>
        <radialGradient id="sun" cx="620" cy="470" r="260" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.88 0.13 80 / 0.9)" />
          <stop offset="45%" stopColor="oklch(0.78 0.15 65 / 0.55)" />
          <stop offset="100%" stopColor="oklch(0.78 0.15 65 / 0)" />
        </radialGradient>
        <linearGradient id="hillFar" gradientUnits="userSpaceOnUse" x1="0" y1="380" x2="0" y2="500">
          <stop offset="0%" stopColor="oklch(0.42 0.08 280)" />
          <stop offset="100%" stopColor="oklch(0.3 0.07 270)" />
        </linearGradient>
        <linearGradient id="fairway" gradientUnits="userSpaceOnUse" x1="0" y1="440" x2="0" y2="640">
          <stop offset="0%" stopColor="oklch(0.32 0.06 145)" />
          <stop offset="55%" stopColor="oklch(0.19 0.04 150)" />
          <stop offset="100%" stopColor="oklch(0.08 0.015 155)" />
        </linearGradient>
        <linearGradient id="vignette" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="820" y2="0">
          <stop offset="0%" stopColor="oklch(0.1 0.02 260 / 0.55)" />
          <stop offset="55%" stopColor="oklch(0.1 0.02 260 / 0.2)" />
          <stop offset="100%" stopColor="oklch(0.1 0.02 260 / 0)" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="1200" height="640" fill="url(#sky)" />
      <circle cx="620" cy="470" r="260" fill="url(#sun)" />
      <circle cx="640" cy="465" r="46" fill="oklch(0.92 0.1 85 / 0.9)" />

      {/* colinas lejanas, azuladas por la distancia */}
      <path
        d="M0,430 C160,390 300,420 460,400 C630,378 760,410 940,392 C1050,380 1130,390 1200,382 L1200,520 L0,520 Z"
        fill="url(#hillFar)"
        opacity="0.75"
      />

      {/* fairway en primer plano */}
      <path
        d="M0,470 C200,440 380,478 560,458 C760,436 900,470 1200,446 L1200,640 L0,640 Z"
        fill="url(#fairway)"
      />
      <path
        d="M0,520 C220,500 420,530 640,512 C840,496 1000,520 1200,500 L1200,640 L0,640 Z"
        fill="oklch(0.06 0.012 155)"
        opacity="0.55"
      />

      {/* silueta de golfista, de espaldas mirando al horizonte */}
      <g transform="translate(360,330)" fill="oklch(0.035 0.008 260)">
        {/* gorra + cabeza */}
        <path d="M-15,-2 C-15,-14 -6,-22 3,-22 C12,-22 20,-15 21,-6 L22,-2 C22,4 17,7 10,7 L-9,7 C-13,7 -15,3 -15,-2 Z" />
        <path d="M18,-4 L34,-1 C35,0.5 34,2.5 32,3 L18,4 Z" />
        {/* torso */}
        <path d="M-16,7 C-24,20 -27,55 -25,95 L-9,95 C-9,65 -6,35 0,15 C6,35 9,65 9,95 L25,95 C27,55 24,20 16,7 C10,12 -10,12 -16,7 Z" />
        {/* brazo sujetando el palo */}
        <path d="M10,20 C22,28 30,45 33,70 L27,72 C24,50 17,34 6,26 Z" />
        {/* piernas */}
        <path d="M-9,95 L-13,190 L-4,190 L0,110 L4,190 L13,190 L9,95 Z" />
        {/* palo de golf */}
        <line x1="33" y1="8" x2="38" y2="182" stroke="oklch(0.035 0.008 260)" strokeWidth="3.5" strokeLinecap="round" />
      </g>

      <rect x="0" y="0" width="1200" height="640" fill="url(#vignette)" />
    </svg>
  );
}
