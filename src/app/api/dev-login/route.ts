import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Ruta de solo-desarrollo para iniciar sesión sin pasar por Google OAuth.
 * Útil para pruebas manuales y end-to-end donde no hay credenciales OAuth
 * reales disponibles. Devuelve 404 fuera de desarrollo: nunca se expone
 * en producción (ver README → "Pruebas").
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const email = url.searchParams.get("email") || "playtester@example.com";

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Jugador de Prueba",
    },
  });

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires },
  });

  const response = NextResponse.redirect(new URL("/dashboard", req.url));
  response.cookies.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });
  return response;
}
