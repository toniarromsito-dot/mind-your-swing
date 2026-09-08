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
}: {
  title: string;
  description: string;
  url: string | null;
  locked?: boolean;
  lockedMessage: string;
  comingSoonLabel: string;
}) {
  const embedUrl = url ? getYouTubeEmbedUrl(url) : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative flex aspect-video items-center justify-center bg-secondary/40">
        {locked ? (
          <Link
            href="/perfil"
            className="flex flex-col items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Lock className="size-6" />
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
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <PlayCircle className="size-6" />
            {comingSoonLabel}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-heading text-base">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
