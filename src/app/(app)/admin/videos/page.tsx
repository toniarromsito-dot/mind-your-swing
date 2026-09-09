import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { listAllSwingVideosForAdmin } from "@/lib/data/swing-videos";
import { getDictionary } from "@/lib/i18n/current-locale";
import { Card, CardContent } from "@/components/ui/card";
import { AdminFeedbackForm } from "@/components/admin-feedback-form";

export default async function AdminVideosPage() {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    redirect("/dashboard");
  }

  const { t } = await getDictionary();
  const videos = await listAllSwingVideosForAdmin();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl">{t.admin.videosTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.admin.videosSubtitle}</p>
      </div>

      {videos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.admin.empty}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {videos.map((video) => (
            <Card key={video.id}>
              <CardContent className="flex flex-col gap-3 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{video.user.name ?? video.user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(video.createdAt).toLocaleDateString(t.dateLocale, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  {video.score != null && (
                    <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
                      {video.score}/100
                    </span>
                  )}
                </div>

                <video src={video.videoUrl} controls className="max-h-72 w-full rounded-lg bg-black" />

                {video.note && <p className="text-sm text-muted-foreground italic">&ldquo;{video.note}&rdquo;</p>}

                {video.aiFeedback && (
                  <p className="rounded-lg bg-secondary/40 p-3 text-sm whitespace-pre-wrap">{video.aiFeedback}</p>
                )}

                <AdminFeedbackForm videoId={video.id} existingFeedback={video.feedback} t={t.admin} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
