"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Browser } from "@capacitor/browser";
import { MindMark } from "@/components/mind-mark";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const ONBOARDED_KEY = "mys_onboarded";
const SLIDE_COUNT = 4;
// El índice del "slide" de CTA dentro del mismo carrusel de scroll-snap —
// así "Saltar" y llegar al final del swipe hacen exactamente lo mismo.
const CTA_INDEX = SLIDE_COUNT;

/**
 * Onboarding de la app nativa (solo /app-entry, nunca la web pública):
 * antes de pedir login, 4 pantallas cortas explican qué es Mind Your
 * Swing en ~10-15 segundos. Swipe nativo vía scroll-snap (sin librería de
 * gestos), "Saltar" salta directo al CTA, y solo se muestra una vez por
 * dispositivo (localStorage).
 */
export function NativeOnboarding({ t }: { t: Dictionary["onboarding"] }) {
  const [alreadyOnboarded, setAlreadyOnboarded] = useState<boolean | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // localStorage no existe durante el render en servidor — leerlo aquí
    // (no en el cuerpo del componente) evita un mismatch de hidratación.
    let onboarded = false;
    try {
      onboarded = localStorage.getItem(ONBOARDED_KEY) === "1";
    } catch {
      // localStorage no disponible: se comporta como si fuera la primera vez
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con localStorage, no re-deriva estado de React
    setAlreadyOnboarded(onboarded);
  }, []);

  useEffect(() => {
    if (activeIndex !== CTA_INDEX) return;
    try {
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      // no pasa nada si no se puede persistir — solo se repetiría el onboarding
    }
  }, [activeIndex]);

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  function goToCta() {
    scrollerRef.current?.scrollTo({ left: CTA_INDEX * (scrollerRef.current.clientWidth ?? 0), behavior: "smooth" });
  }

  function signIn() {
    Browser.open({ url: "https://mind-your-swing.vercel.app/mobile-login" });
  }

  if (alreadyOnboarded) {
    return <CtaScreen t={t} onSignIn={signIn} />;
  }
  if (alreadyOnboarded === null) return null; // evita el parpadeo del carrusel antes de leer localStorage

  return (
    <div className="relative min-h-svh">
      {activeIndex < CTA_INDEX && (
        <button
          type="button"
          onClick={goToCta}
          className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 z-10 rounded-full bg-black/25 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm"
        >
          {t.skip}
        </button>
      )}

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex h-svh snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        <Slide photo={DASHBOARD_PHOTOS.coach}>
          <p className="font-heading text-3xl font-semibold tracking-[0.2em] text-white">{t.wordmark}</p>
          <p className="mt-1 text-xs font-medium tracking-[0.35em] text-white/85">{t.fullName}</p>
        </Slide>
        <Slide photo={DASHBOARD_PHOTOS.play}>
          <SlideCopy title={t.slide2Title} body={t.slide2Body} />
        </Slide>
        <Slide photo={DASHBOARD_PHOTOS.learn}>
          <SlideCopy title={t.slide3Title} body={t.slide3Body} />
        </Slide>
        <Slide>
          <MindMark size="lg" className="mb-4" />
          <SlideCopy title={t.slide4Title} body={t.slide4Body} light={false} />
        </Slide>
        <div className="flex h-svh w-full shrink-0 snap-start items-center justify-center bg-background">
          <CtaScreen t={t} onSignIn={signIn} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] flex justify-center gap-1.5">
        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === activeIndex ? "w-5 bg-white" : "w-1.5 bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function Slide({ photo, children }: { photo?: string; children: React.ReactNode }) {
  if (!photo) {
    return (
      <div className="flex h-svh w-full shrink-0 snap-start flex-col items-center justify-center bg-background px-8 text-center">
        {children}
      </div>
    );
  }
  return (
    <div className="relative flex h-svh w-full shrink-0 snap-start flex-col items-center justify-end bg-background px-8 pb-24 text-center">
      <Image src={photo} alt="" fill sizes="100vw" className="object-cover" priority />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
      <div className="relative">{children}</div>
    </div>
  );
}

function SlideCopy({ title, body, light = true }: { title: string; body: string; light?: boolean }) {
  return (
    <>
      <p className={`font-heading text-3xl font-semibold ${light ? "text-white" : "text-foreground"}`}>{title}</p>
      <p className={`mt-2 text-sm ${light ? "text-white/85" : "text-muted-foreground"}`}>{body}</p>
    </>
  );
}

function CtaScreen({ t, onSignIn }: { t: Dictionary["onboarding"]; onSignIn: () => void }) {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-6 px-8 text-center">
      <MindMark size="lg" />
      <p className="font-heading text-2xl font-semibold tracking-tight">{t.ctaTitle}</p>
      <div className="flex w-full max-w-xs flex-col items-center gap-3">
        <button
          type="button"
          onClick={onSignIn}
          className="w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          {t.continueWithGoogle}
        </button>
        <button type="button" onClick={onSignIn} className="text-sm text-muted-foreground underline">
          {t.alreadyHaveAccount}
        </button>
      </div>
    </div>
  );
}
