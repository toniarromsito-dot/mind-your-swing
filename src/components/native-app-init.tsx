"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { App } from "@capacitor/app";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { handleAndroidBackButton } from "@/lib/native/back-button";

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
    const urlListener = App.addListener("appUrlOpen", ({ url }) => {
      try {
        const parsed = new URL(url);
        if (parsed.hostname !== "auth-callback" && !parsed.pathname.includes("auth-callback")) return;
        const token = parsed.searchParams.get("token");
        if (token) window.location.href = `${PROD_ORIGIN}/api/mobile/session?token=${token}`;
      } catch {
        // URL de deep link con formato inesperado: se ignora.
      }
    });

    // Modo remoto: el WebView no lleva la web empaquetada, así que un
    // despliegue nuevo no llega solo — si el usuario nunca cierra la app
    // del todo (lo normal: la deja en segundo plano), sigue viendo el
    // JS/HTML que cargó la última vez que la abrió, aunque haya pasado
    // días. Recargar al volver de segundo plano (nunca en el arranque en
    // frío, solo en una reanudación real) hace que cada apertura traiga
    // siempre la versión desplegada actual, sin depender de que fuerce el
    // cierre de la app manualmente.
    let hasBackgrounded = false;
    const stateListener = App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        hasBackgrounded = true;
        return;
      }
      if (hasBackgrounded) {
        window.location.reload();
      }
    });

    // Botón/gesto atrás de Android — un único listener global para toda
    // la app (ver back-button.ts: registrarlo por pantalla dejaría el
    // atrás muerto en el resto de la app en cuanto esa pantalla lo
    // quitase). Las pantallas que necesitan interceptarlo (hoy, Focus
    // Mode) registran su propio handler ahí, nunca aquí directamente.
    const backButtonListener = Capacitor.getPlatform() === "android"
      ? App.addListener("backButton", ({ canGoBack }) => {
          handleAndroidBackButton(canGoBack, {
            goBack: () => window.history.back(),
            exitApp: () => {
              App.exitApp().catch(() => {});
            },
          });
        })
      : null;

    return () => {
      urlListener.then((handle) => handle.remove());
      stateListener.then((handle) => handle.remove());
      backButtonListener?.then((handle) => handle.remove());
    };
  }, []);

  return null;
}
