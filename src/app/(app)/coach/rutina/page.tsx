import { requireUserId } from "@/lib/require-user";
import { PreShotRoutine } from "@/components/pre-shot-routine";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function PreShotRoutinePage() {
  await requireUserId();
  const { t } = await getDictionary();
  return <PreShotRoutine t={t.preShotRoutine} />;
}
