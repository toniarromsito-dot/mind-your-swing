import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

let userId: string;
let gameId: string;
let holeId: string;

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: userId } })),
}));

function fakeAnthropicStream(chunks: string[]) {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    on(event: string, cb: (...args: unknown[]) => void) {
      (listeners[event] ??= []).push(cb);
      return this;
    },
    async finalMessage() {
      for (const chunk of chunks) {
        for (const cb of listeners.text ?? []) cb(chunk);
      }
      return { content: [{ type: "text", text: chunks.join("") }] };
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma tipada para poder inspeccionar streamMock.mock.calls
const streamMock = vi.fn((_opts: { system: string }) => fakeAnthropicStream(["Respira ", "hondo."]));

vi.mock("@/lib/anthropic", () => ({
  anthropic: { messages: { stream: streamMock } },
  COACH_MODEL: "test-model",
  COACH_MAX_TOKENS: 500,
}));

const { POST } = await import("./route");

async function readNdjson(res: Response) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const events: unknown[] = [];
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) events.push(JSON.parse(line));
    }
  }
  return events;
}

function chatRequest(body: unknown) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat (integración, DB real + Anthropic mockeado)", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `chat-test-${Date.now()}@example.com`, name: "Chat Tester" },
    });
    userId = user.id;

    const game = await prisma.game.create({
      data: {
        course: "Campo del Chat",
        mode: "SOLO",
        date: new Date(),
        inviteCode: `chat-test-${Date.now()}`,
        holes: { create: [{ number: 1, par: 4 }] },
        players: { create: { userId } },
      },
      include: { holes: true },
    });
    gameId = game.id;
    holeId = game.holes[0].id;
  });

  afterEach(() => {
    streamMock.mockClear();
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("responde 400 si el mensaje está vacío", async () => {
    const res = await POST(chatRequest({ gameId, content: "   " }));
    expect(res.status).toBe(400);
  });

  it("responde 404 si la partida no pertenece al usuario", async () => {
    const res = await POST(chatRequest({ gameId: "no-existe", content: "hola" }));
    expect(res.status).toBe(404);
  });

  it("responde 503 si falta ANTHROPIC_API_KEY y no persiste el mensaje", async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const res = await POST(chatRequest({ gameId, content: "Estoy nervioso" }));
    expect(res.status).toBe(503);

    const messages = await prisma.message.findMany({ where: { gameId } });
    expect(messages).toHaveLength(0);

    if (prev) process.env.ANTHROPIC_API_KEY = prev;
  });

  it("hace streaming de la respuesta y persiste ambos mensajes", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    const res = await POST(chatRequest({ gameId, holeId, content: "Estoy nervioso" }));
    expect(res.status).toBe(200);

    const events = await readNdjson(res);
    const tokens = events.filter((e): e is { type: "token"; text: string } => (e as { type: string }).type === "token");
    expect(tokens.map((t) => t.text).join("")).toBe("Respira hondo.");
    expect(events.some((e) => (e as { type: string }).type === "done")).toBe(true);

    const messages = await prisma.message.findMany({ where: { gameId }, orderBy: { createdAt: "asc" } });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "USER", content: "Estoy nervioso" });
    expect(messages[1]).toMatchObject({ role: "ASSISTANT", content: "Respira hondo." });

    expect(streamMock).toHaveBeenCalledTimes(1);
    expect(streamMock.mock.calls[0][0].system).toContain("Campo del Chat");
  });

  it("funciona en modo standalone, sin ninguna partida activa", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    const res = await POST(chatRequest({ content: "Necesito hablar" }));
    expect(res.status).toBe(200);
    await readNdjson(res);

    const messages = await prisma.message.findMany({ where: { userId, gameId: null } });
    expect(messages.length).toBeGreaterThan(0);
  });
});
