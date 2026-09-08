import { cache } from "react";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dictionaries, type Locale } from "./dictionaries";

export const LOCALE_COOKIE = "locale";

/**
 * Resuelve el idioma actual: si hay sesión, manda la preferencia guardada
 * del usuario (User.language); si no, la cookie del toggle de la landing;
 * por defecto, español. cache() evita repetir la consulta dentro de la
 * misma petición.
 */
export const getCurrentLocale = cache(async (): Promise<Locale> => {
  const session = await auth();
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { language: true },
    });
    if (user?.language === "en") return "en";
    return "es";
  }

  const cookieStore = await cookies();
  return cookieStore.get(LOCALE_COOKIE)?.value === "en" ? "en" : "es";
});

export async function getDictionary() {
  const locale = await getCurrentLocale();
  return { locale, t: dictionaries[locale] };
}
