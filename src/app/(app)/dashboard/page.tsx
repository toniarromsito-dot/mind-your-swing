import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { requireUserId } from "@/lib/require-user";
import { getActiveGamesForUser } from "@/lib/data/games";
import { Card, CardContent } from "@/components/ui/card";
import { MindMark } from "@/components/mind-mark";
import { ArrowRight, Calendar } from "lucide-react";
import { getDictionary } from "@/lib/i18n/current-locale";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";

export default async function HomePage() {
  const userId = await requireUserId();
  const session = await auth();
  const { t } = await getDictionary();
  const h = t.home;

  const activeGames = await getActiveGamesForUser(userId);
  const activeGame = activeGames[0] ?? null;

  const secondaryCards = [
    { href: "/mind", title: h.coachCard, body: h.coachCardBody, photo: DASHBOARD_PHOTOS.coach, isMind: true },
    { href: "/coach", title: h.learnCard, body: h.learnCardBody, photo: DASHBOARD_PHOTOS.learn, isMind: false },
    { href: "/community", title: h.communityCard, body: h.communityCardBody, photo: DASHBOARD_PHOTOS.community, isMind: false },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.dashboard.greeting(session?.user.name?.split(" ")[0] ?? "")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{h.prompt}</p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Jugar es la acción principal: tarjeta dominante, no una más entre
            cuatro iguales — "esta es mi app de golf", no "un panel de 4
            funciones". */}
        <Link href="/play/new" className="group">
          <Card className="relative h-60 overflow-hidden border-none shadow-md transition-transform group-hover:-translate-y-0.5 sm:h-72">
            <Image src={DASHBOARD_PHOTOS.play} alt="" fill sizes="100vw" className="object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <CardContent className="relative flex h-full flex-col justify-between p-5">
              <span className="ml-auto flex size-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
                <ArrowRight className="size-4" />
              </span>
              <div>
                <p className="font-heading text-2xl font-semibold text-white">{h.playCard}</p>
                <p className="mt-1 text-sm text-white/80">{h.playCardBody}</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <div className="grid grid-cols-3 gap-3">
          {secondaryCards.map((c) => (
            <Link key={c.href} href={c.href} className="group">
              <Card className="relative h-32 overflow-hidden border-none shadow-none transition-transform group-hover:-translate-y-0.5 sm:h-36">
                <Image src={c.photo} alt="" fill sizes="(min-width: 640px) 200px, 33vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <CardContent className="relative flex h-full flex-col justify-between p-3">
                  {c.isMind ? (
                    <MindMark size="sm" className="ml-auto" />
                  ) : (
                    <span className="ml-auto flex size-6 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
                      <ArrowRight className="size-3" />
                    </span>
                  )}
                  <div>
                    <p className="font-heading text-sm font-semibold text-white">{c.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-white/75">{c.body}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
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
