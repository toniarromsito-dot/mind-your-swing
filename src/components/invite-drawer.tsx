"use client";

import { useState } from "react";
import { Browser } from "@capacitor/browser";
import { Check, Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * "Invitar" no puede ser solo copiar el enlace en silencio (el jugador no
 * sabe que ha pasado nada) — aquí se ve exactamente a dónde va: WhatsApp,
 * email o copiar el enlace con confirmación visible. Si el navegador
 * soporta el share nativo del sistema (más apps, no solo estas dos), se
 * ofrece también como primera opción.
 */
export function InviteDrawer({
  inviteCode,
  course,
  t,
}: {
  inviteCode: string;
  course: string;
  t: Dictionary["lobby"];
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  function buildUrl() {
    return `${window.location.origin}/play/join/${inviteCode}`;
  }

  function buildMessage() {
    return fmt(t.inviteMessage, { course, url: buildUrl() });
  }

  function openDrawer() {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    setOpen(true);
  }

  function shareNative() {
    navigator.share({ text: buildMessage() }).catch(() => {});
  }

  function openWhatsapp() {
    // window.open() en la WebView nativa carga wa.me como una página web
    // dentro de la app en vez de abrir WhatsApp — Browser.open() (Chrome
    // Custom Tabs) sí respeta el enlace de la app y cambia a WhatsApp de
    // verdad si está instalada; en la versión web hace un window.open normal.
    Browser.open({ url: `https://wa.me/?text=${encodeURIComponent(buildMessage())}` });
  }

  function openEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(t.inviteEmailSubject)}&body=${encodeURIComponent(buildMessage())}`;
  }

  function copyLink() {
    navigator.clipboard.writeText(buildUrl()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const rowClass =
    "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium transition-colors hover:border-primary hover:bg-secondary/40";

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-8 w-fit gap-2 text-xs" onClick={openDrawer}>
        <Share2 className="size-3.5" />
        {t.invite}
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t.inviteTitle}</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-2 p-4">
            {canShare && (
              <button type="button" onClick={shareNative} className={rowClass}>
                <Share2 className="size-4 text-primary" />
                {t.inviteShare}
              </button>
            )}
            <button type="button" onClick={openWhatsapp} className={rowClass}>
              <MessageCircle className="size-4 text-primary" />
              {t.inviteWhatsapp}
            </button>
            <button type="button" onClick={openEmail} className={rowClass}>
              <Mail className="size-4 text-primary" />
              {t.inviteEmail}
            </button>
            <button type="button" onClick={copyLink} className={rowClass}>
              {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4 text-primary" />}
              {copied ? t.inviteCopied : t.inviteCopyLink}
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
