import { GuidedExercise } from "@/components/guided-exercise";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Herramienta independiente, NUNCA insertada a la fuerza en el flujo de
 * puntuación de Focus Mode — el "toca el número y listo" sigue intacto
 * para quien no abra esto. Target → Breathe → Commit → Swing → Accept,
 * ~10-15s en total.
 */
export function PreShotRoutine({ t }: { t: Dictionary["preShotRoutine"] }) {
  return (
    <GuidedExercise
      steps={t.steps.map((s, i) => ({ title: s.title, body: s.body, breathing: i === 1 }))}
      finalTitle={t.finalTitle}
      finalBody={t.finalBody}
      exitLabel={t.exitLabel}
      stepLabel={t.stepLabel}
      ctaLabel={t.playShot}
      breatheInhale={t.breatheInhale}
      breatheExhale={t.breatheExhale}
      exitHref="/aprende"
    />
  );
}
