"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Flag, Users, BookOpen, LineChart } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { MindMark } from "@/components/mind-mark";
import { AdBanner } from "@/components/ad-banner";
import { SignOutForm } from "@/components/sign-out-form";
import { isAdEligible, AD_BANNER_RESERVED_HEIGHT_PX } from "@/lib/ads/policy";
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
  adFree,
}: {
  children: React.ReactNode;
  user: { name?: string | null; image?: string | null };
  t: Dictionary["nav"];
  /** Fase 11F — true si el usuario no debe ver anuncios (PRO/owner), calculado server-side en (app)/layout.tsx. */
  adFree: boolean;
}) {
  const pathname = usePathname();

  // Home, el menú de Aprende, Coach y el hub de Jugar son pantallas
  // inmersivas, sin cabecera ni barra inferior: cada una dibuja su propia
  // marca (logo grande, flecha de atrás salvo en Home) sobre la foto a
  // pantalla completa. /aprende/videos y /play/join también lo son, aunque
  // no son las pantallas principales: se llega a ellas desde un acceso
  // rápido de una pantalla inmersiva y necesitan la misma cabecera para no
  // sentirse como una pantalla distinta. Toda la sección Aprende es
  // inmersiva (ver auditoría de diseño): sus subpáginas dibujan su propia
  // cabecera ligera (AprendeBackLink + título) en vez de heredar el header
  // y la barra inferior globales, que las hacían sentir como una pantalla
  // heredada de una versión anterior. Los 4 ejercicios guiados ya se
  // dibujaban a pantalla completa (GuidedExercise, z-40) por encima del
  // chrome global; entran aquí también para no dejar ese chrome montado
  // (aunque invisible) detrás suyo. /community/friends, /community/ranking y
  // /community/tournaments entran por el mismo motivo (ver auditorías de
  // Comunidad, Clasificación y Torneos): cada una dibuja su propia flecha de
  // vuelta en vez de heredar el chrome global. El resto de subpáginas ajenas
  // a Aprende/Comunidad (historial de Jugar...) sigue con el chrome normal.
  const isImmersivePage =
    pathname === "/dashboard" ||
    pathname === "/aprende" ||
    pathname === "/aprende/ejercicios" ||
    pathname === "/aprende/ejercicios/reset-mental" ||
    pathname === "/aprende/ejercicios/respiracion" ||
    pathname === "/aprende/ejercicios/visualizacion" ||
    pathname === "/aprende/rutina" ||
    pathname === "/aprende/explora" ||
    pathname === "/aprende/academia" ||
    pathname === "/aprende/tutoriales" ||
    pathname === "/aprende/videos" ||
    pathname === "/coach" ||
    pathname === "/play" ||
    pathname === "/play/join" ||
    pathname === "/play/new" ||
    (pathname.startsWith("/play/") && pathname.endsWith("/resumen")) ||
    pathname === "/community" ||
    pathname === "/community/friends" ||
    pathname === "/community/ranking" ||
    pathname === "/community/tournaments";

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

  // Fase 11F — misma función pura que decide si AdBanner puede mostrar un
  // anuncio de verdad; aquí solo se usa para reservar el espacio visual
  // correspondiente y evitar que el contenido salte al cargar el banner.
  const adEligible = isAdEligible(pathname, adFree);
  const adReservedPadding = adEligible ? AD_BANNER_RESERVED_HEIGHT_PX : 0;

  function MobileTab({ link }: { link: NavLink }) {
    const active = isActive(link.href);
    return (
      <Link
        href={link.href}
        className={cn(
          "flex flex-1 flex-col items-center gap-1 py-1.5 text-[10.5px] transition-colors",
          active
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {link.icon ? (
          <link.icon className="size-[19px]" strokeWidth={active ? 2 : 1.5} />
        ) : (
          <MindMark
            size="sm"
            className="size-[19px] bg-transparent text-current"
          />
        )}
        <span className={cn(active && "font-semibold")}>{link.label}</span>
        <span
          className={cn(
            "mt-0.5 size-1 rounded-full",
            active ? "bg-primary" : "bg-transparent"
          )}
        />
      </Link>
    );
  }

  if (isImmersivePage) {
    return (
      <div className="min-h-svh bg-background" style={{ paddingBottom: adReservedPadding }}>
        {children}
        <AdBanner adFree={adFree} hasBottomNav={false} />
      </div>
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
                  {link.icon ? (
                    <link.icon className="size-4" />
                  ) : (
                    <MindMark
                      size="sm"
                      className="size-4 bg-transparent text-current"
                    />
                  )}
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
            <SignOutForm className="hidden lg:block">
              <Button type="submit" variant="outline" size="sm">
                {t.cerrarSesion}
              </Button>
            </SignOutForm>
          </div>
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom)+var(--ad-pad))] sm:px-6 sm:pb-[calc(2.5rem+var(--ad-pad))]"
        style={{ "--ad-pad": `${adReservedPadding}px` } as React.CSSProperties}
      >
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center px-1 py-1.5">
          {navLinks.map((link) => (
            <MobileTab key={link.href} link={link} />
          ))}
        </div>
      </nav>

      <AdBanner adFree={adFree} hasBottomNav={true} />
    </div>
  );
}
