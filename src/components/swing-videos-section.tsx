"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SwingVideoUploader } from "@/components/swing-video-uploader";
import { SwingVideoList, type SwingVideoItem } from "@/components/swing-video-list";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function SwingVideosSection({
  videos,
  t,
  dateLocale,
}: {
  videos: SwingVideoItem[];
  t: Dictionary["swingVideos"];
  dateLocale: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">{t.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <SwingVideoUploader t={t} onSaved={() => router.refresh()} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 font-heading text-lg">{t.yourVideos}</h2>
        <SwingVideoList videos={videos} t={t} dateLocale={dateLocale} />
      </div>
    </div>
  );
}
