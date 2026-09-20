"use client";

import { useState } from "react";
import { Browser } from "@capacitor/browser";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { buildInviteMessage, buildInviteUrl, buildWhatsAppShareUrl } from "@/lib/games/invite";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * "Invitar" desde el lobby: 3 acciones, nada más — WhatsApp primero (es lo
 * que todo el mundo usa para quedar), Compartir enlace (share nativo del
 * sistema si está disponible, con fallback a copiar) y Copiar enlace. Nada
 * de una pantalla llena de botones ni de un email que casi nadie usa aquí.
 */
export function InviteDrawer({
  inviteCode,
  course,
  layoutName,
  teeName,
  holesLabel,
  t,
}: {
  inviteCode: string;
  course: string;
  layoutName: string | null;
  teeName: string | null;
  holesLabel: string;
  t: Dictionary["lobby"];
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function buildUrl() {
    return buildInviteUrl(window.location.origin, inviteCode);
  }

  function buildMessage() {
    return buildInviteMessage(
      { course, layoutName, teeName },
      buildUrl(),
      { intro: t.inviteIntro, holesLabel, joinLabel: t.inviteJoinLabel }
    );
  }

  function copyLink() {
    navigator.clipboard
      .writeText(buildUrl())
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  function openWhatsapp() {
    // window.open() en la WebView nativa carga wa.me como una página web
    // dentro de la app en vez de abrir WhatsApp — Browser.open() (Chrome
    // Custom Tabs) sí respeta el enlace y cambia a WhatsApp de verdad si
    // está instalada; en la versión web hace un window.open normal.
    Browser.open({ url: buildWhatsAppShareUrl(buildMessage()) });
  }

  function shareLink() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      navigator.share({ text: buildMessage() }).catch(() => {});
      return;
    }
    // Sin share nativo del sistema (navegador de escritorio, WebView sin
    // soporte): copiar el enlace es un resultado siempre útil, nunca un
    // botón que no hace nada.
    copyLink();
  }

  const rowClass =
    "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium transition-colors hover:border-primary hover:bg-secondary/40";

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-8 w-fit gap-2 text-xs" onClick={() => setOpen(true)}>
        <Share2 className="size-3.5" />
        {t.invite}
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t.inviteTitle}</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-2 p-4">
            <button type="button" onClick={openWhatsapp} className={rowClass}>
              <MessageCircle className="size-4 text-primary" />
              {t.inviteWhatsapp}
            </button>
            <button type="button" onClick={shareLink} className={rowClass}>
              <Share2 className="size-4 text-primary" />
              {t.inviteShare}
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
