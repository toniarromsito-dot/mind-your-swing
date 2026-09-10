import Link from "next/link";
import { auth } from "@/lib/auth";
import { requireUserId } from "@/lib/require-user";
import { getActiveGamesForUser } from "@/lib/data/games";
import { Card, CardContent } from "@/components/ui/card";
import { Flag, Brain, GraduationCap, Users, ArrowRight, Calendar } from "lucide-react";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function HomePage() {
  const userId = await requireUserId();
  const session = await auth();
  const { t } = await getDictionary();
  const h = t.home;

  const activeGames = await getActiveGamesForUser(userId);
  const activeGame = activeGames[0] ?? null;

  const cards = [
    {
      href: "/play/new",
      icon: Flag,
      title: h.playCard,
      body: h.playCardBody,
      className: "bg-primary text-primary-foreground",
      iconClassName: "bg-primary-foreground/15 text-primary-foreground",
      bodyClassName: "text-primary-foreground/75",
    },
    {
      href: "/mind",
      icon: Brain,
      title: h.coachCard,
      body: h.coachCardBody,
      className: "bg-accent text-accent-foreground",
      iconClassName: "bg-accent-foreground/10 text-accent-foreground",
      bodyClassName: "text-accent-foreground/75",
    },
    {
      href: "/coach",
      icon: GraduationCap,
      title: h.learnCard,
      body: h.learnCardBody,
      className: "bg-card",
      iconClassName: "bg-primary/10 text-primary",
      bodyClassName: "text-muted-foreground",
    },
    {
      href: "/community",
      icon: Users,
      title: h.communityCard,
      body: h.communityCardBody,
      className: "bg-secondary",
      iconClassName: "bg-primary/10 text-primary",
      bodyClassName: "text-muted-foreground",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.dashboard.greeting(session?.user.name?.split(" ")[0] ?? "")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{h.prompt}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className={`h-full border-none shadow-none transition-transform hover:-translate-y-0.5 ${c.className}`}>
              <CardContent className="flex flex-col items-start gap-3 py-6">
                <span className={`flex size-10 items-center justify-center rounded-xl ${c.iconClassName}`}>
                  <c.icon className="size-5" />
                </span>
                <p className="flex items-center gap-1 font-heading text-base font-semibold">
                  {c.title}
                  <ArrowRight className="size-3.5 opacity-60" />
                </p>
                <p className={`text-xs ${c.bodyClassName}`}>{c.body}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {activeGame && (
        <Link href={`/play/${activeGame.id}`}>
          <Card className="border-primary/30 bg-secondary/40 transition-colors hover:bg-secondary/60">
            <CardContent className="flex items-center justify-between gap-4 py-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Calendar className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-medium tracking-wide text-primary uppercase">{h.nextRoundTitle}</p>
                  <p className="mt-1 font-heading text-lg font-semibold">{activeGame.course}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(activeGame.date).toLocaleDateString(t.dateLocale, {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    ·{" "}
                    {new Date(activeGame.date).toLocaleTimeString(t.dateLocale, { hour: "2-digit", minute: "2-digit" })}
                    {activeGame.players.length > 1 ? ` · ${activeGame.players.length} ${t.play.players}` : ""}
                  </p>
                </div>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}
