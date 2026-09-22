import { CloudOff, RefreshCw, AlertCircle } from "lucide-react";
import type { SyncUxStatus } from "@/lib/offline/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Indicación discreta de estado de sincronización durante Focus Mode —
 * Bloque 8/14. Nunca un banner grande: la información principal sigue
 * siendo HOYO/PAR/GOLPES. "online"/"synced" (todo al día, sin nada
 * pendiente) no muestran nada — solo se hace visible cuando hay algo que
 * contar.
 */
export function OfflineStatusBadge({ status, t }: { status: SyncUxStatus; t: Dictionary["playGame"] }) {
  if (status === "online" || status === "synced") return null;

  const config =
    status === "offline"
      ? { Icon: CloudOff, label: t.offlineOffline, spin: false }
      : status === "syncing"
        ? { Icon: RefreshCw, label: t.offlineSyncing, spin: true }
        : { Icon: AlertCircle, label: t.offlinePending, spin: false };

  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] text-white backdrop-blur-sm">
      <config.Icon className={`size-3 ${config.spin ? "animate-spin" : ""}`} />
      {config.label}
    </span>
  );
}
