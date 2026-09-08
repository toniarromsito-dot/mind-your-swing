import Image from "next/image";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile-form";
import { signOutAction } from "@/actions/profile";
import { Button } from "@/components/ui/button";

export default async function ProfilePage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex items-center gap-4">
        {user.image && (
          <Image src={user.image} alt={user.name ?? ""} width={56} height={56} className="rounded-full" />
        )}
        <div>
          <h1 className="font-heading text-2xl">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <ProfileForm
        defaultName={user.name ?? ""}
        defaultHandicap={user.handicap}
        defaultCoachTone={user.coachTone}
        defaultLanguage={user.language}
      />

      <p className="text-xs text-muted-foreground">
        Mind Your Swing es un apoyo para el componente mental del golf y no sustituye la
        terapia psicológica profesional.
      </p>

      <form action={signOutAction} className="sm:hidden">
        <Button type="submit" variant="outline" className="w-full">
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
