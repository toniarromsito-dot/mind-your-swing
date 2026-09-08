"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // instalar como app es un extra, no algo crítico: fallo silencioso
      });
    }
  }, []);

  return null;
}
