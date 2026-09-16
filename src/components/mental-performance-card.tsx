import type { ReactNode } from "react";
import { MentalScoreRing } from "@/components/mental-score-ring";
import { TrendArrow } from "@/components/trend-arrow";
import type { MentalScore, MentalState } from "@/lib/mood";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Tarjeta ancha de "Tu juego mental" — anillo + estado a la izquierda,
 * Confianza/Enfoque/Presión a la derecha. Compartida entre Coach e
 * Insights para no triplicar el mismo marcado (Home usa su propia
 * versión compacta en cuadrícula de 2 columnas, con menos espacio).
 */
export function MentalPerformanceCard({
  eyebrow,
  headerRight,
  mentalScore,
  mentalState,
  homeT,
}: {
  eyebrow: string;
  headerRight?: ReactNode;
  mentalScore: MentalScore;
  mentalState: MentalState;
  homeT: Dictionary["home"];
}) {
  return (
    <div className="bg-card/95 flex flex-col gap-4 rounded-3xl border border-border/70 p-5 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">
          {eyebrow}
        </h2>
        <div className="shrink-0 whitespace-nowrap">{headerRight}</div>
      </div>
      <div className="flex items-center gap-5">
        <div className="relative flex size-[84px] shrink-0 items-center justify-center">
          <MentalScoreRing score={mentalScore.score} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-heading text-2xl leading-none font-semibold">{mentalScore.score}</span>
            <span className="text-[9px] text-muted-foreground">/100</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-primary">{homeT[`state${capitalize(mentalState)}` as const]}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {homeT[`stateBody${capitalize(mentalState)}` as const]}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 border-l border-border/60 pl-4 text-xs text-muted-foreground">
          <span className="flex items-center justify-between gap-3">
            {homeT.confidenceLabel} <TrendArrow trend={mentalScore.confidence} />
          </span>
          <span className="flex items-center justify-between gap-3">
            {homeT.focusLabel} <TrendArrow trend={mentalScore.focus} />
          </span>
          <span className="flex items-center justify-between gap-3">
            {homeT.pressureLabel} <TrendArrow trend={mentalScore.pressure} />
          </span>
        </div>
      </div>
    </div>
  );
}

function capitalize<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;
}
