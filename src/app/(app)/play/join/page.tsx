import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getDictionary } from "@/lib/i18n/current-locale";
import { PageTransition } from "@/components/page-transition";
import { JoinByCodeForm } from "@/components/join-by-code-form";

export default async function JoinByCodePage() {
  const { t } = await getDictionary();

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
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/play"
              aria-label={t.play.backLabel}
              className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm"
            >
              <ChevronLeft className="size-5" />
            </Link>
            <span className="text-sm font-medium text-white">{t.play.backLabel}</span>
          </div>

          <div className="mt-6 shrink-0">
            <p className="text-xs font-semibold tracking-[0.25em] text-white/80 uppercase">
              {t.play.heroEyebrow}
            </p>
            <h1 className="mt-1 font-heading text-4xl leading-tight font-bold text-white">
              {t.joinGame.heroTitle}
            </h1>
            <p className="mt-1.5 text-sm text-white/85">{t.joinGame.heroSubtitle}</p>
          </div>

          <div className="mt-6">
            <JoinByCodeForm t={t.joinGame} />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
