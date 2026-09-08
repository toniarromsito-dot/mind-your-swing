"use server";

import { revalidatePath } from "next/cache";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema, type ProfileInput } from "@/lib/validations";
import type { ActionState } from "./rounds";

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autenticado" };

  const raw: Record<string, unknown> = {
    name: formData.get("name") ?? undefined,
    handicap: formData.get("handicap") || undefined,
    coachTone: formData.get("coachTone") ?? undefined,
    language: formData.get("language") ?? undefined,
  };

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const data: ProfileInput = parsed.data;

  await prisma.user.update({
    where: { id: session.user.id },
    data,
  });

  // Revalida todo el árbol (no solo /perfil): un cambio de idioma afecta al
  // <html lang> y a los textos de todas las páginas, no solo a esta.
  revalidatePath("/", "layout");
  return undefined;
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
