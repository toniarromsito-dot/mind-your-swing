"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

export function LandingMobileNav({
  links,
  signInLabel,
  ctaLabel,
  onSignIn,
}: {
  links: { href: string; label: string }[];
  signInLabel: string;
  ctaLabel: string;
  onSignIn: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 items-center justify-center rounded-full text-neutral-200"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-[64px] z-20 border-t border-neutral-800 bg-neutral-950 px-6 py-6">
          <nav className="flex flex-col gap-4 text-sm text-neutral-300">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="py-1">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-5 flex flex-col gap-3">
            <form action={onSignIn}>
              <button type="submit" className="w-full py-2 text-left text-sm text-neutral-300">
                {signInLabel}
              </button>
            </form>
            <form action={onSignIn}>
              <button type="submit" className="w-full rounded-full bg-white py-2.5 text-sm font-medium text-neutral-900">
                {ctaLabel}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
