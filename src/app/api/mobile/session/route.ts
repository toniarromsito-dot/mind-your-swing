import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Canjea el token de un solo uso de /mobile-bridge por la sesión real,
 * fijando la misma cookie que usa NextAuth (base de datos) directamente en
 * quien haga esta petición — pensado para que la llame el WebView de la
 * app nativa (window.location.href), así el Set-Cookie aterriza en su
 * propio almacén de cookies y no en el del navegador del sistema donde se
 * completó el login de Google.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const fallback = NextResponse.redirect(new URL("/", request.url));
  if (!token) return fallback;

  const handoff = await prisma.mobileHandoff.findUnique({ where: { token } });
  await prisma.mobileHandoff.delete({ where: { token } }).catch(() => {});
  if (!handoff || handoff.expires < new Date()) return fallback;

  const dbSession = await prisma.session.findUnique({ where: { sessionToken: handoff.sessionToken } });
  if (!dbSession || dbSession.expires < new Date()) return fallback;

  const isHttps = request.nextUrl.protocol === "https:";
  const cookieName = isHttps ? "__Secure-authjs.session-token" : "authjs.session-token";

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set(cookieName, handoff.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isHttps,
    expires: dbSession.expires,
  });
  return response;
}
