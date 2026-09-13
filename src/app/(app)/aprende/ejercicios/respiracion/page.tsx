import { requireUserId } from "@/lib/require-user";
import { GuidedExercise } from "@/components/guided-exercise";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function BreathingExercisePage() {
  await requireUserId();
  const { t } = await getDictionary();
  const ex = t.exercises;

  return (
    <GuidedExercise
      steps={ex.breathing.steps.map((s) => ({ title: s.title, breathing: true }))}
      finalTitle={ex.breathing.finalTitle}
      finalBody={ex.breathing.finalBody}
      exitLabel={ex.exitLabel}
      stepLabel={ex.stepLabel}
      ctaLabel={ex.doneCta}
      breatheInhale={ex.breatheInhale}
      breatheExhale={ex.breatheExhale}
      exitHref="/aprende"
    />
  );
}
