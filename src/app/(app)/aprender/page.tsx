import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function LearnPage() {
  const { t } = await getDictionary();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl">{t.learn.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.learn.subtitle}</p>
      </div>

      <div className="flex flex-col gap-3">
        {t.learn.topics.map((topic) => (
          <Card key={topic.title}>
            <CardHeader>
              <CardTitle className="font-heading text-lg">{topic.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{topic.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
        {t.learn.disclaimer}
      </p>
    </div>
  );
}
