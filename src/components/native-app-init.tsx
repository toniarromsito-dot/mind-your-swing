"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { App } from "@capacitor/app";
import { SocialLogin } from "@capgo/capacitor-social-login";

const PROD_ORIGIN = "https://mind-your-swing.vercel.app";

/**
 * Solo hace algo dentro del shell nativo (iOS/Android) generado por
 * Capacitor. En la web (navegador o PWA instalada) Capacitor.isNativePlatform()
 * es false y este componente no hace nada — la web sigue exactamente igual.
 */
export function NativeAppInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    if (Capacitor.getPlatform() === "android") {
      StatusBar.setBackgroundColor({ color: "#1F3D2B" }).catch(() => {});
      // Credential Manager nativo de Google (ver native-onboarding.tsx): se
      // inicializa una vez aquí, no en cada intento de login. Usa el mismo
      // Client ID "Web" que ya usa NextAuth (GOOGLE_CLIENT_ID) — Google
      // exige además un OAuth Client de tipo Android (paquete + SHA-1) dado
      // de alta en el mismo proyecto de Cloud Console, aunque ese client ID
      // nunca se referencia aquí directamente.
      SocialLogin.initialize({ google: { webClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID } }).catch(() => {});
    }
    SplashScreen.hide().catch(() => {});

    // Si Credential Manager falla (p. ej. sin Google Play Services), el
    // login cae a una Custom Tab que redirige a
    // mindyourswing://auth-callback?token=... — este listener recoge ese
    // token y lo canjea por la sesión real dentro del propio WebView.
    const listener = App.addListener("appUrlOpen", ({ url }) => {
      try {
        const parsed = new URL(url);
        if (parsed.hostname !== "auth-callback" && !parsed.pathname.includes("auth-callback")) return;
        const token = parsed.searchParams.get("token");
        if (token) window.location.href = `${PROD_ORIGIN}/api/mobile/session?token=${token}`;
      } catch {
        // URL de deep link con formato inesperado: se ignora.
      }
    });

    return () => {
      listener.then((handle) => handle.remove());
    };
  }, []);

  return null;
}
