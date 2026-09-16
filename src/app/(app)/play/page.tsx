import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Users, ArrowRight } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { listGamesForUser } from "@/lib/data/games";
import { getDictionary } from "@/lib/i18n/current-locale";
import { PageTransition } from "@/components/page-transition";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";

const MAX_RECENT_GAMES = 3;

export default async function PlayPage() {
  const userId = await requireUserId();
  const games = await listGamesForUser(userId);
  const { t } = await getDictionary();

  const upcoming = games
    .filter((g) => g.status === "IN_PROGRESS")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, MAX_RECENT_GAMES);

  return (
    <PageTransition>
      <div className="relative h-svh overflow-hidden">
        <Image
          src="/images/play-hero.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="relative flex h-full flex-col px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
          <div className="flex shrink-0 items-start justify-between">
            <Link
              href="/dashboard"
              aria-label={t.nav.home}
              className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm"
            >
              <ChevronLeft className="size-5" />
            </Link>
            <div className="text-right text-[10px] leading-tight font-medium tracking-[0.2em] text-white/85 uppercase">
              <p>Better golf</p>
              <p>a brighter you</p>
              <span className="mt-1 inline-block h-px w-8 bg-white/50" />
            </div>
          </div>

          <div className="mt-4 shrink-0">
            <p className="text-xs font-semibold tracking-[0.25em] text-white/80 uppercase">
              {t.play.heroEyebrow}
            </p>
            <h1 className="mt-1 font-heading text-4xl leading-tight font-bold text-white">
              {t.play.heroHeadline}
            </h1>
            <p className="mt-1.5 text-sm text-white/85">{t.play.heroTagline}</p>
          </div>

          <div className="mt-4 flex shrink-0 flex-col gap-3">
            <Link
              href="/play/new"
              className="flex items-center gap-3 rounded-3xl bg-primary p-4 text-primary-foreground shadow-lg"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-primary">
                <Plus className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">{t.play.createTitle}</span>
                <span className="block text-xs text-primary-foreground/80">
                  {t.play.createDescription}
                </span>
              </span>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                <ArrowRight className="size-4" />
              </span>
            </Link>

            <Link
              href="/play/join"
              className="flex items-center gap-3 rounded-3xl bg-card/95 p-4 shadow-lg backdrop-blur-sm"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <Users className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">{t.play.joinTitle}</span>
                <span className="block text-xs text-muted-foreground">{t.play.joinDescription}</span>
              </span>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                <ArrowRight className="size-4 text-foreground" />
              </span>
            </Link>
          </div>

          <div className="mt-5 flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex shrink-0 items-center justify-between">
              <h2 className="text-sm font-semibold text-white">{t.play.recentGamesTitle}</h2>
              <Link
                href="/play/historial"
                className="flex items-center gap-1 text-xs font-medium text-white/85"
              >
                {t.play.seeAll}
                <ChevronRight className="size-3.5" />
              </Link>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-1">
              {upcoming.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/30 bg-black/10 p-4 text-center text-xs text-white/80 backdrop-blur-sm">
                  {t.play.noActiveGames}
                </div>
              ) : (
                upcoming.map((game) => (
                  <Link
                    key={game.id}
                    href={`/play/${game.id}`}
                    className="flex shrink-0 items-center gap-3 rounded-2xl bg-card/90 p-2.5 shadow-sm backdrop-blur-sm"
                  >
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={DASHBOARD_PHOTOS.play}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{game.course}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {new Date(game.date).toLocaleDateString(t.dateLocale, {
                          weekday: "long",
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        ·{" "}
                        {new Date(game.date).toLocaleTimeString(t.dateLocale, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {game.players.length > 1 && ` · ${game.players.length} ${t.play.players}`}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
