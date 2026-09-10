import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { requireUserId } from "@/lib/require-user";
import { getActiveGamesForUser } from "@/lib/data/games";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Calendar } from "lucide-react";
import { getDictionary } from "@/lib/i18n/current-locale";

// Unsplash, licencia libre (unsplash.com/license) — sin marcas de agua ni datos inventados.
const DASHBOARD_PHOTOS = {
  play: "https://images.unsplash.com/photo-1683418323363-2ffc2e80a987?q=80&w=800&auto=format&fit=crop",
  coach: "https://images.unsplash.com/photo-1743185836009-848e5035422b?q=80&w=800&auto=format&fit=crop",
  learn: "https://images.unsplash.com/photo-1562204320-31975a5e09ce?q=80&w=800&auto=format&fit=crop",
  community: "https://images.unsplash.com/photo-1629673120178-53a664eec9e8?q=80&w=800&auto=format&fit=crop",
};

export default async function HomePage() {
  const userId = await requireUserId();
  const session = await auth();
  const { t } = await getDictionary();
  const h = t.home;

  const activeGames = await getActiveGamesForUser(userId);
  const activeGame = activeGames[0] ?? null;

  const cards = [
    { href: "/play/new", title: h.playCard, body: h.playCardBody, photo: DASHBOARD_PHOTOS.play },
    { href: "/mind", title: h.coachCard, body: h.coachCardBody, photo: DASHBOARD_PHOTOS.coach },
    { href: "/coach", title: h.learnCard, body: h.learnCardBody, photo: DASHBOARD_PHOTOS.learn },
    { href: "/community", title: h.communityCard, body: h.communityCardBody, photo: DASHBOARD_PHOTOS.community },
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
          <Link key={c.href} href={c.href} className="group">
            <Card className="relative h-44 overflow-hidden border-none shadow-none transition-transform group-hover:-translate-y-0.5">
              <Image
                src={c.photo}
                alt=""
                fill
                sizes="(min-width: 640px) 300px, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <CardContent className="relative flex h-full flex-col justify-between p-4">
                <span className="ml-auto flex size-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
                  <ArrowRight className="size-3.5" />
                </span>
                <div>
                  <p className="font-heading text-base font-semibold text-white">{c.title}</p>
                  <p className="mt-0.5 text-xs text-white/80">{c.body}</p>
                </div>
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
