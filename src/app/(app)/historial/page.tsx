import Link from "next/link";
import { requireUserId } from "@/lib/require-user";
import { listRoundsForUser } from "@/lib/data/rounds";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeToPar, relativeToPar } from "@/lib/golf";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function HistorialPage() {
  const userId = await requireUserId();
  const rounds = await listRoundsForUser(userId);
  const { t } = await getDictionary();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl">{t.historial.title}</h1>

      {rounds.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.historial.empty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rounds.map((r) => (
            <Link key={r.id} href={r.status === "COMPLETED" ? `/rondas/${r.id}/resumen` : `/rondas/${r.id}`}>
              <Card className="transition-colors hover:bg-secondary/40">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{r.course}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(r.date).toLocaleDateString(t.dateLocale, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.status === "IN_PROGRESS" && <Badge variant="secondary">{t.historial.inProgress}</Badge>}
                    <span className="font-heading text-lg">
                      {formatRelativeToPar(relativeToPar(r.holes))}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
