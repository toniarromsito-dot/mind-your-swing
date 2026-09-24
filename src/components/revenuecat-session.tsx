"use client";

import { useEffect } from "react";
import { configureAndLoginRevenueCat } from "@/lib/revenuecat-client";

/**
 * Fase 12C — identifica al SDK de RevenueCat con el User.id real de MYS en
 * cuanto hay una sesión autenticada confirmada server-side (nunca antes,
 * nunca con un id anónimo). No renderiza nada — es un servicio, igual que
 * AdBanner en 11F. En web/sin API key configurada no hace nada
 * (configureAndLoginRevenueCat ya comprueba Capacitor.isNativePlatform()
 * e isRevenueCatClientConfigured() internamente).
 */
export function RevenueCatSession({ userId }: { userId: string }) {
  useEffect(() => {
    configureAndLoginRevenueCat(userId);
  }, [userId]);

  return null;
}
