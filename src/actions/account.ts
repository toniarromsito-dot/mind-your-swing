"use server";

import { cookies } from "next/headers";
import { del } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getDictionary } from "@/lib/i18n/current-locale";

export type DeleteAccountState = { error?: string; deleted?: boolean } | undefined;

// Estados en los que Stripe seguiría cobrando si no se cancela antes de
// borrar la cuenta — nunca se deja a alguien pagando por una cuenta que ya
// no existe.
const BILLABLE_STRIPE_STATUSES = new Set(["ACTIVE", "TRIALING", "PAST_DUE", "INCOMPLETE"]);

/**
 * Borrado de cuenta desde la propia app — obligatorio en la App Store
 * (norma 5.1.1(v)) para cualquier app que permita crear cuenta.
 *
 * Orden deliberado:
 *   1. Cancelar la suscripción de Stripe (si la hay). Si falla, NO se
 *      borra nada: mejor que el usuario lo reintente que dejarle pagando.
 *   2. Borrar los vídeos de swing de Vercel Blob (best-effort — un fichero
 *      huérfano no debe impedir el borrado de la cuenta).
 *   3. Borrar el User: todo lo demás (sesiones, partidas, mensajes, vídeos,
 *      suscripciones, créditos...) cuelga de él con onDelete: Cascade.
 *
 * Las suscripciones de App Store / Google Play (RevenueCat) no se pueden
 * cancelar desde el servidor — solo el propio usuario desde los ajustes de
 * su tienda; la pantalla se lo avisa antes de confirmar.
 */
export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const { t } = await getDictionary();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: t.perfil.deleteAccountError };

  // Confirmación explícita escrita — un toque accidental nunca borra nada.
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== t.perfil.deleteAccountConfirmWord.toUpperCase()) {
    return { error: t.perfil.deleteAccountConfirmMismatch };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptions: { select: { provider: true, status: true, providerSubscriptionId: true } },
      swingVideos: { select: { videoUrl: true } },
    },
  });
  if (!user) return { deleted: true };

  const billableStripe = user.subscriptions.filter(
    (s) => s.provider === "STRIPE" && s.providerSubscriptionId && BILLABLE_STRIPE_STATUSES.has(s.status)
  );
  if (billableStripe.length > 0) {
    // Para cancelar basta la clave secreta (isStripeConfigured() exige además
    // los Price IDs, que aquí no importan).
    if (!process.env.STRIPE_SECRET_KEY) return { error: t.perfil.deleteAccountError };
    try {
      for (const sub of billableStripe) {
        await stripe.subscriptions.cancel(sub.providerSubscriptionId!);
      }
    } catch (err) {
      console.error(`Borrado de cuenta: no se ha podido cancelar la suscripción de Stripe del usuario ${userId}.`, err);
      return { error: t.perfil.deleteAccountError };
    }
  }

  const videoUrls = user.swingVideos.map((v) => v.videoUrl).filter(Boolean);
  if (videoUrls.length > 0) {
    try {
      await del(videoUrls);
    } catch (err) {
      console.error(`Borrado de cuenta: no se han podido borrar los vídeos de Blob del usuario ${userId}.`, err);
    }
  }

  await prisma.user.delete({ where: { id: userId } });

  // La fila Session ya no existe (cascade); se quita también la cookie para
  // que el navegador/WebView no siga enviando un token muerto.
  const cookieStore = await cookies();
  cookieStore.delete("__Secure-authjs.session-token");
  cookieStore.delete("authjs.session-token");

  return { deleted: true };
}
