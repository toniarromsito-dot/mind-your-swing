"use client";

import { useEffect, useState } from "react";
import { Network } from "@capacitor/network";

/**
 * Detección de conectividad — Bloque 2/13. El audit confirmó que el
 * proyecto no tenía ningún mecanismo propio y que `navigator.onLine` da
 * falsos positivos. `@capacitor/network` es la pieza correcta: en nativo
 * usa el estado real del sistema operativo; en web (navegador/PWA) su
 * propia implementación cae a `navigator.onLine` + eventos `online`/
 * `offline` — un único API para ambos, sin tener que ramificar nosotros
 * mismos nativo/web.
 *
 * IMPORTANTE (ver audit, sección 13): esto es una SEÑAL para la UX, nunca
 * una garantía de que una petición concreta vaya a funcionar — cada
 * llamada de sincronización comprueba su propio resultado real, nunca
 * asume éxito solo porque este estado diga "online".
 */

export type ConnectivityState = "online" | "offline";

export async function getConnectivity(): Promise<ConnectivityState> {
  try {
    const status = await Network.getStatus();
    return status.connected ? "online" : "offline";
  } catch {
    // Si el propio plugin fallara por algún motivo, ser conservador: mejor
    // tratarlo como "puede que offline" (dispara reintentos más adelante)
    // que asumir online y arriesgar otro intento fallido silencioso.
    return "offline";
  }
}

export function useConnectivity(): ConnectivityState {
  const [state, setState] = useState<ConnectivityState>("online");

  useEffect(() => {
    let mounted = true;
    getConnectivity().then((s) => {
      if (mounted) setState(s);
    });

    const listenerPromise = Network.addListener("networkStatusChange", (status) => {
      setState(status.connected ? "online" : "offline");
    });

    return () => {
      mounted = false;
      listenerPromise.then((handle) => handle.remove()).catch(() => {});
    };
  }, []);

  return state;
}
