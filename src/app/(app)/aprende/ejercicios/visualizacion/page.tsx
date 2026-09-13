import { requireUserId } from "@/lib/require-user";
import { GuidedExercise } from "@/components/guided-exercise";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function VisualizationExercisePage() {
  await requireUserId();
  const { t } = await getDictionary();
  const ex = t.exercises;

  return (
    <GuidedExercise
      steps={ex.visualization.steps.map((s) => ({ title: s.title, body: s.body }))}
      finalTitle={ex.visualization.finalTitle}
      finalBody={ex.visualization.finalBody}
      exitLabel={ex.exitLabel}
      stepLabel={ex.stepLabel}
      ctaLabel={ex.doneCta}
      breatheInhale={ex.breatheInhale}
      breatheExhale={ex.breatheExhale}
      exitHref="/aprende"
    />
  );
}
