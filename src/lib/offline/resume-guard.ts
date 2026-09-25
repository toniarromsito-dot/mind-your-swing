import type { ConnectivityState } from "./connectivity";

/**
 * Fase 12E — regla de protección extraída de NativeAppInit para poder
 * testearla sin Capacitor: al volver de segundo plano en modo remoto se
 * recarga la página (ver NativeAppInit) salvo que haya una partida local
 * activa Y no haya conectividad real — en ese caso recargar perdería el
 * Focus Mode en curso sin poder volver a traer la página remota. Fuera de
 * ese caso concreto, se recarga siempre.
 */
export function shouldSkipReloadOnResume(
  activeGameId: string | null,
  connectivity: ConnectivityState
): boolean {
  return activeGameId !== null && connectivity === "offline";
}
