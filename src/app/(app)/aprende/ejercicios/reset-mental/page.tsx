import { requireUserId } from "@/lib/require-user";
import { GuidedExercise } from "@/components/guided-exercise";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function MentalResetExercisePage() {
  await requireUserId();
  const { t } = await getDictionary();
  const ex = t.exercises;

  return (
    <GuidedExercise
      steps={ex.mentalReset.steps.map((s, i) => ({ title: s.title, body: s.body, breathing: i === 1 }))}
      finalTitle={ex.mentalReset.finalTitle}
      finalBody={ex.mentalReset.finalBody}
      exitLabel={ex.exitLabel}
      stepLabel={ex.stepLabel}
      ctaLabel={ex.doneCta}
      breatheInhale={ex.breatheInhale}
      breatheExhale={ex.breatheExhale}
      exitHref="/aprende"
    />
  );
}
