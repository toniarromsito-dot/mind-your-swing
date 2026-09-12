import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasProAccess } from "@/lib/plan";
import { getCurrentLocale } from "@/lib/i18n/current-locale";
import { dictionaries } from "@/lib/i18n/dictionaries";

const ALLOWED_CONTENT_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];
const MAX_SIZE_BYTES = 250 * 1024 * 1024; // ~250MB, suficiente para un clip corto de swing en calidad de móvil

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!hasProAccess(user)) {
    const locale = await getCurrentLocale();
    return NextResponse.json({ error: dictionaries[locale].swingVideos.proRequiredError }, { status: 403 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se ha podido preparar la subida." },
      { status: 400 }
    );
  }
}
