import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Contraparte nativa de signInWithGoogle: la app llama aquí con el idToken
 * que devuelve Credential Manager (ver native-onboarding.tsx), sin pasar
 * por ningún navegador. Crea el mismo User/Account que crearía el
 * PrismaAdapter de NextAuth para el login web con Google, así que da igual
 * por qué camino haya entrado el jugador la primera vez.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const idToken = body?.idToken;
  if (typeof idToken !== "string") {
    return NextResponse.json({ error: "missing idToken" }, { status: 400 });
  }

  const payload = await client
    .verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID })
    .then((ticket) => ticket.getPayload())
    .catch(() => null);

  if (!payload?.sub || !payload.email || !payload.email_verified) {
    return NextResponse.json({ error: "invalid idToken" }, { status: 401 });
  }
  const { sub, email, name, picture } = payload;

  const existingAccount = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: sub } },
  });

  const user = existingAccount
    ? await prisma.user.findUniqueOrThrow({ where: { id: existingAccount.userId } })
    : await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, name: name ?? null, image: picture ?? null, emailVerified: new Date() },
      });

  if (!existingAccount) {
    await prisma.account.create({
      data: { userId: user.id, type: "oidc", provider: "google", providerAccountId: sub },
    });
  }

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_MS);
  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } });

  const isHttps = request.nextUrl.protocol === "https:";
  const cookieName = isHttps ? "__Secure-authjs.session-token" : "authjs.session-token";

  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isHttps,
    expires,
  });
  return response;
}
