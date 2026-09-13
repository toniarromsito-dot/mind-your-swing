import { LineChart } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { Card, CardContent } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/current-locale";

/**
 * Placeholder real (no un 404) mientras se construye el motor de insights
 * — la pantalla completa con narrativa real sobre datos reales llega en
 * una fase posterior del rediseño del ecosistema.
 */
export default async function InsightsPage() {
  await requireUserId();
  const { t } = await getDictionary();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t.insights.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.insights.subtitle}</p>
      </div>

      <Card className="border-dashed border-border/70 shadow-none">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-foreground/60">
            <LineChart className="size-5" strokeWidth={1.5} />
          </span>
          <div>
            <p className="font-heading text-lg font-semibold">{t.insights.emptyTitle}</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{t.insights.emptyBody}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
