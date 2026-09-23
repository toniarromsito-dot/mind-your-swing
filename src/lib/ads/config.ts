import { Capacitor } from "@capacitor/core";

/**
 * Fase 11F — configuración de AdMob leída de env vars públicas
 * (NEXT_PUBLIC_*). Los Ad Unit ID de AdMob NO son secretos — Google los
 * diseña para ir embebidos en el binario/bundle del cliente (a diferencia
 * de una API key privada) — así que exponerlos vía NEXT_PUBLIC_ es correcto,
 * no un fallo de seguridad. Lo que SÍ falta y no se puede resolver aquí: el
 * AdMob App ID de cada plataforma vive únicamente en AndroidManifest.xml /
 * Info.plist (configuración nativa, fuera del alcance de este módulo), y
 * NO se ha rellenado en este MVP — ver README/informe de la fase.
 *
 * Funciones (no constantes de módulo), mismo patrón que isVoicePackConfigured()
 * en src/lib/stripe.ts: leer process.env en cada llamada evita depender del
 * orden de evaluación de módulos, importante sobre todo en tests.
 */
export function bannerAdUnitId(): string | undefined {
  if (Capacitor.getPlatform() === "ios") return process.env.NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_IOS;
  if (Capacitor.getPlatform() === "android") return process.env.NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_ANDROID;
  return undefined;
}

/**
 * false hasta que exista un Ad Unit ID real para la plataforma actual. Con
 * esto en false, AdBanner nunca llama a AdMob.initialize()/showBanner() —
 * evita cualquier riesgo de crash nativo por un AndroidManifest/Info.plist
 * sin el App ID real configurado todavía.
 */
export function isAdMobConfigured(): boolean {
  return Boolean(bannerAdUnitId());
}
