import Link from "next/link";
import Image from "next/image";
import { Home, Flag, Brain, Users, User } from "lucide-react";
import { signOutAction } from "@/actions/profile";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function AppShell({
  children,
  user,
  t,
}: {
  children: React.ReactNode;
  user: { name?: string | null; image?: string | null };
  t: Dictionary["nav"];
}) {
  // Navegación reducida a lo esencial (brief: "menos opciones = mejor").
  // Coach sigue accesible desde la tarjeta "Aprender" del dashboard;
  // Admin vive aparte, enlazado solo para administradores desde /perfil —
  // nunca en la navegación de un usuario normal.
  const navLinks = [
    { href: "/dashboard", label: t.home, icon: Home },
    { href: "/play", label: t.play, icon: Flag },
    { href: "/mind", label: t.coach, icon: Brain },
    { href: "/community", label: t.community, icon: Users },
    { href: "/perfil", label: t.perfil, icon: User },
  ];

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
            <Image
              src="/icons/icon-192.png"
              alt="Mind Your Swing"
              width={32}
              height={32}
              className="rounded-[9px]"
            />
            <span className="font-heading text-lg font-semibold tracking-tight whitespace-nowrap">MYS</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-2 text-sm whitespace-nowrap" })}
              >
                <link.icon className="size-4" />
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
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
            <form action={signOutAction} className="hidden lg:block">
              <Button type="submit" variant="outline" size="sm">
                {t.cerrarSesion}
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pb-10">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-around px-1 py-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <link.icon className="size-5" />
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
