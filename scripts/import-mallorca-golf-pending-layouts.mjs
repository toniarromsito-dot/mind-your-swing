// Segunda tanda de datos verificados de Mallorca — completa los 3
// recorridos que se dejaron pendientes en la primera carga
// (scripts/import-mallorca-golf-verified.mjs): Santa Ponsa II, Santa
// Ponsa III y Palma Pitch & Putt.
//
// Fuente: scripts/data/mallorca-golf-pending-layouts.json — cada tee
// incluye sus propias `sources` (URLs) en el propio archivo. No se ha
// buscado ni completado ningún dato por fuera de este archivo: los
// valores (par, distancia, Course Rating, Slope, hoyo a hoyo) se cargan
// tal cual vienen.
//
// Formato de hoyo en este dataset: cada hoyo es un array compacto
// [number, handicap, par, distance_m] (no un objeto, a diferencia del
// dataset de la primera carga) — verificado por consistencia interna
// antes de escribir este importador: la suma de `par`/`distance_m` de
// cada tee coincide exactamente con su `par_total`/`distance_total_m`
// declarado, y los valores de `handicap` de cada tee forman el reparto
// esperado (1..N para 18/9 hoyos "normales"; impares 1-17 para el
// reparto de Palma Pitch & Putt, que es el convenio real de la RFEG/
// FBGolf para un recorrido de 9 hoyos con equivalencia a 18).
//
// Palma Pitch & Putt publica el mismo nombre de tee ("VERDES") con dos
// valoraciones oficiales distintas por categoría (Hombres/Mujeres) — de
// ahí que GolfCourseTee distinga por (layoutId, name, category), no solo
// por nombre (ver migración golf_course_tee_unique_category).
//
// Idempotente: mismo criterio que el importador anterior — si el
// recorrido o el tee ya existen, no se vuelven a crear ni se tocan sus
// hoyos.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "data", "mallorca-golf-pending-layouts.json");

// course_name del dataset -> slug de GolfCourse ya existente.
const COURSE_NAME_TO_SLUG = {
  "Golf Santa Ponsa": "golf-santa-ponsa",
  "Palma Pitch & Putt": "palma-pitch-and-putt",
};

async function importLayout(layoutEntry) {
  const courseSlug = COURSE_NAME_TO_SLUG[layoutEntry.course_name];
  if (!courseSlug) {
    return [{ status: `OMITIDO (course_name sin mapeo: "${layoutEntry.course_name}")` }];
  }

  const course = await prisma.golfCourse.findUnique({ where: { slug: courseSlug } });
  if (!course) {
    return [{ status: `OMITIDO (no existe GolfCourse con slug "${courseSlug}")` }];
  }

  if (!course.location && layoutEntry.municipality) {
    await prisma.golfCourse.update({ where: { id: course.id }, data: { location: layoutEntry.municipality } });
  }

  let layout = await prisma.golfCourseLayout.findUnique({
    where: { courseId_name: { courseId: course.id, name: layoutEntry.layout_name } },
  });
  if (!layout) {
    layout = await prisma.golfCourseLayout.create({
      data: { courseId: course.id, name: layoutEntry.layout_name, holeCount: layoutEntry.holes },
    });
  }

  const results = [];
  for (const t of layoutEntry.tees) {
    // findUnique con el índice compuesto no acepta `category: null`
    // (limitación de Prisma con columnas nullable en una unique compuesta)
    // — findFirst con los mismos 3 campos sí funciona igual con null.
    const existingTee = await prisma.golfCourseTee.findFirst({
      where: { layoutId: layout.id, name: t.name, category: t.category ?? null },
    });
    if (existingTee) {
      results.push({
        course: course.name,
        layout: layoutEntry.layout_name,
        tee: t.name,
        category: t.category,
        status: "ya existía",
      });
      continue;
    }

    const tee = await prisma.golfCourseTee.create({
      data: {
        layoutId: layout.id,
        name: t.name,
        category: t.category ?? null,
        parTotal: t.par_total ?? null,
        distanceTotal: t.distance_total_m ?? null,
        courseRating: t.course_rating ?? null,
        slope: t.slope ?? null,
      },
    });

    // Cada hoyo es [number, handicap, par, distance_m] — ver cabecera.
    for (const [number, handicap, par, distanceM] of t.holes) {
      await prisma.golfCourseTeeHole.create({
        data: {
          teeId: tee.id,
          number,
          index: handicap ?? null,
          par: par ?? null,
          distance: distanceM ?? null,
        },
      });
    }

    results.push({
      course: course.name,
      layout: layoutEntry.layout_name,
      tee: t.name,
      category: t.category,
      status: "creado",
      holes: t.holes.length,
    });
  }
  return results;
}

async function main() {
  const dataset = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  console.log(`Dataset: ${dataset.dataset} (${dataset.version}) — ${dataset.layouts.length} recorrido(s) pendientes.\n`);

  const allResults = [];
  for (const layoutEntry of dataset.layouts) {
    allResults.push(...(await importLayout(layoutEntry)));
  }

  for (const r of allResults) {
    const tag = r.status === "creado" ? "OK" : r.status === "ya existía" ? "--" : "!!";
    console.log(`  [${tag}] ${(r.course ?? "?").padEnd(20)} | ${(r.layout ?? "-").padEnd(16)} | ${(r.tee ?? "-").padEnd(10)} ${r.category ? "(" + r.category + ")" : ""} | ${r.status}`);
  }

  const created = allResults.filter((r) => r.status === "creado").length;
  const skipped = allResults.filter((r) => r.status.startsWith("OMITIDO")).length;
  console.log(`\n${created} tee(s) nuevo(s), ${allResults.length - created - skipped} ya existían, ${skipped} omitido(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
