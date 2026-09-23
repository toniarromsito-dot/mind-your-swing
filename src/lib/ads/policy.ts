/**
 * Fase 11F — política de ubicación de anuncios. Módulo puro (sin React, sin
 * Capacitor) a propósito: es la única fuente de verdad de "¿en qué pantalla
 * es seguro mostrar un banner?" y debe poder testearse sin montar nada.
 *
 * Allowlist, no denylist: por defecto NINGUNA ruta muestra anuncios. Solo
 * las 4 áreas explícitamente aprobadas los muestran. Esto garantiza que
 * Jugar (todo `/play/*`, incluido Focus Mode) y Coach (llamada de voz activa)
 * quedan sin ads por construcción, sin depender de una lista de exclusiones
 * que alguien podría olvidar actualizar al añadir una pantalla nueva.
 *
 * Nota de seguridad importante (no es solo un detalle de CSS): un banner
 * nativo de AdMob se dibuja por encima del WebView a nivel de sistema
 * operativo — el z-index/overlay de React (p. ej. el `fixed inset-0 z-40`
 * de Focus Mode en game-view.tsx) NO lo oculta. La única protección real es
 * no invocar nunca `showBanner()` fuera de esta allowlist.
 */

/** Coincidencia EXACTA de pathname — no prefijo, para no arrastrar
 *  subpáginas no revisadas (p. ej. /aprende/ejercicios/* son overlays
 *  inmersivos de respiración/visualización, no cubiertos por este MVP). */
export const AD_ALLOWED_PATHS: readonly string[] = ["/dashboard", "/community", "/aprende", "/insights"];

export function isAdEligiblePath(pathname: string): boolean {
  return AD_ALLOWED_PATHS.includes(pathname);
}

/**
 * Decisión final de "¿debe verse un banner ahora mismo?". `adFree` debe
 * venir siempre de una fuente server-side (hasProAccess()/canUseFeature()),
 * nunca de un valor que el cliente pueda fijar a su antojo.
 */
export function isAdEligible(pathname: string, adFree: boolean): boolean {
  return !adFree && isAdEligiblePath(pathname);
}

/**
 * Altura reservada para el banner, en px CSS — una aproximación razonable
 * (el tamaño estándar BannerAdSize.BANNER de AdMob es 320×50dp), no un valor
 * medido en dispositivo real (no es posible en este entorno). Sirve para
 * reservar espacio en el layout y evitar que el contenido salte al cargar
 * el anuncio real. Una futura iteración puede afinarlo escuchando
 * BannerAdPluginEvents.SizeChanged — fuera de alcance de este MVP.
 */
export const AD_BANNER_RESERVED_HEIGHT_PX = 60;

/** Altura aproximada de la barra de navegación inferior móvil (ver
 *  app-shell.tsx) — se usa como `margin` para que el banner nativo se
 *  dibuje POR ENCIMA de la barra, nunca tapándola. */
export const MOBILE_TAB_BAR_HEIGHT_PX = 64;
