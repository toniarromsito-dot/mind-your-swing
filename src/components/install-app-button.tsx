"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, Menu } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { MindMark } from "@/components/mind-mark";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// El texto del CTA vive en el diccionario (t.cta = "Instalar Mind Your
// Swing") precisamente para que, cuando publiquemos en las tiendas el mes
// que viene, cambiarlo a "Descargar en App Store" sea una edición de texto,
// no una reescritura de este componente.
type Platform = "ios" | "android-native" | "android-fallback" | "hidden";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const isIPhoneOrIPad = /iPad|iPhone|iPod/.test(navigator.userAgent);
  // iPadOS 13+ se identifica como "MacIntel" pero tiene pantalla táctil —
  // Safari de escritorio real no la tiene.
  const isIpadOs13Plus = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isIPhoneOrIPad || isIpadOs13Plus;
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/.test(navigator.userAgent);
}

/**
 * En Android/Chrome, un solo toque basta (evento beforeinstallprompt). En
 * iOS, Safari no expone ninguna API para instalar por JavaScript — es una
 * restricción de Apple, no nuestra: como mucho podemos guiar al usuario a
 * los toques nativos (Compartir → Añadir a pantalla de inicio → Añadir).
 * Si es Android pero el navegador no dispara beforeinstallprompt (criterios
 * de "instalabilidad" no cumplidos, u otro navegador que no sea Chrome),
 * mostramos igualmente el botón con instrucciones manuales en vez de
 * ocultarlo sin más.
 */
export function InstallAppButton({ t }: { t: Dictionary["landing"]["install"] }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("hidden");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    if (isIos()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- navigator.userAgent solo existe en cliente, no se puede derivar en el render inicial (SSR)
      setPlatform("ios");
      return;
    }

    if (isAndroid()) {
      setPlatform("android-fallback");
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android-native");
    }
    function onAppInstalled() {
      setDeferredPrompt(null);
      setPlatform("hidden");
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (platform === "hidden") return null;

  async function handleClick() {
    if (platform === "android-native" && deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === "accepted") {
        setPlatform("hidden");
        return;
      }
    }
    setSheetOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex h-12 items-center gap-2.5 rounded-full border border-neutral-700 px-6 text-sm font-semibold tracking-wide text-neutral-100 uppercase transition-colors hover:border-neutral-500"
      >
        <Download className="size-4" />
        {t.cta}
      </button>

      <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
        <DrawerContent>
          <DrawerHeader className="items-center text-center">
            <MindMark size="lg" />
            <DrawerTitle className="mt-2 text-xl">{t.sheetTitle}</DrawerTitle>
            <p className="text-sm font-medium text-primary">{t.sheetSubtitle}</p>
          </DrawerHeader>
          <div className="flex flex-col gap-5 px-4 pb-6">
            <p className="text-center text-sm text-muted-foreground">
              {platform === "ios" ? t.sheetBody : t.androidFallbackBody}
            </p>

            {platform === "ios" ? (
              <>
                <InstallStep icon={Share} label={t.iosStep1} />
                <InstallStep icon={SquarePlus} label={t.iosStep2} />
                <InstallStep icon={Download} label={t.iosStep3} />
              </>
            ) : (
              <InstallStep icon={Menu} label={t.androidFallbackStep} />
            )}

            <Button onClick={() => setSheetOpen(false)}>{t.gotIt}</Button>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="text-center text-xs text-muted-foreground underline underline-offset-4"
            >
              {t.secondaryCta}
            </button>
            <p className="text-center text-[11px] text-muted-foreground/70">{t.comingSoonNote}</p>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function InstallStep({ icon: Icon, label }: { icon: typeof Share; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <p className="text-sm">{label}</p>
    </div>
  );
}
