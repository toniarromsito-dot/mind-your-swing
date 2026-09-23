import Image from "next/image";
import Link from "next/link";
import { BarChart3, Camera, ChevronLeft, Dumbbell } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { listMySwingVideos } from "@/lib/data/swing-videos";
import { getDictionary } from "@/lib/i18n/current-locale";
import { SwingVideoList } from "@/components/swing-video-list";
import { SwingRecordFlow } from "@/components/swing-record-flow";
import { ProUpsell } from "@/components/pro-upsell";
import { MindMark } from "@/components/mind-mark";
import { canUseFeature } from "@/lib/entitlements";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";

// Inmersiva como Coach/Aprende/Home (ver isImmersivePage en app-shell.tsx):
// se llega aquí desde el acceso rápido "Análisis de swing" de Coach, así que
// necesita la misma cabecera (flecha + logo grande) para no sentirse como
// una pantalla distinta. El resto del flujo (subir vídeo, lista) es largo
// y no cabe en una pantalla, así que aquí sí se permite scroll normal.
function VideosHeader({ backLabel }: { backLabel: string }) {
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/aprende"
        aria-label={backLabel}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground"
      >
        <ChevronLeft className="size-5" />
      </Link>
      <div className="flex flex-col leading-none">
        <span className="font-sans text-2xl font-bold tracking-tight text-primary">
          MYS
        </span>
        <span className="mt-0.5 text-xs text-muted-foreground">
          Mind Your Swing
        </span>
      </div>
    </div>
  );
}

function BenefitRow({
  icon: Icon,
  mind,
  title,
  body,
}: {
  icon?: LucideIcon;
  mind?: boolean;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      {mind ? (
        <MindMark size="md" />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {Icon && <Icon className="size-4" />}
        </span>
      )}
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

export default async function SwingVideosPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true, email: true } });
  const { t } = await getDictionary();

  if (!canUseFeature(user, "SWING_AI")) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6">
        <VideosHeader backLabel={t.nav.learn} />
        <ProUpsell t={t.landing} />
      </div>
    );
  }

  const videos = await listMySwingVideos(userId);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6">
      <VideosHeader backLabel={t.nav.learn} />

      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t.swingVideos.heroTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.swingVideos.heroSubtitle}</p>
      </div>

      <div className="relative h-72 overflow-hidden rounded-3xl shadow-md sm:h-80">
        <Image
          src={DASHBOARD_PHOTOS.learn}
          alt=""
          fill
          sizes="(min-width: 640px) 600px, 100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-5">
          <span className="ml-auto rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {t.swingVideos.progressPill}
          </span>
          <a
            href="#record"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3.5 text-sm font-semibold text-primary shadow-sm sm:w-auto"
          >
            <Camera className="size-4" />
            {t.swingVideos.recordCta}
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <BenefitRow
          icon={BarChart3}
          title={t.swingVideos.benefitAnalysisTitle}
          body={t.swingVideos.benefitAnalysisBody}
        />
        <BenefitRow
          icon={Dumbbell}
          title={t.swingVideos.benefitExercisesTitle}
          body={t.swingVideos.benefitExercisesBody}
        />
        <BenefitRow mind title={t.swingVideos.benefitMindTitle} body={t.swingVideos.benefitMindBody} />
      </div>

      <div id="record" className="scroll-mt-6">
        <SwingRecordFlow t={t.swingVideos} />
      </div>

      <p className="rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
        {t.swingVideos.disclaimer}
      </p>

      {videos.length > 0 && (
        <div>
          <h2 className="mb-3 font-heading text-lg">{t.swingVideos.yourVideos}</h2>
          <SwingVideoList
            videos={videos.map((v) => ({
              id: v.id,
              videoUrl: v.videoUrl,
              note: v.note,
              score: v.score,
              aiFeedback: v.aiFeedback,
              feedback: v.feedback,
              status: v.status,
              createdAt: v.createdAt.toISOString(),
              metrics: v.metrics,
            }))}
            t={t.swingVideos}
            dateLocale={t.dateLocale}
          />
        </div>
      )}
    </div>
  );
}
