import Link from "next/link";
import Image from "next/image";
import { Home, History, User, Flag } from "lucide-react";
import { signOutAction } from "@/actions/profile";
import { Button, buttonVariants } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/historial", label: "Historial", icon: History },
  { href: "/perfil", label: "Perfil", icon: User },
];

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name?: string | null; image?: string | null };
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Flag className="size-5 text-primary" />
            <span className="font-heading text-lg">Mind Your Swing</span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-2 text-sm" })}
              >
                <link.icon className="size-4" />
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name ?? "Perfil"}
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-sm text-secondary-foreground">
                {user.name?.[0] ?? "?"}
              </div>
            )}
            <form action={signOutAction} className="hidden sm:block">
              <Button type="submit" variant="outline" size="sm">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pb-10">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-around px-2 py-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col items-center gap-1 rounded-lg px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
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
