"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";

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
  }, []);

  return null;
}
