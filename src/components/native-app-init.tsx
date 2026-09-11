"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { App } from "@capacitor/app";

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
    }
    SplashScreen.hide().catch(() => {});

    // El login de Google ocurre en una Custom Tab (ver
    // native-login-screen.tsx), que al terminar redirige a
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
