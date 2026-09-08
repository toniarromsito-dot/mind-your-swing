import { NewRoundForm } from "@/components/new-round-form";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function NewRoundPage() {
  const { t } = await getDictionary();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-heading text-2xl">{t.newRound.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.newRound.subtitle}</p>
      <div className="mt-6">
        <NewRoundForm t={t.newRound} moodLabels={t.mood} />
      </div>
    </div>
  );
}
