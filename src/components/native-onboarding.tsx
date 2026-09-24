"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { MindMark } from "@/components/mind-mark";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import { signInWithApple, signInWithGoogle } from "@/actions/auth";
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
export function NativeOnboarding({ t, appleEnabled = false }: { t: Dictionary["onboarding"]; appleEnabled?: boolean }) {
  const [alreadyOnboarded, setAlreadyOnboarded] = useState<boolean | null>(null);
  const [isNative, setIsNative] = useState(false);
  const [platform, setPlatform] = useState<string>("web");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // localStorage y Capacitor.isNativePlatform() no existen/no son
    // fiables durante el render en servidor — leerlos aquí (no en el
    // cuerpo del componente) evita un mismatch de hidratación.
    let onboarded = false;
    try {
      onboarded = localStorage.getItem(ONBOARDED_KEY) === "1";
    } catch {
      // localStorage no disponible: se comporta como si fuera la primera vez
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con localStorage/Capacitor, no re-deriva estado de React
    setAlreadyOnboarded(onboarded);
    setIsNative(Capacitor.isNativePlatform());
    setPlatform(Capacitor.getPlatform());
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

  // Credential Manager nativo de Google (diálogo del sistema, sin
  // navegador) — se inicializa una vez en NativeAppInit. Si falla (sin
  // Google Play Services, error de red...) cae a la Custom Tab de siempre;
  // si el usuario simplemente cancela el diálogo, no se hace nada.
  async function signInNative() {
    // El SDK nativo de Google solo está inicializado en Android (ver
    // NativeAppInit). En iOS, SocialLogin.login("google") sin GIDClientID
    // lanza una NSException nativa que ningún try/catch de JS puede
    // capturar: la app se cierra. Allí se usa siempre el navegador in-app.
    if (Capacitor.getPlatform() !== "android") {
      Browser.open({ url: "https://mind-your-swing.vercel.app/mobile-login" });
      return;
    }
    setIsSigningIn(true);
    try {
      const { result } = await SocialLogin.login({ provider: "google", options: { scopes: ["email", "profile"] } });
      if (result.responseType !== "online" || !result.idToken) throw new Error("Sin idToken de Google");

      const res = await fetch("/api/mobile/google-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: result.idToken }),
      });
      if (!res.ok) throw new Error("El backend rechazó el idToken");

      window.location.href = "/dashboard";
    } catch (err) {
      setIsSigningIn(false);
      if ((err as { code?: string })?.code === "USER_CANCELLED") return;
      Browser.open({ url: "https://mind-your-swing.vercel.app/mobile-login" });
    }
  }

  // "Iniciar sesión con Apple" — obligatorio en la App Store (norma 4.8) al
  // ofrecer Google. En Android no aporta nada (y Google Play no lo pide).
  const showApple = appleEnabled && platform !== "android";

  // En la app, mismo circuito que el respaldo de Google: navegador in-app
  // → /mobile-login?provider=apple → /mobile-bridge → deep link de vuelta.
  function signInWithAppleNative() {
    Browser.open({ url: "https://mind-your-swing.vercel.app/mobile-login?provider=apple" });
  }

  const cta = (
    <CtaScreen
      t={t}
      isNative={isNative}
      isSigningIn={isSigningIn}
      onSignInNative={signInNative}
      showApple={showApple}
      onSignInAppleNative={signInWithAppleNative}
    />
  );

  if (alreadyOnboarded) {
    return cta;
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
        <Slide photo="/onboarding-hero.png" objectPosition="20% center">
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
          {cta}
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

function Slide({
  photo,
  objectPosition = "center",
  children,
}: {
  photo?: string;
  objectPosition?: string;
  children: React.ReactNode;
}) {
  if (!photo) {
    return (
      <div className="flex h-svh w-full shrink-0 snap-start flex-col items-center justify-center bg-background px-8 text-center">
        {children}
      </div>
    );
  }
  return (
    <div className="relative flex h-svh w-full shrink-0 snap-start flex-col items-center justify-end bg-background px-8 pb-24 text-center">
      <Image
        src={photo}
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
        style={{ objectPosition }}
        priority
      />
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

function CtaScreen({
  t,
  isNative,
  isSigningIn,
  onSignInNative,
  showApple,
  onSignInAppleNative,
}: {
  t: Dictionary["onboarding"];
  isNative: boolean;
  isSigningIn: boolean;
  onSignInNative: () => void;
  showApple: boolean;
  onSignInAppleNative: () => void;
}) {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-6 px-8 text-center">
      <MindMark size="lg" />
      <p className="font-heading text-2xl font-semibold tracking-tight">{t.ctaTitle}</p>
      <div className="flex w-full max-w-xs flex-col items-center gap-3">
        {showApple &&
          (isNative ? (
            <button type="button" onClick={onSignInAppleNative} disabled={isSigningIn} className={APPLE_BUTTON_CLASS}>
              <AppleLogo />
              {t.continueWithApple}
            </button>
          ) : (
            <form action={signInWithApple} className="w-full">
              <button type="submit" className={APPLE_BUTTON_CLASS}>
                <AppleLogo />
                {t.continueWithApple}
              </button>
            </form>
          ))}
        {isNative ? (
          <>
            <button
              type="button"
              onClick={onSignInNative}
              disabled={isSigningIn}
              className="w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {isSigningIn ? t.signingIn : t.continueWithGoogle}
            </button>
            <button
              type="button"
              onClick={onSignInNative}
              disabled={isSigningIn}
              className="text-sm text-muted-foreground underline disabled:opacity-60"
            >
              {t.alreadyHaveAccount}
            </button>
          </>
        ) : (
          <>
            {/* PWA/navegador normal (no WebView de Capacitor): login web de
                toda la vida, sin la Custom Tab que solo hace falta para
                esquivar el bloqueo de Google a WebViews. */}
            <form action={signInWithGoogle} className="w-full">
              <button
                type="submit"
                className="w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
              >
                {t.continueWithGoogle}
              </button>
            </form>
            <form action={signInWithGoogle}>
              <button type="submit" className="text-sm text-muted-foreground underline">
                {t.alreadyHaveAccount}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// Botón de Apple según sus Human Interface Guidelines: negro, logo de
// Apple, mismo tamaño que el de Google.
const APPLE_BUTTON_CLASS =
  "flex w-full items-center justify-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-medium text-white disabled:opacity-60";

function AppleLogo() {
  return (
    <svg viewBox="0 0 814 1000" aria-hidden className="size-4 fill-current">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
    </svg>
  );
}
