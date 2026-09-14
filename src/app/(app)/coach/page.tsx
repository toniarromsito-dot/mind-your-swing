import { auth } from "@/lib/auth";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { getStandaloneMessages } from "@/lib/data/games";
import { CoachScreen } from "@/components/coach-screen";
import type { CoachTopic } from "@/components/coach-hub";
import { computeMentalScore, mentalStateFromScore, moodTrend } from "@/lib/mood";
import { getDictionary } from "@/lib/i18n/current-locale";

const MENTAL_SCORE_SAMPLE_SIZE = 14;

// 4 temas reales del juego mental (mismo contenido que Aprende), elegidos
// por ser los más "de coaching en el momento" — nunca duplicamos los 8,
// solo destacamos estos 4 aquí igual que hace Aprende con su cuadrícula.
const POPULAR_TOPIC_INDICES = [1, 0, 4, 2] as const; // rutina, presión, enfoque, errores

export default async function CoachPage() {
  const userId = await requireUserId();
  const session = await auth();
  const { t } = await getDictionary();
  const firstName = session?.user.name?.split(" ")[0] ?? "";

  const [user, messages, recentMoods] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    getStandaloneMessages(userId),
    prisma.moodEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: MENTAL_SCORE_SAMPLE_SIZE }),
  ]);

  const trend = moodTrend([...recentMoods].reverse(), {
    hole: t.summary.chartHole,
    checkin: t.summary.chartCheckin,
  });

  const mentalScore = computeMentalScore(recentMoods);
  const mentalState = mentalScore ? mentalStateFromScore(mentalScore.score) : null;

  // t.mind.greeting es una función — hay que resolverla aquí (Server
  // Component) y quitarla del objeto antes de pasarlo a componentes
  // cliente, que no pueden recibir funciones como prop.
  const greeting = t.mind.greeting(firstName);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se descarta a propósito: es una función, no se puede pasar a un Client Component
  const { greeting: _greetingFn, ...mindTSafe } = t.mind;

  const technicalCount = t.coach.topics.length - 8;
  const mentalTopics = t.coach.topics.slice(technicalCount);
  const topicCategories = [t.coach.categoryLabels.mental, t.home.pressureLabel, t.home.focusLabel, t.mind.resilienceLabel];
  const topicPhotos = [
    "/images/coach-topic-ball.jpg",
    "/images/coach-topic-swing.jpg",
    "/images/coach-topic-tree.jpg",
    "/images/coach-topic-cliff.jpg",
  ];
  const topics: CoachTopic[] = POPULAR_TOPIC_INDICES.map((topicIndex, i) => ({
    title: mentalTopics[topicIndex].title,
    body: mentalTopics[topicIndex].body,
    category: topicCategories[i],
    photo: topicPhotos[i],
  }));

  return (
    <CoachScreen
      greeting={greeting}
      photo="/images/coach-hero.jpg"
      mentalScore={mentalScore}
      mentalState={mentalState}
      topics={topics}
      quickPrompts={t.quickPrompts}
      initialMessages={messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
      coachTone={user.coachTone}
      moodTrendData={trend}
      hubT={mindTSafe}
      homeT={t.home}
      chatT={t.chat}
      mindT={mindTSafe}
      moodCheckinT={t.moodCheckin}
      moodLabels={t.mood}
      noMoodDataLabel={t.summary.noMoodData}
    />
  );
}
