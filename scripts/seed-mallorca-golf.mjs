// Importador de la BASE DE CAMPOS REALES de golf — primera carga: Mallorca.
//
// Este script NO inventa ningún dato. En esta fase solo crea la identidad
// mínima verificada de cada campo (nombre exacto, isla, país) como una
// fila "esqueleto" de GolfCourse — sin recorridos, sin tees, sin hoyos,
// sin localidad, sin Course Rating/Slope: todo eso llega en la siguiente
// fase, campo a campo, contrastado contra la RFEG, y nunca copiado entre
// tees ni aproximado. Ver GolfCourseLayout/GolfCourseTee/GolfCourseTeeHole
// en prisma/schema.prisma para la estructura ya preparada para recibirlos.
//
// Idempotente: cada campo tiene un `slug` estable (identificador propio de
// este importador, no visible en la UI) usado como clave de upsert — volver
// a ejecutar este script no crea duplicados ni pisa datos ya cargados a
// mano (el upsert no tiene `update`, así que una fila existente se deja
// tal cual está, aunque este archivo cambie más adelante).
//
// Los campos de demostración que existían antes (scripts/seed-courses.mjs)
// ya se han retirado — /play/new usa directamente estos campos reales.
//
// Extensible: para Baleares/España/Europa/resto del mundo, se añade un
// nuevo array (o archivo) con la misma forma { slug, name, island, country }
// y se reutiliza upsertCourse() — no hace falta rehacer este mecanismo.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Los 20 campos indicados para la primera carga (nombre exacto tal cual se
// ha proporcionado). Cuando un club agrupa varios recorridos independientes
// (Santa Ponsa I/II/III, Son Antem Este/Oeste, los recorridos de Son
// Quint...), esta fase crea UNA sola fila por club — los recorridos se
// añadirán como GolfCourseLayout en la fase de datos verificados, nunca
// aquí, para no adivinar cuántos tiene cada uno ni cómo se llaman.
const MALLORCA_COURSES = [
  { slug: "alcanada", name: "Alcanada" },
  { slug: "golf-de-andratx", name: "Golf de Andratx" },
  { slug: "real-golf-de-bendinat", name: "Real Golf de Bendinat" },
  { slug: "capdepera-golf", name: "Capdepera Golf" },
  { slug: "canyamel-golf", name: "Canyamel Golf" },
  { slug: "golf-club-son-servera", name: "Golf Club Son Servera" },
  { slug: "golf-maioris", name: "Golf Maioris" },
  { slug: "golf-pollenca", name: "Golf Pollença" },
  { slug: "golf-santa-ponsa", name: "Golf Santa Ponsa" },
  { slug: "golf-son-gual", name: "Golf Son Gual" },
  { slug: "son-muntaner-golf", name: "Son Muntaner Golf" },
  { slug: "son-quint-golf", name: "Son Quint Golf" },
  { slug: "golf-son-termes", name: "Golf Son Termes" },
  { slug: "son-vida-club-de-golf", name: "Son Vida Club de Golf" },
  { slug: "palma-pitch-and-putt", name: "Palma Pitch & Putt" },
  { slug: "pula-golf-resort", name: "Pula Golf Resort" },
  { slug: "son-antem-golf-club", name: "Son Antem Golf Club" },
  { slug: "t-golf-calvia", name: "T Golf Calvià" },
  { slug: "t-golf-palma-puntiro", name: "T Golf Palma Puntiró" },
  { slug: "vall-dor-golf", name: "Vall d'Or Golf" },
];

// Clubes donde ya sabemos (por el propio encargo) que existe más de un
// recorrido/tee independiente — se deja constancia aquí para que la fase
// de datos verificados no se le olvide comprobarlo contra la RFEG antes de
// crear sus GolfCourseLayout, en vez de asumir cuántos son o cómo se llaman.
const KNOWN_MULTI_LAYOUT_SLUGS = new Set([
  "golf-santa-ponsa", // posibles recorridos I / II / III
  "son-antem-golf-club", // posibles recorridos Este / Oeste
  "son-quint-golf", // posibles varios recorridos
]);

async function upsertCourseShell({ slug, name }) {
  const existing = await prisma.golfCourse.findUnique({ where: { slug } });
  if (existing) return { name, status: "ya existía" };

  await prisma.golfCourse.create({
    data: {
      slug,
      name,
      island: "Mallorca",
      country: "España",
      // location, layouts, holes: deliberadamente sin rellenar en esta
      // fase — no hay ningún dato verificado todavía.
    },
  });
  return { name, status: "creado" };
}

async function main() {
  console.log(`Importando ${MALLORCA_COURSES.length} campos de Mallorca (solo identidad, sin recorridos/tees/hoyos todavía)...\n`);

  const results = [];
  for (const course of MALLORCA_COURSES) {
    results.push(await upsertCourseShell(course));
  }

  for (const r of results) {
    console.log(`  [${r.status === "creado" ? "OK" : "--"}] ${r.name} — ${r.status}`);
  }

  const createdCount = results.filter((r) => r.status === "creado").length;
  console.log(`\n${createdCount} campo(s) nuevo(s), ${results.length - createdCount} ya existente(s).`);

  console.log("\nPendiente para la siguiente fase (datos verificados contra la RFEG, uno a uno):");
  console.log("  - Localidad de cada campo (GolfCourse.location).");
  console.log("  - Recorrido(s), tee(s) y sus totales (par, distancia, Course Rating, Slope).");
  console.log("  - Detalle hoyo a hoyo (par, stroke index, distancia) por cada tee.");
  console.log("  - Confirmar cuántos recorridos independientes tienen realmente:");
  for (const slug of KNOWN_MULTI_LAYOUT_SLUGS) {
    const c = MALLORCA_COURSES.find((m) => m.slug === slug);
    console.log(`      · ${c.name}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
