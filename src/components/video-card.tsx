import Link from "next/link";
import { Lock, PlayCircle } from "lucide-react";
import { getYouTubeEmbedUrl } from "@/lib/youtube";

export function VideoCard({
  title,
  description,
  url,
  locked,
  lockedMessage,
  comingSoonLabel,
  proBadgeLabel,
}: {
  title: string;
  description: string;
  url: string | null;
  locked?: boolean;
  lockedMessage: string;
  comingSoonLabel: string;
  /** Solo se muestra sobre la miniatura de un vídeo Pro — nunca fabricado, refleja el mismo `locked` que ya bloquea el vídeo. */
  proBadgeLabel?: string;
}) {
  const embedUrl = url ? getYouTubeEmbedUrl(url) : null;

  return (
    <div className="overflow-hidden rounded-3xl bg-card shadow-sm">
      <div className="relative aspect-video bg-secondary/50">
        {locked ? (
          <Link
            href="/perfil"
            className="flex size-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground active:opacity-70"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-background/80 text-foreground">
              <Lock className="size-5" strokeWidth={1.6} />
            </span>
            {lockedMessage}
          </Link>
        ) : embedUrl ? (
          <iframe
            src={embedUrl}
            title={title}
            className="size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="flex size-11 items-center justify-center rounded-full bg-background/80 text-foreground">
              <PlayCircle className="size-5" strokeWidth={1.6} />
            </span>
            {comingSoonLabel}
          </div>
        )}
        {locked && proBadgeLabel && (
          <span className="absolute top-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium tracking-[0.08em] text-white uppercase backdrop-blur-sm">
            {proBadgeLabel}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-heading text-base font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
