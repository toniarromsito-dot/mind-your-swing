import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Las páginas bajo (app) ya están protegidas por el layout, pero una
 * sesión puede expirar entre el guard del layout y el render de la
 * página (revalidación, HMR, carrera de cookies). En vez de asumir que
 * `session.user` existe y arriesgar un TypeError, se vuelve a comprobar
 * aquí y se redirige con gracia si ya no hay sesión.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return session.user.id;
}
