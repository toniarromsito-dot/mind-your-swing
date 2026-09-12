"use client";

import { useTransition } from "react";
import { Globe, Check } from "lucide-react";
import { setLocaleCookie } from "@/actions/locale";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { Locale } from "@/lib/i18n/dictionaries";

// Nombres propios de cada idioma en sí mismo (Español/English/Deutsch) —
// no se traducen, igual que "MYS" o el nombre de la marca no cambian de un
// idioma a otro.
const LANGUAGES: { code: Locale; name: string }[] = [
  { code: "es", name: "Español" },
  { code: "en", name: "English" },
  { code: "de", name: "Deutsch" },
];

export function LanguageToggle({ locale, label }: { locale: Locale; label: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/60 disabled:opacity-50"
      >
        <Globe className="size-3.5" />
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => startTransition(() => setLocaleCookie(lang.code))}
            className="flex items-center justify-between gap-3"
          >
            {lang.name}
            {lang.code === locale && <Check className="size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
