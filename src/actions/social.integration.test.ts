import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { listStoriesForFeed } from "@/lib/data/social";

/**
 * Fase 11C — Comunidad: FREE publica/lee posts pero nunca respuestas; PRO
 * ve también respuestas/comentarios. El gate real vive en dos sitios
 * distintos y ambos se prueban aquí:
 *  - lectura: listStoriesForFeed (capa de datos) — el contenido de los
 *    comentarios ni siquiera se selecciona de Postgres para un viewer FREE.
 *  - escritura: addComment (Server Action) — rechazada server-side antes de
 *    tocar la base de datos, no solo oculta en la UI.
 */

let userId = "";
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { addComment } = await import("@/actions/social");

describe("Comunidad — entitlement de respuestas/comentarios (integración, DB real)", () => {
  const userIds: string[] = [];
  const storyIds: string[] = [];

  async function makeUser(label: string, plan: "FREE" | "PRO" = "FREE") {
    const user = await prisma.user.create({
      data: { email: `social-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`, name: label, plan },
    });
    userIds.push(user.id);
    return user;
  }

  async function makeStoryWithComment(authorId: string, commenterId: string, content: string) {
    const story = await prisma.story.create({
      data: { userId: authorId, title: "Post de prueba", content: "Contenido del post" },
    });
    storyIds.push(story.id);
    await prisma.comment.create({ data: { storyId: story.id, userId: commenterId, content } });
    return story;
  }

  afterEach(() => {
    userId = "";
  });

  afterAll(async () => {
    await prisma.comment.deleteMany({ where: { storyId: { in: storyIds } } });
    await prisma.like.deleteMany({ where: { storyId: { in: storyIds } } });
    await prisma.story.deleteMany({ where: { id: { in: storyIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("8. FREE → Community posts OK: sigue leyendo posts con normalidad (título/contenido/autor)", async () => {
    const author = await makeUser("post-author");
    const free = await makeUser("post-reader");
    const story = await prisma.story.create({
      data: { userId: author.id, title: "Mi ronda de hoy", content: "Contenido real" },
    });
    storyIds.push(story.id);

    const feed = await listStoriesForFeed("all", free.id, false);
    const found = feed.find((s) => s.id === story.id);
    expect(found?.title).toBe("Mi ronda de hoy");
    expect(found?.content).toBe("Contenido real");
  });

  it("9/29/32. FREE → Community comments DENIED: el contenido de las respuestas ni se trae de la base de datos", async () => {
    const author = await makeUser("comment-author");
    const commenter = await makeUser("comment-writer", "PRO");
    const free = await makeUser("comment-reader-free");
    const secretText = "Contenido secreto de una respuesta Pro que FREE nunca debe recibir";
    const story = await makeStoryWithComment(author.id, commenter.id, secretText);

    const feed = await listStoriesForFeed("all", free.id, false);
    const found = feed.find((s) => s.id === story.id);

    expect(found?.comments.items).toBeNull(); // nunca se selecciona el contenido, no solo "se oculta"
    expect(found?.comments.count).toBe(1); // el recuento sí es visible como incentivo
    expect(JSON.stringify(feed)).not.toContain(secretText); // el texto real nunca sale hacia el caller
  });

  it("10. PRO → Community comments OK: recibe el contenido real de las respuestas", async () => {
    const author = await makeUser("comment-author-2");
    const commenter = await makeUser("comment-writer-2", "PRO");
    const pro = await makeUser("comment-reader-pro", "PRO");
    const text = "Respuesta visible para Pro";
    const story = await makeStoryWithComment(author.id, commenter.id, text);

    const feed = await listStoriesForFeed("all", pro.id, true);
    const found = feed.find((s) => s.id === story.id);

    expect(found?.comments.items).not.toBeNull();
    expect(found?.comments.items?.[0]?.content).toBe(text);
  });

  it("30. FREE no puede ejecutar addComment (Server Action Pro) directamente, saltándose la UI", async () => {
    const author = await makeUser("direct-call-author");
    const free = await makeUser("direct-call-free");
    const story = await prisma.story.create({
      data: { userId: author.id, title: "Post", content: "Contenido" },
    });
    storyIds.push(story.id);

    userId = free.id;
    await expect(addComment(story.id, "Intento de comentario de un FREE")).rejects.toThrow(/pro/i);

    const stored = await prisma.comment.count({ where: { storyId: story.id } });
    expect(stored).toBe(0); // el intento nunca llegó a crear nada
  });

  it("PRO sí puede ejecutar addComment con normalidad", async () => {
    const author = await makeUser("direct-call-author-2");
    const pro = await makeUser("direct-call-pro", "PRO");
    const story = await prisma.story.create({
      data: { userId: author.id, title: "Post", content: "Contenido" },
    });
    storyIds.push(story.id);

    userId = pro.id;
    await addComment(story.id, "Comentario real de un Pro");

    const stored = await prisma.comment.findFirst({ where: { storyId: story.id } });
    expect(stored?.content).toBe("Comentario real de un Pro");
  });
});
