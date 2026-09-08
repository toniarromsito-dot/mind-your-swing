"use client";

import { useTransition } from "react";
import { Globe } from "lucide-react";
import { setLocaleCookie } from "@/actions/locale";
import type { Locale } from "@/lib/i18n/dictionaries";

export function LanguageToggle({ locale, label }: { locale: Locale; label: string }) {
  const [isPending, startTransition] = useTransition();
  const nextLocale: Locale = locale === "es" ? "en" : "es";

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => setLocaleCookie(nextLocale))}
      className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/60 disabled:opacity-50"
    >
      <Globe className="size-3.5" />
      {label}
    </button>
  );
}
