"use server";

import { randomUUID } from "node:crypto";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}

/**
 * Como signInWithGoogle, pero volviendo a una ruta concreta tras el login
 * en vez de al dashboard — usado desde la pantalla de unirse a una partida
 * (/play/join/[code]) cuando el invitado no tiene sesión, para que no
 * pierda la invitación al iniciar sesión o registrarse. Se usa con
 * .bind(null, callbackUrl), nunca directamente en un <form action>, porque
 * un <form> sin bind pasaría el FormData del envío como si fuera la URL.
 */
export async function signInWithGoogleAndRedirect(callbackUrl: string) {
  await signIn("google", { redirectTo: callbackUrl });
}

// Usado solo por /mobile-login (app nativa) — ver capacitor.config.ts y
// src/app/app-entry. Todo ese login ocurre dentro de una Custom Tab, así
// que las cookies de Google Auth se fijan y se leen en el mismo sitio, sin
// el salto WebView → Chrome que rompe la verificación PKCE.
export async function mobileSignInWithGoogle() {
  await signIn("google", { redirectTo: "/mobile-bridge" });
}

// Llamado desde /mobile-bridge, ya autenticado dentro de esa misma Custom
// Tab. Mintea un token de un solo uso para devolver el control a la app
// nativa (deep link) sin exponer el sessionToken real. Server Action, no
// lógica embebida en el render del Server Component, porque necesita
// escribir en la base de datos y usar un timestamp — el render de un
// componente debe ser puro.
export async function createMobileHandoff(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return null;

  const dbSession = await prisma.session.findFirst({
    where: { userId: session.user.id },
    orderBy: { expires: "desc" },
  });
  if (!dbSession) return null;

  const token = randomUUID();
  await prisma.mobileHandoff.create({
    data: { token, sessionToken: dbSession.sessionToken, expires: new Date(Date.now() + 60_000) },
  });
  return token;
}
