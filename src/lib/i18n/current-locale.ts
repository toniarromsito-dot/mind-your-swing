import { cache } from "react";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { locales, dictionaries, type Locale } from "./dictionaries";

export const LOCALE_COOKIE = "locale";

function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/**
 * Primera visita sin cookie ni sesión: mira el Accept-Language del
 * navegador (ej. "de-DE,de;q=0.9,en;q=0.8") y usa el primer idioma que
 * soportamos. Cualquier otro idioma cae a español, nunca a inglés por
 * defecto — así un visitante francés o italiano ve español, no un tercer
 * idioma al azar.
 */
function detectFromAcceptLanguage(header: string | null): Locale {
  if (!header) return "es";
  const preferred = header
    .split(",")
    .map((part) => part.split(";")[0].trim().slice(0, 2).toLowerCase());
  for (const lang of preferred) {
    if (isLocale(lang)) return lang;
  }
  return "es";
}

/**
 * Resuelve el idioma actual: si hay sesión, manda la preferencia guardada
 * del usuario (User.language); si no, la cookie del toggle de la landing;
 * si tampoco hay cookie (primera visita), el idioma del navegador. cache()
 * evita repetir la consulta/lectura dentro de la misma petición.
 */
export const getCurrentLocale = cache(async (): Promise<Locale> => {
  const session = await auth();
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { language: true },
    });
    if (isLocale(user?.language)) return user.language;
    return "es";
  }

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const headerStore = await headers();
  return detectFromAcceptLanguage(headerStore.get("accept-language"));
});

export async function getDictionary() {
  const locale = await getCurrentLocale();
  return { locale, t: dictionaries[locale] };
}
