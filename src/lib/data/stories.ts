import { prisma } from "@/lib/prisma";

export function listStories() {
  return prisma.story.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { id: true, name: true, image: true } } },
  });
}
