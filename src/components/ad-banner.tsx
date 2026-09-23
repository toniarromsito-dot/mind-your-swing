"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { AdMob, BannerAdPosition, BannerAdSize } from "@capacitor-community/admob";
import { isAdEligible, MOBILE_TAB_BAR_HEIGHT_PX } from "@/lib/ads/policy";
import { bannerAdUnitId, isAdMobConfigured } from "@/lib/ads/config";

// Módulo, no estado de componente: AdBanner es un servicio persistente
// montado UNA VEZ en AppShell (no se remonta al navegar) — este flag evita
// llamar AdMob.initialize() más de una vez durante la vida de la app.
let admobInitialized = false;

/**
 * Solo para tests: el flag vive en memoria del módulo, así que sin esto un
 * test que monta AdBanner varias veces (para probar distintos escenarios de
 * initialize()) heredaría el estado "ya inicializado" del test anterior —
 * mismo patrón que resetRateLimitsForTests() en src/lib/rate-limit.ts.
 * Nunca se llama desde código de producción.
 */
export function resetAdMobInitStateForTests(): void {
  admobInitialized = false;
}

/**
 * Fase 11F — servicio de banner de AdMob. No renderiza nada visible (el
 * banner nativo se dibuja por el SO por encima del WebView, no como un
 * elemento del DOM) — solo decide, en cada navegación, si debe mostrarse u
 * ocultarse, y hace la llamada nativa correspondiente.
 *
 * `adFree` DEBE venir siempre de una fuente server-side (hasProAccess()/
 * canUseFeature(user, "AD_FREE") en (app)/layout.tsx) — este componente
 * nunca decide por sí mismo si el usuario es Pro, solo obedece el valor que
 * recibe. Igual de importante: en web (o si @capacitor-community/admob no
 * está configurado), nunca se llama al SDK nativo — el propio plugin además
 * trae un fallback web sin-op seguro (ver dist/esm/web.js del paquete), así
 * que esto es doble cinturón de seguridad, no la única protección.
 */
export function AdBanner({ adFree, hasBottomNav }: { adFree: boolean; hasBottomNav: boolean }) {
  const pathname = usePathname();
  const shownRef = useRef(false);

  const eligible = isAdEligible(pathname, adFree) && Capacitor.isNativePlatform() && isAdMobConfigured();

  useEffect(() => {
    if (!eligible) {
      if (shownRef.current) {
        shownRef.current = false;
        AdMob.removeBanner().catch(() => {
          // best-effort: si falla, en el peor caso un banner obsoleto se
          // queda visible hasta la próxima transición — nunca rompe la app.
        });
      }
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        if (!admobInitialized) {
          await AdMob.initialize();
          admobInitialized = true;
        }
        if (cancelled) return;
        await AdMob.showBanner({
          adId: bannerAdUnitId()!,
          adSize: BannerAdSize.BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          // El banner se dibuja POR ENCIMA de la barra de navegación móvil
          // (nunca la tapa) cuando la pantalla actual tiene esa barra.
          margin: hasBottomNav ? MOBILE_TAB_BAR_HEIGHT_PX : 0,
        });
        shownRef.current = true;
      } catch (err) {
        // El SDK publicitario nunca debe tumbar la app — sin red, sin
        // fill de anuncio, SDK no instalado en ese build nativo, etc.
        console.error("AdMob: no se ha podido mostrar el banner", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eligible, hasBottomNav]);

  // Limpieza si el propio AdBanner llegara a desmontarse (no ocurre en uso
  // normal, ya que vive en AppShell durante toda la sesión de la app).
  useEffect(() => {
    return () => {
      if (shownRef.current) {
        AdMob.removeBanner().catch(() => {});
      }
    };
  }, []);

  return null;
}
