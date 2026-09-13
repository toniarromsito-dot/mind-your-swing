"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Flag, Users, BookOpen, LineChart } from "lucide-react";
import { signOutAction } from "@/actions/profile";
import { Button, buttonVariants } from "@/components/ui/button";
import { MindMark } from "@/components/mind-mark";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type NavLink = {
  href: string;
  label: string;
  icon: typeof Home | null;
};

export function AppShell({
  children,
  user,
  t,
}: {
  children: React.ReactNode;
  user: { name?: string | null; image?: string | null };
  t: Dictionary["nav"];
}) {
  const pathname = usePathname();

  // Las 6 áreas del producto, ninguna oculta (brief: "no elimines ninguna
  // de estas áreas"), como una barra plana de peso igual — sin botón
  // elevado — con el activo tratado con la píldora verde bosque (ref.
  // visual del Home). Admin vive aparte, enlazado solo para
  // administradores desde /perfil — nunca aquí. Perfil se abre tocando
  // el avatar de la cabecera.
  const navLinks: NavLink[] = [
    { href: "/dashboard", label: t.home, icon: Home },
    { href: "/aprende", label: t.learn, icon: BookOpen },
    { href: "/play", label: t.play, icon: Flag },
    { href: "/coach", label: t.coach, icon: null },
    { href: "/insights", label: t.insights, icon: LineChart },
    { href: "/community", label: t.community, icon: Users },
  ];

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function MobileTab({ link }: { link: NavLink }) {
    const active = isActive(link.href);
    return (
      <Link
        href={link.href}
        className={cn(
          "flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10.5px] transition-colors",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full transition-colors",
            active && "bg-primary/10"
          )}
        >
          {link.icon ? (
            <link.icon className="size-[18px]" strokeWidth={active ? 2 : 1.5} />
          ) : (
            <MindMark size="sm" className="size-[18px] bg-transparent text-current" />
          )}
        </span>
        <span className={cn(active && "font-medium")}>{link.label}</span>
      </Link>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
            <Image
              src="/icons/icon-192.png"
              alt="Mind Your Swing"
              width={32}
              height={32}
              className="rounded-[9px]"
            />
            <span className="font-sans text-[11px] font-semibold tracking-[0.18em] whitespace-nowrap text-foreground/80 uppercase">
              Mind Your Swing
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={buttonVariants({
                    variant: active ? "secondary" : "ghost",
                    size: "sm",
                    className: "gap-2 text-sm whitespace-nowrap",
                  })}
                >
                  {link.icon ? <link.icon className="size-4" /> : <MindMark size="sm" className="size-4 bg-transparent text-current" />}
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <Link href="/perfil" aria-label={t.perfil}>
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name ?? t.perfil}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-sm text-secondary-foreground">
                  {user.name?.[0] ?? "?"}
                </div>
              )}
            </Link>
            <form action={signOutAction} className="hidden lg:block">
              <Button type="submit" variant="outline" size="sm">
                {t.cerrarSesion}
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-10">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center px-1 py-1.5">
          {navLinks.map((link) => (
            <MobileTab key={link.href} link={link} />
          ))}
        </div>
      </nav>
    </div>
  );
}
