import { prisma } from "@/lib/prisma";

export function listMySwingVideos(userId: string) {
  return prisma.swingVideo.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export function listAllSwingVideosForAdmin() {
  return prisma.swingVideo.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });
}
