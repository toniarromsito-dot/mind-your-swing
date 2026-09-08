"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE } from "@/lib/i18n/current-locale";
import type { Locale } from "@/lib/i18n/dictionaries";

/** Solo para páginas públicas (sin sesión); con sesión, el idioma vive en User.language. */
export async function setLocaleCookie(locale: Locale) {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/");
}
