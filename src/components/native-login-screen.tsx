"use client";

import Image from "next/image";
import { Browser } from "@capacitor/browser";

/**
 * Único punto donde la app nativa dispara el login: abre /mobile-login en
 * una Custom Tab a propósito (Browser.open), en vez de dejar que el
 * WebView intente el login de Google y lo rompa a medias. Ver
 * NativeAppInit para el listener que recoge la vuelta.
 */
export function NativeLoginScreen({ signInLabel }: { signInLabel: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <Image src="/icons/icon-192.png" alt="Mind Your Swing" width={72} height={72} className="rounded-2xl" />
      <p className="font-heading text-2xl font-semibold tracking-tight">Mind Your Swing</p>
      <button
        type="button"
        onClick={() => Browser.open({ url: "https://mind-your-swing.vercel.app/mobile-login" })}
        className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        {signInLabel}
      </button>
    </div>
  );
}
