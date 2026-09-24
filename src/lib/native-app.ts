import { headers } from "next/headers";

/**
 * Marca que el shell nativo (iOS/Android) añade a su User-Agent — ver
 * `appendUserAgent` en capacitor.config.ts. Así el SERVIDOR sabe que la
 * página se va a pintar dentro de la app, sin esperar a que el cliente
 * compruebe Capacitor.isNativePlatform() (lo que haría parpadear en
 * pantalla, aunque fuera un instante, lo que no debe verse ahí).
 */
export const NATIVE_APP_USER_AGENT_MARKER = "MindYourSwingApp";

export function isNativeAppUserAgent(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent?.includes(NATIVE_APP_USER_AGENT_MARKER));
}

/**
 * true si la petición viene de la app nativa. Uso principal: la App Store
 * (norma 3.1.1) y Google Play exigen que el contenido digital se compre
 * con su propio sistema de pagos, así que dentro de la app nunca se
 * muestran los botones de Stripe (checkout, portal, pack de Voice) ni
 * enlaces que lleven a ellos.
 */
export async function isNativeAppRequest(): Promise<boolean> {
  return isNativeAppUserAgent((await headers()).get("user-agent"));
}
